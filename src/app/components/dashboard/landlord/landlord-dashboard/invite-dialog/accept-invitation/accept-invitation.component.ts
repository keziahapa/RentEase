// accept-invitation.component.ts
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

  constructor(
    private route: ActivatedRoute,
    public router: Router, // Changed from private to public for template access
    private invitationService: InvitationService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.userIsLoggedIn = this.authService.isLoggedIn();
    
    // Get token from URL parameters
    this.invitationToken = this.route.snapshot.paramMap.get('token');
    
    if (!this.invitationToken) {
      this.error = 'No invitation token provided. Please check your invitation link.';
      this.loading = false;
      return;
    }

    console.log('🔐 Invitation token:', this.invitationToken);
    console.log('🔐 User logged in:', this.userIsLoggedIn);

    // Store the token for use after login/registration
    sessionStorage.setItem('pendingInvitationToken', this.invitationToken);
    
    // If user is already logged in, auto-accept the invitation
    if (this.userIsLoggedIn) {
      console.log('✅ User is logged in, auto-accepting invitation...');
      this.acceptInvitation();
    } else {
      this.loading = false;
      console.log('🔐 User not logged in, showing login options');
    }

    // Load invitation details (optional)
    this.loadInvitationDetails();
  }

  loadInvitationDetails() {
    // Try to get invitation details if endpoint exists
    this.invitationService.getInvitationDetails(this.invitationToken!).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.invitationDetails = response.data;
          console.log('📧 Invitation details loaded:', this.invitationDetails);
        }
      },
      error: (error: any) => {
        // If endpoint doesn't exist, it's okay - we'll proceed with just the token
        console.log('ℹ️ Could not load invitation details, proceeding with token only');
      }
    });
  }

  acceptInvitation() {
    if (!this.invitationToken) {
      this.error = 'No invitation token found.';
      return;
    }

    // Double-check authentication
    if (!this.authService.isLoggedIn()) {
      this.error = 'Please log in first to accept this invitation.';
      this.redirectToLogin();
      return;
    }

    this.processing = true;
    this.error = null;

    console.log('✅ Accepting invitation with token:', this.invitationToken);

    // Pass the token string directly to the service
    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response: any) => {
        this.processing = false;
        this.success = true;
        console.log('🎉 Invitation accepted successfully:', response);
        
        // Clear the pending token
        sessionStorage.removeItem('pendingInvitationToken');
        
        this.snackBar.open('🎉 Invitation accepted! You are now a caretaker.', 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        // Redirect to dashboard after delay
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 3000);
      },
      error: (error: any) => {
        this.processing = false;
        console.error('❌ Error accepting invitation:', error);
        
        this.handleAcceptError(error);
      }
    });
  }

  private handleAcceptError(error: any): void {
    if (error.status === 401) {
      this.error = 'Your session has expired. Please log in again.';
      this.redirectToLogin();
    } else if (error.status === 400) {
      this.error = error.error?.message || 'Invalid invitation token. Please check the link.';
    } else if (error.status === 404) {
      this.error = 'Invitation not found or has expired.';
    } else if (error.status === 409) {
      this.error = 'This invitation has already been accepted.';
    } else if (error.status === 410) {
      this.error = 'This invitation has expired. Please request a new one.';
    } else if (error.status === 403) {
      this.error = 'You do not have permission to accept this invitation.';
    } else {
      this.error = 'An error occurred while accepting the invitation. Please try again.';
    }
  }

  private redirectToLogin(): void {
    this.router.navigate(['/login'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true
      }
    });
  }

  private redirectToRegister(): void {
    this.router.navigate(['/register'], { 
      queryParams: { 
        returnUrl: this.router.url,
        hasPendingInvitation: true
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

  // Helper method to check if user needs to authenticate
  needsAuthentication(): boolean {
    return !this.userIsLoggedIn && !this.success && !this.loading && !this.processing;
  }

  // Method to reload the page
  reloadPage(): void {
    window.location.reload();
  }
}