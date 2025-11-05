import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CaretakerService } from '../../../../../../services/caretaker.service';
import { Property, Unit } from '../../../../../../services/caretaker-interfaces'; // Import from interface file

@Component({
  selector: 'app-properties-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './properties-list.component.html',
  styleUrls: ['./properties-list.component.scss']
})
export class PropertiesListComponent implements OnInit {
  properties: Property[] = [];
  loading = true;
  error = '';

  constructor(
    private caretakerService: CaretakerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProperties();
  }

  loadProperties(): void {
    this.caretakerService.getProperties().subscribe({
      next: (properties: Property[]) => {
        this.properties = properties;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load properties';
        this.loading = false;
        console.error('Error loading properties:', error);
      }
    });
  }

  viewPropertyDetails(propertyId: number): void {
    this.router.navigate(['/caretaker-dashboard/properties', propertyId]);
  }

  viewUnits(propertyId: number): void {
    this.router.navigate(['/caretaker-dashboard/properties', propertyId, 'units']);
  }

  manageUnits(propertyId: number): void {
    this.router.navigate(['/caretaker-dashboard/properties', propertyId, 'units'], {
      queryParams: { manage: 'true' }
    });
  }

  getTotalUnits(property: Property): number {
    return Array.isArray(property.units) ? property.units.length : property.totalUnits || 0;
  }

  getOccupancyRate(property: Property): number {
    const units = Array.isArray(property.units) ? property.units : [];
    if (units.length === 0) return property.occupiedUnits || 0;
    
    // Fix: Add type to the unit parameter
    const occupied = units.filter((unit: Unit) => unit.isOccupied).length;
    return Math.round((occupied / units.length) * 100);
  }

  getAvailableUnits(property: Property): number {
    const units = Array.isArray(property.units) ? property.units : [];
    if (units.length > 0) {
      // Fix: Add type to the unit parameter
      const available = units.filter((unit: Unit) => !unit.isOccupied).length;
      return available;
    }
    return (property.totalUnits || 0) - (property.occupiedUnits || 0);
  }

  getPropertyImage(property: Property): string {
    return property.imageUrl || '/assets/images/property-placeholder.jpg';
  }

  getFullAddress(property: Property): string {
    return `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
  }
}