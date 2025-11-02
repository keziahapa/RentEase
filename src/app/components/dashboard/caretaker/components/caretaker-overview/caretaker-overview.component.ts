import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import {
  MaintenanceService,
  MaintenanceRequest as TenantMaintenanceRequest,
  MaintenanceStatus,
  CaretakerInspection,
  VacancyEvent
} from '../../../../../services/maintenance.service';

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
}

@Component({
  selector: 'app-caretaker-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule],
  templateUrl: './caretaker-overview.component.html',
  styleUrls: ['./caretaker-overview.component.scss']
})
export class CaretakerOverviewComponent implements OnInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private subscriptions = new Subscription();

  stats: Stats = {
    pendingMaintenance: 0,
    scheduledInspections: 0,
    activeDepositCases: 0,
    completedJobs: 0,
    responseRate: 92,
    tenantSatisfaction: 4.5
  };

  maintenanceRequests: MaintenanceRequestSummary[] = [];
  inspections: CaretakerInspection[] = [];
  vacancyEvents: VacancyEvent[] = [];
  loadError: string | null = null;
  isLoadingMaintenance = false;
  isLoadingInspections = false;
  isLoadingVacancy = false;
  
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
      id: 'contactTenant', 
      title: 'Contact Tenant', 
      description: 'Message tenant', 
      icon: 'message', 
      color: '#17a2b8', 
      action: () => this.contactTenant() 
    }
  ];

  ngOnInit(): void {
    this.subscribeToStreams();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    this.loadMaintenanceRequests();
    this.loadInspections();
    this.loadVacancyEvents();
    this.loadMaintenanceSummary();
  }

  private loadMaintenanceRequests(): void {
    this.isLoadingMaintenance = true;
    this.loadError = null;
    const sub = this.maintenanceService.getCaretakerMaintenanceRequests().subscribe({
      next: () => {
        this.isLoadingMaintenance = false;
      },
      error: (error) => {
        this.loadError = error?.message || 'Unable to load maintenance summary.';
        this.isLoadingMaintenance = false;
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
        this.loadError = error?.message || 'Unable to load inspections.';
        this.isLoadingInspections = false;
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
        this.loadError = error?.message || 'Unable to load vacancy status.';
        this.isLoadingVacancy = false;
      }
    });
    this.subscriptions.add(sub);
  }

  private loadMaintenanceSummary(): void {
    const sub = this.maintenanceService.getMaintenanceSummary().subscribe({
      next: (summary) => {
        this.stats.pendingMaintenance = summary.open + summary.inProgress;
        this.stats.completedJobs = summary.completed;
      },
      error: () => {
        // Ignore summary errors; fall back to derived stats
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
    console.log('Creating new maintenance request...');
  }

  scheduleInspection(): void {
    console.log('Scheduling inspection...');
  }

  processDeposit(): void {
    console.log('Processing deposit...');
  }

  contactTenant(): void {
    console.log('Contacting tenant...');
  }

  getVacancyStatusClass(status: VacancyEvent['status']): string {
    const statusMap: Record<VacancyEvent['status'], string> = {
      pending: 'status-pending',
      confirmed: 'status-completed',
      disputed: 'status-disputed'
    };
    return statusMap[status] || 'status-pending';
  }

  private mapMaintenanceRequest(request: TenantMaintenanceRequest): MaintenanceRequestSummary {
    return {
      id: request.id,
      title: request.title,
      category: request.category,
      priority: request.priority as MaintenanceRequestSummary['priority'],
      description: request.description,
      status: this.mapMaintenanceStatus(request.status),
      dateSubmitted: request.dateSubmitted,
      tenantName: request.tenantName || 'Current tenant',
      property: request.propertyName || request.location
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
}
