import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';

import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { ICON_LIST } from '../../shared/icons';


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
    SelectModule,
    SelectButtonModule,
    TableModule
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

  // Computed flat list for the dropdown (only potential parents)
  flatCategories = computed(() => {
    const result: Category[] = [];
    const traverse = (nodes: Category[]) => {
      for (const node of nodes) {
        result.push(node);
        if (node.subcategories) {
          traverse(node.subcategories);
        }
      }
    };
    traverse(this.categories());
    return result;
  });

  // Flat list for Row Group Table
  tableData = computed(() => {
    const result: any[] = [];
    // Sort categories by type then name
    const sortedCats = [...this.categories()].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
    });

    for (const cat of sortedCats) {
        if (cat.subcategories && cat.subcategories.length > 0) {
            for (const sub of cat.subcategories) {
                result.push({ ...sub, parent: cat, isPlaceholder: false });
            }
        } else {
            // Placeholder for empty parents so they show up as headers
            result.push({ parent: cat, isPlaceholder: true });
        }
    }
    return result;
  });

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
    type: ['expense', Validators.required],
    parent_id: [null as string | null]
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
        is_custom: true,
        parent_id: null
    });
    this.visible.set(true);
  }

  editCategory(cat: Category) {
    this.editingId.set(cat.id!);
    this.form.patchValue({
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        is_custom: cat.is_custom,
        type: cat.type,
        parent_id: cat.parent_id || null
    });
    this.visible.set(true);
  }

  deleteCategory(event: Event, id: string) {
    event.stopPropagation(); // Previne clique no card
    
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Apagar esta categoria?',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            this.categoryService.deleteCategory(id).subscribe({
                next: () => {
                    this.messageService.add({severity:'success', summary:'Categoria Excluída'});
                    this.loadCategories();
                },
                error: (err) => {
                     this.messageService.add({severity:'error', summary:'Erro', detail: err.error.detail || 'Não foi possível excluir'});
                }
            });
        }
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const payload = this.form.value as Category;
      if (this.editingId()) {
        this.categoryService.updateCategory(this.editingId()!, payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Categoria atualizada.' });
                this.visible.set(false);
                this.loadCategories();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao atualizar categoria.' });
            }
        });
      } else {
        this.categoryService.createCategory(payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Categoria criada.' });
                this.visible.set(false);
                this.loadCategories();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao criar categoria.' });
            }
        });
      }
    }
  }

  // Filter options for parent selection:
  // 1. Match type (expense/income)
  // 2. Cannot be itself (if editing)
  // 3. Cannot be a child of itself (circular - simplistic check)
  getParentOptions() {
      const currentType = this.form.get('type')?.value;
      const currentId = this.editingId();
      
      return this.flatCategories().filter(c => {
          if (c.type !== currentType) return false;
          if (currentId && c.id === currentId) return false;
          // Prevent selecting a child as parent (Circular dependency prevention level 1)
          // Ideally we traverse children, but simply blocking if id is in current children is hard without deep traversal.
          // For now, simple ID check.
          return true;
      });
  }
}