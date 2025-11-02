import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Transaction } from '../../../../../../models/transaction.model';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { SearchParams } from '../../../../../../services/admin-interfaces';


@Component({
  selector: 'app-transactions-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './transactions-view.component.html',
  styleUrls: ['./transactions-view.component.scss']
})
export class TransactionsViewComponent {
  private readonly adminDataService = inject(AdminDataService);
  private readonly snackBar = inject(MatSnackBar);

  @Input() transactions: Transaction[] = [];
  
  @Output() viewTransactionDetails = new EventEmitter<Transaction>();

  displayedColumns: string[] = [
    'type', 
    'business', 
    'amount', 
    'date', 
    'status', 
    'actions'
  ];
  exportState: Record<'csv' | 'pdf', boolean> = { csv: false, pdf: false };

  getStatusClass(status: string): string {
    const statusMap: any = {
      'completed': 'status-completed',
      'pending': 'status-pending',
      'failed': 'status-failed'
    };
    return statusMap[status] || 'status-pending';
  }

  formatCurrency(amount: number): string {
    return `KSH ${amount.toLocaleString('en-KE')}`;
  }

  getTotalTransactions(): number {
    return this.transactions.length;
  }

  getCompletedTransactions(): number {
    return this.transactions.filter(t => t.status === 'completed').length;
  }

  exportTransactions(format: 'csv' | 'pdf'): void {
    if (this.exportState[format]) {
      return;
    }

    this.exportState[format] = true;
    const params = this.buildExportParams();

    this.adminDataService
      .exportReport('transactions', format, params)
      .pipe(finalize(() => (this.exportState[format] = false)))
      .subscribe({
        next: (blob) => this.handleExportBlob(blob, `rentease-transactions.${format}`),
        error: (error) => {
          const message = error?.message || `Unable to export transactions as ${format.toUpperCase()} right now.`;
          this.snackBar.open(message, 'Close', { duration: 4000 });
        }
      });
  }

  private buildExportParams(): SearchParams {
    const params: SearchParams = {};

    if (this.transactions.length) {
      const activeStatuses = new Set(this.transactions.map(tx => tx.status));
      if (activeStatuses.size === 1) {
        params.status = Array.from(activeStatuses)[0].toUpperCase();
      }
    }

    return params;
  }

  private async handleExportBlob(blob: Blob, filename: string): Promise<void> {
    if (blob.type?.includes('text')) {
      const fallbackMessage = await blob.text();
      this.snackBar.open(fallbackMessage || 'Export unavailable. Please retry later.', 'Close', {
        duration: 4000
      });
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${filename}`, 'Close', { duration: 2500 });
  }
}
