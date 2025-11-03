// admin-overview.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AdminService } from '../../../../../../services/admin.service';
import { AdminStats, Business, Advertisement } from '../../../../../../services/admin-interfaces';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

export interface QuickAction {
  icon: string;
  label: string;
  description: string;
  route: string[];
  color: string;
}

export interface RecentActivity {
  type: string;
  message: string;
  time: string;
  icon: string;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    SkeletonListComponent
  ],
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss']
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  dashboardData: AdminStats | null = null;
  businesses: Business[] = [];
  advertisements: Advertisement[] = [];
  pendingBusinessesCount: number = 0;
  pendingAdvertisementsCount: number = 0;

  quickActions: QuickAction[] = [
    {
      icon: 'people',
      label: 'Manage Users',
      description: 'View and manage all platform users',
      route: ['/admin-dashboard/users'],
      color: '#3b82f6'
    },
    {
      icon: 'apartment',
      label: 'View Properties',
      description: 'Monitor all properties on the platform',
      route: ['/admin-dashboard/properties'],
      color: '#10b981'
    },
    {
      icon: 'business_center',
      label: 'Approve Businesses',
      description: 'Review and approve business applications',
      route: ['/admin-dashboard/businesses'],
      color: '#f59e0b'
    },
    {
      icon: 'campaign',
      label: 'Manage Ads',
      description: 'Review and manage advertisements',
      route: ['/admin-dashboard/advertisements'],
      color: '#8b5cf6'
    },
    {
      icon: 'gavel',
      label: 'Resolve Disputes',
      description: 'Handle platform disputes and issues',
      route: ['/admin-dashboard/disputes'],
      color: '#ef4444'
    },
    {
      icon: 'assessment',
      label: 'Generate Reports',
      description: 'Create platform performance reports',
      route: ['/admin-dashboard/reports'],
      color: '#06b6d4'
    }
  ];

  recentActivities: RecentActivity[] = [];

  isLoadingDashboard = true;
  isLoadingBusinesses = false;
  isLoadingAdvertisements = false;
  dashboardError = '';
  businessesError = '';
  advertisementsError = '';

  private subscriptions = new Subscription();

  ngOnInit() {
    this.loadDashboardData();
    this.loadPendingBusinesses();
    this.loadPendingAdvertisements();
    this.generateRecentActivities();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDashboardData() {
    this.isLoadingDashboard = true;
    this.dashboardError = '';

    const dashboardSub = this.adminService.getDashboardStats().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.dashboardData = {
            totalUsers: response.data.totalUsers || 0,
            totalProperties: response.data.totalProperties || 0,
            activeBusinesses: response.data.activeBusinesses || 0,
            monthlyRevenue: response.data.monthlyRevenue || 0,
            commissionRevenue: response.data.commissionRevenue || 0,
            pendingApprovals: response.data.pendingApprovals || 0,
            activeDisputes: response.data.activeDisputes || 0,
            userGrowth: response.data.userGrowth || 0,
            revenueGrowth: response.data.revenueGrowth || 0,
            propertiesGrowth: response.data.propertiesGrowth || 0,
            totalLandlords: response.data.totalLandlords || 0,
            totalTenants: response.data.totalTenants || 0,
            totalCaretakers: response.data.totalCaretakers || 0,
            totalAdmins: response.data.totalAdmins || 0,
            platformEarnings: response.data.platformEarnings || 0,
            systemHealth: response.data.systemHealth || 'unknown'
          };
        } else {
          this.dashboardError = 'Failed to load dashboard data';
        }
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.isLoadingDashboard = false;
        this.dashboardError = error?.message || 'Failed to load dashboard data';
        this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        
        // Create mock data for development
        this.createMockDashboardData();
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  loadPendingBusinesses() {
    this.isLoadingBusinesses = true;
    this.businessesError = '';

    const businessesSub = this.adminService.getPendingBusinesses().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.pendingBusinessesCount = response.data?.length || 0;
          this.businesses = response.data || [];
        } else {
          this.businessesError = 'Failed to load pending businesses';
        }
        this.isLoadingBusinesses = false;
      },
      error: (error: any) => {
        this.isLoadingBusinesses = false;
        this.businessesError = error?.message || 'Failed to load pending businesses';
        this.pendingBusinessesCount = 0;
        this.businesses = [];
      }
    });

    this.subscriptions.add(businessesSub);
  }

  loadPendingAdvertisements() {
    this.isLoadingAdvertisements = true;
    this.advertisementsError = '';

    const advertisementsSub = this.adminService.getPendingAdvertisements().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.pendingAdvertisementsCount = response.data?.length || 0;
          this.advertisements = response.data || [];
        } else {
          this.advertisementsError = 'Failed to load pending advertisements';
        }
        this.isLoadingAdvertisements = false;
      },
      error: (error: any) => {
        this.isLoadingAdvertisements = false;
        this.advertisementsError = error?.message || 'Failed to load pending advertisements';
        this.pendingAdvertisementsCount = 0;
        this.advertisements = [];
      }
    });

    this.subscriptions.add(advertisementsSub);
  }

  private generateRecentActivities() {
    // This would typically come from an API
    this.recentActivities = [
      {
        type: 'User Registration',
        message: '5 new users registered in the last hour',
        time: '15 minutes ago',
        icon: 'person_add'
      },
      {
        type: 'Business Application',
        message: 'Quick Clean Services applied for approval',
        time: '1 hour ago',
        icon: 'business'
      },
      {
        type: 'Advertisement Posted',
        message: 'New advertisement awaiting review',
        time: '2 hours ago',
        icon: 'campaign'
      },
      {
        type: 'Payment Processed',
        message: 'KES 45,000 commission collected',
        time: '3 hours ago',
        icon: 'payments'
      }
    ];
  }

  private createMockDashboardData(): void {
    this.dashboardData = {
      totalUsers: 1250,
      totalProperties: 89,
      activeBusinesses: 45,
      monthlyRevenue: 4250000,
      commissionRevenue: 425000,
      pendingApprovals: 12,
      activeDisputes: 8,
      userGrowth: 12.5,
      revenueGrowth: 18.3,
      propertiesGrowth: 8.7,
      totalLandlords: 56,
      totalTenants: 980,
      totalCaretakers: 24,
      totalAdmins: 5,
      platformEarnings: 1250000,
      systemHealth: 'excellent'
    };
  }

  onQuickAction(action: QuickAction) {
    this.router.navigate(action.route);
  }

  navigateToUsers() {
    this.router.navigate(['/admin-dashboard/users']);
  }

  navigateToProperties() {
    this.router.navigate(['/admin-dashboard/properties']);
  }

  navigateToBusinesses() {
    this.router.navigate(['/admin-dashboard/businesses']);
  }

  navigateToAdvertisements() {
    this.router.navigate(['/admin-dashboard/advertisements']);
  }

  navigateToDisputes() {
    this.router.navigate(['/admin-dashboard/disputes']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.loadPendingBusinesses();
    this.loadPendingAdvertisements();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  formatCurrency(amount: number): string {
    return `KES ${amount?.toLocaleString('en-KE') || '0'}`;
  }

  getGrowthClass(growth: number): string {
    return growth >= 0 ? 'growth-positive' : 'growth-negative';
  }

  getGrowthIcon(growth: number): string {
    return growth >= 0 ? 'trending_up' : 'trending_down';
  }

  hasData(): boolean {
    return !this.isLoadingDashboard && !this.dashboardError && this.dashboardData !== null;
  }

  hasPendingBusinesses(): boolean {
    return !this.isLoadingBusinesses && this.pendingBusinessesCount > 0;
  }

  hasPendingAdvertisements(): boolean {
    return !this.isLoadingAdvertisements && this.pendingAdvertisementsCount > 0;
  }

  getPendingItemsCount(): number {
    return this.pendingBusinessesCount + this.pendingAdvertisementsCount;
  }
}