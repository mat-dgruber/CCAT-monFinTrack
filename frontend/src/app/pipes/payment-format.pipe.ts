import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'paymentFormat',
  standalone: true
})
export class PaymentFormatPipe implements PipeTransform {

  // Dicionário de tradução
  private paymentMap: Record<string, string> = {
    'credit_card': 'Cartão de Crédito',
    'debit_card': 'Débito',
    'pix': 'Pix',
    'cash': 'Dinheiro',
    'bank_transfer': 'Transferência',
    'other': 'Outros'
  };

  transform(value: string): string {
    // Retorna a tradução ou o valor original se não encontrar
    return this.paymentMap[value] || value;
  }
}