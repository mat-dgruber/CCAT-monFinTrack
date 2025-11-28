import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { RecurrenceService } from '../../services/recurrence.service';
import { Recurrence } from '../../models/recurrence.model';

@Component({
  selector: 'app-subscriptions-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    ButtonModule, 
    TableModule, 
    TagModule,
    TabsModule,
    ProgressBarModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './subscriptions-dashboard.component.html',
  styleUrl: './subscriptions-dashboard.component.scss'
})
export class SubscriptionsDashboardComponent implements OnInit {
  private recurrenceService = inject(RecurrenceService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  recurrences = signal<Recurrence[]>([]);
  currentDate = signal(new Date());

  // Projeção de Recorrências para o Mês Atual
  projectedRecurrences = computed(() => {
    const active = this.recurrences().filter(r => r.active);
    const date = this.currentDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return active.map(r => {
        // Lógica simplificada: assume mensal para todos por enquanto ou usa due_day
        // Se due_day > dias no mês, ajusta para último dia
        let day = r.due_day;
        if (day > daysInMonth) day = daysInMonth;
        
        const dueDate = new Date(year, month, day);
        const isPaid = dueDate < new Date(); // Simplificação: se já passou, tá pago (ou pendente se integrarmos com transações reais)
        
        return {
            ...r,
            dueDate: dueDate,
            status: isPaid ? 'paid' : 'pending'
        };
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  });

  // Totais
  totalMonthly = computed(() => {
      return this.recurrences()
        .filter(r => r.active)
        .reduce((acc, r) => acc + r.amount, 0);
  });

  totalPaid = computed(() => {
      return this.projectedRecurrences()
        .filter(r => r.status === 'paid')
        .reduce((acc, r) => acc + r.amount, 0);
  });

  totalRemaining = computed(() => {
      return this.projectedRecurrences()
        .filter(r => r.status === 'pending')
        .reduce((acc, r) => acc + r.amount, 0);
  });

  progressPercentage = computed(() => {
      const total = this.totalMonthly();
      if (total === 0) return 0;
      return (this.totalPaid() / total) * 100;
  });

  constructor() {}

  ngOnInit() {
    this.loadRecurrences();
  }

  loadRecurrences() {
    this.recurrenceService.getRecurrences(true).subscribe(data => {
        this.recurrences.set(data);
    });
  }

  cancelRecurrence(recurrence: Recurrence) {
      this.confirmationService.confirm({
          message: `Tem certeza que deseja cancelar a assinatura "${recurrence.name}"?`,
          header: 'Confirmar Cancelamento',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Sim, Cancelar',
          rejectLabel: 'Não',
          acceptButtonStyleClass: 'p-button-danger p-button-text',
          rejectButtonStyleClass: 'p-button-text',
          accept: () => {
              this.recurrenceService.cancelRecurrence(recurrence.id).subscribe({
                  next: () => {
                      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Assinatura cancelada.' });
                      this.loadRecurrences();
                  },
                  error: () => {
                      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao cancelar assinatura.' });
                  }
              });
          }
      });
  }
}
