import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BusinessService } from '../../../../../services/business.service';
import { AuthService } from '../../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { CreateAdvertisementComponent } from '../create-advertisement/create-advertisement.component';

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  route: string[];
  color: string;
}

interface RecentActivity {
  type: string;
  message: string;
  time: string;
  icon: string;
}

@Component({
  selector: 'app-business-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './business-overview.component.html',
  styleUrls: ['./business-overview.component.scss']
})
export class BusinessOverviewComponent implements OnInit, OnDestroy {
  dashboardData: any = {
    totalAds: 0,
    activeAds: 0,
    pendingAds: 0,
    totalSpent: 0,
    totalClicks: 0,
    approvalRate: '0%'
  };

  quickActions: QuickAction[] = [
    {
      icon: 'add_circle',
      label: 'Create New Ad',
      description: 'Launch a new advertising campaign',
      route: [],
      color: '#10b981'
    },
    {
      icon: 'campaign',
      label: 'My Ads',
      description: 'Manage your existing advertisements',
      route: ['/business-dashboard/ads'],
      color: '#3b82f6'
    },
    {
      icon: 'analytics',
      label: 'Analytics',
      description: 'View campaign performance insights',
      route: ['/business-dashboard/analytics'],
      color: '#8b5cf6'
    },
    {
      icon: 'receipt',
      label: 'Billing',
      description: 'Manage payments and invoices',
      route: ['/business-dashboard/billing'],
      color: '#f59e0b'
    },
    {
      icon: 'trending_up',
      label: 'Performance',
      description: 'Track ad performance metrics',
      route: ['/business-dashboard/analytics'],
      color: '#06b6d4'
    },
    {
      icon: 'business',
      label: 'Business Profile',
      description: 'Update your business information',
      route: ['/business-dashboard/profile/edit'],
      color: '#ef4444'
    }
  ];

  recentActivities: RecentActivity[] = [
    {
      type: 'Ad Approved',
      message: 'Your "Summer Sale" ad has been approved',
      time: '1 day ago',
      icon: 'check_circle'
    },
    {
      type: 'New Click',
      message: 'Your restaurant ad received 15 new clicks',
      time: '2 days ago',
      icon: 'trending_up'
    },
    {
      type: 'Payment Processed',
      message: 'Monthly advertising fee processed',
      time: '3 days ago',
      icon: 'payments'
    },
    {
      type: 'Ad Created',
      message: 'New "Grand Opening" campaign created',
      time: '1 week ago',
      icon: 'campaign'
    }
  ];

  isLoadingDashboard = true;
  dashboardError = '';
  private subscriptions = new Subscription();

  constructor(
    private businessService: BusinessService,
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

    const dashboardSub = this.businessService.getBusinessDashboardData().subscribe({
      next: (response: any) => {
        this.processBusinessDashboardData(response);
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.processBusinessDashboardData();
        this.isLoadingDashboard = false;
        
        if (error.status !== 404) {
          this.dashboardError = error?.message || 'Failed to load dashboard data';
          this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        }
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout().subscribe();
            this.router.navigate(['/business-login']);
          }, 2000);
        }
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  private processBusinessDashboardData(response?: any): void {
    this.dashboardData = {
      totalAds: 12,
      activeAds: 8,
      pendingAds: 2,
      totalSpent: 12500,
      totalClicks: 345,
      approvalRate: '83%',
      businessName: 'Premium Restaurant',
      registrationStatus: 'Verified'
    };
  }

  navigateToSection(section: string) {
    const routeMap: { [key: string]: string[] } = {
      'create-ad': ['/business-dashboard/ads/create'],
      'my-ads': ['/business-dashboard/ads'],
      'analytics': ['/business-dashboard/analytics'],
      'billing': ['/business-dashboard/billing'],
      'profile': ['/business-dashboard/profile/edit']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    }
  }

  createNewAd() {
    const dialogRef = this.dialog.open(CreateAdvertisementComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: false,
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.snackBar.open('Advertisement created successfully!', 'Close', { 
          duration: 3000 
        });
        this.loadDashboardData();
      }
    });
  }

  onQuickAction(action: QuickAction) {
    if (action.label === 'Create New Ad') {
      this.createNewAd();
    } else {
      this.router.navigate(action.route);
    }
  }

  navigateToProfileView() {
    this.router.navigate(['/business-dashboard/profile/view']);
  }

  navigateToProfileEdit() {
    this.router.navigate(['/business-dashboard/profile/edit']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  getTotalAds(): number {
    return this.dashboardData?.totalAds || 0;
  }

  getActiveAds(): number {
    return this.dashboardData?.activeAds || 0;
  }

  getPendingAds(): number {
    return this.dashboardData?.pendingAds || 0;
  }

  getTotalSpent(): number {
    return this.dashboardData?.totalSpent || 0;
  }

  getTotalClicks(): number {
    return this.dashboardData?.totalClicks || 0;
  }

  getApprovalRate(): string {
    return this.dashboardData?.approvalRate || '0%';
  }

  viewMyAds() {
    this.router.navigate(['/business-dashboard/ads']);
  }

  viewAnalytics() {
    this.router.navigate(['/business-dashboard/analytics']);
  }

  viewBilling() {
    this.router.navigate(['/business-dashboard/billing']);
  }
}