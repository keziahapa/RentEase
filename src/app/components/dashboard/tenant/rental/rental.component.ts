import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TenantService } from '../../../../services/tenant.service';

interface RentalUnit {
  id: number;
  unitNumber: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  rentAmount: number;
  depositAmount: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  status: string;
  amenities: string[];
}

interface Property {
  id: number;
  name: string;
  address: string;
  location: string;
  propertyType: string;
  totalUnits: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  amenities: string[];
  description: string;
  imageUrl?: string;
}

interface LeaseInfo {
  id: number;
  unitId: number;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  depositAmount: number;
  paymentDueDate: number;
  lateFee: number;
  status: string;
  terms: string[];
}

@Component({
  selector: 'app-tenant-rental',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './rental.component.html',
  styleUrls: ['./rental.component.scss']
})
export class RentalComponent implements OnInit, OnDestroy {
  isLoading = true;
  error: string | null = null;
  
  rentalUnit: RentalUnit | null = null;
  property: Property | null = null;
  leaseInfo: LeaseInfo | null = null;
  
  private subscriptions = new Subscription();

  constructor(
    private tenantService: TenantService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadRentalData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadRentalData(): void {
    this.isLoading = true;
    this.error = null;

    this.subscriptions.add(
      this.tenantService.getTenantUnits().subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success && response.data && response.data.length > 0) {
            this.processRentalData(response.data[0]);
          } else {
            this.error = 'No rental unit found for your account';
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.error = error.message || 'Failed to load rental information';
          console.error('Error loading rental data:', error);
        }
      })
    );
  }

  private processRentalData(unitData: any): void {
    // Process rental unit
    this.rentalUnit = {
      id: unitData.id || unitData.unitId || 0,
      unitNumber: unitData.unitNumber || 'N/A',
      unitType: unitData.unitType || 'Apartment',
      bedrooms: unitData.bedrooms || 1,
      bathrooms: unitData.bathrooms || 1,
      squareFeet: unitData.squareFeet || unitData.size || 0,
      rentAmount: unitData.rentAmount || 0,
      depositAmount: unitData.depositAmount || 0,
      leaseStartDate: new Date(unitData.leaseStartDate || unitData.leaseStart || new Date()),
      leaseEndDate: new Date(unitData.leaseEndDate || unitData.leaseEnd || new Date()),
      status: unitData.status || 'Active',
      amenities: unitData.amenities || ['Basic Utilities', 'Security']
    };

    // Process property information
    this.property = {
      id: unitData.property?.id || unitData.propertyId || 0,
      name: unitData.property?.name || unitData.propertyName || 'Property',
      address: unitData.property?.address || unitData.propertyAddress || 'Address not available',
      location: unitData.property?.location || unitData.propertyLocation || '',
      propertyType: unitData.property?.propertyType || 'Residential',
      totalUnits: unitData.property?.totalUnits || 1,
      ownerName: unitData.property?.ownerName || unitData.landlordName || 'Landlord',
      ownerEmail: unitData.property?.ownerEmail || unitData.landlordEmail || '',
      ownerPhone: unitData.property?.ownerPhone || unitData.landlordPhone || '',
      amenities: unitData.property?.amenities || ['Parking', 'Security', 'Water'],
      description: unitData.property?.description || '',
      imageUrl: unitData.property?.imageUrl || unitData.propertyImage
    };

    // Process lease information
    this.leaseInfo = {
      id: unitData.lease?.id || 0,
      unitId: this.rentalUnit.id,
      startDate: this.rentalUnit.leaseStartDate,
      endDate: this.rentalUnit.leaseEndDate,
      rentAmount: this.rentalUnit.rentAmount,
      depositAmount: this.rentalUnit.depositAmount,
      paymentDueDate: unitData.paymentDueDate || 1,
      lateFee: unitData.lateFee || 500,
      status: unitData.leaseStatus || 'Active',
      terms: unitData.leaseTerms || [
        'Rent due on 1st of every month',
        'Late fee applies after 5th of month',
        'Maintenance requests through portal',
        'No pets allowed without permission'
      ]
    };
  }

  getDaysUntilLeaseEnd(): number {
    if (!this.leaseInfo) return 0;
    const today = new Date();
    const endDate = new Date(this.leaseInfo.endDate);
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getLeaseProgress(): number {
    if (!this.leaseInfo) return 0;
    const startDate = new Date(this.leaseInfo.startDate).getTime();
    const endDate = new Date(this.leaseInfo.endDate).getTime();
    const today = new Date().getTime();
    
    const totalDuration = endDate - startDate;
    const elapsed = today - startDate;
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }

  isLeaseExpiringSoon(): boolean {
    const daysUntilEnd = this.getDaysUntilLeaseEnd();
    return daysUntilEnd <= 60 && daysUntilEnd > 0;
  }

  isLeaseExpired(): boolean {
    return this.getDaysUntilLeaseEnd() <= 0;
  }

  getLeaseStatusColor(): string {
    if (this.isLeaseExpired()) return '#ef4444';
    if (this.isLeaseExpiringSoon()) return '#f59e0b';
    return '#10b981';
  }

  getLeaseStatusText(): string {
    if (this.isLeaseExpired()) return 'Expired';
    if (this.isLeaseExpiringSoon()) return 'Expiring Soon';
    return 'Active';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  viewLeaseDocument(): void {
    this.snackBar.open('Lease document would open here', 'Close', {
      duration: 3000
    });
  }

  requestLeaseRenewal(): void {
    this.snackBar.open('Lease renewal request would be sent here', 'Close', {
      duration: 3000
    });
  }

  contactLandlord(): void {
    if (this.property?.ownerEmail) {
      window.location.href = `mailto:${this.property.ownerEmail}`;
    } else {
      this.snackBar.open('Landlord email not available', 'Close', {
        duration: 3000
      });
    }
  }

  reportIssue(): void {
    this.router.navigate(['/tenant-dashboard/maintenance']);
  }

  refreshData(): void {
    this.loadRentalData();
  }

  getBedroomText(): string {
    if (!this.rentalUnit) return '';
    return this.rentalUnit.bedrooms === 1 ? '1 bedroom' : `${this.rentalUnit.bedrooms} bedrooms`;
  }

  getBathroomText(): string {
    if (!this.rentalUnit) return '';
    return this.rentalUnit.bathrooms === 1 ? '1 bathroom' : `${this.rentalUnit.bathrooms} bathrooms`;
  }
}