import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../../../services/auth.service';
import { PropertyService } from '../../../../../../services/property.service';

@Component({
  selector: 'app-landlord-profile-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './landlord-profile-view.component.html',
  styleUrls: ['./landlord-profile-view.component.scss']
})
export class LandlordProfileViewComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private propertyService = inject(PropertyService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  user: any = null;
  profileImage: string | null = null;
  formattedRole: string = 'User';
  isLoadingProfilePicture = false;
  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.loadUserData();
    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private subscribeToUpdates(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.user = user;
          this.formattedRole = this.formatUserRole(user.role);
          this.loadProfilePictureFromApi();
        }
      })
    );

    this.subscriptions.add(
      window.addEventListener('profileImageUpdated', () => {
        this.loadProfilePictureFromApi();
      })
    );
  }

  private loadUserData(): void {
    this.user = this.authService.getCurrentUser();
    
    if (this.user) {
      this.formattedRole = this.formatUserRole(this.user.role);
      this.loadCachedProfileImage();
    } else {
      this.loadUserDataFromApi();
    }

    this.loadUserDataFromApi();
  }

  private loadUserDataFromApi(): void {
    this.propertyService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        if (response.success && response.user) {
          this.user = response.user;
          this.formattedRole = this.formatUserRole(response.user.role);
          this.updateLocalUserData(response.user);
          this.loadProfilePictureFromApi();
        }
      },
      error: (error: any) => {
        if (!this.user) {
          this.user = this.authService.getCurrentUser();
          if (this.user) {
            this.formattedRole = this.formatUserRole(this.user.role);
          } else {
            this.snackBar.open('Failed to load user data', 'Close', { duration: 3000 });
          }
        }
      }
    });
  }

  private updateLocalUserData(userData: any): void {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const localStorageUser = localStorage.getItem('userData');
        const isPermanent = !!localStorageUser;
        
        if (isPermanent) {
          localStorage.setItem('userData', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('userData', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error('Error updating local user data:', error);
    }
  }

  private loadProfilePictureFromApi(): void {
    this.isLoadingProfilePicture = true;
    
    this.propertyService.getProfilePicture().subscribe({
      next: (response: any) => {
        this.isLoadingProfilePicture = false;
        if (response.success && response.pictureUrl) {
          const timestamp = new Date().getTime();
          const cacheBustedUrl = response.pictureUrl.includes('?') 
            ? `${response.pictureUrl}&t=${timestamp}`
            : `${response.pictureUrl}?t=${timestamp}`;
          
          this.preloadImage(cacheBustedUrl).then(() => {
            this.profileImage = cacheBustedUrl;
            localStorage.setItem('profileImage', cacheBustedUrl);
          }).catch(() => {
            this.loadCachedProfileImage();
          });
        } else {
          this.loadCachedProfileImage();
        }
      },
      error: (error: any) => {
        this.isLoadingProfilePicture = false;
        this.loadCachedProfileImage();
      }
    });
  }

  private loadCachedProfileImage(): void {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
      this.profileImage = savedImage;
    } else if (this.user?.avatar) {
      this.profileImage = this.user.avatar;
    } else {
      this.profileImage = this.generateInitialAvatar(this.getUserFullName());
    }
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
  }

  generateInitialAvatar(name: string): string {
    const names = name.split(' ');
    const initials = names.map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2);
    
    const colors = ['#1e40af', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  }

  handleImageError(): void {
    this.profileImage = this.generateInitialAvatar(this.getUserFullName());
  }

  private formatUserRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner',
      'ADMIN': 'Administrator'
    };
    
    return roleMap[role.toString()] || role.toString();
  }

  getUserFullName(): string {
    return this.user?.fullName || 'User';
  }

  getUserEmail(): string {
    return this.user?.email || 'No email provided';
  }

  getUserPhone(): string {
    const phoneNumber = this.authService.getPhoneNumber() || 
                       this.user?.phoneNumber || 
                       this.user?.phone || 
                       this.user?.phone_number ||
                       this.user?.mobile ||
                       this.user?.contactNumber;
    
    if (phoneNumber && phoneNumber.trim() !== '') {
      return phoneNumber;
    }
    
    return 'Not provided';
  }

  getEmailVerificationStatus(): string {
    return this.user?.emailVerified ? 'Verified' : 'Not Verified';
  }

  getAccountStatus(): string {
    return this.user?.verified ? 'Active' : 'Inactive';
  }

  getMemberSince(): string {
    if (this.user?.createdAt) {
      return new Date(this.user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return 'Unknown';
  }

  editProfile(): void {
    this.router.navigate(['/landlord-dashboard/profile/edit']);
  }

  goBack(): void {
    this.router.navigate(['/landlord-dashboard']);
  }
}