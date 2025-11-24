import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RefreshService {
  // Um sinal simples que incrementamos para avisar que algo mudou
  // Qualquer componente que "ouvir" esse sinal vai reagir
  refreshSignal = signal(0);

  triggerRefresh() {
    this.refreshSignal.set(this.refreshSignal() + 1);
  }
}
