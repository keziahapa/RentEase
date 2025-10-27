import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PropertyService } from '../../../../../../services/property.service';
import { AuthService } from '../../../../../../services/auth.service';
import { InvitationService } from '../../../../../../services/invitation.service';
import { Property } from '../../../../../../services/dashboard-interface';
import { InviteDialogComponent } from '../../invite-dialog/invite-dialog.component';

@Component({
  selector: 'app-property-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './property-list.component.html',
  styleUrls: ['./property-list.component.scss'],
   providers: [InvitationService]
})
export class PropertyListComponent implements OnInit {
  properties: Property[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private propertyService: PropertyService,
    private authService: AuthService,
    private invitationService: InvitationService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadProperties();
  }

  loadProperties() {
    this.loading = true;
    this.errorMessage = '';

    this.propertyService.getProperties().subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.properties = response;
        } else if (response?.data && Array.isArray(response.data)) {
          this.properties = response.data;
        } else if (response?.properties && Array.isArray(response.properties)) {
          this.properties = response.properties;
        } else if (response?.content && Array.isArray(response.content)) {
          this.properties = response.content;
        } else if (response?.success && Array.isArray(response.data)) {
          this.properties = response.data;
        } else {
          this.properties = [];
          console.warn('Unexpected response format from properties API:', response);
        }
        
        this.loading = false;
        console.log('Properties loaded successfully:', this.properties);
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error?.message || 'Failed to load properties';
        this.snackBar.open(this.errorMessage, 'Close', { duration: 5000 });
        console.error('Error loading properties:', error);
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout();
            this.router.navigate(['/login']);
          }, 2000);
        }
      }
    });
  }

  viewProperty(propertyId: string) {
    this.router.navigate(['/landlord-dashboard/property', propertyId]);
  }

  viewPropertyUnits(propertyId: string) {
    this.router.navigate(['/landlord-dashboard/property', propertyId, 'units']);
  }

  createProperty() {
    this.router.navigate(['/landlord-dashboard/property/create']);
  }

  editProperty(propertyId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/landlord-dashboard/property', propertyId, 'edit']);
  }

  // Caretaker Invitation Only
  inviteCaretaker(property: Property, event: Event) {
    event.stopPropagation();
    this.openInviteDialog('caretaker', property);
  }

  private openInviteDialog(type: 'caretaker', property: Property) {
    const dialogRef = this.dialog.open(InviteDialogComponent, {
      width: '500px',
      data: {
        type: type,
        propertyId: property.id,
        propertyName: property.name,
        availableUnits: [] // Empty for caretaker
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.sendInvitation(type, result, property.name);
      }
    });
  }

  private sendInvitation(type: 'caretaker', inviteData: any, propertyName: string) {
    this.invitationService.inviteCaretaker(inviteData).subscribe({
      next: () => {
        this.snackBar.open('Caretaker invitation sent successfully!', 'Close', { duration: 4000 });
      },
      error: (error) => {
        console.error('Error sending caretaker invitation:', error);
        const errorMessage = error?.error?.message || 'Failed to send caretaker invitation';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      }
    });
  }

  // Helper Methods
  getOccupancyRate(property: Property): number {
    if (!property.totalUnits || property.totalUnits === 0) return 0;
    const occupied = property.units?.filter(unit => unit.status === 'occupied').length || 0;
    return Math.round((occupied / property.totalUnits) * 100);
  }

  getTotalRevenue(property: Property): number {
    return property.units?.reduce((sum, unit) => {
      return unit.status === 'occupied' ? sum + (unit.rentAmount || 0) : sum;
    }, 0) || 0;
  }

  getOccupiedUnits(property: Property): number {
    return property.units?.filter(unit => unit.status === 'occupied').length || 0;
  }

  getVacantUnits(property: Property): number {
    return (property.totalUnits || 0) - this.getOccupiedUnits(property);
  }

  formatCurrency(amount: number | undefined | null): string {
    if (amount == null) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES', 
      maximumFractionDigits: 0 
    }).format(amount);
  }

  formatCompactCurrency(amount: number | undefined | null): string {
    if (amount == null) return 'KES 0';
    if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`;
    return `KES ${amount.toLocaleString()}`;
  }

  refreshProperties() {
    this.loadProperties();
    this.snackBar.open('Refreshing properties...', 'Close', { duration: 2000 });
  }

  getPropertyTypeDisplay(type: string | undefined): string {
    const typeMap: { [key: string]: string } = {
      'APARTMENT': 'Apartment',
      'HOUSE': 'House',
      'BUNGALOW': 'Bungalow',
      'COMMERCIAL': 'Commercial',
      'CONDO': 'Condominium',
      'TOWNHOUSE': 'Townhouse',
      'MIXED': 'Mixed Use'
    };
    return typeMap[type ?? ''] ?? type ?? 'Property';
  }
}