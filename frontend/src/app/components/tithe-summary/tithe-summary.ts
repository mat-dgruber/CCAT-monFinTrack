import { CustomConfirmService } from '../../services/custom-confirm.service';
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';
import { RefreshService } from '../../services/refresh.service';

@Component({
  selector: 'app-tithe-summary',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    TagModule,
    SkeletonModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './tithe-summary.html',
  styleUrl: './tithe-summary.scss',
})
export class TitheSummaryComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private confirmationService = inject(CustomConfirmService);
  private messageService = inject(MessageService);
  private refreshService = inject(RefreshService);

  loading = signal(false);
  paying = signal(false);
  pendingTransactions = signal<Transaction[]>([]);

  totalTithe = computed(() => {
    return this.pendingTransactions().reduce(
      (sum, t) => sum + (t.tithe_amount || 0),
      0,
    );
  });

  totalOffering = computed(() => {
    return this.pendingTransactions().reduce(
      (sum, t) => sum + (t.offering_amount || 0),
      0,
    );
  });

  totalCombined = computed(() => {
    return this.totalTithe() + this.totalOffering();
  });

  pendingCount = computed(() => this.pendingTransactions().length);

  constructor() {
    // Auto-refresh when dashboard data changes (e.g., new transaction created)
    effect(() => {
      this.refreshService.refreshSignal();
      this.loadPendingTithes();
    });
  }

  ngOnInit() {
    // Initial load handled by effect in constructor
  }

  loadPendingTithes() {
    this.loading.set(true);
    this.transactionService.getPendingTithes().subscribe({
      next: (data) => {
        this.pendingTransactions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading pending tithes', err);
        this.loading.set(false);
      },
    });
  }

  confirmPayAll() {
    this.confirmationService.confirm({
      message: `Deseja marcar ${this.pendingCount()} dízimo(s) pendente(s) como pago(s)? O valor total é de ${this.formatCurrency(this.totalCombined())}.`,
      header: 'Confirmar Pagamento',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Marcar como Pago',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.payAll(),
    });
  }

  payAll() {
    this.paying.set(true);
    this.transactionService.payAllTithes().subscribe({
      next: (res) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Dízimos Pagos!',
          detail:
            res.message ||
            `${res.updated_count} dízimo(s) marcado(s) como pago.`,
        });
        this.pendingTransactions.set([]);
        this.paying.set(false);
        this.refreshService.triggerRefresh();
      },
      error: (err) => {
        console.error('Error paying tithes', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Não foi possível marcar os dízimos como pagos.',
        });
        this.paying.set(false);
      },
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
}
