import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';

// PrimeNG
import { TabsModule } from 'primeng/tabs';
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
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';

import { DebtService } from '../../services/debt.service';
import { ResourceService } from '../../services/resource.service';
import { SubscriptionService } from '../../services/subscription.service';
import { Router } from '@angular/router';
import { Debt, PaymentPlan, AmortizationSystem, DebtType, DebtStatus, CardBrand, IndexerType, InterestPeriod } from '../../models/debt.model';
import { SeasonalIncome, SeasonalIncomeCreate } from '../../models/seasonal-income.model';

@Component({
  selector: 'app-debt-planner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
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
    SkeletonModule,
    CheckboxModule,
    AccordionModule,
    AccordionModule,
    DatePickerModule,
    TagModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './debt-planner.html',
  styleUrl: './debt-planner.scss'
})
export class DebtPlannerComponent implements OnInit {
  private debtService = inject(DebtService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private resourceService = inject(ResourceService);
  private fb = inject(FormBuilder);
  public subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  canAccess = computed(() => this.subscriptionService.canAccess('debts'));

  navigateToPricing() {
    this.router.navigate(['/pricing']);
  }

  activeIndex = signal(0);
  debts = signal<Debt[]>([]);
  loading = signal(false);

  // RESOURCES
  resources = signal<SeasonalIncome[]>([]);
  resourceLoading = false;
  newResource: SeasonalIncomeCreate = {
      name: '',
      amount: 0,
      receive_date: new Date(),
      is_recurrence: false
  };

  // FORM
  debtDialog = false;
  submitted = false;
  currentDebtId: string | null = null;

  debtForm = this.fb.group({
      name: ['', Validators.required],
      debt_type: [DebtType.CREDIT_CARD_ROTATING, Validators.required],
      status: [DebtStatus.ON_TIME, Validators.required],

      total_amount: [0, [Validators.required, Validators.min(0.01)]],
      original_amount: [0],

      interest_rate: [0, [Validators.required, Validators.min(0)]],
      interest_period: [InterestPeriod.MONTHLY, Validators.required],
      cet: [0], // Custo Efetivo Total

      minimum_payment: [0],
      due_day: [null as number | null],
      closing_day: [null as number | null],
      remaining_installments: [null as number | null],

      // Specifics
      card_brand: [null as CardBrand | null],
      card_limit: [0],

      contract_number: [''],
      allow_early_amortization: [true],

      indexer: [null as IndexerType | null],
      insurance_value: [0],
      property_value: [0],
      current_property_value: [0],
      fgts_usage_interval: [24],

      daily_interest_rate: [0],
      days_used_in_month: [0],

      contract_file_path: [''],
      amortization_system: [AmortizationSystem.NONE],
      is_subsidized: [false]
  });

  // ENUMS & OPTIONS
  debtTypes = [
      { label: 'Cartão (Rotativo)', value: DebtType.CREDIT_CARD_ROTATING },
      { label: 'Cartão (Parcelado)', value: DebtType.CREDIT_CARD_INSTALLMENT },
      { label: 'Cheque Especial', value: DebtType.OVERDRAFT },
      { label: 'Empréstimo Pessoal', value: DebtType.PERSONAL_LOAN },
      { label: 'Consignado', value: DebtType.CONSIGNED_CREDIT },
      { label: 'Financ. Veículo', value: DebtType.VEHICLE_FINANCING },
      { label: 'Financ. Imóvel', value: DebtType.REAL_ESTATE_FINANCING },
      { label: 'Outro', value: DebtType.OTHER }
  ];

  debtStatuses = [
      { label: 'Em Dia (Verde)', value: DebtStatus.ON_TIME, icon: 'pi pi-check-circle', color: 'green' },
      { label: 'Atrasado (Vermelho)', value: DebtStatus.OVERDUE, icon: 'pi pi-exclamation-circle', color: 'red' },
      { label: 'Em Negociação', value: DebtStatus.NEGOTIATION, icon: 'pi pi-info-circle', color: 'orange' }
  ];

  cardBrands = [
      { label: 'Mastercard', value: CardBrand.MASTERCARD },
      { label: 'Visa', value: CardBrand.VISA },
      { label: 'Amex', value: CardBrand.AMEX },
      { label: 'Elo', value: CardBrand.ELO },
      { label: 'Hipercard', value: CardBrand.HIPERCARD },
      { label: 'Outro', value: CardBrand.OTHER }
  ];

  indexers = [
      { label: 'TR (Taxa Referencial)', value: IndexerType.TR },
      { label: 'IPCA (Inflação)', value: IndexerType.IPCA },
      { label: 'Poupança', value: IndexerType.POUPANCA },
      { label: 'CDI', value: IndexerType.CDI },
      { label: 'IGPM', value: IndexerType.IGPM },
      { label: 'Nenhum', value: IndexerType.NONE }
  ];

  amortizationSystems = [
      { label: 'SAC (Decrescente)', value: AmortizationSystem.SAC },
      { label: 'Price (Fixa)', value: AmortizationSystem.PRICE },
      { label: 'Nenhum', value: AmortizationSystem.NONE }
  ];

  // Helper for Template
  DebtType = DebtType;

  constructor() {
    // React to type changes to reset unrelated fields or set defaults?
    // For now, keep simple.
  }

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
    this.loadResources();
  }

  loadResources() {
      this.resourceService.getResources().subscribe({
          next: (data) => this.resources.set(data),
          error: () => console.error('Failed to load resources')
      });
  }

  addResource() {
      if (!this.newResource.name || this.newResource.amount <= 0) {
          this.messageService.add({ severity: 'warn', summary: 'Dados Inválidos', detail: 'Informe nome e valor.' });
          return;
      }

      this.resourceLoading = true;
      // Handle Date - ensure it is a valid object or string
      const payload = { ...this.newResource };

      this.resourceService.createResource(payload).subscribe({
          next: (res) => {
              this.resourceLoading = false;
              this.loadResources();
              this.messageService.add({ severity: 'success', summary: 'Recurso Adicionado' });
              // Reset
              this.newResource = {
                  name: '',
                  amount: 0,
                  receive_date: new Date(),
                  is_recurrence: false
              };
          },
          error: () => {
              this.resourceLoading = false;
              this.messageService.add({ severity: 'error', summary: 'Erro ao salvar' });
          }
      });
  }

  deleteResource(id: string) {
      this.confirmationService.confirm({
          message: 'Tem certeza que deseja remover este recurso?',
          header: 'Confirmar Exclusão',
          icon: 'pi pi-exclamation-triangle',
          accept: () => {
              this.resourceService.deleteResource(id).subscribe(() => {
                  this.loadResources();
                  this.messageService.add({ severity: 'success', summary: 'Recurso Removido' });
              });
          }
      });
  }

  simulateImpact() {
      this.activeIndex.set(1); // Switch to Plan Tab
      this.generatePlan();
      this.messageService.add({ severity: 'info', summary: 'Simulando...', detail: 'Recalculando plano com recursos extras.' });
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
          debt_type: DebtType.CREDIT_CARD_ROTATING,
          status: DebtStatus.ON_TIME,
          total_amount: 0,
          original_amount: 0,
          interest_rate: 0,
          interest_period: InterestPeriod.MONTHLY,
          cet: 0,
          minimum_payment: 0,
          due_day: null,
          closing_day: null,
          remaining_installments: null,
          card_brand: null,
          card_limit: 0,
          contract_number: '',
          allow_early_amortization: true,
          indexer: null,
          insurance_value: 0,
          property_value: 0,
          current_property_value: 0,
          fgts_usage_interval: 24,
          daily_interest_rate: 0,
          days_used_in_month: 0,
          amortization_system: AmortizationSystem.NONE,
          is_subsidized: false,
          contract_file_path: ''
      });
  }

  editDebt(debt: Debt) {
       this.debtDialog = true;
       this.submitted = false;
       this.currentDebtId = debt.id;
       this.debtForm.patchValue({
           name: debt.name,
           debt_type: debt.debt_type,
           status: debt.status || DebtStatus.ON_TIME,
           total_amount: debt.total_amount,
           original_amount: debt.original_amount || 0,
           interest_rate: debt.interest_rate,
           interest_period: debt.interest_period,
           cet: debt.cet || 0,
           minimum_payment: debt.minimum_payment || 0,
           due_day: debt.due_day as any,
           closing_day: debt.closing_day as any,
           remaining_installments: debt.remaining_installments as any,

           card_brand: debt.card_brand,
           card_limit: debt.card_limit || 0,

           contract_number: debt.contract_number,
           allow_early_amortization: debt.allow_early_amortization !== undefined ? debt.allow_early_amortization : true,

           indexer: debt.indexer,
           insurance_value: debt.insurance_value || 0,
           property_value: debt.property_value || 0,
           current_property_value: debt.current_property_value || 0,
           fgts_usage_interval: debt.fgts_usage_interval || 24,

           daily_interest_rate: debt.daily_interest_rate || 0,
           days_used_in_month: debt.days_used_in_month || 0,

           amortization_system: debt.amortization_system || AmortizationSystem.NONE,
           is_subsidized: debt.is_subsidized || false
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


  getDebtStatusLabel(status: DebtStatus): string {
    const map: Record<string, string> = {
        [DebtStatus.ON_TIME]: 'Em dia',
        [DebtStatus.OVERDUE]: 'Atrasado',
        [DebtStatus.NEGOTIATION]: 'Negociação'
    };
    return map[status] || status;
  }

  getDebtStatusSeverity(status: DebtStatus): 'success' | 'warn' | 'danger' | 'info' {
      switch (status) {
          case DebtStatus.ON_TIME: return 'success';
          case DebtStatus.NEGOTIATION: return 'warn';
          case DebtStatus.OVERDUE: return 'danger';
          default: return 'info';
      }
  }

  getDebtStatusIcon(status: DebtStatus): string {
      switch (status) {
          case DebtStatus.ON_TIME: return 'pi pi-check-circle';
          case DebtStatus.OVERDUE: return 'pi pi-exclamation-circle';
          case DebtStatus.NEGOTIATION: return 'pi pi-refresh';
          default: return 'pi pi-info-circle';
      }
  }

  isHighPriority(debt: Debt): boolean {
      // Psychological Priority: Overdue OR High Interest (>5% mo, adjusted if yearly)
      let rate = debt.interest_rate;
      if (debt.interest_period === InterestPeriod.YEARLY) {
          rate = rate / 12;
      }
      return debt.status === DebtStatus.OVERDUE || rate > 5;
  }

  // --- AGREEMENT SIMULATOR ---
  agreementDialog = false;
  agreementDebt: Debt | null = null;
  agreementProposal = {
      discountedTotal: 0,
      entryValue: 0,
      installmentCount: 1
  };
  agreementResult: any = null;

  openAgreement(debt: Debt) {
      this.agreementDebt = debt;
      this.agreementDialog = true;
      this.agreementResult = null;
      // Default Proposal: 10% discount, 10% entry, 12 installments
      this.agreementProposal = {
          discountedTotal: debt.total_amount * 0.9,
          entryValue: debt.total_amount * 0.1,
          installmentCount: 12
      };
  }

  simulateAgreement() {
      if (!this.agreementDebt) return;

      const original = this.agreementDebt.total_amount;
      const proposed = this.agreementProposal.discountedTotal;
      const entry = this.agreementProposal.entryValue;
      const count = this.agreementProposal.installmentCount;

      const financedAmount = proposed - entry;
      const installmentValue = financedAmount / count;

      const totalPaid = entry + (installmentValue * count); // Should equal proposed if no interest on agreement
      const savings = original - totalPaid;
      const savingsPercent = (savings / original) * 100;

      this.agreementResult = {
          original,
          proposed,
          entry,
          installmentValue,
          totalPaid,
          savings,
          savingsPercent
      };
  }

  // --- DISCOUNT CALCULATOR ---
  calcDialog = false;
  calcDebt: Debt | null = null;
  calcAmount = 0; // Valor da parcela
  calcDate: Date | null = null; // Vencimento
  calcResult: any = null;
  calcLoading = false;

  openCalculator(debt: Debt) {
      if (debt.interest_rate <= 0) {
          this.messageService.add({ severity: 'warn', summary: 'Sem Juros', detail: 'Esta dívida não possui taxa de juros cadastrada.' });
          return;
      }
      this.calcDebt = debt;
      this.calcDialog = true;
      this.calcAmount = debt.minimum_payment || (debt.total_amount / (debt.remaining_installments || 1));
      this.calcResult = null;

      // Default date: 1 year from now just for demo
      const today = new Date();
      today.setFullYear(today.getFullYear() + 1);
      this.calcDate = today;
  }

  simulateDiscount() {
      if (!this.calcDebt || !this.calcDate || this.calcAmount <= 0) return;

      this.calcLoading = true;

      // Convert Rate to Monthly if needed
      let rate = this.calcDebt.interest_rate;
      if (this.calcDebt.interest_period === InterestPeriod.YEARLY) {
          rate = (Math.pow(1 + rate/100, 1/12) - 1) * 100;
      }

      // Format Date
      const dateStr = this.calcDate.toISOString().split('T')[0];

      this.debtService.calculatePresentValue(this.calcAmount, rate, dateStr).subscribe({
          next: (res) => {
              this.calcResult = res;
              this.calcLoading = false;
          },
          error: () => {
               this.calcLoading = false;
               this.messageService.add({ severity: 'error', summary: 'Erro na Simulação' });
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
