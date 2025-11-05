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
import { InvitationDetails } from '../../../../../../services/invitation-interfaces';

// Interface for pending invitations storage
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
  invitationDetails: InvitationDetails | null = null;
  invitationType: 'tenant' | 'caretaker' | null = null;
  
  // Graceful failure handling properties
  isOnline = navigator.onLine;
  retryCount = 0;
  maxRetries = 3;
  retryDelay = 2000; // 2 seconds initial delay
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
    // Set up online/offline detection
    this.onlineHandler = () => this.handleOnlineStatus();
    this.offlineHandler = () => this.handleOfflineStatus();
  }

  ngOnInit() {
    // Set up network event listeners
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    this.userIsLoggedIn = this.authService.isLoggedIn();
    
    // 🟢 FIXED: Proper token extraction with URL cleaning
    let rawToken = this.route.snapshot.queryParamMap.get('token');
    
    // If token contains full URL, extract just the token
    if (rawToken && rawToken.includes('accept-invitation')) {
      console.log('🔄 Cleaning token from URL:', rawToken);
      const tokenMatch = rawToken.match(/[?&]token=([^&]+)/);
      if (tokenMatch) {
        rawToken = tokenMatch[1];
      } else {
        // If no token param, try to extract from path
        const parts = rawToken.split('/');
        rawToken = parts[parts.length - 1];
      }
    }
    
    this.invitationToken = rawToken;

    console.log('🔄 Cleaned invitation token:', this.invitationToken);
    console.log('👤 User logged in:', this.userIsLoggedIn);
    console.log('🌐 Online status:', this.isOnline);

    if (!this.invitationToken) {
      this.error = 'No valid invitation token provided. Please check your invitation link.';
      this.loading = false;
      return;
    }

    // Store token for potential retry scenarios
    this.storePendingInvitation();

    if (!this.userIsLoggedIn) {
      this.redirectToLogin();
      return;
    }
    
    this.loadInvitationDetails();
  }

  ngOnDestroy() {
    // Clean up event listeners and timeouts
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleOnlineStatus(): void {
    this.isOnline = true;
    console.log('Connection restored - checking for pending invitations');
    
    // Check if we have a pending invitation to retry
    const pending = this.getPendingInvitation();
    if (pending && pending.status === 'queued') {
      this.snackBar.open('Connection restored. Retrying invitation...', 'Close', { duration: 3000 });
      this.retryAcceptance();
    }
  }

  private handleOfflineStatus(): void {
    this.isOnline = false;
    console.log('Connection lost - invitation will be queued');
    
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

  loadInvitationDetails() {
    if (!this.invitationToken) {
      this.loading = false;
      return;
    }

    // Check if we have a previously failed invitation to recover
    const pendingInvitation = this.getPendingInvitation();
    if (pendingInvitation && pendingInvitation.status === 'queued') {
      console.log('Recovering previously queued invitation');
      this.invitationType = pendingInvitation.invitationType;
      this.retryCount = pendingInvitation.attemptCount;
    } else {
      this.invitationType = this.guessInvitationType();
    }

    this.loading = false;
    
    console.log('Proceeding with token only - invitation type:', this.invitationType);
    
    if (this.userIsLoggedIn) {
      console.log('Auto-accepting invitation...');
      this.acceptInvitationAndRedirect();
    }
  }

  private guessInvitationType(): 'tenant' | 'caretaker' {
    const url = this.router.url.toLowerCase();
    if (url.includes('tenant')) return 'tenant';
    if (url.includes('caretaker')) return 'caretaker';
    return 'tenant'; // Default to tenant
  }

  acceptInvitationAndRedirect(): void {
    if (!this.invitationToken) {
      this.error = 'No invitation token found.';
      return;
    }

    if (!this.authService.isLoggedIn()) {
      this.error = 'Please log in first to accept this invitation.';
      this.redirectToLogin();
      return;
    }

    if (!this.isOnline) {
      this.handleOfflineAcceptance();
      return;
    }

    this.processing = true;
    this.error = null;
    this.updatePendingInvitationStatus('processing');

    console.log('🔄 Accepting invitation with cleaned token:', this.invitationToken);

    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response: any) => {
        this.processing = false;
        this.success = true;
        this.retryCount = 0;
        console.log('✅ Invitation accepted successfully:', response);
    
        this.clearPendingInvitation();
        this.updatePendingInvitationStatus('pending'); // Clear the failed status
        
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
        console.error('❌ Error accepting invitation:', error);
        
        this.updatePendingInvitationStatus('failed', error.message);
        this.handleAcceptErrorWithRetry(error);
      }
    });
  }

  private getSuccessMessage(): string {
    switch (this.invitationType) {
      case 'tenant':
        return '🎉 Tenancy invitation accepted! Welcome to your new home! Redirecting to your dashboard...';
      case 'caretaker':
        return '🎉 Caretaker invitation accepted! You now have access to property management features. Redirecting to dashboard...';
      default:
        return '🎉 Invitation accepted! Redirecting to dashboard...';
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
      
      // Store for dashboard retry
      this.updatePendingInvitationStatus('queued', error.message);
      
      this.snackBar.open('Invitation queued for later retry', 'Close', { 
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, 5xx server errors, or rate limiting
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
    // Exponential backoff with jitter
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1) + Math.random() * 1000;
    
    console.log(`Scheduling retry in ${delay}ms (attempt ${this.retryCount})`);
    
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
      this.redirectToLogin();
    }
  }

  queueForLater(): void {
    this.updatePendingInvitationStatus('queued', 'Manually queued by user');
    this.snackBar.open('Invitation queued. It will retry automatically from your dashboard.', 'Close', { 
      duration: 5000 
    });
    this.redirectToDashboard();
  }

  // Enhanced redirect methods with invitation context
  private redirectToDashboard(): void {
    let dashboardRoute = '/dashboard';
   
    if (this.invitationType === 'tenant') {
      dashboardRoute = '/tenant-dashboard';
    } else if (this.invitationType === 'caretaker') {
      dashboardRoute = '/caretaker-dashboard';
    }
    
    // Pass invitation context to dashboard for retry monitoring
    setTimeout(() => {
      this.router.navigate([dashboardRoute], {
        queryParams: {
          hasPendingInvitation: !this.success,
          invitationType: this.invitationType
        }
      });
    }, this.success ? 2000 : 0);
  }

  private redirectToLogin(): void {
    this.router.navigate(['/login'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true,
        invitationType: this.invitationType,
        token: this.invitationToken
      }
    });
  }

  // Template helper methods
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

  // Navigation methods
  navigateToLogin(): void {
    this.redirectToLogin();
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

  // Public getters for template
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
    return this.invitationDetails?.propertyName || 'the property';
  }

  getInviterName(): string {
    return this.invitationDetails?.inviterName || 'the property owner';
  }

  hasInvitationDetails(): boolean {
    return !!this.invitationDetails;
  }

  onAcceptInvitation(): void {
    if (this.userIsLoggedIn) {
      this.acceptInvitationAndRedirect();
    } else {
      this.redirectToLogin();
    }
  }

  // Private helper methods
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
    if (this.invitationDetails) {
      const propertyName = this.invitationDetails.propertyName || 'the property';
      const inviterName = this.invitationDetails.inviterName || 'the property owner';
      
      switch (this.invitationType) {
        case 'tenant':
          return `You have been invited by ${inviterName} to become a tenant at ${propertyName}. Accept this invitation to access your tenancy details, rental information, and manage your stay.`;
        case 'caretaker':
          return `You have been invited by ${inviterName} to become a caretaker for ${propertyName}. Accept this invitation to access property management features and maintenance tools.`;
        default:
          return `You have been invited by ${inviterName} to join ${propertyName}. Accept this invitation to get started.`;
      }
    } else {
      switch (this.invitationType) {
        case 'tenant':
          return 'You have been invited to become a tenant at a property. Accept this invitation to access your tenancy details and manage your rental.';
        case 'caretaker':
          return 'You have been invited to become a caretaker for a property. Accept this invitation to access property management features.';
        default:
          return 'You have been invited to join a property. Accept this invitation to get started.';
      }
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