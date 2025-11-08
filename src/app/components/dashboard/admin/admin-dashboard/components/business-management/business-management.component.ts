// business-management.component.ts
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
import { Business } from '../../../../../../services/admin-interfaces';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-business-management',
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
  templateUrl: './business-management.component.html',
  styleUrls: ['./business-management.component.scss']
})
export class BusinessManagementComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  businesses: Business[] = [];
  pendingBusinesses: Business[] = [];
  displayedColumns: string[] = ['name', 'category', 'owner', 'status', 'registrationDate', 'actions'];
  
  isLoading = false;
  isLoadingPending = false;
  selectedTab = 0;

  private subscriptions = new Subscription();

  ngOnInit() {
    this.loadAllBusinesses();
    this.loadPendingBusinesses();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadAllBusinesses() {
    this.isLoading = true;
    
    const businessesSub = this.adminService.getBusinesses().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.businesses = response.data || [];
          
          // Debug: Check what fields actually exist
          if (this.businesses.length > 0) {
            console.log('🔍 First business object:', this.businesses[0]);
            console.log('🔍 Available status fields:', {
              status: this.businesses[0].status,
              registrationStatus: this.businesses[0].registrationStatus,
              hasStatus: 'status' in this.businesses[0],
              hasRegistrationStatus: 'registrationStatus' in this.businesses[0]
            });
          }
          
        } else {
          this.snackBar.open('Failed to load businesses', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.snackBar.open(error.message || 'Failed to load businesses', 'Close', { duration: 3000 });
        this.businesses = [];
      }
    });

    this.subscriptions.add(businessesSub);
  }

  loadPendingBusinesses() {
    this.isLoadingPending = true;
    
    const pendingSub = this.adminService.getPendingBusinesses().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.pendingBusinesses = response.data || [];
          
          // Debug: Check what fields actually exist in pending businesses
          if (this.pendingBusinesses.length > 0) {
            console.log('🔍 First pending business object:', this.pendingBusinesses[0]);
            console.log('🔍 Pending business status fields:', {
              status: this.pendingBusinesses[0].status,
              registrationStatus: this.pendingBusinesses[0].registrationStatus
            });
          }
          
        } else {
          this.snackBar.open('Failed to load pending businesses', 'Close', { duration: 3000 });
        }
        this.isLoadingPending = false;
      },
      error: (error: any) => {
        this.isLoadingPending = false;
        this.snackBar.open(error.message || 'Failed to load pending businesses', 'Close', { duration: 3000 });
        this.pendingBusinesses = [];
      }
    });

    this.subscriptions.add(pendingSub);
  }

  approveBusiness(businessId: number) {
    const business = this.pendingBusinesses.find(b => b.id === businessId);
    if (!business) return;

    const approveSub = this.adminService.approveBusiness(businessId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.snackBar.open('Business approved successfully', 'Close', { duration: 3000 });
          this.loadPendingBusinesses();
          this.loadAllBusinesses();
        } else {
          this.snackBar.open('Failed to approve business', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.snackBar.open(error.message || 'Failed to approve business', 'Close', { duration: 3000 });
      }
    });

    this.subscriptions.add(approveSub);
  }

  rejectBusiness(businessId: number) {
    const rejectionReason = prompt('Please enter the reason for rejection:');
    if (!rejectionReason || rejectionReason.trim() === '') {
      this.snackBar.open('Rejection reason is required', 'Close', { duration: 3000 });
      return;
    }

    const rejectSub = this.adminService.rejectBusiness(businessId, rejectionReason.trim()).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.snackBar.open('Business rejected successfully', 'Close', { duration: 3000 });
          this.loadPendingBusinesses();
          this.loadAllBusinesses();
        } else {
          this.snackBar.open('Failed to reject business', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.snackBar.open(error.message || 'Failed to reject business', 'Close', { duration: 3000 });
      }
    });

    this.subscriptions.add(rejectSub);
  }

  viewBusinessDetails(businessId: number) {
    this.router.navigate(['/admin-dashboard/businesses', businessId]);
  }

  // NEW: Helper method to get the correct status from business object
  getBusinessStatus(business: Business): string {
    // Prefer status field, fall back to registrationStatus (converted to lowercase)
    return business.status || 
           (business.registrationStatus ? business.registrationStatus.toLowerCase() : 'unknown');
  }

  // UPDATED: Now accepts the entire business object
  getStatusClass(business: Business): string {
    const status = this.getBusinessStatus(business);
    
    switch (status) {
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
      this.loadAllBusinesses();
    } else {
      this.loadPendingBusinesses();
    }
  }

  // NEW: Test method to check endpoint
  testEndpoint() {
    console.log('🧪 Testing pending businesses endpoint...');
    this.adminService.getPendingBusinesses().subscribe({
      next: (response) => console.log('✅ Test response:', response),
      error: (error) => console.error('❌ Test error:', error)
    });
  }
}