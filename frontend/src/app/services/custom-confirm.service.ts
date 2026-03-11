import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  header?: string;
  message?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptButtonStyleClass?: string;
  rejectButtonStyleClass?: string;
  severity?: 'success' | 'info' | 'warning' | 'danger';
  target?: EventTarget | null | any;
  accept?: () => void;
  reject?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class CustomConfirmService {
  isOpen = signal<boolean>(false);
  options = signal<ConfirmOptions>({});

  confirm(opts: ConfirmOptions) {
    this.options.set({
      header: opts.header || 'Confirmar',
      message: opts.message || 'Tem certeza disso?',
      icon: opts.icon || 'pi pi-exclamation-triangle',
      acceptLabel: opts.acceptLabel || 'Sim',
      rejectLabel: opts.rejectLabel || 'Não',
      acceptButtonStyleClass: opts.acceptButtonStyleClass || '',
      rejectButtonStyleClass: opts.rejectButtonStyleClass || '',
      severity: opts.severity || 'warning',
      accept: opts.accept,
      reject: opts.reject
    });
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  accept() {
    const opts = this.options();
    if (opts.accept) {
      opts.accept();
    }
    this.close();
  }

  reject() {
    const opts = this.options();
    if (opts.reject) {
      opts.reject();
    }
    this.close();
  }
}
