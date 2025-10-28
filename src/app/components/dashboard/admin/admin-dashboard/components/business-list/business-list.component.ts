import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { AdminService } from '../../../../../../services/admin.service';
import { Business } from '../../../../../../services/admin-interfaces';

@Component({
  selector: 'app-business-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule
  ],
  templateUrl: './business-list.component.html',
  styleUrls: ['./business-list.component.scss']
})
export class BusinessListComponent implements OnInit {
  businesses: Business[] = [];
  isLoading = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadBusinesses();
  }

  loadBusinesses(): void {
    this.isLoading = true;
    this.adminService.getBusinesses().subscribe({
      next: (response) => {
        if (response.success) {
          this.businesses = response.data;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading businesses:', error);
        this.isLoading = false;
      }
    });
  }

  approveBusiness(businessId: number): void {
    this.adminService.approveBusiness(businessId).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadBusinesses();
        }
      },
      error: (error) => {
        console.error('Error approving business:', error);
      }
    });
  }

  openRejectDialog(businessId: number): void {
    const reason = prompt('Please enter rejection reason:');
    if (reason && reason.trim()) {
      this.rejectBusiness(businessId, reason);
    }
  }

  rejectBusiness(businessId: number, rejectionReason: string): void {
    this.adminService.rejectBusiness(businessId, rejectionReason).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadBusinesses();
        }
      },
      error: (error) => {
        console.error('Error rejecting business:', error);
      }
    });
  }

  suspendBusiness(businessId: number): void {
    const reason = prompt('Please enter suspension reason:');
    if (reason && reason.trim()) {
      this.adminService.suspendBusiness(businessId, reason).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadBusinesses();
          }
        },
        error: (error) => {
          console.error('Error suspending business:', error);
        }
      });
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'approved': return 'primary';
      case 'pending': return 'warn';
      case 'rejected': return 'warn';
      case 'suspended': return 'accent';
      default: return 'basic';
    }
  }
}