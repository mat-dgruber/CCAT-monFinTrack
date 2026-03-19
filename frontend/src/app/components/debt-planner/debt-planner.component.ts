import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
  effect,
  HostListener,
  input,
} from '@angular/core';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';
import { CustomConfirmService } from '../../services/custom-confirm.service';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
import { MenuModule } from 'primeng/menu';

import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { PageHelpComponent } from '../page-help/page-help';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SliderModule } from 'primeng/slider';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DrawerModule } from 'primeng/drawer';

import { DebtService, DebtAlert } from '../../services/debt.service';
import { ResourceService } from '../../services/resource.service';
import { SubscriptionService } from '../../services/subscription.service';
import {
  EconomicIndexService,
  BCB_SERIES,
} from '../../services/economic-index.service';
import { Router } from '@angular/router';
import {
  Debt,
  PaymentPlan,
  AmortizationSystem,
  DebtType,
  DebtStatus,
  CardBrand,
  IndexerType,
  InterestPeriod,
} from '../../models/debt.model';

interface ValidacaoFGTS {
  elegivel: boolean;
  motivo_bloqueio?: string;
  proximo_uso_permitido?: Date;
}
import {
  SeasonalIncome,
  SeasonalIncomeCreate,
} from '../../models/seasonal-income.model';

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
    DividerModule,
    SkeletonModule,
    CheckboxModule,
    AccordionModule,
    DatePickerModule,
    TagModule,
    PageHelpComponent,
    IconFieldModule,
    InputIconModule,
    SliderModule,
    ToggleSwitchModule,
    MarkdownModule,
    MenuModule,
    DrawerModule,
  ],
  templateUrl: './debt-planner.html',
  styleUrl: './debt-planner.scss',
  animations: [
    trigger('tabAnimation', [
      transition(':increment', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(
          ':enter, :leave',
          [
            style({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
            }),
          ],
          { optional: true },
        ),
        query(':enter', [style({ left: '100%', opacity: 0 })], {
          optional: true,
        }),
        group([
          query(
            ':leave',
            [animate('300ms ease-out', style({ left: '-100%', opacity: 0 }))],
            { optional: true },
          ),
          query(
            ':enter',
            [animate('300ms ease-out', style({ left: '0%', opacity: 1 }))],
            { optional: true },
          ),
        ]),
      ]),
      transition(':decrement', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(
          ':enter, :leave',
          [
            style({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
            }),
          ],
          { optional: true },
        ),
        query(':enter', [style({ left: '-100%', opacity: 0 })], {
          optional: true,
        }),
        group([
          query(
            ':leave',
            [animate('300ms ease-out', style({ left: '100%', opacity: 0 }))],
            { optional: true },
          ),
          query(
            ':enter',
            [animate('300ms ease-out', style({ left: '0%', opacity: 1 }))],
            { optional: true },
          ),
        ]),
      ]),
    ]),
  ],
})
export class DebtPlannerComponent implements OnInit {
  private debtService = inject(DebtService);
  private messageService = inject(MessageService);
  private confirmationService = inject(CustomConfirmService);
  private resourceService = inject(ResourceService);
  private economicService = inject(EconomicIndexService);
  private fb = inject(FormBuilder);
  public subscriptionService = inject(SubscriptionService);
  private router = inject(Router);
  public DebtType = DebtType;
  public IndexerType = IndexerType;

  canAccess = computed(() => this.subscriptionService.canAccess('debts'));

  activeIndex = signal(0);
  loading = signal(false);

  helpDocument = computed(() => {
    const docs = [
      'debt-list.md',
      'debt-plan.md',
      'debt-housing.md',
      'debt-scanner.md',
      'debt-resources.md',
    ];
    return docs[this.activeIndex()] || 'debt-list.md';
  });

  helpTitle = computed(() => {
    const titles = [
      'Ajuda: Minhas Dívidas',
      'Ajuda: Plano de Pagamento',
      'Ajuda: Financiamento',
      'Ajuda: IA Scanner / OCR',
      'Ajuda: Recursos & Estratégia',
    ];
    return titles[this.activeIndex()] || 'Ajuda: Planejador de Dívidas';
  });

  debts = signal<Debt[]>([]);

  // DETAILS VIEW
  selectedDebtForDetails = signal<Debt | null>(null);
  latestTR = signal<number | null>(null);
  alerts = signal<DebtAlert[]>([]);
  alertsLoading = signal(false);
  evolutionTable = signal<any[]>([]);
  showEvolutionTable = signal(false);
  // --- Lógica de Drawer Mobile ---
  mobileDebtActionsVisible = signal(false);
  selectedDebtForActions = signal<Debt | null>(null);
  isMobile = signal(window.innerWidth < 768);

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.isMobile.set(window.innerWidth < 768);
  }
  // RESOURCES
  resources = signal<SeasonalIncome[]>([]);
  resourceLoading = false;
  newResource: SeasonalIncomeCreate = {
    name: '',
    amount: 0,
    receive_date: new Date(),
    is_recurrence: false,
  };

  // FORM
  debtDialog = false;
  submitted = false;
  currentDebtId: string | null = null;
  analyzing = false;
  scanReport = signal<string | null>(null);

  debtForm = this.fb.group({
    name: ['', Validators.required],
    debt_type: [DebtType.CREDIT_CARD_ROTATING, Validators.required],
    status: [DebtStatus.ON_TIME, Validators.required],

    total_amount: [0, [Validators.required, Validators.min(0.01)]],
    original_amount: [0],

    interest_rate: [0, [Validators.required, Validators.min(0)]],
    interest_period: [InterestPeriod.MONTHLY, Validators.required],
    cet: [0],

    minimum_payment: [0],
    due_day: [null as number | null],
    closing_day: [null as number | null],
    remaining_installments: [null as number | null],

    // Universal Fields
    creditor_institution: [''],
    contract_date: [null as Date | null],
    next_due_date: [null as Date | null],
    observations: [''],

    // Specifics
    card_brand: [null as CardBrand | null],
    card_limit: [0],

    contract_number: [''],
    allow_early_amortization: [true],

    indexer: [null as IndexerType | null],
    insurance_value: [0],
    administration_fee: [0],
    property_value: [0],
    current_property_value: [0],
    fgts_usage_interval: [24],

    is_under_construction: [false],
    construction_end_date: [null as Date | null],

    total_installments: [null as number | null],
    installments_paid: [0],

    subsidy_amount: [0],
    subsidy_expiration_date: [null as Date | null],

    daily_interest_rate: [0],
    days_used_in_month: [0],

    // Vehicle
    vehicle_brand: [''],
    vehicle_model: [''],
    vehicle_year: [null as number | null],
    vehicle_plate: [''],
    vehicle_renavam: [''],
    vehicle_chassi: [''],
    down_payment: [0],
    gravame_registered: [false],
    vehicle_insurance_active: [false],
    vehicle_insurance_expiry: [null as Date | null],
    ipva_paid: [false],
    licensing_ok: [false],

    contract_file_path: [''],
    amortization_system: [AmortizationSystem.NONE],
    is_subsidized: [false],
    last_fgts_usage_date: [null as Date | null],
    estimated_fgts_balance: [0],
    report: [null as string | null],
  });

  // OPTIONS
  debtTypes = [
    {
      label: 'Cartão (Rotativo)',
      value: DebtType.CREDIT_CARD_ROTATING,
      icon: 'pi pi-credit-card',
    },
    {
      label: 'Cartão (Parcelado)',
      value: DebtType.CREDIT_CARD_INSTALLMENT,
      icon: 'pi pi-credit-card',
    },
    {
      label: 'Cheque Especial',
      value: DebtType.OVERDRAFT,
      icon: 'pi pi-exclamation-triangle',
    },
    {
      label: 'Empréstimo Pessoal',
      value: DebtType.PERSONAL_LOAN,
      icon: 'pi pi-money-bill',
    },
    {
      label: 'Consignado',
      value: DebtType.CONSIGNED_CREDIT,
      icon: 'pi pi-briefcase',
    },
    {
      label: 'Financ. Veículo',
      value: DebtType.VEHICLE_FINANCING,
      icon: 'pi pi-car',
    },
    {
      label: 'Financ. Imóvel',
      value: DebtType.REAL_ESTATE_FINANCING,
      icon: 'pi pi-home',
    },
    { label: 'Outro', value: DebtType.OTHER, icon: 'pi pi-question-circle' },
  ];

  debtStatuses = [
    {
      label: 'Em Dia (Verde)',
      value: DebtStatus.ON_TIME,
      icon: 'pi pi-check-circle',
      color: 'green',
    },
    {
      label: 'Atrasado (Vermelho)',
      value: DebtStatus.OVERDUE,
      icon: 'pi pi-exclamation-circle',
      color: 'red',
    },
    {
      label: 'Em Negociação',
      value: DebtStatus.NEGOTIATION,
      icon: 'pi pi-refresh',
      color: 'orange',
    },
  ];

  cardBrands = [
    {
      label: 'Mastercard',
      value: CardBrand.MASTERCARD,
      icon: 'pi pi-credit-card',
    },
    { label: 'Visa', value: CardBrand.VISA, icon: 'pi pi-credit-card' },
    { label: 'Amex', value: CardBrand.AMEX, icon: 'pi pi-credit-card' },
    { label: 'Elo', value: CardBrand.ELO, icon: 'pi pi-credit-card' },
    {
      label: 'Hipercard',
      value: CardBrand.HIPERCARD,
      icon: 'pi pi-credit-card',
    },
    { label: 'Outro', value: CardBrand.OTHER, icon: 'pi pi-credit-card' },
  ];

  indexers = [
    {
      label: 'TR (Taxa Referencial)',
      value: IndexerType.TR,
      icon: 'pi pi-info-circle',
    },
    {
      label: 'IPCA (Inflação)',
      value: IndexerType.IPCA,
      icon: 'pi pi-percentage',
    },
    { label: 'Poupança', value: IndexerType.POUPANCA, icon: 'pi pi-wallet' },
    { label: 'CDI', value: IndexerType.CDI, icon: 'pi pi-chart-line' },
    { label: 'IGPM', value: IndexerType.IGPM, icon: 'pi pi-percentage' },
    { label: 'Nenhum', value: IndexerType.NONE, icon: 'pi pi-times' },
  ];

  amortizationSystems = [
    {
      label: 'SAC (Decrescente)',
      value: AmortizationSystem.SAC,
      icon: 'pi pi-sort-amount-down',
    },
    {
      label: 'Price (Fixa)',
      value: AmortizationSystem.PRICE,
      icon: 'pi pi-equals',
    },
    { label: 'Nenhum', value: AmortizationSystem.NONE, icon: 'pi pi-times' },
  ];

  // PLANNER
  monthlyBudget = 1000;
  selectedStrategy: 'snowball' | 'avalanche' = 'snowball';
  strategies = [
    { name: 'Bola de Neve', value: 'snowball' },
    { name: 'Avalanche', value: 'avalanche' },
  ];

  housingSystems = [
    { name: 'SAC', value: AmortizationSystem.SAC },
    { name: 'Price', value: AmortizationSystem.PRICE },
  ];
  paymentPlan = signal<PaymentPlan | null>(null);
  simulating = signal(false);

  // HOUSING SIMULATOR
  housingIncome = 3000;
  housingValue = 200000;
  housingEntry = 40000;
  housingRate: number = 5.0;
  housingProgram = '';
  housingSystem: AmortizationSystem = AmortizationSystem.SAC; // SAC or PRICE
  housingResult: any = null;
  housingSimulating = false;
  housingErrors = signal<Record<string, boolean>>({});
  debtFormErrors = signal<Record<string, boolean>>({});

  // ADVICE
  adviceDialog = false;
  adviceResult = signal<string>('');
  adviceLoading = signal(false);

  // DISCOUNT CALCULATOR
  calcDialog = false;
  calcDebt: Debt | null = null;
  calcAmount = 0;
  calcDate: Date | null = null;
  calcResult: any = null;
  calcLoading = false;

  // Extra Amortization & Multi parcels
  calcMode: 'single' | 'extra' = 'extra';
  extraAmortizationAmount = 1000;
  amortizationResult: any = null;
  parcelCountToAnticipate = 1;
  useFGTS = false;
  fgtsAmount = 0;
  fgtsValidation: ValidacaoFGTS | null = null;

  // AGREEMENT SIMULATOR
  agreementDialog = false;
  agreementDebt: Debt | null = null;
  agreementProposal = {
    discountedTotal: 0,
    entryValue: 0,
    installmentCount: 1,
  };
  agreementResult: any = null;

  // --- Métodos de UI ---

  getPrioritySeverity(score: number): any {
    if (score > 70) return 'danger';
    if (score > 40) return 'warn';
    return 'success';
  }

  getPriorityColor(score: number): string {
    if (score > 70) return '#ef4444'; // Red
    if (score > 40) return '#f59e0b'; // Amber
    return '#22c55e'; // Green
  }

  openDebtActions(debt: Debt) {
    this.selectedDebtForActions.set(debt);
    this.mobileDebtActionsVisible.set(true);
  }

  getDebtMenuItems(debt: Debt): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: 'Ver Detalhes',
        icon: 'pi pi-eye',
        command: () => this.viewDebtDetails(debt),
      },
      {
        label: 'Editar Dívida',
        icon: 'pi pi-pencil',
        command: () => this.editDebt(debt),
      },
      {
        label: 'Simular Antecipação',
        icon: 'pi pi-calculator',
        command: () => this.openCalculator(debt),
      },
    ];

    if (debt.status === DebtStatus.OVERDUE || debt.status === DebtStatus.NEGOTIATION) {
      items.push({
        label: 'Simular Acordo',
        icon: 'pi pi-handshake',
        command: () => this.openAgreement(debt),
      });
    }

    items.push({
      separator: true
    });

    items.push({
      label: 'Excluir Dívida',
      icon: 'pi pi-trash',
      command: () => this.deleteDebt(debt.id),
    });

    return items;
  }

  ngOnInit() {
    this.loadDebts();
    this.loadResources();
    this.loadLatestTR();
  }

  loadLatestTR() {
    this.economicService.getLatestValue(BCB_SERIES.TR).subscribe({
      next: (res) => this.latestTR.set(res.valor),
      error: (err) => console.error('Failed to load TR', err),
    });
  }

  viewDebtDetails(debt: Debt) {
    this.selectedDebtForDetails.set(debt);
    this.alerts.set([]);
    this.alertsLoading.set(true);
    this.debtService.getDebtAlerts(debt.id).subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.alertsLoading.set(false);
      },
      error: () => this.alertsLoading.set(false),
    });
  }

  getEquityData(debt: Debt) {
    const totalVal =
      debt.property_value || debt.original_amount || debt.total_amount;
    const debtBalance = debt.total_amount;
    const subsidy = debt.subsidy_amount || 0;
    const paidTotal = Math.max(0, totalVal - debtBalance);
    const userPaid = Math.max(0, paidTotal - subsidy);

    return {
      totalValue: totalVal,
      debtBalance: debtBalance,
      subsidy: subsidy,
      userEquity: userPaid,
      equityPercent: (paidTotal / totalVal) * 100,
      subsidyPercent: (subsidy / totalVal) * 100,
      userPercent: (userPaid / totalVal) * 100,
      bankPercent: (debtBalance / totalVal) * 100,
    };
  }

  loadDebts() {
    this.loading.set(true);
    this.debtService.getDebts().subscribe({
      next: (data) => {
        this.debts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadResources() {
    this.resourceService.getResources().subscribe({
      next: (data) => this.resources.set(data),
      error: () => console.error('Failed to load resources'),
    });
  }

  addResource() {
    if (!this.newResource.name || this.newResource.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Dados Inválidos',
        detail: 'Informe nome e valor.',
      });
      return;
    }
    this.resourceLoading = true;
    const formattedDate =
      this.newResource.receive_date instanceof Date
        ? this.newResource.receive_date.toISOString().split('T')[0]
        : this.newResource.receive_date;

    const payload: SeasonalIncomeCreate = {
      ...this.newResource,
      receive_date: formattedDate,
    };
    this.resourceService.createResource(payload).subscribe({
      next: () => {
        this.resourceLoading = false;
        this.loadResources();
        this.messageService.add({
          severity: 'success',
          summary: 'Recurso Adicionado',
        });
        this.newResource = {
          name: '',
          amount: 0,
          receive_date: new Date(),
          is_recurrence: false,
        };
      },
      error: () => {
        this.resourceLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro ao salvar',
        });
      },
    });
  }

  deleteResource(id: string) {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja remover este recurso?',
      accept: () => {
        this.resourceService.deleteResource(id).subscribe(() => {
          this.loadResources();
          this.messageService.add({
            severity: 'success',
            summary: 'Recurso Removido',
          });
        });
      },
    });
  }

  simulateImpact() {
    this.activeIndex.set(1);
    this.generatePlan();
  }

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
      creditor_institution: '',
      contract_date: null,
      next_due_date: null,
      observations: '',
      card_brand: null,
      card_limit: 0,
      contract_number: '',
      allow_early_amortization: true,
      indexer: null,
      insurance_value: 0,
      administration_fee: 0,
      property_value: 0,
      current_property_value: 0,
      fgts_usage_interval: 24,
      is_under_construction: false,
      construction_end_date: null,
      total_installments: null,
      installments_paid: 0,
      subsidy_amount: 0,
      subsidy_expiration_date: null,
      daily_interest_rate: 0,
      days_used_in_month: 0,
      vehicle_brand: '',
      vehicle_model: '',
      vehicle_year: null,
      vehicle_plate: '',
      vehicle_renavam: '',
      vehicle_chassi: '',
      down_payment: 0,
      gravame_registered: false,
      vehicle_insurance_active: false,
      vehicle_insurance_expiry: null,
      ipva_paid: false,
      licensing_ok: false,
      amortization_system: AmortizationSystem.NONE,
      is_subsidized: false,
      contract_file_path: '',
      report: null,
    });
    this.scanReport.set(null);
  }

  editDebt(debt: Debt) {
    this.debtDialog = true;
    this.submitted = false;
    this.currentDebtId = debt.id;
    this.debtForm.patchValue({
      ...(debt as any),
      construction_end_date: debt.construction_end_date
        ? new Date(debt.construction_end_date)
        : null,
      subsidy_expiration_date: debt.subsidy_expiration_date
        ? new Date(debt.subsidy_expiration_date)
        : null,
    });
  }

  saveDebt() {
    this.submitted = true;
    const errors: Record<string, boolean> = {};

    // Mandatory Field Check for Visual Feedback
    if (!this.debtForm.get('name')?.value) errors['name'] = true;
    if (!this.debtForm.get('debt_type')?.value) errors['debt_type'] = true;
    if (
      this.debtForm.get('total_amount')?.value === null ||
      this.debtForm.get('total_amount')?.value === undefined ||
      (this.debtForm.get('total_amount')?.value ?? 0) <= 0
    )
      errors['total_amount'] = true;

    if (
      this.debtForm.get('interest_rate')?.value === null ||
      this.debtForm.get('interest_rate')?.value === undefined
    )
      errors['interest_rate'] = true;

    this.debtFormErrors.set(errors);

    if (Object.keys(errors).length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos Obrigatórios',
        detail: 'Por favor, preencha todos os campos destacados em vermelho.',
      });
      // Clear errors after 1s for the shake animation to be repeatable if they click again
      setTimeout(() => this.debtFormErrors.set({}), 1000);
      return;
    }

    if (this.debtForm.valid) {
      const rawValue = this.debtForm.getRawValue();
      const payload: any = { ...rawValue };

      if (
        payload.debt_type === DebtType.REAL_ESTATE_FINANCING &&
        payload.total_installments &&
        payload.installments_paid !== null
      ) {
        payload.remaining_installments =
          payload.total_installments - payload.installments_paid;
      }
      if (payload.construction_end_date instanceof Date)
        payload.construction_end_date = payload.construction_end_date
          .toISOString()
          .split('T')[0];
      if (payload.subsidy_expiration_date instanceof Date)
        payload.subsidy_expiration_date = payload.subsidy_expiration_date
          .toISOString()
          .split('T')[0];

      if (this.currentDebtId) {
        this.debtService.updateDebt(this.currentDebtId, payload).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Dívida Atualizada',
            });
            this.debtDialog = false;
            this.loadDebts();
          },
          error: () =>
            this.messageService.add({
              severity: 'error',
              summary: 'Erro ao atualizar',
            }),
        });
      } else {
        this.debtService.createDebt(payload).subscribe({
          next: (err) => {
            this.messageService.add({
              severity: 'success',
              summary: 'Dívida Criada',
            });
            this.debtDialog = false;
            this.loadDebts();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro ao criar',
              detail: err.status === 403 ? 'Versão Free não permite.' : '',
            });
          },
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
      message: 'Deseja apagar esta dívida?',
      accept: () =>
        this.debtService.deleteDebt(id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Apagado' });
          this.loadDebts();
        }),
    });
  }

  onUpload(event: any) {
    const file = event.files[0];
    this.analyzing = true;
    this.debtService.analyzeDocument(file).subscribe({
      next: (data) => {
        this.analyzing = false;
        if (data.error) {
          this.messageService.add({
            severity: 'error',
            summary: 'Erro na Análise',
            detail: data.error,
          });
          return;
        }
        this.preFillForm(data);
      },
      error: () => {
        this.analyzing = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha na conexão.',
        });
      },
    });
  }

  preFillForm(data: any) {
    this.currentDebtId = null;
    this.submitted = false;

    // Primeiro garante os campos padrão para evitar nulos indesejados
    this.debtForm.reset({
      name: '',
      debt_type: DebtType.REAL_ESTATE_FINANCING,
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
      creditor_institution: '',
      contract_date: null,
      next_due_date: null,
      observations: '',
      card_brand: null,
      card_limit: 0,
      contract_number: '',
      allow_early_amortization: true,
      indexer: null,
      insurance_value: 0,
      administration_fee: 0,
      property_value: 0,
      current_property_value: 0,
      fgts_usage_interval: 24,
      is_under_construction: false,
      construction_end_date: null,
      total_installments: null,
      installments_paid: 0,
      subsidy_amount: 0,
      subsidy_expiration_date: null,
      daily_interest_rate: 0,
      days_used_in_month: 0,
      vehicle_brand: '',
      vehicle_model: '',
      vehicle_year: null,
      vehicle_plate: '',
      vehicle_renavam: '',
      vehicle_chassi: '',
      down_payment: 0,
      gravame_registered: false,
      vehicle_insurance_active: false,
      vehicle_insurance_expiry: null,
      ipva_paid: false,
      licensing_ok: false,
      amortization_system: AmortizationSystem.NONE,
      is_subsidized: false,
      contract_file_path: '',
      report: null,
    });

    if (data.report) {
      this.scanReport.set(data.report);
    } else {
      this.scanReport.set(null);
    }

    // Depois aplica os dados da IA
    this.debtForm.patchValue({
      ...data,
      construction_end_date:
        data.construction_end_date &&
        !isNaN(Date.parse(data.construction_end_date))
          ? new Date(data.construction_end_date)
          : null,
      subsidy_expiration_date:
        data.subsidy_expiration_date &&
        !isNaN(Date.parse(data.subsidy_expiration_date))
          ? new Date(data.subsidy_expiration_date)
          : null,
    });

    if (data.report) this.scanReport.set(data.report);
    this.debtDialog = true; // Abre o modal diretamente com os dados
  }

  exportReport() {
    const report = this.scanReport();
    if (!report) return;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];

    a.href = url;
    a.download = `analise-ia-contrato-${date}.md`;
    a.click();

    window.URL.revokeObjectURL(url);
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: 'Relatório exportado com sucesso!',
    });
  }

  generatePlan() {
    this.simulating.set(true);
    this.debtService
      .generatePlan(this.selectedStrategy, this.monthlyBudget)
      .subscribe({
        next: (plan) => {
          this.paymentPlan.set(plan);
          this.simulating.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Erro' });
          this.simulating.set(false);
        },
      });
  }

  loadHousingDefaults() {
    if (this.housingIncome > 0) {
      this.debtService
        .getHousingDefaults(this.housingIncome)
        .subscribe((data) => {
          this.housingRate = data.suggested_rate_yearly;
          this.housingProgram = data.program_name;
          this.messageService.add({
            severity: 'info',
            summary: 'Taxa Sugerida',
            detail: `Baseado na renda: ${this.housingRate}% (${this.housingProgram})`,
          });
        });
    }
  }

  runHousingSim() {
    const errors: Record<string, boolean> = {};
    if (!this.housingIncome || this.housingIncome <= 0) errors['income'] = true;
    if (!this.housingValue || this.housingValue <= 0) errors['value'] = true;
    if (this.housingEntry === null || this.housingEntry === undefined)
      errors['entry'] = true;
    if (!this.housingRate || this.housingRate <= 0) errors['rate'] = true;
    this.housingErrors.set(errors);

    if (Object.keys(errors).length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Preencha os campos destacados.',
      });
      setTimeout(() => this.housingErrors.set({}), 1000);
      return;
    }

    this.housingSimulating = true;
    this.debtService
      .simulateHousing(
        this.housingValue,
        this.housingEntry,
        this.housingRate,
        360,
        this.housingSystem,
      )
      .subscribe({
        next: (res) => {
          this.housingResult = res;
          this.housingSimulating = false;
        },
        error: () => {
          this.housingSimulating = false;
          this.messageService.add({ severity: 'error', summary: 'Erro' });
        },
      });
  }

  openAdvice() {
    this.adviceDialog = true;
    if (!this.adviceResult()) this.getAdvice();
  }
  getAdvice() {
    this.adviceLoading.set(true);
    this.debtService
      .getAdvice(this.monthlyBudget > 0 ? this.monthlyBudget : 0)
      .subscribe({
        next: (res) => {
          this.adviceResult.set(res.advice);
          this.adviceLoading.set(false);
        },
        error: () => {
          this.adviceLoading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Erro' });
        },
      });
  }

  openCalculator(debt: Debt) {
    if (debt.interest_rate <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sem Juros',
        detail: 'Dívida sem taxa cadastrada.',
      });
      return;
    }
    this.calcDebt = debt;
    this.calcDialog = true;
    this.calcAmount = debt.minimum_payment || 0;
    this.calcResult = null;
    this.amortizationResult = null;
    this.parcelCountToAnticipate = 1;
    this.useFGTS = false;
    this.fgtsAmount = 0;
    this.fgtsValidation = null; // Reset validation state

    // Default to extra amortization for real estate, single for others
    this.calcMode =
      debt.debt_type === DebtType.REAL_ESTATE_FINANCING ? 'extra' : 'single';

    const today = new Date();
    today.setFullYear(today.getFullYear() + 1);
    this.calcDate = today;
  }

  simulateDiscount() {
    if (this.calcMode === 'single') {
      this.runSingleParcelSim();
    } else {
      this.runExtraAmortizationSim();
    }
  }

  runSingleParcelSim() {
    if (!this.calcDebt || this.calcAmount <= 0) return;
    this.calcLoading = true;
    let rate = this.calcDebt.interest_rate;
    if (this.calcDebt.interest_period === InterestPeriod.YEARLY)
      rate = (Math.pow(1 + rate / 100, 1 / 12) - 1) * 100;

    this.debtService
      .simulateMultipleParcels(
        rate,
        this.calcAmount,
        this.parcelCountToAnticipate,
      )
      .subscribe({
        next: (res) => {
          this.calcResult = res;
          this.calcLoading = false;
        },
        error: () => {
          this.calcLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Erro na Simulação',
          });
        },
      });
  }

  runExtraAmortizationSim() {
    if (!this.calcDebt || this.extraAmortizationAmount <= 0) return;
    this.calcLoading = true;

    let rate = this.calcDebt.interest_rate;
    if (this.calcDebt.interest_period === InterestPeriod.YEARLY) {
      rate = (Math.pow(1 + rate / 100, 1 / 12) - 1) * 100;
    }

    this.debtService
      .simulateAmortization(
        this.calcDebt.total_amount,
        rate,
        this.calcDebt.minimum_payment || 0,
        this.extraAmortizationAmount + (this.useFGTS ? this.fgtsAmount : 0),
        this.calcDebt.amortization_system || 'price',
      )
      .subscribe({
        next: (res) => {
          this.amortizationResult = res;
          this.calcLoading = false;
        },
        error: () => {
          this.calcLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Erro',
            detail: 'Falha na simulação.',
          });
        },
      });
  }

  canUseFGTS(): boolean {
    if (
      !this.calcDebt ||
      this.calcDebt.debt_type !== DebtType.REAL_ESTATE_FINANCING
    ) {
      this.fgtsValidation = null; // Reset if not real estate financing
      return false;
    }

    const hoje = new Date();
    const divida = this.calcDebt;

    // Regra 1: intervalo mínimo (usando fgts_usage_interval ou default 3 anos)
    if (divida.last_fgts_usage_date) {
      const lastUse = new Date(divida.last_fgts_usage_date);
      const intervalMonths = divida.fgts_usage_interval || 36;
      const proximo = new Date(lastUse);
      proximo.setMonth(proximo.getMonth() + intervalMonths);

      if (hoje < proximo) {
        this.fgtsValidation = {
          elegivel: false,
          motivo_bloqueio: `Último uso em ${format(lastUse, 'dd/MM/yyyy', { locale: ptBR })}. Próximo uso permitido em ${format(proximo, 'dd/MM/yyyy', { locale: ptBR })}.`,
          proximo_uso_permitido: proximo,
        };
        return false;
      }
    }

    // Regra 2: carência de subsídio (5 anos / 60 meses)
    if (divida.is_subsidized && divida.subsidy_expiration_date) {
      const expirationDate = new Date(divida.subsidy_expiration_date);
      if (hoje < expirationDate) {
        // Se amortizar tudo, precisa avisar
        const extraPlusFGTS = this.extraAmortizationAmount + this.fgtsAmount;
        if (divida.total_amount - extraPlusFGTS <= 0) {
          this.fgtsValidation = {
            elegivel: false,
            motivo_bloqueio: `Liquidar com FGTS antes de ${format(expirationDate, 'dd/MM/yyyy', { locale: ptBR })} exige devolução de subsídios (R$ ${divida.subsidy_amount || 0}).`,
          };
          return false;
        }
      }
    }

    this.fgtsValidation = { elegivel: true };

    // Regra 3: Saldo Estimado
    if (
      divida.estimated_fgts_balance &&
      this.fgtsAmount > divida.estimated_fgts_balance
    ) {
      this.fgtsValidation = {
        elegivel: true, // Ainda é elegível pelas regras do banco, mas o usuário não tem saldo
        motivo_bloqueio: `O valor (R$ ${this.fgtsAmount}) excede o saldo estimado cadastrado (R$ ${divida.estimated_fgts_balance}).`,
      };
      // Retornamos true pois a regra bancária permite, mas o template mostrará o aviso
    }

    return true;
  }

  openAgreement(debt: Debt) {
    this.agreementDebt = debt;
    this.agreementDialog = true;
    this.agreementResult = null;
    this.agreementProposal = {
      discountedTotal: debt.total_amount * 0.9,
      entryValue: debt.total_amount * 0.1,
      installmentCount: 12,
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
    const totalPaid = entry + installmentValue * count;
    this.agreementResult = {
      original,
      proposed,
      entry,
      installmentValue,
      totalPaid,
      savings: original - totalPaid,
      savingsPercent: ((original - totalPaid) / original) * 100,
    };
  }

  getDebtLabel(type: string) {
    const map: any = {
      credit_card_rotating: 'Cartão (Rotativo)',
      credit_card_installment: 'Cartão (Parcelado)',
      personal_loan: 'Empréstimo Pessoal',
      vehicle_financing: 'Financ. Veículo',
      real_estate_financing: 'Financ. Imóvel',
      overdraft: 'Cheque Especial',
      consigned_credit: 'Consignado',
      loan: 'Empréstimo (Legado)',
      financing: 'Financiamento (Legado)',
      other: 'Outro',
    };
    return map[type] || type;
  }

  getDebtStatusIcon(status: string) {
    if (status === 'overdue') return 'pi pi-exclamation-triangle';
    if (status === 'paid') return 'pi pi-check-circle';
    return 'pi pi-clock';
  }

  getDebtStatusColor(status: string) {
    if (status === 'overdue') return '#ef4444'; // Red
    if (status === 'paid') return '#22c55e'; // Green
    return '#f59e0b'; // Amber
  }

  navigateToPricing() {
    this.router.navigate(['/pricing']);
  }
  convertToMonthly(yearlyRate: number): string {
    const decimal = yearlyRate / 100;
    return ((Math.pow(1 + decimal, 1 / 12) - 1) * 100).toFixed(2);
  }

  getDebtStatusLabel(status: DebtStatus): string {
    const map: Record<string, string> = {
      [DebtStatus.ON_TIME]: 'Em dia',
      [DebtStatus.OVERDUE]: 'Atrasado',
      [DebtStatus.LATE]: 'Atrasado',
      [DebtStatus.NEGOTIATION]: 'Negociação',
    };
    return map[status] || status;
  }

  getDebtStatusSeverity(
    status: DebtStatus,
  ): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case DebtStatus.ON_TIME:
        return 'success';
      case DebtStatus.NEGOTIATION:
        return 'warn';
      case DebtStatus.OVERDUE:
      case DebtStatus.LATE:
        return 'danger';
      default:
        return 'info';
    }
  }

  isHighPriority(debt: Debt): boolean {
    let rate = debt.interest_rate;
    if (debt.interest_period === InterestPeriod.YEARLY) {
      rate = rate / 12;
    }
    return debt.status === DebtStatus.OVERDUE || rate > 5;
  }

  generateEvolutionTable() {
    if (!this.calcDebt || !this.amortizationResult) return;

    const debt = this.calcDebt;
    const res = this.amortizationResult;
    const balance = debt.total_amount;
    const rate = debt.interest_rate / 100;
    const isMonthly = debt.interest_period === InterestPeriod.MONTHLY;
    const monthlyRate = isMonthly ? rate : Math.pow(1 + rate, 1 / 12) - 1;
    const system = debt.amortization_system;

    const extra =
      (this.extraAmortizationAmount || 0) +
      (this.useFGTS ? this.fgtsAmount || 0 : 0);
    const newBalance = balance - extra;

    const table = [];

    const originalInstallments = debt.remaining_installments || 1;
    let originalPMT = 0;
    if (system === AmortizationSystem.PRICE) {
      originalPMT =
        (balance * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -originalInstallments));
    } else {
      originalPMT = balance / originalInstallments + balance * monthlyRate;
    }

    const newInstallments =
      res.reduce_term?.new_installments || originalInstallments;
    let newPMT = 0;
    if (system === AmortizationSystem.PRICE) {
      newPMT =
        (newBalance * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -newInstallments));
    } else {
      newPMT = newBalance / newInstallments + newBalance * monthlyRate;
    }

    const checkpoints = [1, 12, 24, 60, originalInstallments];
    const uniqueCheckpoints = [
      ...new Set(checkpoints.filter((c) => c <= originalInstallments)),
    ].sort((a, b) => a - b);

    for (const m of uniqueCheckpoints) {
      const isAfterNew = m > newInstallments;

      table.push({
        month: m,
        originalPMT: originalPMT,
        newPMT: isAfterNew ? 0 : newPMT,
        status: isAfterNew ? 'ELIMINADA' : 'ATIVA',
      });
    }

    this.evolutionTable.set(table);
    this.showEvolutionTable.set(true);
  }
}
