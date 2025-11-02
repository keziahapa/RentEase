import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

export interface DashboardData {
  totalUsers: number;
  totalProperties: number;
  activeBusinesses: number;
  monthlyRevenue: number;
  commissionRevenue: number;
  pendingApprovals: number;
  activeDisputes: number;
  userGrowth: number;
  revenueGrowth: number;
  propertiesGrowth: number;
  totalLandlords: number;
  totalTenants: number;
  totalCaretakers: number;
}

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
    SkeletonListComponent
  ],
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss']
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  dashboardData: DashboardData = {
    totalUsers: 0,
    totalProperties: 0,
    activeBusinesses: 0,
    monthlyRevenue: 0,
    commissionRevenue: 0,
    pendingApprovals: 0,
    activeDisputes: 0,
    userGrowth: 0,
    revenueGrowth: 0,
    propertiesGrowth: 0,
    totalLandlords: 0,
    totalTenants: 0,
    totalCaretakers: 0
  };

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
      icon: 'business',
      label: 'Approve Businesses',
      description: 'Review and approve business applications',
      route: ['/admin-dashboard/businesses'],
      color: '#f59e0b'
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
      color: '#8b5cf6'
    },
    {
      icon: 'settings',
      label: 'System Settings',
      description: 'Configure platform settings',
      route: ['/admin-dashboard/settings'],
      color: '#06b6d4'
    }
  ];

  recentActivities: RecentActivity[] = [
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
      type: 'Dispute Reported',
      message: 'New maintenance dispute reported by Tenant A',
      time: '2 hours ago',
      icon: 'warning'
    },
    {
      type: 'Payment Processed',
      message: 'KES 45,000 commission collected',
      time: '3 hours ago',
      icon: 'payments'
    }
  ];

  isLoadingDashboard = true;
  dashboardError = '';
  private subscriptions = new Subscription();

  constructor(
    private adminService: AdminDataService,
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
            totalCaretakers: response.data.totalCaretakers || 0
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
        
        // In a live integration, handle auth errors and redirect accordingly
      }
    });

    this.subscriptions.add(dashboardSub);
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

  navigateToDisputes() {
    this.router.navigate(['/admin-dashboard/disputes']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  formatCurrency(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE')}`;
  }

  getGrowthClass(growth: number): string {
    return growth >= 0 ? 'growth-positive' : 'growth-negative';
  }

  getGrowthIcon(growth: number): string {
    return growth >= 0 ? 'trending_up' : 'trending_down';
  }
}
