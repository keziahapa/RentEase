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
    console.log('🔄 AcceptInvitationComponent initialized');
    console.log('🛣️ Current URL:', this.router.url);
    
    this.userIsLoggedIn = this.authService.isLoggedIn();
    
    // Extract token from multiple possible sources
    this.invitationToken = this.extractTokenFromMultipleSources();
    
    console.log('🔑 Extracted token:', this.invitationToken);
    console.log('👤 User logged in:', this.userIsLoggedIn);

    if (!this.invitationToken) {
      this.error = 'No valid invitation token found. Please check your invitation link.';
      this.loading = false;
      return;
    }

    sessionStorage.setItem('pendingInvitationToken', this.invitationToken);
    this.loadInvitationDetails();
  }

  private extractTokenFromMultipleSources(): string | null {
    console.log('🔍 Searching for token in different sources...');
    
    // 1. Try route parameters (for /accept-invitation/:token)
    const routeToken = this.route.snapshot.paramMap.get('token');
    if (routeToken) {
      console.log('✅ Found token in route parameters');
      return routeToken;
    }

    // 2. Try query parameters (for /accept-invitation?token=abc123)
    const queryParams = this.route.snapshot.queryParams;
    console.log('🔍 Query parameters:', queryParams);
    
    const queryToken = queryParams['token'];
    if (queryToken) {
      console.log('✅ Found token in query parameters:', queryToken);
      
      // Handle malformed backend URLs
      if (queryToken.includes('/accept-invitation?') || queryToken.includes('%2Faccept-invitation%3F')) {
        console.log('🔄 Processing malformed URL format');
        return this.extractTokenFromMalformedUrl(queryToken);
      }
      return queryToken;
    }

    // 3. Try URL fragment
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      console.log('🔍 URL fragment:', fragment);
      const match = fragment.match(/token=([^&]+)/);
      if (match) {
        console.log('✅ Found token in URL fragment');
        return match[1];
      }
    }

    // 4. Try to extract from current URL
    const currentUrl = this.router.url;
    console.log('🔍 Current router URL:', currentUrl);
    
    // Check if token is in the path
    const pathMatch = currentUrl.match(/\/accept-invitation\/([^/?]+)/);
    if (pathMatch) {
      console.log('✅ Found token in URL path');
      return pathMatch[1];
    }

    // Check if token is in query string of current URL
    const queryMatch = currentUrl.match(/[?&]token=([^&]+)/);
    if (queryMatch) {
      console.log('✅ Found token in URL query string');
      return queryMatch[1];
    }

    console.log('❌ No token found in any source');
    return null;
  }

  private extractTokenFromMalformedUrl(malformedToken: string): string | null {
    try {
      console.log('🔄 Processing malformed token:', malformedToken);
      
      // Handle double-encoded format: %2Faccept-invitation%3Ftoken%3Dabc123
      if (malformedToken.includes('%2F') || malformedToken.includes('%3F')) {
        const decoded = decodeURIComponent(malformedToken);
        console.log('🔓 Decoded token:', decoded);
        
        const match = decoded.match(/\/accept-invitation\?token=([^&]+)/);
        if (match) {
          console.log('✅ Extracted token from decoded URL');
          return match[1];
        }
      }
      
      // Handle format: /accept-invitation?token=abc123
      const match = malformedToken.match(/\/accept-invitation\?token=([^&]+)/);
      if (match) {
        console.log('✅ Extracted token from malformed format');
        return match[1];
      }
      
      // If it's just the token without the path prefix
      if (malformedToken.length === 32 || malformedToken.length === 36) { // Common token lengths
        console.log('✅ Using token directly (looks like a valid token)');
        return malformedToken;
      }
      
    } catch (error) {
      console.error('❌ Error processing malformed token:', error);
    }
    
    return null;
  }

  loadInvitationDetails() {
    if (!this.invitationToken) {
      this.loading = false;
      return;
    }

    console.log('📡 Loading invitation details for token:', this.invitationToken);

    this.invitationService.getInvitationDetails(this.invitationToken).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('✅ Invitation details response:', response);
        
        if (response.success && response.data) {
          this.invitationDetails = response.data;
          this.invitationType = this.safeDetermineInvitationType();
          console.log('📋 Invitation details loaded:', this.invitationDetails);
          console.log('🎯 Invitation type:', this.invitationType);
          
          if (this.userIsLoggedIn) {
            console.log('🚀 User is logged in, auto-accepting invitation...');
            this.acceptInvitationAndRedirect();
          }
        } else {
          this.error = response.message || 'Invalid invitation response. Please check your invitation link.';
          console.error('❌ Invalid invitation response:', response);
        }
      },
      error: (error: any) => {
        this.loading = false;
        console.error('❌ Error loading invitation details:', error);
        
        // Even if details fail, we can still try to accept with just the token
        console.log('ℹ️ Could not load invitation details, proceeding with token only');
        this.invitationType = this.guessInvitationType();
        
        if (this.userIsLoggedIn && this.invitationToken) {
          console.log('🔄 Attempting to accept invitation with token only...');
          this.acceptInvitationAndRedirect();
        } else {
          this.error = 'Failed to load invitation details. Please try again.';
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
    
    // Default to tenant if we can't determine
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

    console.log('🎯 Accepting invitation with token:', this.invitationToken);
    console.log('📝 Invitation type:', this.invitationType);

    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response: any) => {
        this.processing = false;
        this.success = true;
        console.log('✅ Invitation accepted successfully:', response);
    
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
        console.error('❌ Error accepting invitation:', error);
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
    
    console.log('🔄 Redirecting to dashboard:', dashboardRoute);
    
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

  private handleAcceptError(error: any): void {
    console.error('❌ Invitation acceptance error:', error);
    
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

  // Public methods for template
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
    return this.invitationType === 'tenant' ? 'Tenancy Invitation' : 
           this.invitationType === 'caretaker' ? 'Caretaker Invitation' : 'Property Invitation';
  }

  getRoleName(): string {
    return this.invitationType === 'tenant' ? 'Tenant' : 
           this.invitationType === 'caretaker' ? 'Caretaker' : 'Member';
  }

  getDescription(): string {
    if (this.invitationDetails) {
      const propertyName = this.invitationDetails.propertyName || 'the property';
      const inviterName = this.invitationDetails.inviterName || 'the property owner';
      
      if (this.invitationType === 'tenant') {
        return `You have been invited by ${inviterName} to become a tenant at ${propertyName}. Accept this invitation to access your tenancy details, rental information, and manage your stay.`;
      } else if (this.invitationType === 'caretaker') {
        return `You have been invited by ${inviterName} to become a caretaker for ${propertyName}. Accept this invitation to access property management features and maintenance tools.`;
      }
    }
    
    return this.invitationType === 'tenant' 
      ? 'You have been invited to become a tenant at a property. Accept this invitation to access your tenancy details and manage your rental.'
      : 'You have been invited to become a caretaker for a property. Accept this invitation to access property management features.';
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