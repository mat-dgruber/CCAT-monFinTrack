import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker'; // <--- Importante
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select'; // <--- Importante
import { ConfirmationService, MessageService } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';

import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/transaction.model';
import { ICON_LIST } from '../../shared/icons'; // <--- Importe a lista


@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ButtonModule, 
    DialogModule, 
    InputTextModule, 
    ColorPickerModule, 
    ConfirmDialogModule,
    SelectModule, // <--- Adicione aqui
    SelectButtonModule
  ],
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.scss'
})
export class CategoryManager implements OnInit {
  private categoryService = inject(CategoryService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  categories = signal<Category[]>([]);
  visible = signal(false);
  editingId = signal<string | null>(null);

  // LISTA DE ÍCONES PARA O HTML
  icons = ICON_LIST;

  typeOptions = [
    { name: 'Despesa', value: 'expense' },
    { name: 'Receita', value: 'income' }
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    icon: ['pi pi-tag', Validators.required],
    color: ['#3b82f6', Validators.required],
    is_custom: [true],
    type: ['expense', Validators.required]
  });

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => this.categories.set(data));
  }

  openNew() {
    this.editingId.set(null);
    this.form.reset({ 
        name: '', 
        icon: 'pi pi-tag', 
        color: '#3b82f6', 
        type: 'expense', // Padrão
        is_custom: true 
    });
    this.visible.set(true);
  }

  editCategory(cat: Category) {
    this.editingId.set(cat.id!);
    this.form.patchValue(cat);
    this.visible.set(true);
  }

  deleteCategory(event: Event, id: string) {
    event.stopPropagation(); // Previne clique no card
    
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Apagar esta categoria?',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            this.categoryService.deleteCategory(id).subscribe(() => {
                this.messageService.add({severity:'success', summary:'Categoria Excluída'});
                this.loadCategories();
            });
        }
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const payload = this.form.value as Category;
      if (this.editingId()) {
        this.categoryService.updateCategory(this.editingId()!, payload).subscribe(() => {
            this.visible.set(false);
            this.loadCategories();
        });
      } else {
        this.categoryService.createCategory(payload).subscribe(() => {
            this.visible.set(false);
            this.loadCategories();
        });
      }
    }
  }
}