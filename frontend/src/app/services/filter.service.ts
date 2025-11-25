import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  // Data atual selecionada (começa hoje)
  currentDate = signal(new Date());

  // Signals auxiliares para facilitar
  month = computed(() => this.currentDate().getMonth() + 1); // JS mês é 0-11, API quer 1-12
  year = computed(() => this.currentDate().getFullYear());

  // Navegação
  nextMonth() {
    const next = new Date(this.currentDate());
    next.setMonth(next.getMonth() + 1);
    this.currentDate.set(next);
  }

  prevMonth() {
    const prev = new Date(this.currentDate());
    prev.setMonth(prev.getMonth() - 1);
    this.currentDate.set(prev);
  }
  
  // Formata para exibir na tela (ex: "Novembro 2025")
  get displayDate(): string {
      return this.currentDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
}
