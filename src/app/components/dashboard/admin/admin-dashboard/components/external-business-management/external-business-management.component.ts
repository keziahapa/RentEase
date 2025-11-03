// external-business-management.component.ts
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
import { Subscription } from 'rxjs';
import { AdminService } from '../../../../../../services/admin.service';
import { ExternalBusiness } from '../../../../../../services/admin-interfaces';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-external-business-management',
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
    SkeletonListComponent
  ],
  templateUrl: './external-business-management.component.html',
  styleUrls: ['./external-business-management.component.scss']
})
export class ExternalBusinessManagementComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  externalBusinesses: ExternalBusiness[] = [];
  pendingExternalBusinesses: ExternalBusiness[] = [];
  displayedColumns: string[] = ['businessName', 'registrationNumber', 'contact', 'status', 'createdAt', 'actions'];
  
  isLoading = false;
  isLoadingPending = false;
  selectedTab = 0;

  private subscriptions = new Subscription();

  ngOnInit() {
    this.loadAllExternalBusinesses();
    this.loadPendingExternalBusinesses();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadAllExternalBusinesses() {
    this.isLoading = true;
    
    const businessesSub = this.adminService.getExternalBusinesses().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.externalBusinesses = response.data || [];
        } else {
          this.snackBar.open('Failed to load external businesses', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.snackBar.open(error.message || 'Failed to load external businesses', 'Close', { duration: 3000 });
        this.externalBusinesses = [];
      }
    });

    this.subscriptions.add(businessesSub);
  }

  loadPendingExternalBusinesses() {
    this.isLoadingPending = true;
    
    const pendingSub = this.adminService.getPendingExternalBusinesses().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.pendingExternalBusinesses = response.data || [];
        } else {
          this.snackBar.open('Failed to load pending external businesses', 'Close', { duration: 3000 });
        }
        this.isLoadingPending = false;
      },
      error: (error: any) => {
        this.isLoadingPending = false;
        this.snackBar.open(error.message || 'Failed to load pending external businesses', 'Close', { duration: 3000 });
        this.pendingExternalBusinesses = [];
      }
    });

    this.subscriptions.add(pendingSub);
  }

  approveExternalBusiness(businessId: number) {
    this.snackBar.open('Approval functionality to be implemented', 'Close', { duration: 3000 });
  }

  rejectExternalBusiness(businessId: number) {
    this.snackBar.open('Rejection functionality to be implemented', 'Close', { duration: 3000 });
  }

  viewExternalBusinessDetails(businessId: number) {
    this.router.navigate(['/admin-dashboard/external-businesses', businessId]);
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'pending': return 'status-pending';
      case 'rejected': return 'status-rejected';
      case 'suspended': return 'status-suspended';
      default: return 'status-unknown';
    }
  }

  onTabChange(event: any) {
    this.selectedTab = event.index;
  }

  refreshData() {
    if (this.selectedTab === 0) {
      this.loadAllExternalBusinesses();
    } else {
      this.loadPendingExternalBusinesses();
    }
  }
}