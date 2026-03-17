import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  Output,
  EventEmitter,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../../services/subscription.service';
import { CalculatorService } from '../../../services/calculator.service';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

export type CalculatorMode = 'arithmetic' | 'financial';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, TagModule, ButtonModule, TooltipModule],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
})
export class CalculatorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('calculatorWindow') calculatorWindow!: ElementRef;
  @ViewChild('dragHandle') dragHandle!: ElementRef;

  @Output() close = new EventEmitter<void>();

  private subService = inject(SubscriptionService);
  private calcService = inject(CalculatorService);

  display = signal('0');
  currentInput = '';
  previousInput = '';
  operator: string | null = null;
  mode = signal<CalculatorMode>('arithmetic');

  // History / Tape
  history = signal<string[]>([]);
  showHistory = signal(false);

  // Financial Form
  financialData = {
    balance: 0,
    rate: 0,
    installment: 0,
    extra: 0,
    type: 'amortization' as 'amortization' | 'present_value',
    dueDate: '',
  };
  financialResult = signal<any>(null);
  loading = signal(false);

  // Subscriptions
  canUseFinancial = computed(() =>
    this.subService.canAccess('calculator_financial'),
  );
  canUseHistory = computed(() =>
    this.subService.canAccess('calculator_history'),
  );
  financialBadge = computed(() =>
    this.subService.getFeatureBadge('calculator_financial'),
  );
  historyBadge = computed(() =>
    this.subService.getFeatureBadge('calculator_history'),
  );

  // Dragging state
  private isDragging = false;
  private initialX = 0;
  private initialY = 0;
  private currentX = 0;
  private currentY = 0;
  private xOffset = 0;
  private yOffset = 0;

  private dragStartListener: any;
  private dragEndListener: any;
  private dragListener: any;

  ngAfterViewInit() {
    this.initDrag();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.mode() === 'financial') return;

    const key = event.key;
    if (/[0-9]/.test(key)) {
      this.appendNumber(key);
    } else if (key === '.') {
      this.appendNumber('.');
    } else if (['+', '-', '*', '/'].includes(key)) {
      this.setOperator(key);
    } else if (key === 'Enter' || key === '=') {
      this.calculate();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
      this.clear();
    } else if (key === 'Backspace') {
      this.backspace();
    }
  }

  backspace() {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      this.display.set(this.currentInput || '0');
    }
  }

  setMode(newMode: CalculatorMode) {
    if (newMode === 'financial' && !this.canUseFinancial()) {
      // Could show a toast or message here
      return;
    }
    this.mode.set(newMode);
  }

  toggleHistory() {
    if (!this.canUseHistory()) return;
    this.showHistory.update((v) => !v);
  }

  copyResult() {
    const val = this.display();
    navigator.clipboard.writeText(val);
    // Simple visual feedback could be added here
  }

  ngOnDestroy() {
    this.removeDragListeners();
  }

  // --- Calculator Logic ---

  appendNumber(num: string) {
    if (this.currentInput.length > 10) return; // Limit length
    if (num === '.' && this.currentInput.includes('.')) return;

    // If we just finished a calculation and type a number, start fresh
    if (!this.operator && this.previousInput && !this.currentInput) {
      this.previousInput = '';
      this.display.set('');
    }

    if (this.currentInput === '0' && num !== '.') {
      this.currentInput = num;
    } else {
      this.currentInput += num;
    }
    this.display.set(this.currentInput);
  }

  setOperator(op: string) {
    if (this.currentInput === '') {
      if (this.previousInput !== '') {
        this.operator = op;
      }
      return;
    }

    if (this.previousInput !== '') {
      this.calculate();
    }

    this.operator = op;
    this.previousInput = this.currentInput;
    this.currentInput = '';
  }

  clear() {
    this.currentInput = '';
    this.previousInput = '';
    this.operator = null;
    this.display.set('0');
  }

  calculate() {
    let calculation = 0;
    const prev = parseFloat(this.previousInput);
    const current = parseFloat(this.currentInput);

    if (isNaN(prev) || isNaN(current)) return;

    switch (this.operator) {
      case '+':
        calculation = prev + current;
        break;
      case '-':
        calculation = prev - current;
        break;
      case '*':
        calculation = prev * current;
        break;
      case '/':
        if (current === 0) return;
        calculation = prev / current;
        break;
      default:
        return;
    }

    const entry = `${prev} ${this.operator} ${current} = ${calculation}`;
    this.addToHistory(entry);

    this.currentInput = calculation.toString();
    this.operator = null;
    this.previousInput = '';
    this.display.set(this.currentInput);
  }

  private addToHistory(entry: string) {
    if (!this.canUseHistory()) return;
    const currentHistory = this.history();
    this.history.set([entry, ...currentHistory].slice(0, 20));
  }

  // --- Financial Logic ---

  runFinancial() {
    if (!this.canUseFinancial()) return;
    this.loading.set(true);

    if (this.financialData.type === 'amortization') {
      this.calcService
        .simulateAmortization({
          balance: this.financialData.balance,
          rate_monthly: this.financialData.rate,
          installment: this.financialData.installment,
          extra_amount: this.financialData.extra,
        })
        .subscribe({
          next: (res) => {
            this.financialResult.set(res);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    } else {
      this.calcService
        .calculatePresentValue({
          parcel_value: this.financialData.installment,
          monthly_interest_rate: this.financialData.rate,
          due_date: this.financialData.dueDate,
        })
        .subscribe({
          next: (res) => {
            this.financialResult.set(res);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    }
  }

  // Explicit % button handler if we want single-operand % (like converting 50 to 0.5)
  // Or current logic handles it as an operator or modifier.
  // Let's implement a specific method for the '%' button to match user expectation:
  // Usually % applies to the current number immediately based on context.

  handlePercentage() {
    if (!this.currentInput) return;

    const current = parseFloat(this.currentInput);

    if (this.previousInput && this.operator) {
      // We are in the middle of an expression: 100 + 10...
      // 10 becomes 10% of 100 (which is 10)
      const prev = parseFloat(this.previousInput);
      const percentVal = (prev * current) / 100;
      this.currentInput = percentVal.toString();
      this.display.set(this.currentInput);
    } else {
      // Just a number: 50 % -> 0.5
      this.currentInput = (current / 100).toString();
      this.display.set(this.currentInput);
    }
  }

  // --- Drag Logic (Vanilla JS) ---

  private initDrag() {
    this.dragStartListener = this.dragStart.bind(this);
    this.dragEndListener = this.dragEnd.bind(this);
    this.dragListener = this.drag.bind(this);

    const handle = this.dragHandle.nativeElement;

    // Mouse events
    handle.addEventListener('mousedown', this.dragStartListener);
    document.addEventListener('mouseup', this.dragEndListener);
    document.addEventListener('mousemove', this.dragListener);

    // Touch events (for mobile consideration, though requested as 'sidebar' on desktop mostly)
    handle.addEventListener('touchstart', this.dragStartListener, {
      passive: false,
    });
    document.addEventListener('touchend', this.dragEndListener);
    document.addEventListener('touchmove', this.dragListener, {
      passive: false,
    });
  }

  private removeDragListeners() {
    const handle = this.dragHandle?.nativeElement;
    if (handle) {
      handle.removeEventListener('mousedown', this.dragStartListener);
      handle.removeEventListener('touchstart', this.dragStartListener);
    }
    document.removeEventListener('mouseup', this.dragEndListener);
    document.removeEventListener('mousemove', this.dragListener);
    document.removeEventListener('touchend', this.dragEndListener);
    document.removeEventListener('touchmove', this.dragListener);
  }

  private dragStart(e: any) {
    if (e.type === 'touchstart') {
      this.initialX = e.touches[0].clientX - this.xOffset;
      this.initialY = e.touches[0].clientY - this.yOffset;
    } else {
      this.initialX = e.clientX - this.xOffset;
      this.initialY = e.clientY - this.yOffset;
    }

    if (
      e.target === this.dragHandle.nativeElement ||
      this.dragHandle.nativeElement.contains(e.target)
    ) {
      this.isDragging = true;
    }
  }

  private dragEnd(e: any) {
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
  }

  private drag(e: any) {
    if (this.isDragging) {
      e.preventDefault();

      if (e.type === 'touchmove') {
        this.currentX = e.touches[0].clientX - this.initialX;
        this.currentY = e.touches[0].clientY - this.initialY;
      } else {
        this.currentX = e.clientX - this.initialX;
        this.currentY = e.clientY - this.initialY;
      }

      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      this.setTranslate(
        this.currentX,
        this.currentY,
        this.calculatorWindow.nativeElement,
      );
    }
  }

  private setTranslate(xPos: number, yPos: number, el: HTMLElement) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}
