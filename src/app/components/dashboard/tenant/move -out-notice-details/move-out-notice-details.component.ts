import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { PropertyService } from '../../../../services/property.service';

@Component({
  selector: 'app-move-out-notice-details',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule
  ],
  templateUrl: './move-out-notice-details.component.html',
  styleUrls: ['./move-out-notice-details.component.scss']
})
export class MoveOutNoticeDetailsComponent implements OnInit {
  notice: any = null;
  isLoading = true;
  noticeId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.noticeId = this.route.snapshot.paramMap.get('id');
    if (this.noticeId) {
      this.loadMoveOutNoticeDetails(parseInt(this.noticeId));
    } else {
      this.snackBar.open('Invalid move-out notice ID', 'Close', { duration: 5000 });
      this.router.navigate(['/tenant-dashboard/move-out-notices']);
    }
  }

  loadMoveOutNoticeDetails(noticeId: number): void {
    this.isLoading = true;
    this.propertyService.getTenantMoveOutNoticeById(noticeId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.notice = response.data;
          console.log('📋 Notice details loaded:', this.notice);
        } else {
          this.snackBar.open(response.message || 'Failed to load notice details', 'Close', { duration: 5000 });
          this.router.navigate(['/tenant-dashboard/move-out-notices']);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        const errorMessage = error?.message || 'Failed to load notice details';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        this.isLoading = false;
        this.router.navigate(['/tenant-dashboard/move-out-notices']);
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

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getMoveOutReasonDisplay(reason: string): string {
    const reasonMap: { [key: string]: string } = {
      'RELOCATION': 'Relocation to another area',
      'JOB_CHANGE': 'Job change or transfer',
      'FINANCIAL': 'Financial reasons',
      'PERSONAL': 'Personal/family reasons',
      'PROPERTY_ISSUES': 'Property maintenance issues',
      'LEASE_END': 'Lease term ending',
      'PURCHASED_HOME': 'Purchased a home',
      'OTHER': 'Other reasons'
    };
    return reasonMap[reason] || reason;
  }

  goBack(): void {
    this.router.navigate(['/tenant-dashboard/move-out-notices']);
  }

  canCancel(): boolean {
    return this.notice?.status === 'PENDING';
  }

  cancelNotice(): void {
    if (!this.notice?.id) return;

    const confirmed = confirm('Are you sure you want to cancel this move-out notice?');
    if (!confirmed) return;

    this.propertyService.cancelMoveOutNotice(this.notice.id).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.snackBar.open('Move-out notice cancelled successfully', 'Close', { duration: 3000 });
          this.loadMoveOutNoticeDetails(this.notice.id);
        } else {
          this.snackBar.open(response.message || 'Failed to cancel notice', 'Close', { duration: 5000 });
        }
      },
      error: (error: any) => {
        const errorMessage = error?.message || 'Failed to cancel move-out notice';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      }
    });
  }
}