import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
     name: 'periodicity',
     standalone: true
})
export class PeriodicityPipe implements PipeTransform {

     transform(value: string | undefined | null): string {
          if (!value) return '';

          switch (value.toLowerCase()) {
               case 'monthly':
                    return 'Mensal';
               case 'weekly':
                    return 'Semanal';
               case 'yearly':
                    return 'Anual';
               default:
                    return value;
          }
     }

}
