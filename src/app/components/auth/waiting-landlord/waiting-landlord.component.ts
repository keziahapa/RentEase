import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waiting-landlord',
  templateUrl: './waiting-landlord.component.html',
  styleUrls: ['./waiting-landlord.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class WaitingLandlordComponent {
  private router = inject(Router);

  logout() {
    sessionStorage.removeItem('pendingUser');
    sessionStorage.removeItem('pendingPhoneNumber');
    sessionStorage.removeItem('pendingVerificationEmail');
    this.router.navigate(['/login']);
  }
}