import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Business } from '../../../../../../models/bussiness.model';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { SearchParams } from '../../../../../../services/admin-interfaces';


@Component({
  selector: 'app-businesses-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './businesses-view.component.html',
  styleUrls: ['./businesses-view.component.scss']
})
export class BusinessesViewComponent {
  private readonly adminDataService = inject(AdminDataService);
  private readonly snackBar = inject(MatSnackBar);

  @Input() businesses: Business[] = [];
  @Input() pendingApprovals: number = 0;
  @Input() activeBusinesses: number = 0;
  
  @Output() approveBusiness = new EventEmitter<Business>();
  @Output() rejectBusiness = new EventEmitter<Business>();

  displayedColumns: string[] = [
    'name', 
    'category', 
    'status', 
    'rating', 
    'totalJobs', 
    'actions'
  ];

  exportState: Record<'csv' | 'pdf', boolean> = { csv: false, pdf: false };

  getStatusClass(status: string): string {
    const statusMap: any = {
      'pending': 'status-pending',
      'approved': 'status-approved',
      'rejected': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
  }

  exportBusinesses(format: 'csv' | 'pdf'): void {
    if (this.exportState[format]) {
      return;
    }

    this.exportState[format] = true;
    const params = this.buildExportParams();

    this.adminDataService
      .exportReport('businesses', format, params)
      .pipe(finalize(() => (this.exportState[format] = false)))
      .subscribe({
        next: (blob) => this.handleExportBlob(blob, `rentease-businesses.${format}`),
        error: (error) => {
          const message = error?.message || `Unable to export businesses as ${format.toUpperCase()} right now.`;
          this.snackBar.open(message, 'Close', { duration: 4000 });
        }
      });
  }

  private buildExportParams(): SearchParams {
    const params: SearchParams = {};

    if (this.pendingApprovals && this.pendingApprovals > 0) {
      params.status = 'PENDING';
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
