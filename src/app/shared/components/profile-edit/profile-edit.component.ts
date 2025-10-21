import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ProfilePictureService } from '../../../services/profile-picture.service';

@Component({
  selector: 'app-profile-view',
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
  templateUrl: './profile-view.component.html',
  styleUrls: ['./profile-view.component.scss']
})
export class ProfileViewComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private profilePictureService = inject(ProfilePictureService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  user: any = null;
  profileImage: string | null = null;
  isLoadingProfilePicture = false;
  isLoadingUserData = false;
  private subscriptions = new Subscription();

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['refreshProfile']) {
      this.loadUserDataFromApi();
    }
  }

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
          this.loadProfilePictureFromApi();
        }
      })
    );

    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.loadUserData();
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
      this.loadCachedProfileImage();
    }

    this.loadUserDataFromApi();
  }

  private loadUserDataFromApi(): void {
    this.isLoadingUserData = true;
    
    this.profilePictureService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        this.isLoadingUserData = false;
        if (response.success && response.user) {
          this.user = response.user;
          this.updateLocalUserData(response.user);
          this.loadProfilePictureFromApi();
        } else {
          this.snackBar.open('Failed to load profile data', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isLoadingUserData = false;
        this.snackBar.open('Error loading profile data', 'Close', { duration: 3000 });
        
        if (!this.user) {
          this.user = this.authService.getCurrentUser();
        }
      }
    });
  }

  private updateLocalUserData(userData: any): void {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const localStorageUser = localStorage.getItem('userData');
        const sessionStorageUser = sessionStorage.getItem('userData');
        
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
    
    this.profilePictureService.getProfilePicture().subscribe({
      next: (response: any) => {
        this.isLoadingProfilePicture = false;
        if (response.success && response.pictureUrl) {
          const timestamp = new Date().getTime();
          const cacheBustedUrl = response.pictureUrl.includes('?') 
            ? `${response.pictureUrl}&t=${timestamp}`
            : `${response.pictureUrl}?t=${timestamp}`;
          
          this.profileImage = cacheBustedUrl;
          localStorage.setItem('profileImage', cacheBustedUrl);
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

  generateInitialAvatar(name: string): string {
    const names = name.split(' ');
    const initials = names.map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2);
    
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="40" font-weight="bold">${initials}</text>
      </svg>
    `)}`;
  }

  getInitials(): string {
    if (!this.user?.fullName) return '?';
    
    const names = this.user.fullName.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }

  isDefaultAvatar(): boolean {
    return !this.profileImage || this.profileImage.includes('svg+xml');
  }

  onImageError(): void {
    this.profileImage = this.generateInitialAvatar(this.getUserFullName());
  }

  getUserFullName(): string {
    return this.user?.fullName || 'User';
  }

  getUserEmail(): string {
    return this.user?.email || 'No email provided';
  }

  getUserPhone(): string {
    const phoneNumber = this.user?.phoneNumber || 
                       this.user?.phone || 
                       this.user?.phone_number ||
                       this.user?.mobile ||
                       this.user?.contactNumber;
    
    if (phoneNumber && phoneNumber.trim() !== '') {
      return phoneNumber;
    }
    
    return 'Not provided';
  }

  getRoleDisplay(): string {
    const roleMap: { [key: string]: string } = {
      'landlord': 'Landlord',
      'tenant': 'Tenant',
      'caretaker': 'Caretaker',
      'admin': 'Administrator',
      'business': 'Business',
      'user': 'User'
    };
    
    const role = this.user?.role?.toLowerCase() || 'user';
    return roleMap[role] || 'User';
  }

  getRoleColor(): string {
    const colorMap: { [key: string]: string } = {
      'landlord': '#ff6b35',
      'tenant': '#4CAF50',
      'caretaker': '#2196F3',
      'admin': '#9C27B0',
      'business': '#FF9800',
      'user': '#666'
    };
    
    const role = this.user?.role?.toLowerCase() || 'user';
    return colorMap[role] || '#666';
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

  getFormattedBio(bio: string): string {
    if (!bio) return 'No bio provided yet. Tell us about yourself!';
    return bio;
  }

  editProfile(): void {
    this.router.navigate(['/dashboard/profile/edit']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/home']);
  }
}