import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
      id: 'processDeposit', 
      title: 'Process Deposit', 
      description: 'Handle deposit release', 
      icon: 'account_balance', 
      color: '#ffc107', 
      action: () => this.processDeposit() 
    },
    { 
      id: 'moveOutRequests', 
      title: 'Move Out Requests', 
      description: 'Manage tenant move-out notices', 
      icon: 'exit_to_app', 
      color: '#ef4444', 
      action: () => this.navigateToMoveOutNotices() 
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
        catchError(error => {
          console.warn('Failed to load properties:', error);
          return of([]);
        })
      ),
      maintenanceRequests: this.maintenanceService.getCaretakerMaintenanceRequests().pipe(
        catchError(error => {
          console.warn('Failed to load maintenance requests:', error);
          return of([]);
        })
      ),
      moveOutNotices: this.caretakerService.getPendingMoveOutNotices(1, 10).pipe(
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

  private processDashboardData(results: any): void {
    // Process properties data - REAL DATA
    this.stats.totalProperties = Array.isArray(results.properties) ? results.properties.length : 0;
    
    // Calculate occupied units from properties data
    this.stats.occupiedUnits = Array.isArray(results.properties) 
      ? results.properties.reduce((total: number, property: any) => {
          return total + (property.occupiedUnits || property.units?.length || 0);
        }, 0)
      : 0;

    // Process maintenance requests - REAL DATA
    this.maintenanceRequests = Array.isArray(results.maintenanceRequests) 
      ? results.maintenanceRequests.map((req: any) => this.mapMaintenanceRequest(req)) 
      : [];
    
    // Calculate pending maintenance from real data
    this.stats.pendingMaintenance = this.maintenanceRequests.filter(
      (req: any) => req.status === 'submitted' || req.status === 'in-progress'
    ).length;

    // Process move-out notices - REAL DATA
    this.moveOutNotices = Array.isArray(results.moveOutNotices) 
      ? results.moveOutNotices.map((notice: any) => this.mapMoveOutNotice(notice)) 
      : [];

    // Process chat rooms - REAL DATA
    this.chatRooms = Array.isArray(results.chatRooms) ? results.chatRooms : [];
    
    // Calculate unread messages from real data
    this.stats.unreadMessages = this.chatRooms.reduce(
      (total: number, room: any) => total + (room.unreadCount || 0), 0
    );
  }

  private mapMaintenanceRequest(request: any): any {
    return {
      id: request.id,
      title: request.title || 'Maintenance Request',
      category: request.category || 'General',
      priority: this.mapPriority(request.priority),
      status: this.mapMaintenanceStatus(request.status),
      dateSubmitted: request.dateSubmitted || new Date().toISOString(),
      tenantName: request.tenantName || 'Tenant',
      propertyName: request.propertyName || 'Property',
      unitNumber: request.unitNumber || ''
    };
  }

  private mapMoveOutNotice(notice: any): any {
    return {
      id: notice.id,
      tenantName: notice.tenantName || 'Tenant',
      unitNumber: notice.unitNumber || '',
      propertyName: notice.propertyName || 'Property',
      moveOutDate: notice.moveOutDate,
      status: notice.status || 'PENDING'
    };
  }

  private mapPriority(priority: string): string {
    const priorityMap: any = {
      'LOW': 'low',
      'MEDIUM': 'medium', 
      'HIGH': 'high',
      'URGENT': 'urgent'
    };
    return priorityMap[priority] || 'medium';
  }

  private mapMaintenanceStatus(status: string): string {
    const statusMap: any = {
      'SUBMITTED': 'submitted',
      'IN_PROGRESS': 'in-progress',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled'
    };
    return statusMap[status] || 'submitted';
  }

  // Quick Action Methods
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

  // Helper Methods
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