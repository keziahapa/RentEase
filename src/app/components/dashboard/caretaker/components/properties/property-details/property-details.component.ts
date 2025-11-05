import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CaretakerService } from '../../../../../../services/caretaker.service';
import { Property, Unit } from '../../../../../../services/caretaker-interfaces';

@Component({
  selector: 'app-property-details',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './property-details.component.html',
  styleUrls: ['./property-details.component.scss']
})
export class PropertyDetailsComponent implements OnInit {
  property!: Property;
  loading = true;
  error = '';

  // Add computed properties for template
  get totalUnits(): number {
    return this.property?.units?.length || 0;
  }

  get occupancyRate(): number {
    return this.getOccupancyRate();
  }

  get vacantUnits(): number {
    return this.getAvailableUnits();
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
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load property details';
        this.loading = false;
        console.error('Error loading property details:', error);
      }
    });
  }

  // Add missing method for template
  manageUnits(): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units'], {
      queryParams: { manage: 'true' }
    });
  }

  getOccupancyRate(): number {
    if (!this.property?.units || this.property.units.length === 0) {
      return 0;
    }
    
    const occupiedUnits = this.property.units.filter((unit: Unit) => unit.isOccupied).length;
    return Math.round((occupiedUnits / this.property.units.length) * 100);
  }

  getAvailableUnits(): number {
    if (!this.property?.units) return 0;
    return this.property.units.filter((unit: Unit) => !unit.isOccupied).length;
  }

  viewUnits(): void {
    this.router.navigate(['/caretaker-dashboard/properties', this.property.id, 'units']);
  }

  goBack(): void {
    this.router.navigate(['/caretaker-dashboard/properties']);
  }
}