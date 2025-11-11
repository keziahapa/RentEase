import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BusinessService } from '../../../services/business.service';
import { AuthService } from '../../../services/auth.service';

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

  businessInfo: any = null;
  isLoading = true;
  checkInterval: any;
  lastChecked: Date | null = null;
  hasCheckedInitialStatus = false;

  ngOnInit() {
    this.loadBusinessStatus();
 
    this.checkInterval = setInterval(() => {
      if (!this.businessInfo || this.businessInfo.verificationStatus !== 'APPROVED') {
        this.loadBusinessStatus();
      }
    }, 30000);
  }

  async loadBusinessStatus() {
    try {
      this.lastChecked = new Date();
      const response = await this.businessService.getRegistrationStatus().toPromise();
      
      if (response?.success && response.data) {
        this.businessInfo = response.data;
        this.hasCheckedInitialStatus = true;
        
        if (response.data.verificationStatus === 'APPROVED') {
          this.redirectToDashboard();
          return;
        }
      } else {
        this.businessInfo = null;
        this.hasCheckedInitialStatus = true;
      }
    } catch (error: any) {
      console.error('Error loading business status:', error);
      if (error.status === 404) {
        this.businessInfo = null;
      } else {
        this.showMessage('Error loading business status. Please try again.', 'error');
      }
      this.hasCheckedInitialStatus = true;
    } finally {
      this.isLoading = false;
    }
  }

  private redirectToDashboard() {
    this.showMessage('Business approved! Redirecting to dashboard...', 'success');
    setTimeout(() => {
      this.router.navigate(['/business-dashboard']);
    }, 2000);
  }

  refreshStatus() {
    this.isLoading = true;
    this.loadBusinessStatus();
  }

  navigateToRegistration() {
    this.router.navigate(['/business/registration']);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`snackbar-${type}`]
    });
  }

  getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'Pending Approval',
      'APPROVED': 'Approved',
      'REJECTED': 'Rejected'
    };
    return statusMap[status] || status;
  }

  getStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'PENDING': 'schedule',
      'APPROVED': 'check_circle',
      'REJECTED': 'cancel'
    };
    return iconMap[status] || 'help';
  }

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'PENDING': 'accent',
      'APPROVED': 'primary',
      'REJECTED': 'warn'
    };
    return colorMap[status] || '';
  }

  shouldShowStatusPage(): boolean {
    return this.isLoading || 
           !this.hasCheckedInitialStatus || 
           (this.businessInfo && this.businessInfo.verificationStatus !== 'APPROVED');
  }

  ngOnDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}