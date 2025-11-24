import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'accountType',
  standalone: true
})
export class AccountTypePipe implements PipeTransform {

  private typeMap: Record<string, string> = {
    'checking': 'Conta Corrente',
    'savings': 'Poupança',
    'investment': 'Investimento',
    'cash': 'Dinheiro / Carteira',
    'credit_card': 'Cartão de Crédito',
    'other': 'Outros'
  };

  transform(value: string): string {
    return this.typeMap[value] || value;
  }
}