import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TenantService } from '../../services/tenant.service';
import { CaretakerService } from '../../services/caretaker.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private tenantService = inject(TenantService);
  private caretakerService = inject(CaretakerService);
  private authService = inject(AuthService);

  isLoading = false;
  userRole: string = '';
  userName: string = '';
  private checkInterval: any;

  ngOnInit() {
    this.getUserInfo();
    this.checkPropertyAccess();
    
    this.checkInterval = setInterval(() => {
      this.checkPropertyAccess();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  getUserInfo() {
    this.authService.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.userRole = user.role || 'user';
          this.userName = user.fullName || 'User';
        } else {
          this.userRole = 'user';
          this.userName = 'User';
        }
      },
      error: () => {
        this.userRole = 'user';
        this.userName = 'User';
      }
    });
  }

  checkPropertyAccess() {
    this.isLoading = true;
    
    if (this.userRole === 'tenant') {
      this.checkTenantAccess();
    } else if (this.userRole === 'caretaker') {
      this.checkCaretakerAccess();
    } else {
      this.isLoading = false;
    }
  }

  checkTenantAccess() {
    this.tenantService.getTenantUnits().subscribe({
      next: (unitsResponse) => {
        this.isLoading = false;
        const units = Array.isArray(unitsResponse?.data) ? unitsResponse.data : [];
        if (units.length > 0) {
          this.router.navigate(['/tenant-dashboard/dashboard']);
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  checkCaretakerAccess() {
    this.caretakerService.getProperties().subscribe({
      next: (properties) => {
        this.isLoading = false;
        if (properties && properties.length > 0) {
          this.router.navigate(['/caretaker-dashboard/overview']);
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  manualCheck() {
    this.checkPropertyAccess();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}