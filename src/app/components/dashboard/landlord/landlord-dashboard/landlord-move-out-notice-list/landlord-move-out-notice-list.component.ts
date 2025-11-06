import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { LandlordMoveOutNotice, LandlordMoveOutNoticeResponse, MoveOutActionRequest } from '../../../../../services/dashboard-interface';
import { PropertyService } from '../../../../../services/property.service';
import { MoveOutActionDialogComponent } from '../move-out-action-dialog/move-out-action-dialog.component';

@Component({
  selector: 'app-landlord-move-out-notice-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatChipsModule,
    MatMenuModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './landlord-move-out-notice-list.component.html',
  styleUrls: ['./landlord-move-out-notice-list.component.scss']
})
export class LandlordMoveOutNoticeListComponent implements OnInit {
  moveOutNotices: LandlordMoveOutNotice[] = [];
  filteredNotices: LandlordMoveOutNotice[] = [];
  isLoading = true;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  pageSize = 10;
  hasNext = false;
  hasPrev = false;

  // Filters
  filterStatus: string = '';
  searchTerm: string = '';
  propertyFilter: string = '';

  // Stats
  stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  };

  private router = inject(Router);
  private propertyService = inject(PropertyService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    this.loadMoveOutNotices();
  }

  loadMoveOutNotices(page: number = 1): void {
    this.isLoading = true;
    this.propertyService.getLandlordMoveOutNotices(page, this.pageSize, this.filterStatus).subscribe({
      next: (response: LandlordMoveOutNoticeResponse) => {
        if (response.success) {
          let notices = Array.isArray(response.data) ? response.data : [response.data];
          
          // ✅ TRANSFORM DATA TO ENSURE ALL FIELDS ARE AVAILABLE
          this.moveOutNotices = notices.map(notice => this.transformNoticeData(notice));
          this.filteredNotices = [...this.moveOutNotices];
          
          this.currentPage = response.pagination?.currentPage || 1;
          this.totalPages = response.pagination?.totalPages || 1;
          this.totalItems = response.pagination?.totalItems || 0;
          this.hasNext = response.pagination?.hasNext || false;
          this.hasPrev = response.pagination?.hasPrev || false;
          this.calculateStats();
          
          console.log('📋 Loaded notices:', this.moveOutNotices);
        } else {
          this.snackBar.open(response.message || 'Failed to load move-out notices', 'Close', { duration: 5000 });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading notices:', error);
        this.snackBar.open('Failed to load move-out notices', 'Close', { duration: 5000 });
        this.isLoading = false;
      }
    });
  }

  // ✅ TRANSFORM NOTICE DATA TO ENSURE ALL FIELDS EXIST
  private transformNoticeData(notice: any): LandlordMoveOutNotice {
    return {
      ...notice,
      // ✅ Ensure tenant data exists with fallbacks
      tenant: notice.tenant || {
        fullName: notice.tenantName || notice.tenantFullName || 'Unknown Tenant',
        email: notice.tenantEmail || 'N/A',
        phone: notice.tenantPhone || 'N/A'
      },
      // ✅ Ensure property data exists with fallbacks
      property: notice.property || {
        name: notice.propertyName || 'Unknown Property',
        address: notice.propertyAddress || 'Address not available',
        id: notice.propertyId
      },
      // ✅ Ensure unit data exists with fallbacks
      unit: notice.unit || {
        unitNumber: notice.unitNumber || 'Unknown Unit',
        id: notice.unitId
      },
      // ✅ Ensure all required fields have fallbacks
      moveOutDate: notice.moveOutDate || '',
      reason: notice.reason || 'OTHER',
      notes: notice.notes || '',
      submittedAt: notice.submittedAt || notice.createdAt || new Date().toISOString(),
      status: notice.status || 'PENDING'
    };
  }

  calculateStats(): void {
    this.stats = {
      pending: this.moveOutNotices.filter(n => n.status === 'PENDING').length,
      approved: this.moveOutNotices.filter(n => n.status === 'APPROVED').length,
      rejected: this.moveOutNotices.filter(n => n.status === 'REJECTED').length,
      total: this.moveOutNotices.length
    };
  }

  applyFilters(): void {
    this.filteredNotices = this.moveOutNotices.filter(notice => {
      const matchesStatus = !this.filterStatus || notice.status === this.filterStatus;
      const matchesSearch = !this.searchTerm || 
        notice.tenant?.fullName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        notice.property?.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        notice.unit?.unitNumber?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesProperty = !this.propertyFilter || notice.property?.name === this.propertyFilter;
      
      return matchesStatus && matchesSearch && matchesProperty;
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.loadMoveOutNotices(1);
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.searchTerm = '';
    this.propertyFilter = '';
    this.loadMoveOutNotices(1);
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

  getStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return 'Pending Review';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  approveNotice(notice: LandlordMoveOutNotice): void {
    if (!notice.id) return;

    const dialogRef = this.dialog.open(MoveOutActionDialogComponent, {
      width: '500px',
      data: {
        title: 'Approve Move Out Notice',
        action: 'approve',
        notice: notice
      }
    });

    dialogRef.afterClosed().subscribe((result: { notes?: string } | undefined) => {
      if (result !== undefined) {
        const request: MoveOutActionRequest = {
          notes: result?.notes,
          landlordNotes: result?.notes
        };

        this.propertyService.approveMoveOutNotice(notice.id!, request).subscribe({
          next: (response: LandlordMoveOutNoticeResponse) => {
            if (response.success) {
              this.snackBar.open('Move-out notice approved successfully', 'Close', { duration: 3000 });
              this.loadMoveOutNotices(this.currentPage);
            } else {
              this.snackBar.open(response.message || 'Failed to approve notice', 'Close', { duration: 5000 });
            }
          },
          error: (error) => {
            this.snackBar.open('Failed to approve move-out notice', 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  rejectNotice(notice: LandlordMoveOutNotice): void {
    if (!notice.id) return;

    const dialogRef = this.dialog.open(MoveOutActionDialogComponent, {
      width: '500px',
      data: {
        title: 'Reject Move Out Notice',
        action: 'reject',
        notice: notice
      }
    });

    dialogRef.afterClosed().subscribe((result: { notes?: string } | undefined) => {
      if (result !== undefined) {
        const request: MoveOutActionRequest = {
          notes: result?.notes,
          landlordNotes: result?.notes
        };

        this.propertyService.rejectMoveOutNotice(notice.id!, request).subscribe({
          next: (response: LandlordMoveOutNoticeResponse) => {
            if (response.success) {
              this.snackBar.open('Move-out notice rejected successfully', 'Close', { duration: 3000 });
              this.loadMoveOutNotices(this.currentPage);
            } else {
              this.snackBar.open(response.message || 'Failed to reject notice', 'Close', { duration: 5000 });
            }
          },
          error: (error) => {
            this.snackBar.open('Failed to reject move-out notice', 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  canApprove(notice: LandlordMoveOutNotice): boolean {
    return notice.status === 'PENDING';
  }

  canReject(notice: LandlordMoveOutNotice): boolean {
    return notice.status === 'PENDING';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  getDaysUntilMoveOut(moveOutDate: string): number {
    const today = new Date();
    const moveOut = new Date(moveOutDate);
    const timeDiff = moveOut.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  getMoveOutUrgency(moveOutDate: string): string {
    const days = this.getDaysUntilMoveOut(moveOutDate);
    if (days <= 7) return 'high';
    if (days <= 14) return 'medium';
    return 'low';
  }

  getUniqueProperties(): string[] {
    return [...new Set(this.moveOutNotices
      .map(notice => notice.property?.name)
      .filter(name => name !== undefined) as string[])];
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.loadMoveOutNotices(event.pageIndex + 1);
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
      'PURCHASED_HOME': 'Purchased a Home',
      'OTHER': 'Other'
    };
    return reasonMap[reason] || reason;
  }

  exportToCSV(): void {
    // Simple CSV export implementation
    const headers = ['Tenant', 'Property', 'Unit', 'Move Out Date', 'Status', 'Reason', 'Submitted Date'];
    const csvData = this.filteredNotices.map(notice => [
      notice.tenant?.fullName || 'N/A',
      notice.property?.name || 'N/A',
      notice.unit?.unitNumber || 'N/A',
      this.formatDate(notice.moveOutDate),
      this.getStatusText(notice.status),
      this.getMoveOutReasonDisplay(notice.reason),
      notice.submittedAt ? this.formatDate(notice.submittedAt) : 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `move-out-notices-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}