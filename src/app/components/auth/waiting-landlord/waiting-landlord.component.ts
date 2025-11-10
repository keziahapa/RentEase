import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-waiting-landlord',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './waiting-landlord.component.html',
  styleUrls: ['./waiting-landlord.component.scss']
})
export class WaitingLandlordComponent implements OnInit {
  email = '';
  userType = '';

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.userType = params['userType'] || '';
      
      // Redirect if user is not tenant or caretaker
      if (!this.isWaitingUser()) {
        this.router.navigate(['/login']);
      }
    });
  }

  private isWaitingUser(): boolean {
    return this.userType === 'tenant' || this.userType === 'caretaker';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  contactSupport() {
    window.location.href = 'mailto:support@rentease.com';
  }

  getRoleDisplayName(): string {
    const roleMap: { [key: string]: string } = {
      'tenant': 'Tenant',
      'caretaker': 'Caretaker'
    };
    return roleMap[this.userType] || 'User';
  }

  getRoleIcon(): string {
    const iconMap: { [key: string]: string } = {
      'tenant': 'apartment',
      'caretaker': 'build'
    };
    return iconMap[this.userType] || 'person';
  }
}