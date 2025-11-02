import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, interval } from 'rxjs';
import { BusinessService } from '../../../services/business.service';
import { AuthService } from '../../../services/auth.service';

interface BusinessRegistration {
  id: number;
  businessName: string;
  businessRegistrationNumber: string;
  businessLicenseDocumentUrl: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  userEmail: string;
  userFullName: string;
}

@Component({
  selector: 'app-business-registration-status',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './business-registration-status.component.html',
  styleUrls: ['./business-registration-status.component.scss']
})
export class BusinessRegistrationStatusComponent implements OnInit, OnDestroy {
  private businessService = inject(BusinessService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  registration: BusinessRegistration | null = null;
  isLoading = true;
  isRefreshing = false;
  private refreshSubscription?: Subscription;
  currentUser: any;

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.showMessage('Please log in to view registration status', 'error');
      this.router.navigate(['/login']);
      return;
    }

    this.loadRegistrationStatus();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  loadRegistrationStatus(): void {
    this.isLoading = true;
    
    this.businessService.getRegistrationStatus().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.registration = response.data;
          
          // If approved, redirect to dashboard after a delay
          if (this.registration.verificationStatus === 'APPROVED') {
            this.showMessage('Business approved! Redirecting to dashboard...', 'success');
            setTimeout(() => {
              this.router.navigate(['/business-dashboard']);
            }, 3000);
          }
        } else {
          this.registration = null;
        }
        this.isLoading = false;
        this.isRefreshing = false;
      },
      error: (error) => {
        console.error('Error loading registration status:', error);
        this.showMessage('Failed to load registration status', 'error');
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  startAutoRefresh(): void {
    // Refresh every 30 seconds for pending status
    this.refreshSubscription = interval(30000).subscribe(() => {
      if (this.registration?.verificationStatus === 'PENDING') {
        this.refreshStatus();
      }
    });
  }

  stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  refreshStatus(): void {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.loadRegistrationStatus();
  }

  getStatusIcon(): string {
    if (!this.registration) return 'help';
    
    switch (this.registration.verificationStatus) {
      case 'APPROVED': return 'check_circle';
      case 'REJECTED': return 'cancel';
      case 'PENDING': return 'schedule';
      default: return 'help';
    }
  }

  getStatusColor(): string {
    if (!this.registration) return 'warn';
    
    switch (this.registration.verificationStatus) {
      case 'APPROVED': return 'primary';
      case 'REJECTED': return 'warn';
      case 'PENDING': return 'accent';
      default: return 'warn';
    }
  }

  getStatusMessage(): string {
    if (!this.registration) return 'No registration found';
    
    switch (this.registration.verificationStatus) {
      case 'APPROVED':
        return 'Your business has been approved and verified!';
      case 'REJECTED':
        return `Your business registration was rejected. Reason: ${this.registration.rejectionReason || 'No reason provided'}`;
      case 'PENDING':
        return 'Your business registration is under review. Please wait for admin approval.';
      default:
        return 'Unknown status';
    }
  }

  canEditRegistration(): boolean {
    return this.registration?.verificationStatus === 'REJECTED';
  }

  editRegistration(): void {
    this.router.navigate(['/business/register']);
  }

  viewDashboard(): void {
    this.router.navigate(['/business-dashboard']);
  }

  registerNewBusiness(): void {
    this.router.navigate(['/business/register']);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`snackbar-${type}`]
    });
  }
}