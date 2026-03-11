import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CustomConfirmService } from '../../../services/custom-confirm.service';
import { trigger, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-custom-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './custom-confirm-dialog.component.html',
  styleUrl: './custom-confirm-dialog.component.scss',
  animations: [
    trigger('dialogAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('150ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ]),
    trigger('backdropAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('150ms linear', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms linear', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class CustomConfirmDialogComponent {
  public confirmService = inject(CustomConfirmService);

  get iconClass() {
    const severity = this.confirmService.options().severity;
    let baseClass = 'flex items-center justify-center w-14 h-14 rounded-full mb-4 mx-auto ';
    if (severity === 'danger') {
      return baseClass + 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400';
    } else if (severity === 'success') {
      return baseClass + 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400';
    } else if (severity === 'info') {
      return baseClass + 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400';
    }
    // warning or default
    return baseClass + 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400';
  }

  get buttonSeverity(): any {
    const sev = this.confirmService.options().severity;
    if (sev === 'danger') return 'danger';
    if (sev === 'success') return 'success';
    if (sev === 'info') return 'info';
    return 'primary';
  }
}
