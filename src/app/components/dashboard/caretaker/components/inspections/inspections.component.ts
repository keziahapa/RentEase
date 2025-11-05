import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MaintenanceService, CaretakerInspection } from '../../../../../services/maintenance.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inspections',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTableModule],
  templateUrl: './inspections.component.html',
  styleUrls: ['./inspections.component.scss']
})
export class InspectionsComponent implements OnInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private subscriptions = new Subscription();

  inspections: CaretakerInspection[] = [];
  displayedColumns: string[] = ['type', 'property', 'tenantName', 'date', 'status', 'depositAmount', 'actions'];
  isLoading = false;
  loadError: string | null = null;

  ngOnInit(): void {
    this.subscribeToInspectionStream();
    this.loadInspections();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadInspections(): void {
    this.isLoading = true;
    this.loadError = null;

    const sub = this.maintenanceService.getCaretakerInspections().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (error) => {
        this.loadError = error?.message || 'Unable to load inspections.';
        this.isLoading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  completeInspection(inspection: CaretakerInspection): void {
    const sub = this.maintenanceService.completeCaretakerInspection(inspection.id).subscribe({
      next: () => {},
      error: (error) => {
        this.loadError = error?.message || 'Failed to update inspection status.';
      }
    });

    this.subscriptions.add(sub);
  }

  private subscribeToInspectionStream(): void {
    const sub = this.maintenanceService.caretakerInspectionsChanges$.subscribe(inspections => {
      this.inspections = inspections;
    });
    this.subscriptions.add(sub);
  }

  formatCurrency(amount: number): string {
    return `KSH ${amount.toLocaleString('en-KE')}`;
  }

  getInspectionTypeClass(type: string): string {
    const typeMap: any = {
      'move-in': 'type-move-in',
      'move-out': 'type-move-out',
      'routine': 'type-routine'
    };
    return typeMap[type] || 'type-routine';
  }

  getStatusClass(status: string): string {
    const statusMap: any = {
      'scheduled': 'status-scheduled',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-scheduled';
  }
}
