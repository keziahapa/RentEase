import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InvitationService } from '../../../../../../services/invitation.service';
import { AuthService } from '../../../../../../services/auth.service';

interface PendingInvitation {
  token: string;
  attemptCount: number;
  lastAttempt: Date;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'queued';
  invitationType: 'tenant' | 'caretaker' | null;
  originalUrl: string;
  error?: string;
}

@Component({
  selector: 'app-accept-invitation',
  templateUrl: './accept-invitation.component.html',
  styleUrls: ['./accept-invitation.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule
  ]
})
export class AcceptInvitationComponent implements OnInit, OnDestroy {
  invitationToken: string | null = null;
  loading = true;
  processing = false;
  error: string | null = null;
  success = false;
  userIsLoggedIn = false;
  invitationType: 'tenant' | 'caretaker' | null = null;
  
  isOnline = navigator.onLine;
  retryCount = 0;
  maxRetries = 3;
  retryDelay = 2000;
  private retryTimeout: any;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private invitationService: InvitationService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.onlineHandler = () => this.handleOnlineStatus();
    this.offlineHandler = () => this.handleOfflineStatus();
  }

  ngOnInit() {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    this.userIsLoggedIn = this.authService.isLoggedIn();
    
    let rawToken = this.route.snapshot.queryParamMap.get('token');
    
    if (rawToken && rawToken.includes('accept-invitation')) {
      const tokenMatch = rawToken.match(/[?&]token=([^&]+)/);
      if (tokenMatch) {
        rawToken = tokenMatch[1];
      } else {
        const parts = rawToken.split('/');
        rawToken = parts[parts.length - 1];
      }
    }
    
    this.invitationToken = rawToken;

    if (!this.invitationToken) {
      this.error = 'No valid invitation token provided. Please check your invitation link.';
      this.loading = false;
      return;
    }

    sessionStorage.setItem('pendingInvitationToken', this.invitationToken);

    if (this.userIsLoggedIn) {
      this.acceptInvitationAndRedirect();
    } else {
      this.redirectToLoginWithInvitation();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleOnlineStatus(): void {
    this.isOnline = true;
    const pending = this.getPendingInvitation();
    if (pending && pending.status === 'queued') {
      this.snackBar.open('Connection restored. Retrying invitation...', 'Close', { duration: 3000 });
      this.retryAcceptance();
    }
  }

  private handleOfflineStatus(): void {
    this.isOnline = false;
    if (this.processing) {
      this.snackBar.open('Connection lost. Invitation will be processed when online.', 'Close', { duration: 5000 });
    }
  }

  private storePendingInvitation(): void {
    if (!this.invitationToken) return;

    const pendingInvitation: PendingInvitation = {
      token: this.invitationToken,
      attemptCount: 0,
      lastAttempt: new Date(),
      maxRetries: this.maxRetries,
      status: 'queued',
      invitationType: this.invitationType,
      originalUrl: this.router.url
    };

    sessionStorage.setItem('pendingInvitationToken', this.invitationToken);
    localStorage.setItem('pendingInvitation', JSON.stringify(pendingInvitation));
  }

  private getPendingInvitation(): PendingInvitation | null {
    try {
      const pending = localStorage.getItem('pendingInvitation');
      return pending ? JSON.parse(pending) : null;
    } catch {
      return null;
    }
  }

  private clearPendingInvitation(): void {
    sessionStorage.removeItem('pendingInvitationToken');
    localStorage.removeItem('pendingInvitation');
  }

  private updatePendingInvitationStatus(status: PendingInvitation['status'], error?: string): void {
    const pending = this.getPendingInvitation();
    if (pending && this.invitationToken) {
      pending.status = status;
      pending.lastAttempt = new Date();
      pending.attemptCount++;
      if (error) pending.error = error;
      localStorage.setItem('pendingInvitation', JSON.stringify(pending));
    }
  }

  private redirectToLoginWithInvitation(): void {
    const queryParams = {
      returnUrl: this.router.url,
      hasPendingInvitation: true,
      token: this.invitationToken,
      invitationType: this.invitationType,
      message: `You have a pending ${this.invitationType} invitation. Login to accept it.`
    };

    this.router.navigate(['/login'], { queryParams });
  }

  private cleanToken(rawToken: string | null): string | null {
    if (!rawToken) return null;
    
    if (rawToken.includes('accept-invitation')) {
      const tokenMatch = rawToken.match(/[?&]token=([^&]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      } else {
        const parts = rawToken.split('/');
        return parts[parts.length - 1];
      }
    }
    
    return rawToken;
  }

  acceptInvitationAndRedirect(): void {
    if (!this.invitationToken) {
      this.error = 'No invitation token found.';
      return;
    }

    if (!this.authService.isLoggedIn()) {
      this.error = 'Please log in first to accept this invitation.';
      this.redirectToLoginWithInvitation();
      return;
    }

    if (!this.isOnline) {
      this.handleOfflineAcceptance();
      return;
    }

    this.processing = true;
    this.error = null;
    this.updatePendingInvitationStatus('processing');

    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response: any) => {
        this.processing = false;
        this.success = true;
        this.retryCount = 0;
    
        this.clearPendingInvitation();
        this.updatePendingInvitationStatus('pending');
        
        const successMessage = this.getSuccessMessage();
        this.snackBar.open(successMessage, 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        this.redirectToDashboard();
      },
      error: (error: any) => {
        this.processing = false;
        this.retryCount++;
        this.updatePendingInvitationStatus('failed', error.message);
        this.handleAcceptErrorWithRetry(error);
      }
    });
  }

  private getSuccessMessage(): string {
    switch (this.invitationType) {
      case 'tenant':
        return 'Tenancy invitation accepted! Welcome to your new home! Redirecting to your dashboard...';
      case 'caretaker':
        return 'Caretaker invitation accepted! You now have access to property management features. Redirecting to dashboard...';
      default:
        return 'Invitation accepted! Redirecting to dashboard...';
    }
  }

  private handleOfflineAcceptance(): void {
    this.error = 'You are currently offline. This invitation has been queued and will be processed automatically when your connection is restored.';
    this.updatePendingInvitationStatus('queued', 'Offline - waiting for connection');
    
    this.snackBar.open('Invitation queued for when you are back online', 'Close', { 
      duration: 5000,
      panelClass: ['warning-snackbar']
    });
  }

  private handleAcceptErrorWithRetry(error: any): void {
    const canRetry = this.retryCount < this.maxRetries && this.isRetryableError(error);
    
    if (canRetry) {
      this.error = this.getErrorMessage(error) + ` Retrying... (${this.retryCount}/${this.maxRetries})`;
      this.scheduleRetry();
    } else {
      this.error = this.getErrorMessage(error);
      if (this.retryCount >= this.maxRetries) {
        this.error += ' Maximum retry attempts reached.';
      }
      
      this.updatePendingInvitationStatus('queued', error.message);
      
      this.snackBar.open('Invitation queued for later retry', 'Close', { 
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
    }
  }

  private isRetryableError(error: any): boolean {
    return error.status === 0 || 
           (error.status >= 500 && error.status < 600) ||
           error.status === 429;
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'Your session has expired. Please log in again to accept this invitation.';
    } else if (error.status === 400) {
      return error.error?.message || 'Invalid invitation token. Please check the link and try again.';
    } else if (error.status === 404) {
      return 'Invitation not found or has been cancelled. Please contact the property owner for a new invitation.';
    } else if (error.status === 409) {
      return 'This invitation has already been accepted.';
    } else if (error.status === 410) {
      return 'This invitation has expired. Please request a new invitation from the property owner.';
    } else if (error.status === 403) {
      return 'You do not have permission to accept this invitation. Please contact the property owner.';
    } else if (error.status === 0 || !this.isOnline) {
      return 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.status === 429) {
      return 'Too many requests. Please wait a moment.';
    } else {
      return error.error?.message || 'An unexpected error occurred while accepting the invitation.';
    }
  }

  private scheduleRetry(): void {
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1) + Math.random() * 1000;
    
    this.retryTimeout = setTimeout(() => {
      if (this.isOnline) {
        this.acceptInvitationAndRedirect();
      }
    }, delay);
  }

  retryAcceptance(): void {
    this.userIsLoggedIn = this.authService.isLoggedIn();
    this.error = null;
    this.retryCount = 0;
    
    if (this.userIsLoggedIn) {
      this.acceptInvitationAndRedirect();
    } else {
      this.redirectToLoginWithInvitation();
    }
  }

  queueForLater(): void {
    this.updatePendingInvitationStatus('queued', 'Manually queued by user');
    this.snackBar.open('Invitation queued. It will retry automatically from your dashboard.', 'Close', { 
      duration: 5000 
    });
    this.redirectToDashboard();
  }

  private redirectToDashboard(): void {
    let dashboardRoute = '/dashboard';
   
    if (this.invitationType === 'tenant') {
      dashboardRoute = '/tenant-dashboard';
    } else if (this.invitationType === 'caretaker') {
      dashboardRoute = '/caretaker-dashboard';
    }
    
    setTimeout(() => {
      this.router.navigate([dashboardRoute], {
        queryParams: {
          hasPendingInvitation: !this.success,
          invitationType: this.invitationType
        }
      });
    }, this.success ? 2000 : 0);
  }

  canRetryManually(): boolean {
    return !this.processing && !this.success && !!this.error && this.retryCount < this.maxRetries;
  }

  canQueueForLater(): boolean {
    return !this.processing && !this.success && !!this.error;
  }

  isNetworkError(): boolean {
    return this.error?.includes('internet') || this.error?.includes('connection') || !this.isOnline;
  }

  getStatusMessage(): string {
    if (this.processing) return 'Processing invitation...';
    if (this.success) return 'Invitation accepted successfully!';
    if (this.error) return this.error;
    if (!this.isOnline) return 'Waiting for network connection...';
    return 'Ready to accept invitation';
  }

  getStatusIcon(): string {
    if (this.success) return 'check_circle';
    if (this.error) return 'error';
    if (this.processing) return 'autorenew';
    if (!this.isOnline) return 'wifi_off';
    return 'mark_email_read';
  }

  getStatusColor(): string {
    if (this.success) return 'primary';
    if (this.error) return 'warn';
    if (this.processing) return 'accent';
    return 'primary';
  }

  navigateToLogin(): void {
    this.redirectToLoginWithInvitation();
  }

  navigateToRegister(): void {
    this.router.navigate(['/register'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true,
        invitationType: this.invitationType
      }
    });
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  needsAuthentication(): boolean {
    return !this.userIsLoggedIn && !this.success && !this.loading && !this.processing;
  }

  getInvitationTypeDisplay(): string {
    return this.getInvitationTitle();
  }

  getRoleName(): string {
    return this.getRoleDisplayName();
  }

  getDescription(): string {
    return this.getInvitationDescription();
  }

  getPropertyName(): string {
    return 'the property';
  }

  getInviterName(): string {
    return 'the property owner';
  }

  hasInvitationDetails(): boolean {
    return false;
  }

  onAcceptInvitation(): void {
    if (this.userIsLoggedIn) {
      this.acceptInvitationAndRedirect();
    } else {
      this.redirectToLoginWithInvitation();
    }
  }

  private getInvitationTitle(): string {
    switch (this.invitationType) {
      case 'tenant':
        return 'Tenancy Invitation';
      case 'caretaker':
        return 'Caretaker Invitation';
      default:
        return 'Property Invitation';
    }
  }

  private getInvitationDescription(): string {
    switch (this.invitationType) {
      case 'tenant':
        return 'You have been invited to become a tenant at a property. Accept this invitation to access your tenancy details and manage your rental.';
      case 'caretaker':
        return 'You have been invited to become a caretaker for a property. Accept this invitation to access property management features.';
      default:
        return 'You have been invited to join a property. Accept this invitation to get started.';
    }
  }

  private getRoleDisplayName(): string {
    switch (this.invitationType) {
      case 'tenant':
        return 'Tenant';
      case 'caretaker':
        return 'Caretaker';
      default:
        return 'Member';
    }
  }
}