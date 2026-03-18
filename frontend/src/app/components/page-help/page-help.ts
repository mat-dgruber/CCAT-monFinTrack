import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-page-help',
  standalone: true,
  imports: [CommonModule, MarkdownModule, DrawerModule, ButtonModule],
  templateUrl: './page-help.html',
})
export class PageHelpComponent {
  document = input.required<string>(); // gsl-movimento-estoque.md
  title = input<string>('Ajuda e Documentação');

  isOpen = signal(false);
  hasError = signal(false);

  // url para bater no assets folder
  documentUrl = computed(() => {
    return `/assets/docs/manuais-usuario/${this.document()}`;
  });

  openDrawer() {
    this.isOpen.set(true);
  }

  closeDrawer() {
    this.isOpen.set(false);
  }

  onLoad(event: any) {
    this.hasError.set(false);
  }

  onError(error: any) {
    console.error('Erro ao carregar o manual Markdown:', error);
    this.hasError.set(true);
  }
}
