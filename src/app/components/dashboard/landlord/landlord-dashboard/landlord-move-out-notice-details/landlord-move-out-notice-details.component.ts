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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MoveOutActionDialogComponent } from '../move-out-action-dialog/move-out-action-dialog.component';
import { PropertyService } from '../../../../../services/property.service';

@Component({
  selector: 'app-landlord-move-out-notice-details',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
    MatDialogModule
  ],
  templateUrl: './landlord-move-out-notice-details.component.html',
  styleUrls: ['./landlord-move-out-notice-details.component.scss']
})
export class LandlordMoveOutNoticeDetailsComponent implements OnInit {
  notice: any = null;
  isLoading = true;
  noticeId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.noticeId = this.route.snapshot.paramMap.get('id');
    if (this.noticeId) {
      this.loadMoveOutNoticeDetails(parseInt(this.noticeId));
    } else {
      this.snackBar.open('Invalid move-out notice ID', 'Close', { duration: 5000 });
      this.router.navigate(['/landlord-dashboard/move-out-notices']);
    }
  }

  loadMoveOutNoticeDetails(noticeId: number): void {
    this.isLoading = true;
    this.propertyService.getLandlordMoveOutNoticeById(noticeId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.notice = response.data;
          console.log('📋 Landlord notice details loaded:', this.notice);
        } else {
          this.snackBar.open(response.message || 'Failed to load notice details', 'Close', { duration: 5000 });
          this.router.navigate(['/landlord-dashboard/move-out-notices']);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        const errorMessage = error?.message || 'Failed to load notice details';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        this.isLoading = false;
        this.router.navigate(['/landlord-dashboard/move-out-notices']);
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
    this.router.navigate(['/landlord-dashboard/move-out-notices']);
  }

  canApprove(): boolean {
    return this.notice?.status === 'PENDING';
  }

  canReject(): boolean {
    return this.notice?.status === 'PENDING';
  }

  approveNotice(): void {
    if (!this.notice?.id) return;

    const dialogRef = this.dialog.open(MoveOutActionDialogComponent, {
      width: '500px',
      data: {
        title: 'Approve Move Out Notice',
        action: 'approve',
        notice: this.notice
      }
    });

    dialogRef.afterClosed().subscribe((result: { notes?: string } | undefined) => {
      if (result !== undefined) {
        const request = {
          notes: result?.notes,
          landlordNotes: result?.notes
        };

        this.propertyService.approveMoveOutNotice(this.notice.id, request).subscribe({
          next: (response: any) => {
            if (response.success) {
              this.snackBar.open('Move-out notice approved successfully', 'Close', { duration: 3000 });
              this.loadMoveOutNoticeDetails(this.notice.id);
            } else {
              this.snackBar.open(response.message || 'Failed to approve notice', 'Close', { duration: 5000 });
            }
          },
          error: (error: any) => {
            this.snackBar.open('Failed to approve move-out notice', 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  rejectNotice(): void {
    if (!this.notice?.id) return;

    const dialogRef = this.dialog.open(MoveOutActionDialogComponent, {
      width: '500px',
      data: {
        title: 'Reject Move Out Notice',
        action: 'reject',
        notice: this.notice
      }
    });

    dialogRef.afterClosed().subscribe((result: { notes?: string } | undefined) => {
      if (result !== undefined) {
        const request = {
          notes: result?.notes,
          landlordNotes: result?.notes
        };

        this.propertyService.rejectMoveOutNotice(this.notice.id, request).subscribe({
          next: (response: any) => {
            if (response.success) {
              this.snackBar.open('Move-out notice rejected successfully', 'Close', { duration: 3000 });
              this.loadMoveOutNoticeDetails(this.notice.id);
            } else {
              this.snackBar.open(response.message || 'Failed to reject notice', 'Close', { duration: 5000 });
            }
          },
          error: (error: any) => {
            this.snackBar.open('Failed to reject move-out notice', 'Close', { duration: 5000 });
          }
        });
      }
    });
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

  getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  getUrgencyText(urgency: string): string {
    switch (urgency) {
      case 'high': return 'High Urgency';
      case 'medium': return 'Medium Urgency';
      case 'low': return 'Low Urgency';
      default: return 'No Urgency';
    }
  }
}