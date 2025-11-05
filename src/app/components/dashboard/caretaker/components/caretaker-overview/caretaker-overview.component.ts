import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  MaintenanceService,
  MaintenanceRequest as TenantMaintenanceRequest,
  MaintenanceStatus,
  CaretakerInspection,
  VacancyEvent
} from '../../../../../services/maintenance.service';
import { CaretakerService } from '../../../../../services/caretaker.service';

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
}

export interface Stats {
  pendingMaintenance: number;
  scheduledInspections: number;
  activeDepositCases: number;
  completedJobs: number;
  responseRate: number;
  tenantSatisfaction: number;
  totalProperties: number;
  occupiedUnits: number;
  pendingMoveOuts: number;
  movedOutThisMonth: number;
}

export interface MaintenanceRequestSummary {
  id: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  status: 'submitted' | 'in-progress' | 'completed' | 'cancelled';
  dateSubmitted: string;
  tenantName: string;
  property: string;
  unitNumber: string;
}

export interface MoveOutNoticeSummary {
  id: number;
  tenantName: string;
  unitNumber: string;
  propertyName: string;
  moveOutDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  depositStatus: string;
}

@Component({
  selector: 'app-caretaker-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule, MatSnackBarModule],
  templateUrl: './caretaker-overview.component.html',
  styleUrls: ['./caretaker-overview.component.scss']
})
export class CaretakerOverviewComponent implements OnInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private caretakerService = inject(CaretakerService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private subscriptions = new Subscription();

  stats: Stats = {
    pendingMaintenance: 0,
    scheduledInspections: 0,
    activeDepositCases: 0,
    completedJobs: 0,
    responseRate: 92,
    tenantSatisfaction: 4.5,
    totalProperties: 0,
    occupiedUnits: 0,
    pendingMoveOuts: 0,
    movedOutThisMonth: 0
  };

  maintenanceRequests: MaintenanceRequestSummary[] = [];
  moveOutNotices: MoveOutNoticeSummary[] = [];
  inspections: CaretakerInspection[] = [];
  vacancyEvents: VacancyEvent[] = [];
  loadError: string | null = null;
  isLoadingDashboard = true;
  isLoadingMaintenance = false;
  isLoadingInspections = false;
  isLoadingVacancy = false;
  isLoadingMoveOuts = false;
  
  quickActions: QuickAction[] = [
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
    this.subscribeToStreams();
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
      moveOutStats: this.caretakerService.getMoveOutStats().pipe(
        catchError(error => {
          console.warn('Failed to load move-out stats:', error);
          return of({});
        })
      ),
      pendingMoveOuts: this.caretakerService.getPendingMoveOutNotices(1, 5).pipe(
        catchError(error => {
          console.warn('Failed to load pending move-outs:', error);
          return of([]);
        })
      ),
      maintenanceSummary: this.maintenanceService.getMaintenanceSummary().pipe(
        catchError(error => {
          console.warn('Failed to load maintenance summary:', error);
          return of({ open: 0, inProgress: 0, completed: 0 });
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
    // Process properties data
    if (Array.isArray(results.properties)) {
      this.stats.totalProperties = results.properties.length;
      this.stats.occupiedUnits = results.properties.reduce((total: number, property: any) => {
        return total + (property.occupiedUnits || 0);
      }, 0);
    }

    // Process move-out data
    if (results.moveOutStats) {
      this.stats.pendingMoveOuts = results.moveOutStats.pendingNotices || 0;
      this.stats.movedOutThisMonth = results.moveOutStats.movedOutThisMonth || 0;
    }

    // Process maintenance data
    if (results.maintenanceSummary) {
      this.stats.pendingMaintenance = (results.maintenanceSummary.open || 0) + (results.maintenanceSummary.inProgress || 0);
      this.stats.completedJobs = results.maintenanceSummary.completed || 0;
    }

    // Process pending move-out notices
    if (Array.isArray(results.pendingMoveOuts)) {
      this.moveOutNotices = results.pendingMoveOuts.map((notice: any) => this.mapMoveOutNotice(notice));
    }
  }

  loadData(): void {
    this.loadMaintenanceRequests();
    this.loadInspections();
    this.loadVacancyEvents();
    this.loadMoveOutNotices();
  }

  private loadMaintenanceRequests(): void {
    this.isLoadingMaintenance = true;
    this.loadError = null;
    const sub = this.maintenanceService.getCaretakerMaintenanceRequests().subscribe({
      next: () => {
        this.isLoadingMaintenance = false;
      },
      error: (error) => {
        const errorMessage = error?.message || 'Unable to load maintenance summary.';
        this.loadError = errorMessage;
        this.isLoadingMaintenance = false;
        this.showSnackbar(errorMessage);
      }
    });
    this.subscriptions.add(sub);
  }

  private loadInspections(): void {
    this.isLoadingInspections = true;
    this.loadError = null;
    const sub = this.maintenanceService.getCaretakerInspections().subscribe({
      next: () => {
        this.isLoadingInspections = false;
      },
      error: (error) => {
        const errorMessage = error?.message || 'Unable to load inspections.';
        this.loadError = errorMessage;
        this.isLoadingInspections = false;
        this.showSnackbar(errorMessage);
      }
    });
    this.subscriptions.add(sub);
  }

  private loadVacancyEvents(): void {
    this.isLoadingVacancy = true;
    this.loadError = null;
    const sub = this.maintenanceService.getVacancyEvents().subscribe({
      next: () => {
        this.isLoadingVacancy = false;
      },
      error: (error) => {
        const errorMessage = error?.message || 'Unable to load vacancy status.';
        this.loadError = errorMessage;
        this.isLoadingVacancy = false;
        this.showSnackbar(errorMessage);
      }
    });
    this.subscriptions.add(sub);
  }

  private loadMoveOutNotices(): void {
    this.isLoadingMoveOuts = true;
    const sub = this.caretakerService.getPendingMoveOutNotices(1, 5).subscribe({
      next: (notices) => {
        this.moveOutNotices = Array.isArray(notices) ? notices.map(notice => this.mapMoveOutNotice(notice)) : [];
        this.isLoadingMoveOuts = false;
      },
      error: (error) => {
        console.error('Error loading move-out notices:', error);
        this.moveOutNotices = [];
        this.isLoadingMoveOuts = false;
      }
    });
    this.subscriptions.add(sub);
  }

  private refreshDerivedStats(): void {
    this.stats.scheduledInspections = this.inspections.filter(i => i.status === 'scheduled').length;
    this.stats.activeDepositCases = this.vacancyEvents.filter(event => event.status !== 'confirmed').length;
  }

  private subscribeToStreams(): void {
    const maintenanceSub = this.maintenanceService.maintenanceRequestsChanges$.subscribe(requests => {
      this.maintenanceRequests = requests.map(req => this.mapMaintenanceRequest(req));
      this.stats.pendingMaintenance = this.maintenanceRequests.filter(r => r.status === 'submitted' || r.status === 'in-progress').length;
      this.stats.completedJobs = this.maintenanceRequests.filter(r => r.status === 'completed').length;
      this.refreshDerivedStats();
    });

    const inspectionsSub = this.maintenanceService.caretakerInspectionsChanges$.subscribe(inspections => {
      this.inspections = inspections;
      this.refreshDerivedStats();
    });

    const vacancySub = this.maintenanceService.vacancyEventsChanges$.subscribe(events => {
      this.vacancyEvents = events;
      this.refreshDerivedStats();
    });

    this.subscriptions.add(maintenanceSub);
    this.subscriptions.add(inspectionsSub);
    this.subscriptions.add(vacancySub);
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

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Dashboard refreshed', 'Close', { duration: 2000 });
  }

  viewMoveOutNotice(noticeId: number): void {
    this.router.navigate(['/caretaker-dashboard/move-out-notices', noticeId]);
  }

  approveMoveOutNotice(noticeId: number): void {
    this.caretakerService.approveMoveOutNotice(noticeId).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Move-out request approved', 'Close', { duration: 3000 });
          this.loadMoveOutNotices();
          this.loadDashboardData();
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to approve move-out request', 'Close', { duration: 3000 });
      }
    });
  }

  // FIXED: Handle string | null properly
  private showSnackbar(message: string | null): void {
    const displayMessage = message || 'An unknown error occurred';
    this.snackBar.open(displayMessage, 'Close', { duration: 5000 });
  }

  getVacancyStatusClass(status: VacancyEvent['status']): string {
    const statusMap: Record<VacancyEvent['status'], string> = {
      pending: 'status-pending',
      confirmed: 'status-completed',
      disputed: 'status-disputed'
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

  getDepositStatusClass(status: string): string {
    const statusMap: any = {
      'PENDING': 'deposit-pending',
      'PROCESSING': 'deposit-processing',
      'REFUNDED': 'deposit-refunded',
      'DEDUCTED': 'deposit-deducted'
    };
    return statusMap[status] || 'deposit-pending';
  }

  private mapMaintenanceRequest(request: TenantMaintenanceRequest): MaintenanceRequestSummary {
    // Use type assertion to access unitNumber safely
    const maintenanceRequest = request as any;
    return {
      id: request.id,
      title: request.title,
      category: request.category,
      priority: request.priority as MaintenanceRequestSummary['priority'],
      description: request.description,
      status: this.mapMaintenanceStatus(request.status),
      dateSubmitted: request.dateSubmitted,
      tenantName: request.tenantName || 'Current tenant',
      property: request.propertyName || request.location,
      unitNumber: maintenanceRequest.unitNumber || maintenanceRequest.unit || ''
    };
  }

  private mapMoveOutNotice(notice: any): MoveOutNoticeSummary {
    return {
      id: notice.id,
      tenantName: notice.tenantName || 'Tenant',
      unitNumber: notice.unitNumber || '',
      propertyName: notice.propertyName || 'Property',
      moveOutDate: notice.moveOutDate,
      status: notice.status,
      depositStatus: notice.depositStatus || 'PENDING'
    };
  }

  private mapMaintenanceStatus(status: MaintenanceStatus): MaintenanceRequestSummary['status'] {
    switch (status) {
      case MaintenanceStatus.SUBMITTED:
      case MaintenanceStatus.ACKNOWLEDGED:
        return 'submitted';
      case MaintenanceStatus.IN_PROGRESS:
      case MaintenanceStatus.SCHEDULED:
      case MaintenanceStatus.PENDING_PARTS:
        return 'in-progress';
      case MaintenanceStatus.COMPLETED:
        return 'completed';
      case MaintenanceStatus.CANCELLED:
      case MaintenanceStatus.REJECTED:
        return 'cancelled';
      default:
        return 'submitted';
    }
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
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

  getInspectionTypeClass(type: string): string {
    const typeMap: any = {
      'move-in': 'type-move-in',
      'move-out': 'type-move-out',
      'routine': 'type-routine'
    };
    return typeMap[type] || 'type-routine';
  }

  hasPendingMoveOuts(): boolean {
    return this.stats.pendingMoveOuts > 0;
  }

  hasPendingMaintenance(): boolean {
    return this.stats.pendingMaintenance > 0;
  }

  getPendingItemsCount(): number {
    return this.stats.pendingMaintenance + this.stats.pendingMoveOuts;
  }
}