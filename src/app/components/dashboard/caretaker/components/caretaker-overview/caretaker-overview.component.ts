import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CaretakerService } from '../../../../../services/caretaker.service';
import { MaintenanceService } from '../../../../../services/maintenance.service';
import { ChatService } from '../../../../../services/chat.service';

@Component({
  selector: 'app-caretaker-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule, MatSnackBarModule],
  templateUrl: './caretaker-overview.component.html',
  styleUrls: ['./caretaker-overview.component.scss']
})
export class CaretakerOverviewComponent implements OnInit, OnDestroy {
  private caretakerService = inject(CaretakerService);
  private maintenanceService = inject(MaintenanceService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private subscriptions = new Subscription();

  stats = {
    totalProperties: 0,
    occupiedUnits: 0,
    pendingMaintenance: 0,
    unreadMessages: 0
  };

  maintenanceRequests: any[] = [];
  moveOutNotices: any[] = [];
  chatRooms: any[] = [];
  
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

    const dashboardSub = forkJoin({
      properties: this.caretakerService.getProperties().pipe(
        map(response => this.normalizePropertiesResponse(response)),
        catchError(error => {
          console.warn('Failed to load properties:', error);
          return of([]);
        })
      ),
      maintenanceRequests: this.maintenanceService.getCaretakerMaintenanceRequests().pipe(
        map(response => this.normalizeArrayResponse(response)),
        catchError(error => {
          console.warn('Failed to load maintenance requests:', error);
          return of([]);
        })
      ),
      moveOutNotices: this.caretakerService.getPendingMoveOutNotices(1, 10).pipe(
        map(response => this.normalizeArrayResponse(response)),
        catchError(error => {
          console.warn('Failed to load move-out notices:', error);
          return of([]);
        })
      ),
      chatRooms: this.chatService.rooms$.pipe(
        catchError(error => {
          console.warn('Failed to load chat rooms:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: (results) => {
        console.log('Dashboard data loaded:', results);
        this.processDashboardData(results);
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.loadError = error?.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        this.showSnackbar(this.loadError);
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  private normalizePropertiesResponse(response: any): any[] {
    if (!response) return [];
    
    if (Array.isArray(response)) {
      return response;
    }
    
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    if (response.content && Array.isArray(response.content)) {
      return response.content;
    }
    
    return [];
  }

  private normalizeArrayResponse(response: any): any[] {
    if (!response) return [];
    
    if (Array.isArray(response)) {
      return response;
    }
    
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    if (response.content && Array.isArray(response.content)) {
      return response.content;
    }
    
    if (response.success && response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  }

  private processDashboardData(results: any): void {
    const properties = results.properties || [];
    const maintenanceRequests = results.maintenanceRequests || [];
    const moveOutNotices = results.moveOutNotices || [];
    const chatRooms = results.chatRooms || [];

    this.stats.totalProperties = properties.length;

    this.stats.occupiedUnits = properties.reduce((total: number, property: any) => {
      if (property.occupiedUnits !== undefined) {
        return total + property.occupiedUnits;
      }
      
      if (property.units && Array.isArray(property.units)) {
        const occupied = property.units.filter((unit: any) => 
          unit.isOccupied === true || unit.status === 'OCCUPIED' || unit.status === 'occupied'
        ).length;
        return total + occupied;
      }
      
      return total;
    }, 0);

    this.maintenanceRequests = maintenanceRequests.map((req: any) => this.mapMaintenanceRequest(req));
    
    this.stats.pendingMaintenance = this.maintenanceRequests.filter(
      (req: any) => 
        req.status === 'submitted' || 
        req.status === 'in-progress' || 
        req.status === 'SUBMITTED' || 
        req.status === 'IN_PROGRESS' ||
        req.status === 'PENDING'
    ).length;

    this.moveOutNotices = moveOutNotices.map((notice: any) => this.mapMoveOutNotice(notice));

    this.chatRooms = chatRooms;
    
    this.stats.unreadMessages = chatRooms.reduce(
      (total: number, room: any) => total + (room.unreadCount || 0), 0
    );

    console.log('Processed stats:', this.stats);
    console.log('Properties:', properties);
    console.log('Maintenance requests:', this.maintenanceRequests);
    console.log('Chat rooms:', this.chatRooms);
  }

  private mapMaintenanceRequest(request: any): any {
    return {
      id: request.id,
      title: request.title || request.description || 'Maintenance Request',
      category: request.category || request.type || 'General',
      priority: this.mapPriority(request.priority),
      status: this.mapMaintenanceStatus(request.status),
      dateSubmitted: request.dateSubmitted || request.createdAt || request.submittedDate || new Date().toISOString(),
      tenantName: request.tenantName || request.tenant?.name || request.tenant?.fullName || 'Tenant',
      propertyName: request.propertyName || request.property?.name || 'Property',
      unitNumber: request.unitNumber || request.unit?.unitNumber || ''
    };
  }

  private mapMoveOutNotice(notice: any): any {
    return {
      id: notice.id,
      tenantName: notice.tenantName || notice.tenant?.name || notice.tenant?.fullName || 'Tenant',
      unitNumber: notice.unitNumber || notice.unit?.unitNumber || '',
      propertyName: notice.propertyName || notice.property?.name || 'Property',
      moveOutDate: notice.moveOutDate || notice.intendedMoveOutDate || notice.expectedMoveOutDate,
      status: notice.status || 'PENDING'
    };
  }

  private mapPriority(priority: string): string {
    if (!priority) return 'medium';
    
    const priorityMap: any = {
      'LOW': 'low',
      'MEDIUM': 'medium', 
      'HIGH': 'high',
      'URGENT': 'urgent',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'urgent': 'urgent'
    };
    return priorityMap[priority] || 'medium';
  }

  private mapMaintenanceStatus(status: string): string {
    if (!status) return 'submitted';
    
    const statusMap: any = {
      'SUBMITTED': 'submitted',
      'IN_PROGRESS': 'in-progress',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
      'PENDING': 'submitted',
      'submitted': 'submitted',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return statusMap[status] || 'submitted';
  }

  createMaintenance(): void {
    this.router.navigate(['/caretaker-dashboard/maintenance/new']);
  }

  scheduleInspection(): void {
    this.router.navigate(['/caretaker-dashboard/inspections/schedule']);
  }

  processDeposit(): void {
    this.router.navigate(['/caretaker-dashboard/deposits']);
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
      'COMPLETED': 'status-completed'
    };
    return statusMap[status] || 'status-pending';
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-KE');
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}