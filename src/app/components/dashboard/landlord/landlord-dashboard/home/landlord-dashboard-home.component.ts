import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PropertyService } from '../../../../../services/property.service';
import { AuthService } from '../../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { PropertyCreateComponent } from '../property/property-create/property-create.component';
import { DashboardData, QuickAction, RecentActivity } from '../../../../../services/dashboard-interface';

@Component({
  selector: 'app-landlord-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './landlord-dashboard-home.component.html',
  styleUrls: ['./landlord-dashboard-home.component.scss']
})
export class LandlordDashboardHomeComponent implements OnInit, OnDestroy {
  dashboardData: DashboardData = {
    totalProperties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    rentCollectionRate: 0,
    openMaintenance: 0
  };

  quickActions: QuickAction[] = [
    {
      icon: 'person_add',
      label: 'Add Tenant',
      description: 'Invite new tenants to your properties',
      route: ['/landlord-dashboard/tenants'],
      color: '#3b82f6'
    },
    {
      icon: 'receipt',
      label: 'Create Invoice',
      description: 'Generate rent invoices for tenants',
      route: ['/landlord-dashboard/financials/invoices'],
      color: '#10b981'
    },
    {
      icon: 'handyman',
      label: 'Maintenance',
      description: 'Create maintenance work orders',
      route: ['/landlord-dashboard/maintenance'],
      color: '#f59e0b'
    },
    {
      icon: 'assessment',
      label: 'Reports',
      description: 'View financial and property reports',
      route: ['/landlord-dashboard/reports'],
      color: '#8b5cf6'
    },
    {
      icon: 'description',
      label: 'Documents',
      description: 'Manage lease agreements and documents',
      route: ['/landlord-dashboard/documents'],
      color: '#ef4444'
    },
    {
      icon: 'message',
      label: 'Messages',
      description: 'Communicate with tenants',
      route: ['/landlord-dashboard/messages'],
      color: '#06b6d4'
    },
    // FIXED: Added profile edit quick action
    {
      icon: 'edit',
      label: 'Edit Profile',
      description: 'Update your personal information',
      route: ['/landlord-dashboard/profile/edit'],
      color: '#8b5cf6'
    }
  ];

  recentActivities: RecentActivity[] = [
    {
      type: 'Property Added',
      message: 'Springfield Apartments was added',
      time: '2 hours ago',
      icon: 'apartment'
    },
    {
      type: 'Payment Received',
      message: 'KES 25,000 from John Doe - Unit 4B',
      time: '5 hours ago',
      icon: 'payments'
    },
    {
      type: 'Maintenance Request',
      message: 'New request for leaking faucet in Unit 2A',
      time: '1 day ago',
      icon: 'handyman'
    },
    {
      type: 'Tenant Added',
      message: 'Sarah Johnson moved into Unit 3C',
      time: '2 days ago',
      icon: 'person_add'
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
        let properties: any[] = [];
        
        if (Array.isArray(response)) {
          properties = response;
        } else if (response?.data && Array.isArray(response.data)) {
          properties = response.data;
        } else if (response?.properties && Array.isArray(response.properties)) {
          properties = response.properties;
        } else if (response?.content && Array.isArray(response.content)) {
          properties = response.content;
        } else if (response?.success && Array.isArray(response.data)) {
          properties = response.data;
        } else {
          properties = [];
        }

        this.processDashboardData(properties);
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.isLoadingDashboard = false;
        this.dashboardError = error?.message || 'Failed to load dashboard data';
        this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        
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

  private processDashboardData(properties: any[]): void {
    const totalProperties = properties.length;
    let totalUnits = 0;
    let occupiedUnits = 0;
    let monthlyRevenue = 0;
    let openMaintenance = 0;

    properties.forEach(property => {
      if (property.units && Array.isArray(property.units)) {
        totalUnits += property.units.length;
        
        property.units.forEach((unit: any) => {
          if (unit.status === 'occupied') {
            occupiedUnits++;
            monthlyRevenue += unit.rentAmount || 0;
          } else if (unit.status === 'maintenance') {
            openMaintenance++;
          }
        });
      }
    });

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const rentCollectionRate = monthlyRevenue > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    this.dashboardData = {
      totalProperties,
      occupancyRate,
      monthlyRevenue,
      rentCollectionRate,
      openMaintenance
    };
  }

  navigateToSection(section: string) {
    const routeMap: { [key: string]: string[] } = {
      'properties': ['/landlord-dashboard/property'],
      'tenants': ['/landlord-dashboard/tenants'],
      'maintenance': ['/landlord-dashboard/maintenance'],
      'financials': ['/landlord-dashboard/financials'],
      'reports': ['/landlord-dashboard/reports'],
      'documents': ['/landlord-dashboard/documents'],
      'messages': ['/landlord-dashboard/messages'],
      'profile': ['/landlord-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    }
  }

  openPropertyForm() {
    const dialogRef = this.dialog.open(PropertyCreateComponent, {
      width: '90%',
      maxWidth: '800px',
      height: '90vh',
      panelClass: 'property-form-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.snackBar.open('Property added successfully!', 'Close', { duration: 3000 });
        this.loadDashboardData();
      }
    });
  }

  onQuickAction(action: QuickAction) {
    this.router.navigate(action.route);
  }

  // FIXED: Added direct profile navigation methods
  navigateToProfileView() {
    this.router.navigate(['/landlord-dashboard/profile/view']);
  }

  navigateToProfileEdit() {
    this.router.navigate(['/landlord-dashboard/profile/edit']);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }
}