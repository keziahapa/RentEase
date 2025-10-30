import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { InvitationService } from '../../../../../../services/invitation.service';
import { AuthService } from '../../../../../../services/auth.service';

@Component({
  selector: 'app-accept-invitation',
  templateUrl: './accept-invitation.component.html',
  styleUrls: ['./accept-invitation.component.scss'],
  imports: [CommonModule]
})
export class AcceptInvitationComponent implements OnInit {
  invitationToken: string | null = null;
  loading = false;
  processing = false;
  error: string | null = null;
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invitationService: InvitationService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.invitationToken = this.route.snapshot.paramMap.get('token');
    
    if (this.invitationToken) {
      // We don't have validation endpoint, so just show the acceptance form
      this.loading = false;
    } else {
      this.error = 'No invitation token provided. Please check your invitation link.';
      this.loading = false;
    }
  }

  acceptInvitation() {
    if (!this.invitationToken) return;

    this.processing = true;
    this.error = null;

    this.invitationService.acceptInvitation(this.invitationToken).subscribe({
      next: (response) => {
        this.processing = false;
        this.success = true;
        
        // Redirect after 3 seconds
        setTimeout(() => {
          if (this.authService.isLoggedIn()) {
            this.router.navigate(['/dashboard']);
          } else {
            this.router.navigate(['/login']);
          }
        }, 3000);
      },
      error: (error) => {
        this.processing = false;
        if (error.status === 400) {
          this.error = error.error?.message || 'Failed to accept invitation.';
        } else if (error.status === 409) {
          this.error = 'This invitation has already been accepted.';
        } else {
          this.error = 'An error occurred while accepting the invitation. Please try again.';
        }
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }
}