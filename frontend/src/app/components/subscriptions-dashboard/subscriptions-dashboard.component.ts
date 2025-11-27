import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
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

  totalMonthly = computed(() => {
      return this.recurrences()
        .filter(r => r.active)
        .reduce((acc, r) => acc + r.amount, 0);
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
