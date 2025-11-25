import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { FilterService } from '../../services/filter.service';

@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
        <p-button icon="pi pi-chevron-left" [text]="true" [rounded]="true" (onClick)="filterService.prevMonth()"></p-button>
        
        <span class="font-bold text-gray-700 capitalize min-w-[150px] text-center select-none">
            {{ filterService.displayDate }}
        </span>
        
        <p-button icon="pi pi-chevron-right" [text]="true" [rounded]="true" (onClick)="filterService.nextMonth()"></p-button>
    </div>
  `
})
export class MonthSelector {
  public filterService = inject(FilterService);
}
