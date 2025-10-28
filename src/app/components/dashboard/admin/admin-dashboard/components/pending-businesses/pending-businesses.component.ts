import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../../../services/admin.service';
import { Business } from '../../../../../../services/admin-interfaces';

@Component({
  selector: 'app-pending-businesses',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './pending-businesses.component.html',
  styleUrls: ['./pending-businesses.component.scss']
})
export class PendingBusinessesComponent implements OnInit {
  pendingBusinesses: Business[] = [];
  isLoading = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadPendingBusinesses();
  }

  loadPendingBusinesses(): void {
    this.isLoading = true;
    this.adminService.getPendingBusinesses().subscribe({
      next: (response) => {
        if (response.success) {
          this.pendingBusinesses = response.data;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading pending businesses:', error);
        this.isLoading = false;
      }
    });
  }

  approveBusiness(businessId: number): void {
    this.adminService.approveBusiness(businessId).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadPendingBusinesses();
        }
      },
      error: (error) => {
        console.error('Error approving business:', error);
      }
    });
  }

  rejectBusiness(businessId: number): void {
    const reason = prompt('Please enter the rejection reason:');
    if (reason && reason.trim()) {
      this.adminService.rejectBusiness(businessId, reason).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadPendingBusinesses();
          }
        },
        error: (error) => {
          console.error('Error rejecting business:', error);
        }
      });
    }
  }
}