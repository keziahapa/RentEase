import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PropertyService } from '../../../../services/property.service';
import { TenantMoveOutNotice, TenantMoveOutNoticeResponse } from '../../../../services/dashboard-interface';

@Component({
  selector: 'app-move-out-notice-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './move-out-notice-list.component.html',
  styleUrls: ['./move-out-notice-list.component.scss']
})
export class MoveOutNoticeListComponent implements OnInit {
  moveOutNotices: TenantMoveOutNotice[] = [];
  isLoading = true;
  currentPage = 1;
  totalPages = 1;
  hasNext = false;
  hasPrev = false;

  constructor(
    private propertyService: PropertyService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMoveOutNotices();
  }

  loadMoveOutNotices(page: number = 1): void {
    this.isLoading = true;
    this.propertyService.getTenantMoveOutNotices(page, 10).subscribe({
      next: (response: TenantMoveOutNoticeResponse) => {
        if (response.success) {
          this.moveOutNotices = Array.isArray(response.data) ? response.data : [response.data];
          this.currentPage = response.pagination?.currentPage || 1;
          this.totalPages = response.pagination?.totalPages || 1;
          this.hasNext = response.pagination?.hasNext || false;
          this.hasPrev = response.pagination?.hasPrev || false;
        } else {
          this.snackBar.open(response.message || 'Failed to load move-out notices', 'Close', { duration: 5000 });
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackBar.open('Failed to load move-out notices', 'Close', { duration: 5000 });
        this.isLoading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return '#f59e0b';
      case 'APPROVED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      case 'CANCELLED': return '#6b7280';
      default: return '#6b7280';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING': return 'schedule';
      case 'APPROVED': return 'check_circle';
      case 'REJECTED': return 'cancel';
      case 'CANCELLED': return 'block';
      default: return 'help';
    }
  }

  createNewNotice(): void {
    this.router.navigate(['/tenant-dashboard/move-out-notices/new']);
  }

  viewNotice(notice: TenantMoveOutNotice): void {
    if (notice.id) {
      this.router.navigate(['/tenant-dashboard/move-out-notices', notice.id]);
    }
  }

  cancelNotice(notice: TenantMoveOutNotice): void {
    if (!notice.id) return;

    const confirmed = confirm('Are you sure you want to cancel this move-out notice?');
    if (!confirmed) return;

    this.propertyService.cancelMoveOutNotice(notice.id).subscribe({
      next: (response: TenantMoveOutNoticeResponse) => {
        if (response.success) {
          this.snackBar.open('Move-out notice cancelled successfully', 'Close', { duration: 3000 });
          this.loadMoveOutNotices(this.currentPage);
        } else {
          this.snackBar.open(response.message || 'Failed to cancel notice', 'Close', { duration: 5000 });
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to cancel move-out notice', 'Close', { duration: 5000 });
      }
    });
  }

  canCancel(notice: TenantMoveOutNotice): boolean {
    return notice.status === 'PENDING';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  nextPage(): void {
    if (this.hasNext) {
      this.loadMoveOutNotices(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.hasPrev) {
      this.loadMoveOutNotices(this.currentPage - 1);
    }
  }

  getMoveOutReasonDisplay(reason: string): string {
    const reasonMap: { [key: string]: string } = {
      'RELOCATION': 'Relocation',
      'JOB_CHANGE': 'Job Change',
      'FINANCIAL': 'Financial Reasons',
      'PERSONAL': 'Personal Reasons',
      'PROPERTY_ISSUES': 'Property Issues',
      'LEASE_END': 'Lease End',
      'OTHER': 'Other'
    };
    return reasonMap[reason] || reason;
  }
}