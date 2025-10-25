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

import { DashboardData, QuickAction, RecentActivity } from '../../../../services/dashboard-interface';

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
   dashboardData: any = {
    currentRent: 0,
    paymentStatus: '',
    daysUntilDue: 0,
    openMaintenance: 0,
    leaseEndDays: 0
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
    },
    {
      icon: 'edit',
      label: 'Edit Profile',
      description: 'Update your personal information',
      route: ['/tenant-dashboard/profile/edit'],
      color: '#ef4444'
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

    const propertiesSub = this.propertyService.getProperties().subscribe({
      next: (response: any) => {
        this.processTenantDashboardData();
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.processTenantDashboardData();
        this.isLoadingDashboard = false;
        
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

    this.subscriptions.add(propertiesSub);
  }

  private processTenantDashboardData(): void {
   
    this.dashboardData = {
      currentRent: 25000,
      paymentStatus: 'Current',
      daysUntilDue: 12,
      openMaintenance: 1,
      leaseEndDays: 85
    };
  }

  navigateToSection(section: string) {
    const routeMap: { [key: string]: string[] } = {
      'payments': ['/tenant-dashboard/payments'],
      'maintenance': ['/tenant-dashboard/maintenance'],
      'documents': ['/tenant-dashboard/documents'],
      'messages': ['/tenant-dashboard/messages'],
      'profile': ['/tenant-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    }
  }

  openMaintenanceRequest() {
   
    this.snackBar.open('Redirecting to maintenance requests...', 'Close', { duration: 2000 });
    this.router.navigate(['/tenant-dashboard/maintenance']);
    
    // This would be the correct implementation when MaintenanceRequestComponent exists:
    /*
    const dialogRef = this.dialog.open(MaintenanceRequestComponent, {
      width: '90%',
      maxWidth: '600px',
      height: 'auto',
      panelClass: 'maintenance-form-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.snackBar.open('Maintenance request submitted successfully!', 'Close', { duration: 3000 });
        this.loadDashboardData();
      }
    });
    */
  }

  onQuickAction(action: QuickAction) {
    this.router.navigate(action.route);
  }

  navigateToProfileView() {
    this.router.navigate(['/tenant-dashboard/profile/view']);
  }

  navigateToProfileEdit() {
    this.router.navigate(['/tenant-dashboard/profile/edit']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }

  
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
}