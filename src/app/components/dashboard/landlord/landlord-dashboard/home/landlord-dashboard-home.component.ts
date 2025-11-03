import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PropertyService } from '../../../../../services/property.service';
import { AuthService } from '../../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { PropertyCreateComponent } from '../property/property-create/property-create.component';
import { MoveOutActionDialogComponent } from '../move-out-action-dialog/move-out-action-dialog.component';
import { 
  DashboardData, 
  QuickAction, 
  RecentActivity, 
  LandlordMoveOutNotice,
  LandlordMoveOutNoticeResponse,
  MoveOutStats 
} from '../../../../../services/dashboard-interface';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-landlord-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    SkeletonListComponent
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
    openMaintenance: 0,
    pendingMoveOutNotices: 0,
    approvedMoveOutNotices: 0,
    upcomingMoveOuts: 0
  };

  moveOutStats: MoveOutStats = {
    totalNotices: 0,
    pendingNotices: 0,
    approvedNotices: 0,
    rejectedNotices: 0,
    cancelledNotices: 0,
    upcomingMoveOuts: 0,
    averageProcessingTime: 0,
    monthlyTrend: [],
    reasonBreakdown: []
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
      icon: 'exit_to_app',
      label: 'Move Out Requests',
      description: 'Review tenant move-out notices',
      route: ['/landlord-dashboard/move-out-notices'],
      color: '#ef4444'
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

    try {
      const propertiesSub = this.propertyService.getProperties().subscribe({
        next: (response: any) => {
          const properties = this.normalizePropertiesResponse(response);
          this.processDashboardData(properties);
          this.loadMoveOutData();
        },
        error: (error: any) => this.handleDashboardError(error)
      });

      this.subscriptions.add(propertiesSub);
    } catch (error) {
      this.handleDashboardError(error);
    }
  }

  private loadMoveOutData(): void {
    const moveOutNoticesSub = this.propertyService.getLandlordMoveOutNotices(1, 5).subscribe({
      next: (response: LandlordMoveOutNoticeResponse) => {
        if (response.success) {
          const notices = Array.isArray(response.data) ? response.data : [];
          this.processMoveOutDashboardData(notices);
        }
        this.loadMoveOutStats();
      },
      error: (error: any) => {
        this.loadMoveOutStats();
      }
    });

    this.subscriptions.add(moveOutNoticesSub);
  }

  private loadMoveOutStats(): void {
    const moveOutStatsSub = this.propertyService.getMoveOutStats().subscribe({
      next: (stats: MoveOutStats) => {
        this.moveOutStats = stats;
        this.updateDashboardWithMoveOutData();
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.updateDashboardWithMoveOutData();
        this.isLoadingDashboard = false;
      }
    });

    this.subscriptions.add(moveOutStatsSub);
  }

  private processMoveOutDashboardData(notices: LandlordMoveOutNotice[]): void {
    const pendingNotices = notices.filter(notice => notice.status === 'PENDING').length;
    const approvedNotices = notices.filter(notice => notice.status === 'APPROVED').length;
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const upcomingMoveOuts = notices.filter(notice => {
      if (notice.status !== 'APPROVED') return false;
      const moveOutDate = new Date(notice.moveOutDate);
      return moveOutDate >= today && moveOutDate <= thirtyDaysFromNow;
    }).length;

    this.dashboardData.pendingMoveOutNotices = pendingNotices;
    this.dashboardData.approvedMoveOutNotices = approvedNotices;
    this.dashboardData.upcomingMoveOuts = upcomingMoveOuts;

    this.addMoveOutActivities(notices);
  }

  private addMoveOutActivities(notices: LandlordMoveOutNotice[]): void {
    const recentMoveOutNotices = notices
      .filter(notice => notice.status === 'PENDING')
      .slice(0, 2);

    recentMoveOutNotices.forEach(notice => {
      const tenantName = notice.tenant?.fullName || 'Tenant';
      const propertyName = notice.property?.name || 'Property';
      
      this.recentActivities.unshift({
        type: 'Move Out Request',
        message: `New move-out request from ${tenantName} - ${propertyName}`,
        time: 'Recently',
        icon: 'exit_to_app'
      });
    });

    if (this.recentActivities.length > 6) {
      this.recentActivities = this.recentActivities.slice(0, 6);
    }
  }

  private updateDashboardWithMoveOutData(): void {
    this.dashboardData.pendingMoveOutNotices = this.moveOutStats.pendingNotices;
    this.dashboardData.approvedMoveOutNotices = this.moveOutStats.approvedNotices;
    this.dashboardData.upcomingMoveOuts = this.moveOutStats.upcomingMoveOuts;
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
      ...this.dashboardData,
      totalProperties,
      occupancyRate,
      monthlyRevenue,
      rentCollectionRate,
      openMaintenance
    };
  }

  private normalizePropertiesResponse(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response?.properties && Array.isArray(response.properties)) {
      return response.properties;
    }
    if (response?.content && Array.isArray(response.content)) {
      return response.content;
    }
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  private handleDashboardError(error: any): void {
    this.isLoadingDashboard = false;
    const message = error?.message || 'Failed to load dashboard data';
    this.dashboardError = message;
    this.snackBar.open(message, 'Close', { duration: 5000 });
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
      'move-out': ['/landlord-dashboard/move-out-notices'],
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

  navigateToMoveOutNotices() {
    this.router.navigate(['/landlord-dashboard/move-out-notices']);
  }

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

  // Add method to open move-out action dialog
  openMoveOutActionDialog(notice: LandlordMoveOutNotice, action: 'approve' | 'reject'): void {
    const title = action === 'approve' 
      ? 'Approve Move Out Request' 
      : 'Reject Move Out Request';

    const dialogRef = this.dialog.open(MoveOutActionDialogComponent, {
      width: '500px',
      data: {
        title,
        action,
        notice
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Handle the action result
        this.snackBar.open(
          `Move out request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`,
          'Close',
          { duration: 3000 }
        );
        this.loadDashboardData();
      }
    });
  }

  hasPendingMoveOuts(): boolean {
    return this.dashboardData.pendingMoveOutNotices > 0;
  }

  hasUpcomingMoveOuts(): boolean {
    return this.dashboardData.upcomingMoveOuts > 0;
  }

  getMoveOutUrgency(): string {
    if (this.dashboardData.pendingMoveOutNotices > 5) return 'high';
    if (this.dashboardData.pendingMoveOutNotices > 2) return 'medium';
    return 'low';
  }

  // ADD THE MISSING METHODS THAT THE TEMPLATE IS CALLING:
  getTotalProperties(): number {
    return this.dashboardData.totalProperties;
  }

  getOccupancyRate(): number {
    return this.dashboardData.occupancyRate;
  }

  getMonthlyRevenue(): number {
    return this.dashboardData.monthlyRevenue;
  }

  getRentCollectionRate(): number {
    return this.dashboardData.rentCollectionRate;
  }

  getOpenMaintenance(): number {
    return this.dashboardData.openMaintenance;
  }

  getPendingMoveOutNotices(): number {
    return this.dashboardData.pendingMoveOutNotices;
  }

  getUpcomingMoveOuts(): number {
    return this.dashboardData.upcomingMoveOuts;
  }

  getApprovedMoveOutNotices(): number {
    return this.dashboardData.approvedMoveOutNotices;
  }
}