import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { Advertisement } from '../../../../../../services/admin-interfaces';

@Component({
  selector: 'app-pending-advertisements',
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
  templateUrl: './pending-advertisements.component.html',
  styleUrls: ['./pending-advertisements.component.scss']
})
export class PendingAdvertisementsComponent implements OnInit {
  advertisements: Advertisement[] = [];
  isLoading = false;

  constructor(
    private adminService: AdminDataService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingAdvertisements();
  }

  loadPendingAdvertisements(): void {
    this.isLoading = true;
    this.adminService.getPendingAdvertisements().subscribe({
      next: (response) => {
        if (response.success) {
          this.advertisements = response.data;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open('Failed to load pending advertisements', 'Close', { duration: 3000 });
      }
    });
  }

  approveAdvertisement(advertisementId: number): void {
    this.adminService.approveAdvertisement(advertisementId).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadPendingAdvertisements();
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to approve advertisement', 'Close', { duration: 3000 });
      }
    });
  }

  rejectAdvertisement(advertisementId: number): void {
    const reason = prompt('Please enter rejection reason:');
    if (reason && reason.trim()) {
      this.adminService.rejectAdvertisement(advertisementId, reason).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPendingAdvertisements();
          }
        },
        error: (error) => {
          this.snackBar.open('Failed to reject advertisement', 'Close', { duration: 3000 });
        }
      });
    }
  }

  getStatusColor(status: string): string {
    return 'warn';
  }

  getStatusText(status: string): string {
    return 'PENDING REVIEW';
  }
}
