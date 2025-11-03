import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PropertyService } from '../../../../services/property.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { 
  TenantDashboardData, 
  QuickAction, 
  RecentActivity, 
  TenantMoveOutNotice,
  TenantMoveOutNoticeResponse 
} from '../../../../services/dashboard-interface';

@Component({
  selector: 'app-tenant-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './dashboard-overview.component.html',
  styleUrls: ['./dashboard-overview.component.scss']
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  dashboardData: TenantDashboardData = {
    currentRent: 0,
    paymentStatus: '',
    daysUntilDue: 0,
    openMaintenance: 0,
    leaseEndDays: 0,
    propertyAddress: '',
    landlordName: '',
    depositAmount: 0,
    pendingMoveOutNotices: 0,
    hasActiveMoveOut: false
  };

  quickActions: QuickAction[] = [
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
      description: 'Communicate with your landlord',
      route: ['/tenant-dashboard/messages'],
      color: '#06b6d4'
    }
  ];

  recentActivities: RecentActivity[] = [
    {
      type: 'Rent Payment',
      message: 'February rent payment confirmed',
      time: '2 days ago',
      icon: 'payments'
    },
    {
      type: 'Maintenance',
      message: 'Kitchen faucet repair scheduled',
      time: '5 days ago',
      icon: 'handyman'
    },
    {
      type: 'Message',
      message: 'New message from property manager',
      time: '1 week ago',
      icon: 'message'
    },
    {
      type: 'Document',
      message: 'Updated lease agreement available',
      time: '2 weeks ago',
      icon: 'description'
    }
  ];

  isLoadingDashboard = true;
  dashboardError = '';
  private subscriptions = new Subscription();

  constructor(
    private propertyService: PropertyService,
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

    // Load tenant dashboard data
    const dashboardSub = this.propertyService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        this.processTenantDashboardData(response);
        this.loadMoveOutNoticesData();
      },
      error: (error: any) => {
        this.processTenantDashboardData();
        this.loadMoveOutNoticesData();
        
        if (error.status !== 404) {
          this.dashboardError = error?.message || 'Failed to load dashboard data';
          this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        }
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout().subscribe();
            this.router.navigate(['/login']);
          }, 2000);
        }
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  private loadMoveOutNoticesData(): void {
    const moveOutSub = this.propertyService.getTenantMoveOutNotices(1, 50).subscribe({
      next: (response: TenantMoveOutNoticeResponse) => {
        const notices = Array.isArray(response.data) ? response.data : [];
        this.calculateMoveOutDashboardData(notices);
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.calculateMoveOutDashboardData([]);
        this.isLoadingDashboard = false;
      }
    });

    this.subscriptions.add(moveOutSub);
  }

  private calculateMoveOutDashboardData(moveOutNotices: TenantMoveOutNotice[]): void {
    const pendingNotices = moveOutNotices.filter(notice => 
      notice.status === 'PENDING'
    ).length;

    const upcomingNotice = moveOutNotices
      .filter(notice => notice.status === 'PENDING' || notice.status === 'APPROVED')
      .sort((a, b) => new Date(a.moveOutDate).getTime() - new Date(b.moveOutDate).getTime())[0];

    let daysUntilMoveOut = 0;
    let upcomingMoveOutDate = undefined;

    if (upcomingNotice) {
      const moveOutDate = new Date(upcomingNotice.moveOutDate);
      const today = new Date();
      const timeDiff = moveOutDate.getTime() - today.getTime();
      daysUntilMoveOut = Math.ceil(timeDiff / (1000 * 3600 * 24));
      upcomingMoveOutDate = upcomingNotice.moveOutDate;

      // Update lease end days if move out is sooner
      if (daysUntilMoveOut > 0 && daysUntilMoveOut < this.dashboardData.leaseEndDays) {
        this.dashboardData.leaseEndDays = daysUntilMoveOut;
      }
    }

    // Update dashboard data with move-out information
    this.dashboardData.pendingMoveOutNotices = pendingNotices;
    this.dashboardData.upcomingMoveOutDate = upcomingMoveOutDate;
    this.dashboardData.hasActiveMoveOut = pendingNotices > 0 || !!upcomingMoveOutDate;

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

  private processTenantDashboardData(userData?: any): void {
    // Basic tenant data - in real app, this would come from API
    this.dashboardData = {
      currentRent: 25000,
      paymentStatus: 'Current',
      daysUntilDue: 12,
      openMaintenance: 1,
      leaseEndDays: 85,
      propertyAddress: '123 Main Street, Nairobi',
      landlordName: 'John Doe',
      depositAmount: 50000,
      pendingMoveOutNotices: 0,
      hasActiveMoveOut: false
    };

    // Override with actual user data if available
    if (userData?.data) {
      const data = userData.data;
      this.dashboardData = {
        ...this.dashboardData,
        propertyAddress: data.propertyAddress || this.dashboardData.propertyAddress,
        landlordName: data.landlordName || this.dashboardData.landlordName,
        currentRent: data.currentRent || this.dashboardData.currentRent,
        depositAmount: data.depositAmount || this.dashboardData.depositAmount
      };
    }
  }

  navigateToSection(section: string) {
    const routeMap: { [key: string]: string[] } = {
      'payments': ['/tenant-dashboard/payments'],
      'maintenance': ['/tenant-dashboard/maintenance'],
      'documents': ['/tenant-dashboard/documents'],
      'messages': ['/tenant-dashboard/messages'],
      'profile': ['/tenant-dashboard/profile/view'],
      'move-out': ['/tenant-dashboard/move-out-notices']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    }
  }

  openMaintenanceRequest() {
    this.snackBar.open('Redirecting to maintenance requests...', 'Close', { duration: 2000 });
    this.router.navigate(['/tenant-dashboard/maintenance']);
  }

  onQuickAction(action: QuickAction) {
    this.router.navigate(action.route);
  }

  navigateToMoveOutNotices() {
    this.router.navigate(['/tenant-dashboard/move-out-notices']);
  }

  submitMoveOutNotice() {
    this.router.navigate(['/tenant-dashboard/move-out-notices/new']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  // Getters for template
  getCurrentRent(): number {
    return this.dashboardData?.currentRent || 0;
  }

  getPaymentStatus(): string {
    return this.dashboardData?.paymentStatus || 'Unknown';
  }

  getDaysUntilDue(): number {
    return this.dashboardData?.daysUntilDue || 0;
  }

  getOpenMaintenance(): number {
    return this.dashboardData?.openMaintenance || 0;
  }

  getLeaseEndDays(): number {
    return this.dashboardData?.leaseEndDays || 0;
  }

  getPendingMoveOutNotices(): number {
    return this.dashboardData?.pendingMoveOutNotices || 0;
  }

  hasUpcomingMoveOut(): boolean {
    return !!this.dashboardData?.upcomingMoveOutDate;
  }

  getUpcomingMoveOutDate(): string {
    if (this.dashboardData?.upcomingMoveOutDate) {
      return new Date(this.dashboardData.upcomingMoveOutDate).toLocaleDateString();
    }
    return '';
  }

  hasActiveMoveOut(): boolean {
    return this.dashboardData?.hasActiveMoveOut || false;
  }

  // Action methods
  payRent() {
    this.snackBar.open('Redirecting to payment page...', 'Close', { duration: 2000 });
    this.router.navigate(['/tenant-dashboard/payments']);
  }

  viewMaintenance() {
    this.router.navigate(['/tenant-dashboard/maintenance']);
  }

  viewDocuments() {
    this.router.navigate(['/tenant-dashboard/documents']);
  }

  viewMessages() {
    this.router.navigate(['/tenant-dashboard/messages']);
  }

  viewMoveOutNotices() {
    this.router.navigate(['/tenant-dashboard/move-out-notices']);
  }
}