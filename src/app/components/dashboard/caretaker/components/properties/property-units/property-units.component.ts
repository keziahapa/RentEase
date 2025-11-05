import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { CaretakerService } from '../../../../../../services/caretaker.service';
import { Property, Unit } from '../../../../../../services/caretaker-interfaces';

@Component({
  selector: 'app-property-units',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './property-units.component.html',
  styleUrls: ['./property-units.component.scss']
})
export class PropertyUnitsComponent implements OnInit {
  property!: Property;
  units: Unit[] = [];
  loading = true;
  error = '';

  // Add computed properties for template
  get totalUnits(): number {
    return this.units.length;
  }

  get occupiedUnits(): number {
    return this.units.filter(unit => unit.isOccupied).length;
  }

  get vacantUnits(): number {
    return this.units.filter(unit => !unit.isOccupied).length;
  }

  constructor(
    private caretakerService: CaretakerService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPropertyUnits();
  }

  loadPropertyUnits(): void {
    const propertyId = Number(this.route.snapshot.paramMap.get('id'));
    
    if (isNaN(propertyId)) {
      this.error = 'Invalid property ID';
      this.loading = false;
      return;
    }

    // Load property details first
    this.caretakerService.getPropertyDetails(propertyId).subscribe({
      next: (property: Property) => {
        this.property = property;
        // Then load units
        this.loadUnits(propertyId);
      },
      error: (error) => {
        this.error = 'Failed to load property details';
        this.loading = false;
        console.error('Error loading property details:', error);
      }
    });
  }

  loadUnits(propertyId: number): void {
    this.caretakerService.getPropertyUnits(propertyId).subscribe({
      next: (units: Unit[]) => {
        this.units = units;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load units';
        this.loading = false;
        console.error('Error loading units:', error);
      }
    });
  }

  // Add missing method for template
  addUnit(): void {
    // You can implement a dialog or navigate to a create unit page
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units', 'new']);
    // Or open a dialog:
    // this.openAddUnitDialog();
  }

  viewUnitDetails(unit: Unit): void {
    this.router.navigate(['/caretaker-dashboard/properties', unit.propertyId, 'units', unit.id]);
  }

  getStatusClass(unit: Unit): string {
    switch (unit.status) {
      case 'occupied': return 'status-occupied';
      case 'available': return 'status-available';
      case 'maintenance': return 'status-maintenance';
      default: return 'status-unknown';
    }
  }

  goBack(): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id]);
  }

  // Optional: Method to open add unit dialog
  private openAddUnitDialog(): void {
    // Implement dialog opening logic here
    console.log('Open add unit dialog');
  }
}