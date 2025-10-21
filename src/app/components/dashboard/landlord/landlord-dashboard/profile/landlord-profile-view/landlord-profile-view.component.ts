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
          console.log('User updated from AuthService:', user);
          console.log('Phone number from AuthService subscription:', user.phoneNumber);
          this.user = user;
          this.formattedRole = this.formatUserRole(user.role);
          this.loadProfilePictureFromApi();
        }
      })
    );

    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          console.log('Navigation detected, reloading user data');
          this.loadUserData();
        })
    );

    this.subscriptions.add(
      window.addEventListener('profileImageUpdated', () => {
        console.log('Profile image update event received');
        this.loadProfilePictureFromApi();
      })
    );
  }

  private loadUserData(): void {
    this.user = this.authService.getCurrentUser();
    console.log('Loaded user data from AuthService getCurrentUser():', this.user);
    console.log('Phone number from getCurrentUser():', this.user?.phoneNumber);
    
    if (this.user) {
      this.formattedRole = this.formatUserRole(this.user.role);
      this.loadCachedProfileImage();
      this.logPhoneNumberDetails();
    }

    this.loadUserDataFromApi();
  }

  private logPhoneNumberDetails(): void {
    console.log('=== PHONE NUMBER DETAILS ===');
    console.log('User object:', this.user);
    console.log('Phone number property:', this.user?.phoneNumber);
    console.log('Phone number type:', typeof this.user?.phoneNumber);
    console.log('Phone number length:', this.user?.phoneNumber?.length);
    console.log('All user properties:', Object.keys(this.user || {}));
    console.log('=== END PHONE NUMBER DETAILS ===');
  }

  private loadUserDataFromApi(): void {
    this.isLoadingUserData = true;
    
    this.propertyService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        this.isLoadingUserData = false;
        if (response.success && response.user) {
          console.log('User data loaded from API:', response.user);
          console.log('Phone number from API:', response.user.phoneNumber);
          
          this.user = response.user;
          this.formattedRole = this.formatUserRole(response.user.role);
          
          this.updateLocalUserData(response.user);
          
          this.loadProfilePictureFromApi();
          
          this.logPhoneNumberDetails();
        } else {
          console.warn('No user data received from API:', response.message);
          this.snackBar.open('Failed to load profile data', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isLoadingUserData = false;
        console.error('Error loading user data from API:', error);
        this.snackBar.open('Error loading profile data', 'Close', { duration: 3000 });
        
        if (!this.user) {
          this.user = this.authService.getCurrentUser();
          if (this.user) {
            this.formattedRole = this.formatUserRole(this.user.role);
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
        const sessionStorageUser = sessionStorage.getItem('userData');
        
        const isPermanent = !!localStorageUser;
        
        if (isPermanent) {
          localStorage.setItem('userData', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('userData', JSON.stringify(userData));
        }
        
        console.log('User data updated in', isPermanent ? 'localStorage' : 'sessionStorage');
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
          
          this.profileImage = cacheBustedUrl;
          localStorage.setItem('profileImage', cacheBustedUrl);
          console.log('Profile picture loaded from API:', cacheBustedUrl);
        } else {
          this.loadCachedProfileImage();
          console.log('No profile picture from API, using fallback');
        }
      },
      error: (error: any) => {
        this.isLoadingProfilePicture = false;
        console.error('Error loading profile picture from API:', error);
        this.loadCachedProfileImage();
      }
    });
  }

  private loadCachedProfileImage(): void {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
      this.profileImage = savedImage;
      console.log('Profile picture loaded from cache');
    } else if (this.user?.avatar) {
      this.profileImage = this.user.avatar;
      console.log('Profile picture loaded from user avatar');
    } else {
      this.profileImage = this.generateInitialAvatar(this.getUserFullName());
      console.log('Profile picture generated as initial avatar');
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
    console.log('Getting phone number for display:', this.user?.phoneNumber);
    
    const phoneNumber = this.user?.phoneNumber || 
                       this.user?.phone || 
                       this.user?.phone_number ||
                       this.user?.mobile ||
                       this.user?.contactNumber;
    
    console.log('Final phone number to display:', phoneNumber);
    
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
    this.router.navigate(['/landlord-dashboard/home']);
  }

  refreshProfile(): void {
    console.log('Manually refreshing profile data');
    this.loadUserDataFromApi();
  }

  debugUserData(): void {
    console.log('=== DEBUG USER DATA ===');
    console.log('Full user object:', this.user);
    console.log('User keys:', Object.keys(this.user || {}));
    console.log('Phone number:', this.user?.phoneNumber);
    console.log('All storage data:');
    console.log('localStorage userData:', localStorage.getItem('userData'));
    console.log('sessionStorage userData:', sessionStorage.getItem('userData'));
    console.log('=== END DEBUG ===');
  }
}