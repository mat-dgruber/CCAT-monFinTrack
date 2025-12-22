import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';

// PrimeNG
import { TabsModule, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';

import { DebtService } from '../../services/debt.service';
import { Debt, PaymentPlan, AmortizationSystem } from '../../models/debt.model';

@Component({
  selector: 'app-debt-planner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,TabList, Tab, TabPanels, TabPanel,
    ButtonModule,
    TableModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectButtonModule,
    SelectModule,
    RadioButtonModule,
    FileUploadModule,
    ProgressSpinnerModule,
    TooltipModule,
    ConfirmDialogModule,
    DividerModule,
    SkeletonModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './debt-planner.html',
  styleUrl: './debt-planner.scss'
})
export class DebtPlannerComponent implements OnInit {
  private debtService = inject(DebtService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  activeIndex = signal(0);
  debts = signal<Debt[]>([]);
  loading = signal(false);

  // FORM
  debtDialog = false;
  submitted = false;
  currentDebtId: string | null = null;

  debtForm = this.fb.group({
      name: ['', Validators.required],
      debt_type: ['credit_card_rotating', Validators.required],
      total_amount: [0, [Validators.required, Validators.min(0.01)]],
      interest_rate: [0, [Validators.required, Validators.min(0)]],
      interest_period: ['monthly', Validators.required],
      minimum_payment: [0],
      due_day: [null],
      contract_file_path: [''] // Hidden or handled via upload separately (Premium)
  });

  debtTypes = [
      { label: 'Cartão (Rotativo)', value: 'credit_card_rotating' },
      { label: 'Cartão (Parcelado)', value: 'credit_card_installment' },
      { label: 'Cheque Especial', value: 'overdraft' },
      { label: 'Empréstimo Pessoal', value: 'personal_loan' },
      { label: 'Financ. Imóvel', value: 'real_estate_financing' },
      { label: 'Financ. Veículo', value: 'vehicle_financing' },
      { label: 'Consignado', value: 'consigned_credit' },
      { label: 'Outro', value: 'other' }
  ];

  // PLANNER
  monthlyBudget = 1000;
  selectedStrategy: 'snowball' | 'avalanche' = 'snowball';
  strategies = [
      { name: 'Bola de Neve', value: 'snowball' },
      { name: 'Avalanche', value: 'avalanche' }
  ];
  paymentPlan = signal<PaymentPlan | null>(null);
  simulating = signal(false);

  // HOUSING SIMULATOR
  housingIncome = 3000;
  housingValue = 200000;
  housingEntry = 40000;
  housingRate = 0;
  housingProgram = '';
  housingSystem: AmortizationSystem = AmortizationSystem.SAC; // SAC or PRICE
  housingResult: any = null;
  housingSimulating = false;

  // ADVICE
  adviceDialog = false;
  adviceResult = signal<string>('');
  adviceLoading = signal(false);

  // DOCUMENT ANALYSIS (Legacy/Upload)
  analyzing = false;

  ngOnInit() {
    this.loadDebts();
  }

  loadDebts() {
    this.loading.set(true);
    this.debtService.getDebts().subscribe({
      next: (data) => {
        this.debts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getDebtLabel(type: string) {
      const map: {[key:string]: string} = {
          'credit_card_rotating': 'Cartão (Rotativo)',
          'credit_card_installment': 'Cartão (Parcelado)',
          'personal_loan': 'Empréstimo Pessoal',
          'vehicle_financing': 'Financ. Veículo',
          'real_estate_financing': 'Financ. Imóvel',
          'overdraft': 'Cheque Especial',
          'consigned_credit': 'Consignado',
          'other': 'Outro'
      };
      return map[type] || type;
  }

  convertToMonthly(yearlyRate: number): string {
      // (1+r)^(1/12) - 1
      const decimal = yearlyRate / 100;
      const monthly = (Math.pow(1 + decimal, 1/12) - 1) * 100;
      return monthly.toFixed(2);
  }

  // --- ACTIONS ---

  openNewDebt() {
      this.debtDialog = true;
      this.submitted = false;
      this.currentDebtId = null;
      this.debtForm.reset({
          name: '',
          debt_type: 'credit_card_rotating',
          total_amount: 0,
          interest_rate: 0,
          interest_period: 'monthly',
          minimum_payment: 0
      });
  }

  editDebt(debt: Debt) {
       this.debtDialog = true;
       this.submitted = false;
       this.currentDebtId = debt.id;
       this.debtForm.patchValue({
           name: debt.name,
           debt_type: debt.debt_type,
           total_amount: debt.total_amount,
           interest_rate: debt.interest_rate,
           interest_period: debt.interest_period,
           minimum_payment: debt.minimum_payment || 0,
           due_day: debt.due_day as any
       });
  }

  saveDebt() {
      this.submitted = true;
      if (this.debtForm.valid) {
          const payload: any = this.debtForm.value;

          if (this.currentDebtId) {
              this.debtService.updateDebt(this.currentDebtId, payload).subscribe({
                  next: () => {
                      this.messageService.add({ severity: 'success', summary: 'Dívida Atualizada' });
                      this.debtDialog = false;
                      this.loadDebts();
                  },
                  error: () => this.messageService.add({ severity: 'error', summary: 'Erro ao atualizar' })
              });
          } else {
              this.debtService.createDebt(payload).subscribe({
                  next: () => {
                      this.messageService.add({ severity: 'success', summary: 'Dívida Criada' });
                      this.debtDialog = false;
                      this.loadDebts();
                  },
                  error: (err) => {
                      if(err.status === 403) {
                           this.messageService.add({ severity: 'warn', summary: 'Acesso Negado', detail: 'Versão Free não permite cadastrar dívidas.' });
                      } else {
                           this.messageService.add({ severity: 'error', summary: 'Erro ao criar' });
                      }
                  }
              });
          }
      }
  }

  hideDialog() {
      this.debtDialog = false;
      this.submitted = false;
  }

  deleteDebt(id: string) {
      this.confirmationService.confirm({
          message: 'Tem certeza que deseja apagar esta dívida?',
          accept: () => {
              this.debtService.deleteDebt(id).subscribe(() => {
                  this.messageService.add({ severity: 'success', summary: 'Apagado' });
                  this.loadDebts();
              });
          }
      });
  }

  // --- SIMULATION ---

  generatePlan() {
      this.simulating.set(true);
      this.debtService.generatePlan(this.selectedStrategy, this.monthlyBudget).subscribe({
          next: (plan) => {
              this.paymentPlan.set(plan);
              this.simulating.set(false);
          },
          error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha na simulação. Verifique se é PRO.' });
              this.simulating.set(false);
          }
      });
  }

  // --- HOUSING ---

  loadHousingDefaults() {
      if (this.housingIncome > 0) {
          this.debtService.getHousingDefaults(this.housingIncome).subscribe(data => {
              this.housingRate = data.suggested_rate_yearly;
              this.housingProgram = data.program_name;
              this.messageService.add({ severity: 'info', summary: 'Taxa Sugerida', detail: `Baseado na renda: ${this.housingRate}% (${this.housingProgram})` });
          });
      }
  }

  runHousingSim() {
      this.housingSimulating = true;
      this.debtService.simulateHousing(
          this.housingValue,
          this.housingEntry,
          this.housingRate,
          360, // Default 30 years
          this.housingSystem
        ).subscribe({
            next: (res) => {
                this.housingResult = res;
                this.housingSimulating = false;
            },
            error: () => this.housingSimulating = false
        });
  }

  // --- ADVICE ---

  openAdvice() {
      this.adviceDialog = true;
      if (!this.adviceResult()) {
          this.getAdvice();
      }
  }

  getAdvice() {
      this.adviceLoading.set(true);
      // Use configured monthly budget as surplus, or default 0
      const surplus = this.monthlyBudget > 0 ? this.monthlyBudget : 0;

      this.debtService.getAdvice(surplus).subscribe({
          next: (res) => {
              this.adviceResult.set(res.advice);
              this.adviceLoading.set(false);
          },
          error: () => {
              this.adviceLoading.set(false);
              this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao gerar consultoria.' });
          }
      });
  }

  // --- ANALYSIS (Upload) ---

  onUpload(event: any) {
      const file = event.files[0];
      this.analyzing = true;

      this.debtService.analyzeDocument(file).subscribe({
          next: (data) => {
              this.analyzing = false;
              console.log('AI Analysis Result:', data);

              if (data.error) {
                   this.messageService.add({
                       severity: 'error',
                       summary: 'Erro na Análise',
                       detail: data.error
                   });
                   return;
              }

              // AUTO-CREATE LOGIC
              // If we have at least Name and Amount, we try to create directly
              if (data.name && data.total_amount > 0) {
                  const payload = {
                      name: data.name,
                      debt_type: data.debt_type || 'other',
                      total_amount: data.total_amount,
                      interest_rate: data.interest_rate || 0,
                      interest_period: data.interest_period || 'monthly',
                      minimum_payment: data.minimum_payment || 0, // Optional
                      due_day: data.due_day || null // Optional
                  };

                  this.loading.set(true); // Show global loading while creating
                  this.debtService.createDebt(payload).subscribe({
                      next: (newDebt) => {
                           this.loading.set(false);
                           this.messageService.add({
                               severity: 'success',
                               summary: 'Dívida Criada via IA!',
                               detail: `${newDebt.name} - ${newDebt.total_amount}`
                           });
                           this.loadDebts(); // Refresh list
                           this.activeIndex.set(0); // Switch to list tab
                      },
                      error: (err) => {
                           this.loading.set(false);
                           console.error('Auto-create failed', err);
                           // Fallback to manual form if creation fails (e.g. valid failure)
                           this.preFillForm(data);
                           this.messageService.add({ severity: 'warn', summary: 'Criação Automática Falhou', detail: 'Por favor, revise os dados.' });
                      }
                  });

              } else {
                  // Fallback: Not enough confidence to create, let user review
                  this.messageService.add({
                      severity: 'info',
                      summary: 'Revisão Necessária',
                      detail: 'Dados incompletos para criação automática. Por favor, revise.'
                  });
                  this.preFillForm(data);
              }
          },
          error: (err) => {
              this.analyzing = false;
              this.messageService.add({ severity: 'error', summary: 'Erro na Análise', detail: 'Falha ao conectar com o serviço.' });
          }
      });
  }

  preFillForm(data: any) {
      if (data.name) this.debtForm.controls.name.setValue(data.name);
      if (data.total_amount) this.debtForm.controls.total_amount.setValue(data.total_amount);
      if (data.interest_rate !== undefined) this.debtForm.controls.interest_rate.setValue(data.interest_rate);
      if (data.debt_type) this.debtForm.controls.debt_type.setValue(data.debt_type as any);
      if (data.interest_period) this.debtForm.controls.interest_period.setValue(data.interest_period as any);

      this.openNewDebt();
  }
}
