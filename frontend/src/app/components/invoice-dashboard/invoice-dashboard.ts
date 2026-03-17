import {
  Component,
  OnInit,
  inject,
  signal,
  effect,
  Input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Required for ngModel in dialog
import { Router } from '@angular/router'; // Import Router
import { InvoiceService } from '../../services/invoice.service';
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { SubscriptionService } from '../../services/subscription.service'; // Import SubscriptionService
import { InvoiceSummary } from '../../models/invoice.model';
import { Account } from '../../models/account.model';
import { PageHelpComponent } from '../page-help/page-help';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-invoice-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SkeletonModule,
    DialogModule,
    SelectModule,
    DatePickerModule,
    PageHelpComponent,
  ],
  templateUrl: './invoice-dashboard.html',
  styles: [
    `
      .surface-card {
        background-color: var(--surface-card);
      }
      .surface-ground {
        background-color: var(--surface-ground);
      }
      .surface-border {
        border-color: var(--surface-border);
      }
    `,
  ],
})
export class InvoiceDashboard implements OnInit {
  private invoiceService = inject(InvoiceService);
  private accountService = inject(AccountService);
  private refreshService = inject(RefreshService);
  private messageService = inject(MessageService);
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  @Input() isWidget = false;

  canAccess = computed(() => this.subscriptionService.canAccess('invoices'));

  navigateToPricing() {
    this.router.navigate(['/pricing']);
  }

  invoices = signal<InvoiceSummary[]>([]);
  loading = signal(true);

  // Payment Modal State
  paymentVisible = signal(false);
  selectedInvoice = signal<InvoiceSummary | null>(null);
  accounts = signal<Account[]>([]);
  selectedAccount = signal<string | null>(null); // Transformado em signal
  paymentDate: Date = new Date();
  paymentLoading = signal(false);

  selectedAccountBalance = computed(() => {
    const accId = this.selectedAccount();
    if (!accId) return null;
    return this.accounts().find((a) => a.id === accId)?.balance || 0;
  });

  getDaysRemaining(dueDateStr: string): { days: number; text: string } {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { days: 0, text: 'Vence hoje!' };
    if (diffDays === 1) return { days: 1, text: 'Vence amanhã' };
    if (diffDays < 0)
      return { days: diffDays, text: `Atrasada há ${Math.abs(diffDays)} dias` };
    return { days: diffDays, text: `Vence em ${diffDays} dias` };
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'open':
        return '#22c55e'; // Green
      case 'closed':
        return '#3b82f6'; // Blue
      case 'overdue':
        return '#ef4444'; // Red
      case 'paid':
        return '#10b981'; // Teal
      default:
        return '#6b7280'; // Gray
    }
  }

  constructor() {
    effect(() => {
      this.refreshService.refreshSignal();
      this.loadInvoices();
    });
  }

  ngOnInit() {
    this.loadInvoices();
    this.loadAccounts();
  }

  loadInvoices() {
    this.loading.set(true);
    this.invoiceService.getInvoices().subscribe({
      next: (data) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed

        const filteredData = data.filter((inv) => {
          if (inv.year < currentYear) return true;
          if (inv.year === currentYear && inv.month <= currentMonth)
            return true;
          return false;
        });

        this.invoices.set(filteredData);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
    });
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe((data) => {
      // Filtrar apenas contas bancárias de verdade (não cartões) para pagar a fatura
      this.accounts.set(data.filter((a) => a.type !== 'credit_card'));
    });
  }

  openPaymentDialog(invoice: InvoiceSummary) {
    this.selectedInvoice.set(invoice);
    this.paymentDate = new Date();
    this.selectedAccount.set(null); // Reset selection

    // Tentar auto-selecionar a conta "mãe" se possível, mas aqui invoice.account_id é a conta do cartão.
    // Se a conta do cartão for "Nubank", e houver uma conta "Nubank" (checking), talvez seja a mesma?
    // No schema Account, o cartão está DENTRO da conta.
    // Então invoice.account_id É a conta mãe.
    // Podemos pré-selecionar ela se ela estiver na lista de accounts (checking).

    const motherAccount = this.accounts().find(
      (a) => a.id === invoice.account_id,
    );
    if (motherAccount) {
      this.selectedAccount.set(motherAccount.id!);
    }

    this.paymentVisible.set(true);
  }

  confirmPayment() {
    if (!this.selectedAccount() || !this.selectedInvoice()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Selecione uma conta de origem.',
      });
      return;
    }

    this.paymentLoading.set(true);
    const inv = this.selectedInvoice()!;

    this.invoiceService
      .payInvoice({
        credit_card_id: inv.credit_card_id,
        amount: inv.amount,
        source_account_id: this.selectedAccount()!,
        description: `Pagamento Fatura ${inv.card_name}`,
        payment_date: this.paymentDate.toISOString(),
        month: inv.month,
        year: inv.year,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: 'Fatura paga!',
          });
          this.paymentVisible.set(false);
          this.paymentLoading.set(false);
          this.refreshService.triggerRefresh(); // Atualiza tudo
        },
        error: (err) => {
          const msg = err.error?.detail || 'Falha ao pagar fatura.';
          this.messageService.add({
            severity: 'error',
            summary: 'Erro',
            detail: msg,
          });
          this.paymentLoading.set(false);
        },
      });
  }
}
