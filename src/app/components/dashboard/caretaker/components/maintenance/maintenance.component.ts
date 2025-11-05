import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';
import { Subscription } from 'rxjs';
import {
  MaintenanceService,
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceImage,
  MaintenanceUpdate,
  CaretakerMaintenanceUpdatePayload,
  UrgencyLevel
} from '../../../../../services/maintenance.service';

interface CaretakerMaintenanceRow {
  id: string;
  title: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  urgencyLevel: UrgencyLevel;
  tenantName: string;
  property: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  location?: string;
  images: MaintenanceImage[];
  updates: MaintenanceUpdate[];
  assignedTo?: MaintenanceRequest['assignedTo'];
  scheduledDate?: string;
  estimatedCost?: number;
  actualCost?: number;
}

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTableModule, SkeletonListComponent],
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss']
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private subscriptions = new Subscription();

  maintenanceRequests: CaretakerMaintenanceRow[] = [];
  selectedRequest: CaretakerMaintenanceRow | null = null;
  MaintenanceStatus = MaintenanceStatus;
  isUpdatingRequest = false;
  actionError: string | null = null;
  updateMessages: Record<string, string> = {};
  scheduleDates: Record<string, string> = {};
  displayedColumns: string[] = ['title', 'category', 'priority', 'status', 'tenantName', 'property', 'actions'];

  stats = {
    pendingMaintenance: 0,
    total: 0
  };

  isLoading = false;
  loadError: string | null = null;

  ngOnInit(): void {
    this.subscribeToMaintenanceStream();
    this.loadMaintenanceRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadMaintenanceRequests(): void {
    this.isLoading = true;
    this.loadError = null;
    const sub = this.maintenanceService.getCaretakerMaintenanceRequests().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (error) => {
        this.loadError = error?.message || 'Unable to load caretaker maintenance.';
        this.isLoading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  updateStats(): void {
    this.stats.pendingMaintenance = this.maintenanceRequests.filter(request =>
      request.status === MaintenanceStatus.SUBMITTED || request.status === MaintenanceStatus.IN_PROGRESS
    ).length;
    this.stats.total = this.maintenanceRequests.length;
  }

  acknowledgeRequest(request: CaretakerMaintenanceRow): void {
    this.submitMaintenanceUpdate(request, { status: MaintenanceStatus.ACKNOWLEDGED });
  }

  startRequest(request: CaretakerMaintenanceRow): void {
    this.submitMaintenanceUpdate(request, { status: MaintenanceStatus.IN_PROGRESS });
  }

  scheduleMaintenance(request: CaretakerMaintenanceRow): void {
    const scheduledDate = this.scheduleDates[request.id]?.trim();

    if (!scheduledDate) {
      this.actionError = 'Select a visit date and time before scheduling.';
      return;
    }

    this.submitMaintenanceUpdate(request, {
      status: MaintenanceStatus.SCHEDULED,
      scheduledDate
    });
  }

  completeRequest(request: CaretakerMaintenanceRow): void {
    this.submitMaintenanceUpdate(request, { status: MaintenanceStatus.COMPLETED });
  }

  getPriorityClass(priority: MaintenancePriority): string {
    const priorityMap: Record<MaintenancePriority, string> = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      urgent: 'priority-urgent'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  getStatusClass(status: MaintenanceStatus): string {
    const statusMap: Record<MaintenanceStatus | string, string> = {
      submitted: 'status-pending',
      acknowledged: 'status-pending',
      in_progress: 'status-progress',
      pending_parts: 'status-progress',
      scheduled: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      rejected: 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
  }

  formatStatus(status: MaintenanceStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  private subscribeToMaintenanceStream(): void {
    const sub = this.maintenanceService.maintenanceRequestsChanges$.subscribe((requests: MaintenanceRequest[]) => {
      const mapped = requests.map(request => this.mapMaintenanceRequest(request));
      this.maintenanceRequests = mapped;
      if (this.selectedRequest) {
        this.selectedRequest = mapped.find(item => item.id === this.selectedRequest!.id) ?? null;
        if (this.selectedRequest) {
          this.scheduleDates[this.selectedRequest.id] ??= this.selectedRequest.scheduledDate ?? '';
        }
      }
      this.updateStats();
    });

    this.subscriptions.add(sub);
  }

  private mapMaintenanceRequest(request: MaintenanceRequest): CaretakerMaintenanceRow {
    return {
      id: request.id,
      title: request.title,
      category: request.category,
      priority: request.priority,
      status: request.status,
      tenantName: request.tenantName || 'Current tenant',
      property: request.propertyName || request.location,
      description: request.description,
      createdAt: request.dateSubmitted,
      updatedAt: request.updates?.at(-1)?.updatedAt,
      location: request.location,
      images: request.images || [],
      updates: request.updates || [],
      assignedTo: request.assignedTo,
      scheduledDate: request.scheduledDate,
      urgencyLevel: request.urgencyLevel,
      estimatedCost: request.estimatedCost,
      actualCost: request.actualCost
    };
  }

  canAcknowledge(request: CaretakerMaintenanceRow): boolean {
    return request.status === MaintenanceStatus.SUBMITTED;
  }

  canStart(request: CaretakerMaintenanceRow): boolean {
    return (
      request.status === MaintenanceStatus.SUBMITTED ||
      request.status === MaintenanceStatus.ACKNOWLEDGED ||
      request.status === MaintenanceStatus.SCHEDULED ||
      request.status === MaintenanceStatus.PENDING_PARTS
    );
  }

  canSchedule(request: CaretakerMaintenanceRow): boolean {
    return (
      request.status === MaintenanceStatus.SUBMITTED ||
      request.status === MaintenanceStatus.ACKNOWLEDGED ||
      request.status === MaintenanceStatus.IN_PROGRESS
    );
  }

  canComplete(request: CaretakerMaintenanceRow): boolean {
    return (
      request.status === MaintenanceStatus.IN_PROGRESS ||
      request.status === MaintenanceStatus.SCHEDULED ||
      request.status === MaintenanceStatus.PENDING_PARTS
    );
  }

  selectRequest(request: CaretakerMaintenanceRow): void {
    this.selectedRequest = request;
    this.actionError = null;
    this.scheduleDates[request.id] ??= request.scheduledDate ?? '';
  }

  closeDetails(): void {
    this.selectedRequest = null;
    this.actionError = null;
  }

  viewAttachment(image: MaintenanceImage): void {
    if (image.url) {
      window.open(image.url, '_blank');
    }
  }

  trackByImageId(index: number, image: MaintenanceImage): string {
    return image.id;
  }

  trackByUpdateId(index: number, update: MaintenanceUpdate): string {
    return update.id;
  }

  private submitMaintenanceUpdate(
    request: CaretakerMaintenanceRow,
    update: CaretakerMaintenanceUpdatePayload
  ): void {
    if (!request) {
      return;
    }

    const payload: CaretakerMaintenanceUpdatePayload = { ...update };
    const message = this.updateMessages[request.id]?.trim();
    if (message) {
      payload.message = message;
    }

    this.isUpdatingRequest = true;
    this.actionError = null;

    const sub = this.maintenanceService
      .updateCaretakerMaintenanceRequest(request.id, payload)
      .subscribe({
        next: () => {
          this.isUpdatingRequest = false;
          if (message) {
            this.updateMessages[request.id] = '';
          }
        },
        error: (error) => {
          this.isUpdatingRequest = false;
          this.actionError = error?.message || 'Failed to update maintenance request.';
        }
      });

    this.subscriptions.add(sub);
  }
}
