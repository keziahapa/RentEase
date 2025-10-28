import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BusinessService } from '../../../../../services/business.service';
import { Advertisement } from '../../../../../services/admin-interfaces';

@Component({
  selector: 'app-my-advertisements',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './my-advertisements.component.html',
  styleUrls: ['./my-advertisements.component.scss']
})
export class MyAdvertisementsComponent implements OnInit {
  advertisements: Advertisement[] = [];
  isLoading = false;

  constructor(
    private businessService: BusinessService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadMyAdvertisements();
  }

  loadMyAdvertisements(): void {
    this.isLoading = true;
    this.businessService.getMyAdvertisements().subscribe({
      next: (ads: Advertisement[]) => {
        this.advertisements = ads;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load advertisements', 'Close', {
          duration: 3000
        });
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'APPROVED': return 'primary';
      case 'PENDING': return 'warn';
      case 'REJECTED': return 'warn';
      default: return 'basic';
    }
  }

  createNewAd(): void {
    this.router.navigate(['/business-dashboard/ads/create']);
  }

  viewAd(adId: number): void {
    this.router.navigate(['/business-dashboard/ads', adId]);
  }

  editAd(adId: number): void {
    this.router.navigate(['/business-dashboard/ads', adId, 'edit']);
  }

  deleteAd(adId: number): void {
    if (confirm('Are you sure you want to delete this advertisement?')) {
      // FIX: Use deleteAdvertisement instead of deleteBusinessAdvertisement
      this.businessService.deleteAdvertisement(adId.toString()).subscribe({
        next: () => {
          this.snackBar.open('Advertisement deleted successfully', 'Close', {
            duration: 3000
          });
          this.loadMyAdvertisements();
        },
        error: () => {
          this.snackBar.open('Failed to delete advertisement', 'Close', {
            duration: 3000
          });
        }
      });
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'APPROVED': return 'Active';
      case 'PENDING': return 'Under Review';
      case 'REJECTED': return 'Rejected';
      default: return status;
    }
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event);
    event.target.style.display = 'none';
  }
}