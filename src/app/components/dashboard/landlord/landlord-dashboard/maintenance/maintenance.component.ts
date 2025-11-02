import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

import {
  MaintenanceService,
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority
} from '../../../../../services/maintenance.service';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';

interface StatusFilterOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-landlord-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    SkeletonListComponent
  ],
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss']
})
export class LandlordMaintenanceComponent implements OnInit, OnDestroy {
  MaintenanceStatus = MaintenanceStatus;
  MaintenancePriority = MaintenancePriority;

  private readonly subscriptions = new Subscription();

  maintenanceRequests: MaintenanceRequest[] = [];
  filteredRequests: MaintenanceRequest[] = [];
  summary = {
    open: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  };

  isLoading = false;
  isRefreshing = false;
  errorMessage: string | null = null;

  statusControl = new FormControl<string>('all', { nonNullable: true });
  priorityControl = new FormControl<string>('all', { nonNullable: true });
  statusFilters: StatusFilterOption[] = [
    { id: 'all', label: 'All' },
    { id: MaintenanceStatus.SUBMITTED, label: 'Submitted' },
    { id: MaintenanceStatus.ACKNOWLEDGED, label: 'Acknowledged' },
    { id: MaintenanceStatus.IN_PROGRESS, label: 'In progress' },
    { id: MaintenanceStatus.PENDING_PARTS, label: 'Pending parts' },
    { id: MaintenanceStatus.SCHEDULED, label: 'Scheduled' },
    { id: MaintenanceStatus.COMPLETED, label: 'Completed' },
    { id: MaintenanceStatus.CANCELLED, label: 'Cancelled' }
  ];
  priorityFilters: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All priorities' },
    { id: MaintenancePriority.URGENT, label: 'Urgent' },
    { id: MaintenancePriority.HIGH, label: 'High' },
    { id: MaintenancePriority.MEDIUM, label: 'Medium' },
    { id: MaintenancePriority.LOW, label: 'Low' }
  ];

  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.maintenanceService.maintenanceRequestsChanges$.subscribe(requests => {
        this.maintenanceRequests = requests;
        this.applyFilters();
        this.computeSummary(requests);
      })
    );

    this.subscriptions.add(
      this.statusControl.valueChanges.subscribe(() => this.applyFilters())
    );

    this.subscriptions.add(
      this.priorityControl.valueChanges.subscribe(() => this.applyFilters())
    );

    this.loadMaintenanceRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  refresh(): void {
    this.isRefreshing = true;
    this.loadMaintenanceRequests(true);
  }

  statusLabel(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.ACKNOWLEDGED:
        return 'Acknowledged';
      case MaintenanceStatus.IN_PROGRESS:
        return 'In Progress';
      case MaintenanceStatus.PENDING_PARTS:
        return 'Pending Parts';
      case MaintenanceStatus.SCHEDULED:
        return 'Scheduled';
      case MaintenanceStatus.COMPLETED:
        return 'Completed';
      case MaintenanceStatus.CANCELLED:
        return 'Cancelled';
      case MaintenanceStatus.REJECTED:
        return 'Rejected';
      case MaintenanceStatus.SUBMITTED:
      default:
        return 'Submitted';
    }
  }

  statusClass(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.COMPLETED:
        return 'status-completed';
      case MaintenanceStatus.IN_PROGRESS:
      case MaintenanceStatus.SCHEDULED:
        return 'status-in-progress';
      case MaintenanceStatus.PENDING_PARTS:
      case MaintenanceStatus.ACKNOWLEDGED:
        return 'status-pending';
      case MaintenanceStatus.CANCELLED:
      case MaintenanceStatus.REJECTED:
        return 'status-cancelled';
      default:
        return 'status-open';
    }
  }

  priorityLabel(priority: MaintenancePriority): string {
    switch (priority) {
      case MaintenancePriority.URGENT:
        return 'Urgent';
      case MaintenancePriority.HIGH:
        return 'High';
      case MaintenancePriority.MEDIUM:
        return 'Medium';
      default:
        return 'Low';
    }
  }

  trackByRequestId(_index: number, request: MaintenanceRequest): string {
    return request.id;
  }

  private loadMaintenanceRequests(force = false): void {
    if (this.isLoading && !force) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.maintenanceService.getLandlordMaintenanceRequests().subscribe({
      next: requests => {
        this.isLoading = false;
        this.isRefreshing = false;
        this.maintenanceRequests = requests;
        this.computeSummary(requests);
        this.applyFilters();
      },
      error: error => {
        this.isLoading = false;
        this.isRefreshing = false;
        this.errorMessage = error?.message || 'Unable to load maintenance requests right now.';
        const message = this.errorMessage ?? 'Unable to load maintenance requests right now.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });
  }

  private applyFilters(): void {
    const statusFilter = this.statusControl.value;
    const priorityFilter = this.priorityControl.value;

    this.filteredRequests = this.maintenanceRequests.filter(request => {
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }

  private computeSummary(requests: MaintenanceRequest[]): void {
    const summary = {
      open: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0
    };

    requests.forEach(request => {
      if (
        request.status === MaintenanceStatus.SUBMITTED ||
        request.status === MaintenanceStatus.ACKNOWLEDGED ||
        request.status === MaintenanceStatus.PENDING_PARTS ||
        request.status === MaintenanceStatus.SCHEDULED
      ) {
        summary.open += 1;
      }
      if (request.status === MaintenanceStatus.IN_PROGRESS) {
        summary.inProgress += 1;
      }
      if (request.status === MaintenanceStatus.COMPLETED) {
        summary.completed += 1;
      }
      if ((request.priority === MaintenancePriority.URGENT || request.priority === MaintenancePriority.HIGH) && request.status !== MaintenanceStatus.COMPLETED) {
        summary.overdue += 1;
      }
    });

    this.summary = summary;
  }
}
