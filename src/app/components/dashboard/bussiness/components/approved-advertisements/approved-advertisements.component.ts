import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminService } from '../../../../../services/admin.service';
import { Advertisement } from '../../../../../services/admin-interfaces';

@Component({
  selector: 'app-approved-advertisements',
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
  templateUrl: './approved-advertisements.component.html',
  styleUrls: ['./approved-advertisements.component.scss']
})
export class ApprovedAdvertisementsComponent implements OnInit {
  advertisements: Advertisement[] = [];
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadApprovedAdvertisements();
  }

  loadApprovedAdvertisements(): void {
    this.isLoading = true;
    this.adminService.getAdvertisements().subscribe({
      next: (response) => {
        if (response.success) {
          // Filter only approved advertisements
          this.advertisements = response.data.filter(ad => ad.status === 'APPROVED');
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open('Failed to load approved advertisements', 'Close', { duration: 3000 });
      }
    });
  }

  getStatusColor(status: string): string {
    return 'primary';
  }

  getStatusText(status: string): string {
    return 'Active';
  }
}