import { Component, OnInit, inject, signal, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Required for ngModel in dialog
import { InvoiceService } from '../../services/invoice.service';
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { InvoiceSummary } from '../../models/invoice.model';
import { Account } from '../../models/account.model';

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
      DatePickerModule
  ],
  templateUrl: './invoice-dashboard.html',
  styles: [`
      .surface-card { background-color: var(--surface-card); }
      .surface-ground { background-color: var(--surface-ground); }
      .surface-border { border-color: var(--surface-border); }
  `]
})
export class InvoiceDashboard implements OnInit {
  private invoiceService = inject(InvoiceService);
  private accountService = inject(AccountService);
  private refreshService = inject(RefreshService);
  private messageService = inject(MessageService);
  
  @Input() isWidget = false;

  invoices = signal<InvoiceSummary[]>([]);
  loading = signal(true);
  
  // Payment Modal State
  paymentVisible = signal(false);
  selectedInvoice = signal<InvoiceSummary | null>(null);
  accounts = signal<Account[]>([]);
  selectedAccount: string | null = null;
  paymentDate: Date = new Date();
  paymentLoading = signal(false);

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
              this.invoices.set(data);
              this.loading.set(false);
          },
          error: (err) => {
              console.error(err);
              this.loading.set(false);
          }
      });
  }

  loadAccounts() {
      this.accountService.getAccounts().subscribe(data => {
          // Filtrar apenas contas bancárias de verdade (não cartões) para pagar a fatura
          this.accounts.set(data.filter(a => a.type !== 'credit_card'));
      });
  }

  openPaymentDialog(invoice: InvoiceSummary) {
      this.selectedInvoice.set(invoice);
      this.paymentDate = new Date();
      this.selectedAccount = null; // Reset selection
      
      // Tentar auto-selecionar a conta "mãe" se possível, mas aqui invoice.account_id é a conta do cartão.
      // Se a conta do cartão for "Nubank", e houver uma conta "Nubank" (checking), talvez seja a mesma?
      // No schema Account, o cartão está DENTRO da conta.
      // Então invoice.account_id É a conta mãe.
      // Podemos pré-selecionar ela se ela estiver na lista de accounts (checking).
      
      const motherAccount = this.accounts().find(a => a.id === invoice.account_id);
      if (motherAccount) {
          this.selectedAccount = motherAccount.id!;
      }
      
      this.paymentVisible.set(true);
  }

  confirmPayment() {
      if (!this.selectedAccount || !this.selectedInvoice()) {
          this.messageService.add({severity:'warn', summary:'Atenção', detail:'Selecione uma conta de origem.'});
          return;
      }

      this.paymentLoading.set(true);
      const inv = this.selectedInvoice()!;
      
      this.invoiceService.payInvoice({
          credit_card_id: inv.credit_card_id,
          amount: inv.amount,
          source_account_id: this.selectedAccount,
          description: `Pagamento Fatura ${inv.card_name}`,
          payment_date: this.paymentDate.toISOString(),
          month: inv.month,
          year: inv.year
      }).subscribe({
          next: () => {
              this.messageService.add({severity:'success', summary:'Sucesso', detail:'Fatura paga!'});
              this.paymentVisible.set(false);
              this.paymentLoading.set(false);
              this.refreshService.triggerRefresh(); // Atualiza tudo
          },
          error: (err) => {
              this.messageService.add({severity:'error', summary:'Erro', detail:'Falha ao pagar fatura.'});
              this.paymentLoading.set(false);
          }
      });
  }
}
