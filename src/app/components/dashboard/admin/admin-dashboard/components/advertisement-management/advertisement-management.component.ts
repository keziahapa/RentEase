// advertisement-management.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';
import { AdminService } from '../../../../../../services/admin.service';
import { Advertisement} from '../../../../../../services/admin-interfaces';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-advertisement-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatMenuModule,
    SkeletonListComponent
  ],
  templateUrl: './advertisement-management.component.html',
  styleUrls: ['./advertisement-management.component.scss']
})
export class AdvertisementManagementComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  advertisements: Advertisement[] = [];
  pendingAdvertisements: Advertisement[] = [];
  displayedColumns: string[] = ['title', 'business', 'mediaType', 'status', 'createdAt', 'actions'];
  
  isLoading = false;
  isLoadingPending = false;
  selectedTab = 0;

  private subscriptions = new Subscription();

  ngOnInit() {
    this.loadAllAdvertisements();
    this.loadPendingAdvertisements();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadAllAdvertisements() {
    this.isLoading = true;
    
    const adsSub = this.adminService.getAdvertisements().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.advertisements = response.data || [];
        } else {
          this.snackBar.open('Failed to load advertisements', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.snackBar.open(error.message || 'Failed to load advertisements', 'Close', { duration: 3000 });
        this.advertisements = [];
      }
    });

    this.subscriptions.add(adsSub);
  }

  loadPendingAdvertisements() {
    this.isLoadingPending = true;
    
    const pendingSub = this.adminService.getPendingAdvertisements().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.pendingAdvertisements = response.data || [];
        } else {
          this.snackBar.open('Failed to load pending advertisements', 'Close', { duration: 3000 });
        }
        this.isLoadingPending = false;
      },
      error: (error: any) => {
        this.isLoadingPending = false;
        this.snackBar.open(error.message || 'Failed to load pending advertisements', 'Close', { duration: 3000 });
        this.pendingAdvertisements = [];
      }
    });

    this.subscriptions.add(pendingSub);
  }

  approveAdvertisement(advertisementId: number) {
    const ad = this.pendingAdvertisements.find(a => a.id === advertisementId);
    if (!ad) return;

    const approveSub = this.adminService.approveAdvertisement(advertisementId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.snackBar.open('Advertisement approved successfully', 'Close', { duration: 3000 });
          this.loadPendingAdvertisements();
          this.loadAllAdvertisements();
        } else {
          this.snackBar.open('Failed to approve advertisement', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.snackBar.open(error.message || 'Failed to approve advertisement', 'Close', { duration: 3000 });
      }
    });

    this.subscriptions.add(approveSub);
  }

  rejectAdvertisement(advertisementId: number) {
    const rejectionReason = prompt('Please enter the reason for rejection:');
    if (!rejectionReason || rejectionReason.trim() === '') {
      this.snackBar.open('Rejection reason is required', 'Close', { duration: 3000 });
      return;
    }

    const rejectSub = this.adminService.rejectAdvertisement(advertisementId, rejectionReason.trim()).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.snackBar.open('Advertisement rejected successfully', 'Close', { duration: 3000 });
          this.loadPendingAdvertisements();
          this.loadAllAdvertisements();
        } else {
          this.snackBar.open('Failed to reject advertisement', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.snackBar.open(error.message || 'Failed to reject advertisement', 'Close', { duration: 3000 });
      }
    });

    this.subscriptions.add(rejectSub);
  }

  viewAdvertisementDetails(advertisementId: number) {
    // Navigate to advertisement details page or open dialog
    this.router.navigate(['/admin-dashboard/advertisements', advertisementId]);
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'pending': return 'status-pending';
      case 'rejected': return 'status-rejected';
      default: return 'status-unknown';
    }
  }

  onTabChange(event: any) {
    this.selectedTab = event.index;
  }

  refreshData() {
    if (this.selectedTab === 0) {
      this.loadAllAdvertisements();
    } else {
      this.loadPendingAdvertisements();
    }
  }

  getMediaTypeIcon(mediaType: string): string {
    return mediaType === 'IMAGE' ? 'image' : 'videocam';
  }
}