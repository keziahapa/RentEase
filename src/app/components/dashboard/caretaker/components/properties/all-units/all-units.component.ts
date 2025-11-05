import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CaretakerService } from '../../../../../../services/caretaker.service';
import { Unit, Property } from '../../../../../../services/caretaker-interfaces';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './all-units.component.html',
  styleUrls: ['./all-units.component.scss']
})
export class AllUnitsComponent implements OnInit {
  units: Unit[] = [];
  properties: Property[] = [];
  loading = true;
  error = '';

  // Add missing properties for template
  get totalUnits(): number {
    return this.units.length;
  }

  get occupiedUnits(): number {
    return this.units.filter(unit => unit.isOccupied).length;
  }

  get vacantUnits(): number {
    return this.units.filter(unit => !unit.isOccupied).length;
  }

  get totalProperties(): number {
    return this.properties.length;
  }

  constructor(
    private caretakerService: CaretakerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAllUnits();
    this.loadProperties();
  }

  loadAllUnits(): void {
    this.caretakerService.getAllUnits().subscribe({
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

  loadProperties(): void {
    this.caretakerService.getProperties().subscribe({
      next: (properties: Property[]) => {
        this.properties = properties;
      },
      error: (error) => {
        console.error('Error loading properties:', error);
      }
    });
  }

  // Add missing method for template
  viewProperty(propertyId: number): void {
    this.router.navigate(['/caretaker-dashboard/properties', propertyId]);
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
}