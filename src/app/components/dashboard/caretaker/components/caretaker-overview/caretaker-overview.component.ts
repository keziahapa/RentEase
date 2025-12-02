import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CaretakerService } from '../../../../../services/caretaker.service';
import { MaintenanceService } from '../../../../../services/maintenance.service';
import { ChatService } from '../../../../../services/chat.service';

@Component({
  selector: 'app-caretaker-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './caretaker-overview.component.html',
  styleUrls: ['./caretaker-overview.component.scss']
})
export class CaretakerOverviewComponent implements OnInit, OnDestroy {
  private caretakerService = inject(CaretakerService);
  private maintenanceService = inject(MaintenanceService);
  private chatService = inject(ChatService);
  public router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private subscriptions = new Subscription();

  stats = {
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    pendingMaintenance: 0,
    pendingMoveOutNotices: 0,
    unreadMessages: 0
  };

  maintenanceRequests: any[] = [];
  moveOutNotices: any[] = [];
  chatRooms: any[] = [];
  properties: any[] = [];
  units: any[] = [];
  
  loadError: string | null = null;
  isLoadingDashboard = true;

  quickActions = [
    { 
      id: 'newMaintenance', 
      title: 'New Maintenance', 
      description: 'Create maintenance request', 
      icon: 'build', 
      color: '#007bff', 
      action: () => this.createMaintenance() 
    },
    { 
      id: 'scheduleInspection', 
      title: 'Schedule Inspection', 
      description: 'Schedule property inspection', 
      icon: 'calendar_today', 
      color: '#28a745', 
      action: () => this.scheduleInspection() 
    },
    { 
      id: 'messages', 
      title: 'Messages', 
      description: 'Chat with landlords & tenants', 
      icon: 'message', 
      color: '#17a2b8', 
      action: () => this.navigateToChat() 
    },
    { 
      id: 'moveOutNotices', 
      title: 'Move-Out Notices', 
      description: 'Manage pending move-out notices', 
      icon: 'exit_to_app', 
      color: '#ffc107', 
      action: () => this.navigateToMoveOutNotices() 
    }
  ];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDashboardData(): void {
    this.isLoadingDashboard = true;
    this.loadError = null;

    console.log('🔄 Loading caretaker dashboard data...');

    // Get all data at once like Landlord component
    const dashboardSub = forkJoin({
      properties: this.caretakerService.getProperties().pipe(
        catchError(error => {
          console.warn('❌ Failed to load properties:', error);
          return of([]);
        })
      ),
      maintenanceRequests: this.maintenanceService.getCaretakerMaintenanceRequests().pipe(
        catchError(error => {
          console.warn('❌ Failed to load maintenance requests:', error);
          return of([]);
        })
      ),
      moveOutNotices: this.caretakerService.getPendingMoveOutNotices(1, 50).pipe(
        catchError(error => {
          console.warn('❌ Failed to load move-out notices:', error);
          return of([]);
        })
      ),
      chatRooms: this.chatService.rooms$.pipe(
        catchError(error => {
          console.warn('❌ Failed to load chat rooms:', error);
          return of([]);
        })
      ),
      allUnits: this.caretakerService.getAllUnits().pipe(
        catchError(error => {
          console.warn('❌ Failed to load all units:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: (results) => {
        console.log('🚀 CARETAKER DASHBOARD RAW DATA:', results);
        
        // Store data
        this.properties = results.properties || [];
        this.units = results.allUnits || [];
        const maintenanceRequests = results.maintenanceRequests || [];
        const moveOutNotices = results.moveOutNotices || [];
        const chatRooms = results.chatRooms || [];

        // Calculate stats from the actual data (like Landlord component)
        this.calculateDashboardStats(this.properties, this.units, maintenanceRequests, moveOutNotices, chatRooms);

        // Process data for display
        this.maintenanceRequests = this.processMaintenanceRequests(maintenanceRequests);
        this.moveOutNotices = this.processMoveOutNotices(moveOutNotices);
        this.chatRooms = chatRooms;

        console.log('🎯 FINAL CARETAKER STATS:', this.stats);
        console.log('🎯 Properties:', this.properties.length);
        console.log('🎯 Units:', this.units.length);

        this.isLoadingDashboard = false;
      },
      error: (error) => {
        console.error('❌ Error loading caretaker dashboard data:', error);
        this.loadError = error?.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        this.showSnackbar(this.loadError);
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  // SIMILAR TO LANDLORD'S calculateDashboardData
  private calculateDashboardStats(
    properties: any[], 
    units: any[],
    maintenanceRequests: any[], 
    moveOutNotices: any[], 
    chatRooms: any[]
  ): void {
    console.log('🧮 Calculating caretaker stats from data...');

    // Reset stats
    this.stats = {
      totalProperties: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      pendingMaintenance: 0,
      pendingMoveOutNotices: 0,
      unreadMessages: 0
    };

    // 1. Property Stats (like Landlord)
    this.stats.totalProperties = properties.length;

    // 2. Unit Stats (similar to Landlord's approach)
    this.stats.totalUnits = units.length;
    
    // Count occupied units (like Landlord does)
    this.stats.occupiedUnits = units.filter((unit: any) => {
      return this.isUnitOccupied(unit);
    }).length;

    this.stats.vacantUnits = Math.max(0, this.stats.totalUnits - this.stats.occupiedUnits);

    // 3. Maintenance Stats (like Landlord's approach)
    this.stats.pendingMaintenance = maintenanceRequests.filter((req: any) => {
      return this.isMaintenancePending(req);
    }).length;

    // 4. Move Out Notices Stats (like Landlord)
    this.stats.pendingMoveOutNotices = moveOutNotices.filter((notice: any) => {
      return this.isMoveOutNoticePending(notice);
    }).length;

    // 5. Chat Stats (like Landlord might do if it had chat)
    this.stats.unreadMessages = chatRooms.reduce((total: number, room: any) => {
      return total + (room.unreadCount || 0);
    }, 0);

    console.log('📈 Final Calculated Caretaker Stats:', this.stats);
  }

  private isUnitOccupied(unit: any): boolean {
    return unit.isOccupied === true || 
           unit.status === 'OCCUPIED' || 
           unit.status === 'occupied' ||
           unit.occupancyStatus === 'OCCUPIED' ||
           (unit.tenant !== null && unit.tenant !== undefined) ||
           unit.tenantId !== null ||
           unit.tenantId !== undefined;
  }

  private isMaintenancePending(request: any): boolean {
    const status = (request.status || '').toLowerCase();
    return status === 'pending' || 
           status === 'submitted' || 
           status === 'in-progress' || 
           status === 'in_progress' ||
           status === 'open' ||
           status === 'new' ||
           status === 'assigned' ||
           status === 'in_review';
  }

  private isMoveOutNoticePending(notice: any): boolean {
    const status = (notice.status || '').toLowerCase();
    return status === 'pending' || 
           status === 'submitted' || 
           status === 'under_review' ||
           status === 'review' ||
           status === 'awaiting_approval' ||
           status === 'in_progress' ||
           status === 'processing';
  }

  private processMaintenanceRequests(requests: any[]): any[] {
    return requests
      .map((req: any) => ({
        id: req.id,
        title: req.title || req.description || 'Maintenance Request',
        category: req.category || req.type || 'General',
        priority: this.mapPriority(req.priority),
        status: this.mapMaintenanceStatus(req.status),
        dateSubmitted: req.dateSubmitted || req.createdAt || req.submittedDate || new Date().toISOString(),
        tenantName: req.tenantName || req.tenant?.name || req.tenant?.fullName || 'Tenant',
        propertyName: req.propertyName || req.property?.name || 'Property',
        unitNumber: req.unitNumber || req.unit?.unitNumber || ''
      }))
      .slice(0, 5);
  }

  private processMoveOutNotices(notices: any[]): any[] {
    return notices
      .map((notice: any) => ({
        id: notice.id,
        tenantName: notice.tenantName || notice.tenant?.name || notice.tenant?.fullName || 'Tenant',
        unitNumber: notice.unitNumber || notice.unit?.unitNumber || '',
        propertyName: notice.propertyName || notice.property?.name || 'Property',
        moveOutDate: notice.moveOutDate || notice.intendedMoveOutDate || notice.expectedMoveOutDate,
        status: notice.status || 'PENDING',
        submittedDate: notice.submittedDate || notice.createdAt || new Date().toISOString()
      }))
      .slice(0, 5);
  }

  private mapPriority(priority: string): string {
    if (!priority) return 'medium';
    const priorityMap: any = {
      'LOW': 'low', 'MEDIUM': 'medium', 'HIGH': 'high', 'URGENT': 'urgent',
      'low': 'low', 'medium': 'medium', 'high': 'high', 'urgent': 'urgent'
    };
    return priorityMap[priority] || 'medium';
  }

  private mapMaintenanceStatus(status: string): string {
    if (!status) return 'submitted';
    const statusMap: any = {
      'SUBMITTED': 'submitted', 'IN_PROGRESS': 'in-progress', 'COMPLETED': 'completed', 'CANCELLED': 'cancelled',
      'PENDING': 'submitted', 'submitted': 'submitted', 'in-progress': 'in-progress', 'completed': 'completed', 'cancelled': 'cancelled',
      'NEW': 'submitted', 'OPEN': 'submitted', 'ASSIGNED': 'in-progress', 'IN_REVIEW': 'in-progress'
    };
    return statusMap[status] || 'submitted';
  }

  createMaintenance(): void {
    this.router.navigate(['/caretaker-dashboard/maintenance/new']);
  }

  scheduleInspection(): void {
    this.router.navigate(['/caretaker-dashboard/inspections/schedule']);
  }

  navigateToMaintenance(): void {
    this.router.navigate(['/caretaker-dashboard/maintenance']);
  }

  navigateToMoveOutNotices(): void {
    this.router.navigate(['/caretaker-dashboard/move-out-notices']);
  }

  navigateToChat(): void {
    this.router.navigate(['/caretaker-dashboard/chat']);
  }

  openChat(roomId: number): void {
    this.router.navigate(['/caretaker-dashboard/chat', roomId]);
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Dashboard refreshed', 'Close', { duration: 2000 });
  }

  viewMoveOutNotice(noticeId: number): void {
    this.router.navigate(['/caretaker-dashboard/move-out-notices', noticeId]);
  }

  viewMaintenanceRequest(requestId: number): void {
    this.router.navigate(['/caretaker-dashboard/maintenance', requestId]);
  }

  private showSnackbar(message: string | null): void {
    const displayMessage = message || 'An unknown error occurred';
    this.snackBar.open(displayMessage, 'Close', { duration: 5000 });
  }

  getPriorityClass(priority: string): string {
    const priorityMap: any = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  getStatusClass(status: string): string {
    const statusMap: any = {
      'submitted': 'status-pending',
      'in-progress': 'status-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
  }

  getMoveOutStatusClass(status: string): string {
    const statusMap: any = {
      'PENDING': 'status-pending',
      'APPROVED': 'status-approved',
      'REJECTED': 'status-rejected',
      'CANCELLED': 'status-cancelled',
      'COMPLETED': 'status-completed',
      'UNDER_REVIEW': 'status-progress'
    };
    return statusMap[status] || 'status-pending';
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-KE');
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  get occupancyRate(): number {
    if (this.stats.totalUnits === 0) return 0;
    return Math.round((this.stats.occupiedUnits / this.stats.totalUnits) * 100);
  }
}