import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { InvitationService } from '../../../../../../services/invitation.service';
import { AuthService } from '../../../../../../services/auth.service';
import { InvitationDetails } from '../../../../../../services/invitation-interfaces';

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
    MatIconModule
  ]
})
export class AcceptInvitationComponent implements OnInit {
  invitationToken: string | null = null;
  loading = true;
  processing = false;
  error: string | null = null;
  success = false;
  userIsLoggedIn = false;
  invitationDetails: InvitationDetails | null = null;
  invitationType: 'tenant' | 'caretaker' | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private invitationService: InvitationService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.userIsLoggedIn = this.authService.isLoggedIn();
    
    // ✅ FIXED: Use queryParamMap instead of paramMap for query parameters
    this.invitationToken = this.route.snapshot.queryParamMap.get('token');
    
    if (!this.invitationToken) {
      this.error = 'No invitation token provided. Please check your invitation link.';
      this.loading = false;
      return;
    }

    console.log('Invitation token:', this.invitationToken);
    console.log('User logged in:', this.userIsLoggedIn);

    sessionStorage.setItem('pendingInvitationToken', this.invitationToken);
    
    this.loadInvitationDetails();
  }

  loadInvitationDetails() {
    if (!this.invitationToken) {
      this.loading = false;
      return;
    }

    this.invitationService.getInvitationDetails(this.invitationToken).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success && response.data) {
          this.invitationDetails = response.data;
          this.invitationType = this.safeDetermineInvitationType();
          console.log('Invitation details loaded:', this.invitationDetails);
          console.log('Invitation type:', this.invitationType);
          
          if (this.userIsLoggedIn) {
            console.log('User is logged in, auto-accepting invitation...');
            this.acceptInvitationAndRedirect();
          }
        } else {
          this.error = 'Invalid invitation response. Please check your invitation link.';
        }
      },
      error: (error: any) => {
        this.loading = false;
        console.log('Could not load invitation details, proceeding with token only');
        this.invitationType = this.guessInvitationType();
        
        if (this.userIsLoggedIn && this.invitationToken) {
          console.log('Attempting to accept invitation with token only...');
          this.acceptInvitationAndRedirect();
        }
      }
    });
  }

  private safeDetermineInvitationType(): 'tenant' | 'caretaker' {
    if (!this.invitationDetails) {
      return this.guessInvitationType();
    }

    if (this.invitationDetails.inviteeRole?.toLowerCase().includes('tenant') || 
        this.invitationDetails.role?.toLowerCase().includes('tenant')) {
      return 'tenant';
    } else if (this.invitationDetails.inviteeRole?.toLowerCase().includes('caretaker') || 
               this.invitationDetails.role?.toLowerCase().includes('caretaker')) {
      return 'caretaker';
    } else if (this.invitationDetails.unitNumber) {
      return 'tenant'; 
    } else {
      return 'caretaker'; 
    }
  }

  private guessInvitationType(): 'tenant' | 'caretaker' {
    const url = this.router.url.toLowerCase();
    if (url.includes('tenant')) return 'tenant';
    if (url.includes('caretaker')) return 'caretaker';
    return 'tenant';
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

    this.processing = true;
    this.error = null;

    console.log('Accepting invitation with token:', this.invitationToken);
    console.log('Invitation type:', this.invitationType);

    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response: any) => {
        this.processing = false;
        this.success = true;
        console.log('Invitation accepted successfully:', response);
    
        sessionStorage.removeItem('pendingInvitationToken');
        
        const successMessage = this.getSuccessMessage();
        this.snackBar.open(successMessage, 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        this.redirectToDashboard();
      },
      error: (error: any) => {
        this.processing = false;
        console.error('Error accepting invitation:', error);
        this.handleAcceptError(error);
      }
    });
  }

  private redirectToDashboard(): void {
    let dashboardRoute = '/dashboard';
   
    if (this.invitationType === 'tenant') {
      dashboardRoute = '/tenant-dashboard';
    } else if (this.invitationType === 'caretaker') {
      dashboardRoute = '/caretaker-dashboard';
    }
    
    setTimeout(() => {
      this.router.navigate([dashboardRoute]);
    }, 2000);
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

  private handleAcceptError(error: any): void {
    if (error.status === 401) {
      this.error = 'Your session has expired. Please log in again to accept this invitation.';
      this.redirectToLogin();
    } else if (error.status === 400) {
      this.error = error.error?.message || 'Invalid invitation token. Please check the link and try again.';
    } else if (error.status === 404) {
      this.error = 'Invitation not found or has been cancelled. Please contact the property owner for a new invitation.';
    } else if (error.status === 409) {
      this.error = 'This invitation has already been accepted. Redirecting you to the dashboard...';
    
      setTimeout(() => {
        this.redirectToDashboard();
      }, 3000);
    } else if (error.status === 410) {
      this.error = 'This invitation has expired. Please request a new invitation from the property owner.';
    } else if (error.status === 403) {
      this.error = 'You do not have permission to accept this invitation. Please contact the property owner.';
    } else if (error.status === 0) {
      this.error = 'Unable to connect to the server. Please check your internet connection and try again.';
    } else {
      this.error = error.error?.message || 'An unexpected error occurred while accepting the invitation. Please try again.';
    }
  }

  private redirectToLogin(): void {
    this.router.navigate(['/login'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true,
        invitationType: this.invitationType
      }
    });
  }

  private redirectToRegister(): void {
    this.router.navigate(['/register'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true,
        invitationType: this.invitationType
      }
    });
  }

  navigateToLogin(): void {
    this.redirectToLogin();
  }

  navigateToRegister(): void {
    this.redirectToRegister();
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  needsAuthentication(): boolean {
    return !this.userIsLoggedIn && !this.success && !this.loading && !this.processing;
  }
  
  retryAcceptance(): void {
    this.userIsLoggedIn = this.authService.isLoggedIn();
    if (this.userIsLoggedIn) {
      this.acceptInvitationAndRedirect();
    } else {
      this.redirectToLogin();
    }
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
}