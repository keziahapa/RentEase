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
import { Subscription, forkJoin } from 'rxjs';
import { CreateAdvertisementComponent } from '../create-advertisement/create-advertisement.component';
import { Advertisement } from '../../../../../services/business-interface';

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
  date: Date;
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

  advertisements: Advertisement[] = [];

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

  recentActivities: RecentActivity[] = [];

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

    // Load both advertisements and dashboard data
    const loadSub = forkJoin({
      ads: this.businessService.getAdvertisements(),
      dashboard: this.businessService.getBusinessDashboardData()
    }).subscribe({
      next: (response) => {
        this.advertisements = response.ads || [];
        this.processRealDashboardData();
        this.generateRealRecentActivities();
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        console.error('Dashboard load error:', error);
        
        // Try to load from local storage as fallback
        this.advertisements = this.businessService['getLocalAdvertisements']() || [];
        this.processRealDashboardData();
        this.generateRealRecentActivities();
        this.isLoadingDashboard = false;
        
        if (error.status !== 404) {
          this.dashboardError = error?.message || 'Failed to load dashboard data';
          this.snackBar.open('Some data loaded from cache', 'Close', { duration: 3000 });
        }
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout().subscribe();
            this.router.navigate(['/business-login']);
          }, 2000);
        }
      }
    });

    this.subscriptions.add(loadSub);
  }

  private processRealDashboardData(): void {
    const totalAds = this.advertisements.length;
    const activeAds = this.advertisements.filter(ad => ad.status === 'APPROVED').length;
    const pendingAds = this.advertisements.filter(ad => ad.status === 'PENDING').length;
    const rejectedAds = this.advertisements.filter(ad => ad.status === 'REJECTED').length;
    
    // Calculate total clicks and views from actual ad data
    const totalClicks = this.advertisements.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const totalViews = this.advertisements.reduce((sum, ad) => sum + (ad.views || 0), 0);
    
    // Calculate total spent (assuming 500 KES per ad as base cost)
    const baseAdCost = 500;
    const totalSpent = totalAds * baseAdCost;
    
    // Calculate approval rate
    const approvalRate = totalAds > 0 
      ? `${Math.round((activeAds / totalAds) * 100)}%`
      : '0%';

    this.dashboardData = {
      totalAds,
      activeAds,
      pendingAds,
      rejectedAds,
      totalSpent,
      totalClicks,
      totalViews,
      approvalRate
    };
  }

  private generateRealRecentActivities(): void {
    this.recentActivities = [];

    // Sort advertisements by date (newest first)
    const sortedAds = [...this.advertisements].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Generate activities from real ad data
    sortedAds.forEach(ad => {
      const createdDate = new Date(ad.createdAt);
      const updatedDate = new Date(ad.updatedAt || ad.createdAt);

      // Ad creation activity
      this.recentActivities.push({
        type: 'Ad Created',
        message: `"${ad.title}" campaign created`,
        time: this.getRelativeTime(createdDate),
        icon: 'campaign',
        date: createdDate
      });

      // Ad approval/rejection activity (if status changed)
      if (ad.status === 'APPROVED' && ad.updatedAt) {
        this.recentActivities.push({
          type: 'Ad Approved',
          message: `Your "${ad.title}" ad has been approved`,
          time: this.getRelativeTime(updatedDate),
          icon: 'check_circle',
          date: updatedDate
        });
      } else if (ad.status === 'REJECTED' && ad.updatedAt) {
        this.recentActivities.push({
          type: 'Ad Rejected',
          message: `Your "${ad.title}" ad was rejected${ad.rejectionReason ? ': ' + ad.rejectionReason : ''}`,
          time: this.getRelativeTime(updatedDate),
          icon: 'cancel',
          date: updatedDate
        });
      }

      // Click activity (if ad has clicks)
      if (ad.clicks && ad.clicks > 0 && ad.status === 'APPROVED') {
        this.recentActivities.push({
          type: 'New Clicks',
          message: `Your "${ad.title}" ad received ${ad.clicks} click${ad.clicks > 1 ? 's' : ''}`,
          time: this.getRelativeTime(updatedDate),
          icon: 'trending_up',
          date: updatedDate
        });
      }
    });

    // Sort all activities by date (newest first) and take top 10
    this.recentActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    this.recentActivities = this.recentActivities.slice(0, 10);

    // If no activities, show a placeholder
    if (this.recentActivities.length === 0) {
      this.recentActivities.push({
        type: 'Getting Started',
        message: 'Create your first advertisement to see activity here',
        time: 'Just now',
        icon: 'info',
        date: new Date()
      });
    }
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
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
        this.loadDashboardData(); // Reload to show new ad in stats and activities
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