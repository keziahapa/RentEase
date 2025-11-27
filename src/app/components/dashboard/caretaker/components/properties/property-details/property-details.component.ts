import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { CaretakerService } from '../../../../../../services/caretaker.service';
import { Property, Unit, } from '../../../../../../services/caretaker-interfaces';

@Component({
  selector: 'app-property-details',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule
  ],
  templateUrl: './property-details.component.html',
  styleUrls: ['./property-details.component.scss']
})
export class PropertyDetailsComponent implements OnInit {
  property!: Property;
  loading = true;
  error = '';

  // Safe computed properties with type checking
  get totalUnits(): number {
    if (!this.property?.units) return 0;
    return Array.isArray(this.property.units) ? this.property.units.length : this.property.units;
  }

  get unitsArray(): Unit[] {
    if (!this.property?.units) return [];
    return Array.isArray(this.property.units) ? this.property.units : [];
  }

  get maintenanceRequestsArray(): any[] {
    if (!this.property?.maintenanceRequests) return [];
    return Array.isArray(this.property.maintenanceRequests) ? this.property.maintenanceRequests : [];
  }

  get occupancyRate(): number {
    return this.getOccupancyRate();
  }

  get vacantUnits(): number {
    return this.getAvailableUnits();
  }

  get occupiedUnits(): number {
    const units = this.unitsArray;
    return units.filter((unit: Unit) => unit.isOccupied).length;
  }

  get maintenanceRequestsCount(): number {
    const requests = this.maintenanceRequestsArray;
    return requests.length;
  }

  get pendingMaintenanceCount(): number {
    const requests = this.maintenanceRequestsArray;
    return requests.filter((req: any) => 
      req.status === 'PENDING' || 
      req.status === 'SUBMITTED' || 
      req.status === 'IN_PROGRESS'
    ).length;
  }

  constructor(
    private caretakerService: CaretakerService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPropertyDetails();
  }

  loadPropertyDetails(): void {
    const propertyId = Number(this.route.snapshot.paramMap.get('id'));
    
    if (isNaN(propertyId)) {
      this.error = 'Invalid property ID';
      this.loading = false;
      return;
    }

    this.caretakerService.getPropertyDetails(propertyId).subscribe({
      next: (property: Property) => {
        this.property = property;
        console.log('Property details loaded:', property);
        console.log('Units type:', typeof property.units);
        console.log('Units value:', property.units);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load property details';
        this.loading = false;
        console.error('Error loading property details:', error);
      }
    });
  }

  getOccupancyRate(): number {
    const units = this.unitsArray;
    if (units.length === 0) {
      return 0;
    }
    
    const occupiedUnits = units.filter((unit: Unit) => unit.isOccupied).length;
    return Math.round((occupiedUnits / units.length) * 100);
  }

  getAvailableUnits(): number {
    const units = this.unitsArray;
    return units.filter((unit: Unit) => !unit.isOccupied).length;
  }

  getPropertyImage(): string {
    return this.property?.imageUrl || '/assets/images/property-placeholder.jpg';
  }

  getFullAddress(): string {
    if (!this.property) return '';
    return `${this.property.address}, ${this.property.city}, ${this.property.state} ${this.property.zipCode}`;
  }

  getUnitStatus(unit: Unit): string {
    return unit.isOccupied ? 'Occupied' : 'Vacant';
  }

  getUnitStatusClass(unit: Unit): string {
    return unit.isOccupied ? 'status-occupied' : 'status-vacant';
  }

  getMaintenancePriorityClass(priority: string): string {
    const priorityMap: any = {
      'LOW': 'priority-low',
      'MEDIUM': 'priority-medium',
      'HIGH': 'priority-high',
      'URGENT': 'priority-urgent',
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityMap[priority] || 'priority-medium';
  }

  getMaintenanceStatusClass(status: string): string {
    const statusMap: any = {
      'PENDING': 'status-pending',
      'SUBMITTED': 'status-submitted',
      'IN_PROGRESS': 'status-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled',
      'pending': 'status-pending',
      'submitted': 'status-submitted',
      'in-progress': 'status-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  formatCurrency(amount: number): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Navigation methods
  manageUnits(): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units'], {
      queryParams: { manage: 'true' }
    });
  }

  viewUnits(): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units']);
  }

  viewUnitDetails(unitId: number): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units', unitId]);
  }

  viewMaintenanceRequest(requestId: number): void {
    this.router.navigate(['/caretaker-dashboard/maintenance', requestId]);
  }

  createMaintenanceRequest(): void {
    this.router.navigate(['/caretaker-dashboard/maintenance/new'], {
      queryParams: { propertyId: this.property.id }
    });
  }

  goBack(): void {
    this.router.navigate(['/caretaker-dashboard/properties']);
  }

  refreshProperty(): void {
    this.loading = true;
    this.error = '';
    this.loadPropertyDetails();
  }

  // Check if we have units data to display
  hasUnitsData(): boolean {
    return this.unitsArray.length > 0;
  }

  // Check if we have maintenance data to display
  hasMaintenanceData(): boolean {
    return this.maintenanceRequestsArray.length > 0;
  }
}