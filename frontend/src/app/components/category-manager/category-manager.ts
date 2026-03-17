import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CustomConfirmService } from '../../services/custom-confirm.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { SelectModule } from 'primeng/select';
import { MessageService, MenuItem } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MenuModule } from 'primeng/menu';
import { TagModule } from 'primeng/tag';

import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { ICON_LIST } from '../../shared/icons';
import { PageHelpComponent } from '../page-help/page-help';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ColorPickerModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    PageHelpComponent,
    MenuModule,
    TagModule,
  ],
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.scss',
})
export class CategoryManager implements OnInit {
  private categoryService = inject(CategoryService);
  private confirmationService = inject(CustomConfirmService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  categories = signal<Category[]>([]);
  loading = signal(true);
  visible = signal(false);
  editingId = signal<string | null>(null);
  searchTerm = signal('');

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

  // Flat list for Row Group Table (Filtered)
  tableData = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const result: any[] = [];

    // Sort categories by type then name
    const sortedCats = [...this.categories()].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });

    for (const cat of sortedCats) {
      const parentMatches = cat.name.toLowerCase().includes(term);
      const filteredSubs =
        cat.subcategories?.filter((s) => s.name.toLowerCase().includes(term)) ||
        [];

      // Se o pai combina OU qualquer filho combina, adicionamos o grupo
      if (parentMatches || filteredSubs.length > 0) {
        // Placeholder do header (pai)
        result.push({ ...cat, parent: cat, isPlaceholder: true });

        // Se o termo de busca estiver vazio ou o pai combinar, mostramos todos os filhos?
        // Não, mostramos apenas os que combinam (se houver termo) ou todos (se vazio).
        const subsToShow = term ? filteredSubs : cat.subcategories || [];

        for (const sub of subsToShow) {
          result.push({ ...sub, parent: cat, isPlaceholder: false });
        }
      }
    }
    return result;
  });

  filteredCategories = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.categories();

    return this.categories()
      .map((cat) => {
        const parentMatches = cat.name.toLowerCase().includes(term);
        const filteredSubs =
          cat.subcategories?.filter((s) =>
            s.name.toLowerCase().includes(term),
          ) || [];

        if (parentMatches || filteredSubs.length > 0) {
          return { ...cat, subcategories: filteredSubs };
        }
        return null;
      })
      .filter((c) => c !== null) as Category[];
  });

  // --- Métodos de UI ---

  getCategoryTypeSeverity(type: string): any {
    return type === 'income' ? 'success' : 'danger';
  }

  getCategoryMenuItems(cat: Category): MenuItem[] {
    return [
      {
        label: 'Ações',
        items: [
          {
            label: 'Editar',
            icon: 'pi pi-pencil',
            command: () => this.editCategory(cat),
          },
          {
            label: 'Excluir',
            icon: 'pi pi-trash',
            className: 'text-red-600',
            command: () => this.deleteCategoryForMenu(cat.id!),
          },
        ],
      },
    ];
  }

  private deleteCategoryForMenu(id: string) {
    this.confirmationService.confirm({
      message: 'Apagar esta categoria?',
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.categoryService.deleteCategory(id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Categoria Excluída',
            });
            this.loadCategories();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: err.error?.detail || 'Não foi possível excluir',
            });
          },
        });
      },
    });
  }

  // LISTA DE ÍCONES PARA O HTML
  icons = ICON_LIST;

  typeOptions = [
    { label: 'Despesa', value: 'expense', icon: 'pi pi-minus-circle' },
    { label: 'Receita', value: 'income', icon: 'pi pi-plus-circle' },
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    icon: ['pi pi-tag', Validators.required],
    color: ['#3b82f6', Validators.required],
    is_custom: [true],
    type: ['expense', Validators.required],
    parent_id: [null as string | null],
  });

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading.set(true);
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        const sorted = data
          .filter((c) => !c.is_hidden && c.type !== 'transfer')
          .sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.name.localeCompare(b.name);
          });
        this.categories.set(sorted);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar categorias', err);
        this.loading.set(false);
      },
    });
  }

  openNew() {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      icon: 'pi pi-tag',
      color: '#3b82f6',
      type: 'expense', // Padrão
      is_custom: true,
      parent_id: null,
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
      parent_id: cat.parent_id || null,
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
            this.messageService.add({
              severity: 'success',
              summary: 'Categoria Excluída',
            });
            this.loadCategories();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: err.error.detail || 'Não foi possível excluir',
            });
          },
        });
      },
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const payload = this.form.value as Category;
      if (this.editingId()) {
        this.categoryService
          .updateCategory(this.editingId()!, payload)
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Sucesso',
                detail: 'Categoria atualizada.',
              });
              this.visible.set(false);
              this.loadCategories();
            },
            error: (err) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Erro',
                detail: 'Erro ao atualizar categoria.',
              });
            },
          });
      } else {
        this.categoryService.createCategory(payload).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Sucesso',
              detail: 'Categoria criada.',
            });
            this.visible.set(false);
            this.loadCategories();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Erro ao criar categoria.',
            });
          },
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

    return this.flatCategories().filter((c) => {
      if (c.type !== currentType) return false;
      if (currentId && c.id === currentId) return false;
      // Prevent selecting a child as parent (Circular dependency prevention level 1)
      // Ideally we traverse children, but simply blocking if id is in current children is hard without deep traversal.
      // For now, simple ID check.
      return true;
    });
  }
}
