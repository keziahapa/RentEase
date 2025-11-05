import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TenantService } from '../../../../services/tenant.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { 
  TenantData, 
  TenantQuickAction, 
  TenantActivity,
  MoveOutNotice 
} from '../../../../services/tenant-interface';
import { CreateMoveOutNoticeDialogComponent } from '../create-move-out-notice-dialog/create-move-out-notice-dialog.component';

@Component({
  selector: 'app-tenant-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './dashboard-overview.component.html',
  styleUrls: ['./dashboard-overview.component.scss']
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  tenantData: TenantData = {
    currentRent: 0,
    paymentStatus: '',
    daysUntilDue: 0,
    openMaintenance: 0,
    leaseEndDays: 0,
    propertyAddress: '',
    landlordName: '',
    depositAmount: 0,
    unitNumber: '',
    propertyName: ''
  };

  quickActions: TenantQuickAction[] = [
    {
      icon: 'payments',
      label: 'Pay Rent',
      description: 'Make your monthly rent payment',
      route: ['/tenant-dashboard/payments'],
      color: '#10b981'
    },
    {
      icon: 'receipt',
      label: 'Payment History',
      description: 'View your payment records',
      route: ['/tenant-dashboard/payments/history'],
      color: '#3b82f6'
    },
    {
      icon: 'handyman',
      label: 'Maintenance',
      description: 'Request maintenance services',
      route: ['/tenant-dashboard/maintenance'],
      color: '#f59e0b'
    },
    {
      icon: 'exit_to_app',
      label: 'Move Out Notice',
      description: 'Submit move out notice',
      route: ['/tenant-dashboard/move-out-notices/new'],
      color: '#ef4444'
    },
    {
      icon: 'description',
      label: 'Documents',
      description: 'Access lease and other documents',
      route: ['/tenant-dashboard/documents'],
      color: '#8b5cf6'
    },
    {
      icon: 'message',
      label: 'Messages',
      description: 'Communicate with landlord & caretaker',
      route: ['/tenant-dashboard/chat'],
      color: '#06b6d4'
    }
  ];

  recentActivities: TenantActivity[] = [];
  moveOutNotices: MoveOutNotice[] = [];

  isLoadingDashboard = true;
  dashboardError = '';
  private subscriptions = new Subscription();

  constructor(
    private tenantService: TenantService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDashboardData() {
    this.isLoadingDashboard = true;
    this.dashboardError = '';

    // Load tenant units data
    const unitsSub = this.tenantService.getTenantUnits().subscribe({
      next: (response: any) => {
        this.processTenantData(response);
        this.loadMoveOutNotices();
      },
      error: (error: any) => {
        console.error('Error loading tenant data:', error);
        this.dashboardError = error?.message || 'Failed to load dashboard data';
        this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        this.isLoadingDashboard = false;
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout().subscribe();
            this.router.navigate(['/login']);
          }, 2000);
        }
      }
    });

    this.subscriptions.add(unitsSub);
  }

  private loadMoveOutNotices(): void {
    const moveOutSub = this.tenantService.getMoveOutNotices().subscribe({
      next: (response: any) => {
        this.moveOutNotices = Array.isArray(response.data) ? response.data : [];
        this.updateDashboardWithMoveOutData();
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        console.error('Error loading move-out notices:', error);
        this.moveOutNotices = [];
        this.isLoadingDashboard = false;
      }
    });

    this.subscriptions.add(moveOutSub);
  }

  private updateDashboardWithMoveOutData(): void {
    const pendingNotices = this.moveOutNotices.filter(notice => 
      notice.status === 'PENDING'
    ).length;

    const upcomingNotice = this.moveOutNotices
      .filter(notice => notice.status === 'PENDING' || notice.status === 'APPROVED')
      .sort((a, b) => new Date(a.moveOutDate).getTime() - new Date(b.moveOutDate).getTime())[0];

    let upcomingMoveOutDate = undefined;

    if (upcomingNotice) {
      upcomingMoveOutDate = upcomingNotice.moveOutDate;
      
      // Update lease end days if move out is sooner
      const moveOutDays = this.calculateDaysUntilDate(upcomingNotice.moveOutDate);
      if (moveOutDays > 0 && moveOutDays < this.tenantData.leaseEndDays) {
        this.tenantData.leaseEndDays = moveOutDays;
      }
    }

    // Update tenant data with move-out information
    this.tenantData.pendingMoveOutNotices = pendingNotices;
    this.tenantData.upcomingMoveOutDate = upcomingMoveOutDate;
    this.tenantData.hasActiveMoveOut = pendingNotices > 0 || !!upcomingMoveOutDate;

    // Add move-out activity to recent activities if applicable
    if (pendingNotices > 0) {
      this.addMoveOutActivity(pendingNotices, upcomingMoveOutDate);
    }
  }

  private addMoveOutActivity(pendingNotices: number, upcomingDate?: string): void {
    let message = '';
    if (pendingNotices === 1) {
      message = 'Move-out notice submitted and pending approval';
    } else {
      message = `${pendingNotices} move-out notices pending approval`;
    }

    if (upcomingDate) {
      const moveOutDate = new Date(upcomingDate);
      const formattedDate = moveOutDate.toLocaleDateString();
      message += ` - Scheduled for ${formattedDate}`;
    }

    // Add move-out activity to the top of recent activities
    this.recentActivities.unshift({
      type: 'Move Out Notice',
      message: message,
      time: 'Recently',
      icon: 'exit_to_app'
    });

    // Keep only the latest 4 activities
    if (this.recentActivities.length > 4) {
      this.recentActivities = this.recentActivities.slice(0, 4);
    }
  }

  private processTenantData(unitsResponse: any): void {
    const units = Array.isArray(unitsResponse?.data) ? unitsResponse.data : [];
    
    if (units.length > 0) {
      const primaryUnit = units[0];
      const leaseEndDays = this.calculateDaysUntilDate(primaryUnit.leaseEndDate);
      
      this.tenantData = {
        currentRent: primaryUnit.rentAmount || 0,
        paymentStatus: primaryUnit.paymentStatus || 'Current',
        daysUntilDue: primaryUnit.daysUntilDue || 0,
        openMaintenance: primaryUnit.openMaintenanceRequests || 0,
        leaseEndDays: leaseEndDays,
        propertyAddress: primaryUnit.propertyAddress || '',
        landlordName: primaryUnit.landlordName || '',
        depositAmount: primaryUnit.depositAmount || 0,
        unitNumber: primaryUnit.unitNumber || '',
        propertyName: primaryUnit.propertyName || '',
        nextPaymentDate: primaryUnit.nextPaymentDate
      };

      // Generate recent activities based on real data
      this.generateRecentActivities(primaryUnit);
    } else {
      // Fallback data if no units found
      this.tenantData = {
        currentRent: 0,
        paymentStatus: 'No Data',
        daysUntilDue: 0,
        openMaintenance: 0,
        leaseEndDays: 0,
        propertyAddress: 'No property assigned',
        landlordName: '',
        depositAmount: 0,
        unitNumber: '',
        propertyName: ''
      };
    }
  }

  private calculateDaysUntilDate(endDate: string): number {
    if (!endDate) return 0;
    const today = new Date();
    const targetDate = new Date(endDate);
    const timeDiff = targetDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  private generateRecentActivities(unit: any): void {
    const activities: TenantActivity[] = [];

    // Add payment activity based on status
    if (unit.paymentStatus === 'Current') {
      activities.push({
        type: 'Rent Payment',
        message: 'Rent payment confirmed',
        time: 'Recently',
        icon: 'payments'
      });
    } else if (unit.paymentStatus === 'Overdue') {
      activities.push({
        type: 'Payment Reminder',
        message: 'Rent payment overdue',
        time: 'Today',
        icon: 'warning'
      });
    }

    // Add maintenance activity if there are open requests
    if (unit.openMaintenanceRequests > 0) {
      activities.push({
        type: 'Maintenance',
        message: `${unit.openMaintenanceRequests} open maintenance request(s)`,
        time: 'Active',
        icon: 'handyman'
      });
    }

    // Add lease activity
    const leaseEndDays = this.calculateDaysUntilDate(unit.leaseEndDate);
    if (leaseEndDays <= 30) {
      activities.push({
        type: 'Lease',
        message: `Lease ends in ${leaseEndDays} days`,
        time: 'Upcoming',
        icon: 'event'
      });
    }

    // Fill with default activities if needed
    const defaultActivities: TenantActivity[] = [
      {
        type: 'Welcome',
        message: 'Welcome to your tenant dashboard',
        time: 'Just now',
        icon: 'home'
      },
      {
        type: 'Document',
        message: 'Lease agreement available',
        time: '1 week ago',
        icon: 'description'
      }
    ];

    this.recentActivities = [...activities, ...defaultActivities].slice(0, 4);
  }

  // Navigation methods
  onQuickAction(action: TenantQuickAction) {
    if (action.label === 'Move Out Notice') {
      this.submitMoveOutNotice();
    } else {
      this.router.navigate(action.route);
    }
  }

  openMaintenanceRequest() {
    this.router.navigate(['/tenant-dashboard/maintenance']);
  }

  submitMoveOutNotice() {
    const dialogRef = this.dialog.open(CreateMoveOutNoticeDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        propertyId: 1,
        unitId: 1
      },
      panelClass: 'move-out-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.handleMoveOutNoticeSubmission(result.data);
      }
    });
  }

  private handleMoveOutNoticeSubmission(noticeData: any): void {
    this.tenantService.submitMoveOutNotice(noticeData).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Move-out notice submitted successfully!', 'Close', { 
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          // Reload dashboard data to reflect changes
          this.loadDashboardData();
        } else {
          this.snackBar.open(response.message || 'Failed to submit move-out notice', 'Close', { 
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Error submitting move-out notice:', error);
        this.snackBar.open('Failed to submit move-out notice. Please try again.', 'Close', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  viewMoveOutNotices() {
    this.router.navigate(['/tenant-dashboard/move-out-notices']);
  }

  navigateToChat() {
    this.router.navigate(['/tenant-dashboard/chat']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  // Getters for template
  getCurrentRent(): number {
    return this.tenantData?.currentRent || 0;
  }

  getPaymentStatus(): string {
    return this.tenantData?.paymentStatus || 'Unknown';
  }

  getDaysUntilDue(): number {
    return this.tenantData?.daysUntilDue || 0;
  }

  getOpenMaintenance(): number {
    return this.tenantData?.openMaintenance || 0;
  }

  getLeaseEndDays(): number {
    return this.tenantData?.leaseEndDays || 0;
  }

  getPendingMoveOutNotices(): number {
    return this.tenantData?.pendingMoveOutNotices || 0;
  }

  hasUpcomingMoveOut(): boolean {
    return !!this.tenantData?.upcomingMoveOutDate;
  }

  getUpcomingMoveOutDate(): string {
    if (this.tenantData?.upcomingMoveOutDate) {
      return new Date(this.tenantData.upcomingMoveOutDate).toLocaleDateString();
    }
    return '';
  }

  hasActiveMoveOut(): boolean {
    return this.tenantData?.hasActiveMoveOut || false;
  }

  getPropertyAddress(): string {
    return this.tenantData?.propertyAddress || 'No address available';
  }

  getLandlordName(): string {
    return this.tenantData?.landlordName || 'Landlord';
  }

  getUnitNumber(): string {
    return this.tenantData?.unitNumber || '';
  }

  getPropertyName(): string {
    return this.tenantData?.propertyName || 'Property';
  }
}