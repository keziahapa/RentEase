import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InvitationService } from '../../../../services/invitation.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-tenant-pending-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './tenant-pending-dashboard.component.html',
  styleUrls: ['./tenant-pending-dashboard.component.scss']
})
export class TenantPendingDashboardComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private invitationService = inject(InvitationService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  currentUser: any;
  invitations: any[] = [];
  isLoading = true;
  hasPendingInvitations = false;

  ngOnInit(): void {
    this.loadUserData();
    this.loadInvitations();
  }

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  private loadInvitations(): void {
    this.isLoading = true;
    
    this.invitationService.getReceivedInvitations().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success && response.data) {
          this.invitations = response.data;
          this.hasPendingInvitations = this.invitations.some(
            (inv: any) => inv.status?.toUpperCase() === 'PENDING'
          );
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Error loading invitations:', error);
      }
    });
  }

  acceptInvitation(invitation: any): void {
    this.invitationService.acceptInvitation(invitation.token).subscribe({
      next: (response: any) => {
        this.snackBar.open('Invitation accepted! Redirecting...', 'Close', { duration: 3000 });
        
        setTimeout(() => {
          this.router.navigate(['/tenant-dashboard']);
        }, 2000);
      },
      error: (error: any) => {
        this.snackBar.open('Failed to accept invitation. Please try again.', 'Close', { duration: 5000 });
        console.error('Error accepting invitation:', error);
      }
    });
  }

  navigateToProfile(): void {
    this.router.navigate(['/tenant-dashboard/profile/edit']);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}