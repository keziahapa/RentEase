import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';
import { AdminService } from '../../../../../../services/admin.service';
import { Subscription, forkJoin } from 'rxjs';

interface DashboardData {
  totalUsers: number;
  totalProperties: number;
  activeBusinesses: number;
  activeDisputes: number;
  monthlyRevenue: number;
  userGrowth: number;
  propertiesGrowth: number;
  revenueGrowth: number;
  totalLandlords: number;
  totalTenants: number;
  totalCaretakers: number;
  platformEarnings?: number;
  commissionRevenue?: number;
  pendingApprovals?: number;
  totalAdmins?: number;
  systemHealth?: string;
}

interface QuickAction {
  label: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

interface Activity {
  type: string;
  message: string;
  icon: string;
  time: string;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SkeletonListComponent
  ],
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss']
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private adminService = inject(AdminService);

  private subscriptions = new Subscription();

  isLoadingDashboard = true;
  dashboardError: string | null = null;
  dashboardData: DashboardData | null = null;
  
  quickActions: QuickAction[] = [
    {
      label: 'Manage Businesses',
      description: 'Approve or reject business applications',
      icon: 'business_center',
      color: '#f59e0b',
      route: '/admin-dashboard/businesses'
    },
    {
      label: 'Review Advertisements',
      description: 'Manage advertisement campaigns',
      icon: 'campaign',
      color: '#8b5cf6',
      route: '/admin-dashboard/advertisements'
    },
    {
      label: 'User Management',
      description: 'View and manage platform users',
      icon: 'people',
      color: '#3b82f6',
      route: '/admin-dashboard/users'
    },
    {
      label: 'Dispute Resolution',
      description: 'Handle user disputes and issues',
      icon: 'gavel',
      color: '#ef4444',
      route: '/admin-dashboard/disputes'
    }
  ];

  recentActivities: Activity[] = [];
  pendingBusinessesCount = 0;
  pendingAdvertisementsCount = 0;

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDashboardData() {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    // Load all data from backend simultaneously
    const dashboardStats$ = this.adminService.getDashboardStats();
    const pendingBusinesses$ = this.adminService.getPendingBusinesses();
    const pendingAdvertisements$ = this.adminService.getPendingAdvertisements();

    const subscription = forkJoin({
      stats: dashboardStats$,
      pendingBusinesses: pendingBusinesses$,
      pendingAdvertisements: pendingAdvertisements$
    }).subscribe({
      next: (results) => {
        // Process dashboard stats from backend
        if (results.stats.success) {
          this.dashboardData = this.transformStatsData(results.stats.data);
        } else {
          throw new Error(results.stats.message || 'Failed to load dashboard statistics');
        }

        // Process pending businesses count from backend
        if (results.pendingBusinesses.success) {
          this.pendingBusinessesCount = results.pendingBusinesses.data.length;
        } else {
          console.warn('Failed to load pending businesses:', results.pendingBusinesses.message);
          this.pendingBusinessesCount = 0;
        }

        // Process pending advertisements count from backend
        if (results.pendingAdvertisements.success) {
          this.pendingAdvertisementsCount = results.pendingAdvertisements.data.length;
        } else {
          console.warn('Failed to load pending advertisements:', results.pendingAdvertisements.message);
          this.pendingAdvertisementsCount = 0;
        }

        // Generate recent activities based on real data
        this.generateRecentActivities();
        
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        console.error('Error loading dashboard data:', error);
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        
        // FIX: Use a string literal instead of dashboardError which can be null
        const errorMessage = this.dashboardError || 'An unknown error occurred';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      }
    });

    this.subscriptions.add(subscription);
  }

  private transformStatsData(stats: any): DashboardData {
    return {
      totalUsers: stats.totalUsers || 0,
      totalProperties: stats.totalProperties || 0,
      activeBusinesses: stats.activeBusinesses || 0,
      activeDisputes: stats.activeDisputes || 0,
      monthlyRevenue: stats.monthlyRevenue || 0,
      userGrowth: stats.userGrowth || 0,
      propertiesGrowth: stats.propertiesGrowth || 0,
      revenueGrowth: stats.revenueGrowth || 0,
      totalLandlords: stats.totalLandlords || 0,
      totalTenants: stats.totalTenants || 0,
      totalCaretakers: stats.totalCaretakers || 0,
      platformEarnings: stats.platformEarnings || 0,
      commissionRevenue: stats.commissionRevenue || 0,
      pendingApprovals: stats.pendingApprovals || 0,
      totalAdmins: stats.totalAdmins || 0,
      systemHealth: stats.systemHealth || 'healthy'
    };
  }

  private generateRecentActivities() {
    this.recentActivities = [];

    // Add activities based on real backend data
    if (this.pendingBusinessesCount > 0) {
      this.recentActivities.push({
        type: 'Pending Business Applications',
        message: `${this.pendingBusinessesCount} business application(s) awaiting review`,
        icon: 'business',
        time: 'Recently'
      });
    }

    if (this.pendingAdvertisementsCount > 0) {
      this.recentActivities.push({
        type: 'Pending Advertisements',
        message: `${this.pendingAdvertisementsCount} advertisement(s) awaiting approval`,
        icon: 'campaign',
        time: 'Recently'
      });
    }

    if (this.dashboardData) {
      // Add user growth activity
      if (this.dashboardData.userGrowth > 0) {
        this.recentActivities.push({
          type: 'User Growth',
          message: `${this.dashboardData.userGrowth}% user growth this month`,
          icon: 'trending_up',
          time: 'Today'
        });
      }

      // Add revenue activity
      if (this.dashboardData.monthlyRevenue > 0) {
        this.recentActivities.push({
          type: 'Revenue Update',
          message: `Monthly revenue: ${this.formatCurrency(this.dashboardData.monthlyRevenue)}`,
          icon: 'attach_money',
          time: 'Today'
        });
      }

      // Add disputes activity
      if (this.dashboardData.activeDisputes > 0) {
        this.recentActivities.push({
          type: 'Active Disputes',
          message: `${this.dashboardData.activeDisputes} active dispute(s)`,
          icon: 'gavel',
          time: 'Requires attention'
        });
      }
    }

    // Add default activity if no recent activities
    if (this.recentActivities.length === 0) {
      this.recentActivities.push({
        type: 'System Status',
        message: 'All systems operational',
        icon: 'check_circle',
        time: 'Just now'
      });
    }

    // Limit to 3 activities
    this.recentActivities = this.recentActivities.slice(0, 3);
  }

  refreshDashboard() {
    this.loadDashboardData();
    this.snackBar.open('Dashboard refreshed', 'Close', { duration: 3000 });
  }

  hasData(): boolean {
    return this.dashboardData !== null;
  }

  getGrowthClass(growth: number): string {
    return growth >= 0 ? 'growth-positive' : 'growth-negative';
  }

  getGrowthIcon(growth: number): string {
    return growth >= 0 ? 'trending_up' : 'trending_down';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  getPendingItemsCount(): number {
    return this.pendingBusinessesCount + this.pendingAdvertisementsCount;
  }

  hasPendingBusinesses(): boolean {
    return this.pendingBusinessesCount > 0;
  }

  hasPendingAdvertisements(): boolean {
    return this.pendingAdvertisementsCount > 0;
  }

  onQuickAction(action: QuickAction) {
    this.router.navigate([action.route]);
  }

  navigateToBusinesses() {
    this.router.navigate(['/admin-dashboard/businesses']);
  }

  navigateToAdvertisements() {
    this.router.navigate(['/admin-dashboard/advertisements']);
  }

  // Helper methods for safe data display
  getDisplayValue(value: number | undefined): string {
    return value !== undefined ? this.formatNumber(value) : '0';
  }

  getGrowthDisplay(growth: number | undefined): string {
    if (growth === undefined) return '0%';
    return `${growth >= 0 ? '+' : ''}${growth}%`;
  }

  // Safe method to get error message for template
  getErrorMessage(): string {
    return this.dashboardError || 'An unknown error occurred';
  }
}