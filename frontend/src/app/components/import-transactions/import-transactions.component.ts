import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select'; // Updated to SelectModule
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';
import { SubscriptionService } from '../../services/subscription.service';
import { computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { Transaction } from '../../models/transaction.model';

interface DraftTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category_id?: string;
  source: string;
  selected?: boolean;
}

@Component({
  selector: 'app-import-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    TableModule,
    ButtonModule,
    SelectModule, // Updated
    ToastModule,
    TooltipModule,
    CheckboxModule
  ],
  providers: [MessageService],
  templateUrl: './import-transactions.component.html',
  styleUrl: './import-transactions.component.scss'
})
export class ImportTransactionsComponent {
  private http = inject(HttpClient);
  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private accountService = inject(AccountService);
  private messageService = inject(MessageService);

  uploadedFiles: any[] = [];
  transactions = signal<DraftTransaction[]>([]);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);

  selectedAccount = signal<Account | null>(null);

  loading = signal(false);

  subscriptionService = inject(SubscriptionService);
  canAccess = computed(() => this.subscriptionService.canAccess('import'));

  constructor() {
    this.loadData();
  }

  loadData() {
    this.categoryService.getCategories().subscribe(cats => this.categories.set(cats));
    this.accountService.getAccounts().subscribe(accs => this.accounts.set(accs));
  }

  myUploader(event: any) {
      const file = event.files[0];
      this.uploadFile(file);
  }

  uploadFile(file: File) {
    this.loading.set(true);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<DraftTransaction[]>(`${environment.apiUrl}/import/preview`, formData)
      .subscribe({
        next: (data) => {
          const drafts = data.map(d => ({ ...d, selected: true }));
          this.transactions.set(drafts);
          this.loading.set(false);
          this.messageService.add({severity:'success', summary: 'Arquivo analisado', detail: `${drafts.length} transações encontradas.`});
        },
        error: (err) => {
            console.error(err);
            this.loading.set(false);
            this.messageService.add({severity:'error', summary: 'Erro', detail: 'Falha ao ler arquivo.'});
        }
      });
  }

  async importSelected() {
    const selected = this.transactions().filter(t => t.selected);
    if (selected.length === 0) return;

    const account = this.selectedAccount();
    if (!account) {
        this.messageService.add({severity:'warn', summary: 'Conta necessária', detail: 'Selecione a conta bancária para atribuir estas transações.'});
        return;
    }

    this.loading.set(true);

    let successCount = 0;

    for (const draft of selected) {
        try {
            // Fix: Create proper Partial<Transaction> object or cast as any if service is strict
            // The service expects 'Transaction', but typically creation only needs subset.
            // Let's create a partial object and force cast to 'any' or 'Transaction' to bypass strict checks if acceptable,
            // OR ideally, use a dedicated CreateTransactionDTO.
            // Given the error was "Object literal may only specify known properties...", it means we were passing account_id which is NOT in Transaction interface.
            // We should pass 'account' object if the interface demands it, or ignore if backend handles ID mapping.
            // Backend create_transaction expects Pydantic model which takes account_id.
            // Frontend model usually mirrors full object.

            // Let's construct a payload that satisfies the interface or trick it.
            // Usually we assign the full account object if we have it.

            const newTx: any = {
                title: draft.description,
                amount: draft.amount,
                type: draft.type,
                date: new Date(draft.date),
                category: this.categories().find(c => c.id === draft.category_id) as Category, // Try to find category object
                account: account, // We have the full account object!
                payment_method: 'debit',
                description: `Importado de ${draft.source}`,
                status: 'paid'
            };

            await firstValueFrom(this.transactionService.createTransaction(newTx));
            successCount++;
        } catch (err) {
            console.error('Import error for', draft.description, err);
        }
    }

    this.loading.set(false);
    this.messageService.add({severity:'success', summary: 'Importação Concluída', detail: `${successCount} transações importadas com sucesso.`});
    this.transactions.set([]);
  }
}
