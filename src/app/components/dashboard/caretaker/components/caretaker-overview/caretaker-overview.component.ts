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
import { catchError, map } from 'rxjs/operators';
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

    console.log('🔄 Loading dashboard data...');

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
      )
    }).subscribe({
      next: (results) => {
        console.log('🚀 DASHBOARD RAW DATA:', results);
        
        this.properties = results.properties || [];
        const maintenanceRequests = results.maintenanceRequests || [];
        const moveOutNotices = results.moveOutNotices || [];
        const chatRooms = results.chatRooms || [];

        console.log('📊 Raw Properties:', this.properties);
        console.log('🔧 Raw Maintenance Requests:', maintenanceRequests);
        console.log('🚪 Raw Move Out Notices:', moveOutNotices);
        console.log('💬 Raw Chat Rooms:', chatRooms);

        // Calculate stats from the actual data
        this.calculateStatsFromData(this.properties, maintenanceRequests, moveOutNotices, chatRooms);

        // Process data for display
        this.maintenanceRequests = maintenanceRequests
          .map((req: any) => this.mapMaintenanceRequest(req))
          .slice(0, 5);
        
        this.moveOutNotices = moveOutNotices
          .map((notice: any) => this.mapMoveOutNotice(notice))
          .slice(0, 5);
        
        this.chatRooms = chatRooms;

        console.log('🎯 FINAL STATS:', this.stats);
        console.log('🎯 Display Maintenance Requests:', this.maintenanceRequests.length);
        console.log('🎯 Display Move Out Notices:', this.moveOutNotices.length);

        this.isLoadingDashboard = false;
      },
      error: (error) => {
        console.error('❌ Error loading dashboard data:', error);
        this.loadError = error?.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        this.showSnackbar(this.loadError);
      }
    });

    this.subscriptions.add(dashboardSub);
  }

  private calculateStatsFromData(
    properties: any[], 
    maintenanceRequests: any[], 
    moveOutNotices: any[], 
    chatRooms: any[]
  ): void {
    console.log('🧮 Calculating stats from data...');

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

    // 1. Property Stats
    this.stats.totalProperties = properties.length;
    
    let totalUnits = 0;
    let occupiedUnits = 0;

    // Load units for each property to get accurate counts
    if (properties.length > 0) {
      const unitRequests = properties.map(property => 
        this.caretakerService.getPropertyUnits(property.id).pipe(
          catchError(error => {
            console.warn(`❌ Failed to load units for property ${property.id}:`, error);
            return of([]);
          })
        )
      );

      forkJoin(unitRequests).subscribe({
        next: (allUnits) => {
          allUnits.forEach((units: any[], propertyIndex) => {
            const property = properties[propertyIndex];
            console.log(`🏠 Property ${propertyIndex + 1} (${property.name}):`, property);
            console.log(`   Units for property:`, units);

            // Count from actual units array
            const propertyUnits = units.length;
            totalUnits += propertyUnits;
            
            const propertyOccupied = units.filter((unit: any) => {
              const isOccupied = unit.isOccupied === true || 
                                unit.status === 'OCCUPIED' || 
                                unit.status === 'occupied' ||
                                unit.occupancyStatus === 'OCCUPIED' ||
                                (unit.tenant !== null && unit.tenant !== undefined) ||
                                unit.tenantId !== null;
              console.log(`   Unit ${unit.unitNumber}: isOccupied=${isOccupied}`, unit);
              return isOccupied;
            }).length;
            
            occupiedUnits += propertyOccupied;
            console.log(`   From units array - Total: ${propertyUnits}, Occupied: ${propertyOccupied}`);
          });

          // Update stats after all units are loaded
          this.stats.totalUnits = totalUnits;
          this.stats.occupiedUnits = occupiedUnits;
          this.stats.vacantUnits = Math.max(0, totalUnits - occupiedUnits);

          // Calculate other stats
          this.calculateOtherStats(maintenanceRequests, moveOutNotices, chatRooms);
        },
        error: (error) => {
          console.error('❌ Error loading units:', error);
          // Fallback to basic property data if units fail to load
          this.fallbackToPropertyData(properties, maintenanceRequests, moveOutNotices, chatRooms);
        }
      });
    } else {
      // No properties, just calculate other stats
      this.calculateOtherStats(maintenanceRequests, moveOutNotices, chatRooms);
    }
  }

  private fallbackToPropertyData(
    properties: any[], 
    maintenanceRequests: any[], 
    moveOutNotices: any[], 
    chatRooms: any[]
  ): void {
    console.log('🔄 Falling back to property data for unit counts...');

    let totalUnits = 0;
    let occupiedUnits = 0;

    properties.forEach((property: any, index: number) => {
      console.log(`🏠 Property ${index + 1}:`, property);
      
      // Try different possible field names for unit counts
      const possibleTotalUnitFields = ['totalUnits', 'unitsCount', 'numberOfUnits', 'unitCount'];
      const possibleOccupiedUnitFields = ['occupiedUnits', 'occupiedUnitsCount', 'occupiedCount'];

      let propertyTotalUnits = 0;
      let propertyOccupiedUnits = 0;

      // Find total units
      for (const field of possibleTotalUnitFields) {
        if (property[field] !== undefined && property[field] !== null) {
          propertyTotalUnits = Number(property[field]);
          console.log(`   Using ${field} for total: ${propertyTotalUnits}`);
          break;
        }
      }

      // Find occupied units
      for (const field of possibleOccupiedUnitFields) {
        if (property[field] !== undefined && property[field] !== null) {
          propertyOccupiedUnits = Number(property[field]);
          console.log(`   Using ${field} for occupied: ${propertyOccupiedUnits}`);
          break;
        }
      }

      // If no specific fields found, check for units array
      if (propertyTotalUnits === 0 && property.units && Array.isArray(property.units)) {
        propertyTotalUnits = property.units.length;
        propertyOccupiedUnits = property.units.filter((unit: any) => 
          unit.isOccupied === true || 
          unit.status === 'OCCUPIED' || 
          unit.occupancyStatus === 'OCCUPIED' ||
          unit.tenant !== null
        ).length;
        console.log(`   From units array - Total: ${propertyTotalUnits}, Occupied: ${propertyOccupiedUnits}`);
      }

      totalUnits += propertyTotalUnits;
      occupiedUnits += propertyOccupiedUnits;
    });

    this.stats.totalUnits = totalUnits;
    this.stats.occupiedUnits = occupiedUnits;
    this.stats.vacantUnits = Math.max(0, totalUnits - occupiedUnits);

    this.calculateOtherStats(maintenanceRequests, moveOutNotices, chatRooms);
  }

  private calculateOtherStats(
    maintenanceRequests: any[], 
    moveOutNotices: any[], 
    chatRooms: any[]
  ): void {
    // 2. Maintenance Stats
    this.stats.pendingMaintenance = maintenanceRequests.filter((req: any) => {
      const status = (req.status || '').toLowerCase();
      return status === 'pending' || 
             status === 'submitted' || 
             status === 'in-progress' || 
             status === 'in_progress' ||
             status === 'open' ||
             status === 'new';
    }).length;

    console.log('🔧 Maintenance requests analysis:', {
      total: maintenanceRequests.length,
      pending: this.stats.pendingMaintenance,
      requests: maintenanceRequests.map(r => ({ id: r.id, status: r.status }))
    });

    // 3. Move Out Notices Stats
    this.stats.pendingMoveOutNotices = moveOutNotices.filter((notice: any) => {
      const status = (notice.status || '').toLowerCase();
      return status === 'pending' || 
             status === 'submitted' || 
             status === 'under_review' ||
             status === 'review' ||
             status === 'awaiting_approval';
    }).length;

    console.log('🚪 Move out notices analysis:', {
      total: moveOutNotices.length,
      pending: this.stats.pendingMoveOutNotices,
      notices: moveOutNotices.map(n => ({ id: n.id, status: n.status }))
    });

    // 4. Chat Stats
    this.stats.unreadMessages = chatRooms.reduce((total: number, room: any) => {
      return total + (room.unreadCount || 0);
    }, 0);

    console.log('📈 Final Calculated Stats:', this.stats);
  }

  private mapMaintenanceRequest(request: any): any {
    const mapped = {
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
    
    console.log('🔧 Mapped Maintenance Request:', mapped);
    return mapped;
  }

  private mapMoveOutNotice(notice: any): any {
    const mapped = {
      id: notice.id,
      tenantName: notice.tenantName || notice.tenant?.name || notice.tenant?.fullName || 'Tenant',
      unitNumber: notice.unitNumber || notice.unit?.unitNumber || '',
      propertyName: notice.propertyName || notice.property?.name || 'Property',
      moveOutDate: notice.moveOutDate || notice.intendedMoveOutDate || notice.expectedMoveOutDate,
      status: notice.status || 'PENDING',
      submittedDate: notice.submittedDate || notice.createdAt || new Date().toISOString()
    };
    
    console.log('🚪 Mapped Move Out Notice:', mapped);
    return mapped;
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
      'NEW': 'submitted', 'OPEN': 'submitted'
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