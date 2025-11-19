import { Component, EventEmitter, Output, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

//PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';        
import { DatePickerModule } from 'primeng/datepicker'; 
import { SelectButtonModule } from 'primeng/selectbutton';

import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { Category } from '../../models/transaction.model';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule, InputNumberModule, SelectModule, DatePickerModule, SelectButtonModule],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm implements OnInit{

  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);

  visible = signal(false);
  categories = signal<Category[]>([]);
  @Output() save = new EventEmitter<void>();

  typeOptions = [
    { label: 'Despesas', value: 'expense' },
    { label: 'Receitas', value: 'income' },
  ];

  paymentOptions = [
    { label:'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' }
  ]

  form: FormGroup = this.fb.group({
    description: ['', [Validators.required, Validators.minLength(3)]],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    category: [null, Validators.required],
    type: ['expense', Validators.required],
    payment_method: [null, Validators.required]
  });

  ngOnInit() {
    this.loadCategories();  
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => {
      this.categories.set(data);
    })
  }

  showDialog() {
    this.visible.set(true);
  }

  onSubmit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const payload = {
        ...formValue,
        category_id: formValue.category.id
      };

      this.transactionService.createTransaction(payload).subscribe({
        next: () => {
          this.visible.set(false);
          this.form.reset({ type: 'expense', date: new Date(), payment_method: null });
          this.save.emit();
          console.log('Transação salva com sucesso!');
        },
        error: (error) => console.error('Erro ao salvar transação:', error)
      });
    }

  };



}
