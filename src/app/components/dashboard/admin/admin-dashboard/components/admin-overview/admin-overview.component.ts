import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SkeletonListComponent } from '../../../../../../shared/components/skeleton/skeleton-list.component';

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
export class AdminOverviewComponent implements OnInit {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

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

  recentActivities: Activity[] = [
    {
      type: 'New Business Registration',
      message: 'ABC Corporation registered for business account',
      icon: 'business',
      time: '2 hours ago'
    },
    {
      type: 'Advertisement Approved',
      message: 'Summer Campaign ad was approved',
      icon: 'campaign',
      time: '4 hours ago'
    },
    {
      type: 'User Registration',
      message: 'New landlord joined the platform',
      icon: 'person_add',
      time: '6 hours ago'
    }
  ];

  pendingBusinessesCount = 5;
  pendingAdvertisementsCount = 3;

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    // Simulate API call
    setTimeout(() => {
      this.dashboardData = {
        totalUsers: 1250,
        totalProperties: 89,
        activeBusinesses: 45,
        activeDisputes: 12,
        monthlyRevenue: 45200,
        userGrowth: 12,
        propertiesGrowth: 8,
        revenueGrowth: 15,
        totalLandlords: 340,
        totalTenants: 780,
        totalCaretakers: 45
      };
      this.isLoadingDashboard = false;
    }, 2000);
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
      currency: 'USD'
    }).format(amount);
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
}