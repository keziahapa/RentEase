import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { PropertyService } from '../../../../../../services/property.service';
import { AuthService } from '../../../../../../services/auth.service';

@Component({
  selector: 'app-landlord-profile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatExpansionModule,
    MatTabsModule
  ],
  templateUrl: './landlord-profile-edit.component.html',
  styleUrls: ['./landlord-profile-edit.component.scss']
})
export class LandlordProfileEditComponent implements OnInit, OnDestroy {
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  user: any = null;
  profileImage: string | null = null;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  isSubmitting = false;
  isChangingPassword = false;
  isUploadingPhoto = false;
  isDeletingPhoto = false;
  showAvatarDialog = false;
  showPasswordDialog = false;
  selectedTab = 0;
  
  originalPhoneNumber: string = '';
  currentPhoneNumber: string = '';

  constructor() {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
  }

  ngOnInit(): void {
    this.debugAuthState();
    this.loadUserData();
  }

  ngOnDestroy(): void {}

  private debugAuthState(): void {
    console.log('=== AUTH SERVICE DEBUG INFO ===');
    console.log('Is authenticated:', this.authService.isAuthenticated());
    console.log('Is logged in:', this.authService.isLoggedIn());
    
    const token = this.authService.getToken();
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length);
    
    const currentUser = this.authService.getCurrentUser();
    console.log('Current user from service:', currentUser);
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const localStorageUser = localStorage.getItem('userData');
        const sessionStorageUser = sessionStorage.getItem('userData');
        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        
        console.log('LocalStorage userData:', localStorageUser);
        console.log('SessionStorage userData:', sessionStorageUser);
        console.log('Auth token from storage:', authToken);
        
        if (localStorageUser) {
          console.log('Parsed localStorage user:', JSON.parse(localStorageUser));
        }
        if (sessionStorageUser) {
          console.log('Parsed sessionStorage user:', JSON.parse(sessionStorageUser));
        }
      } catch (error) {
        console.error('Error reading storage:', error);
      }
    }
    
    console.log('=== END DEBUG INFO ===');
  }

  onTabChange(event: any): void {
    this.selectedTab = event.index;
  }

  openAvatarDialog(): void {
    this.showAvatarDialog = true;
  }

  closeAvatarDialog(): void {
    this.showAvatarDialog = false;
  }

  openPasswordDialog(): void {
    this.showPasswordDialog = true;
  }

  closePasswordDialog(): void {
    this.showPasswordDialog = false;
    this.passwordForm.reset();
  }

  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    
    console.log('Loading user data - User:', currentUser);
    console.log('Loading user data - Token:', token);
    
    if (!currentUser || !token) {
      console.error('No user data or token found');
      this.snackBar.open('Please log in to continue', 'Close', { duration: 3000 });
      this.router.navigate(['/login']);
      return;
    }

    this.originalPhoneNumber = this.extractPhoneNumber(currentUser);
    this.currentPhoneNumber = this.originalPhoneNumber;
    
    console.log('Extracted phone number:', this.originalPhoneNumber);
    console.log('Full user object:', currentUser);
    
    this.user = currentUser;
    this.populateForm();
    this.loadProfilePicture();
  }

  private extractPhoneNumber(user: any): string {
    if (!user) return '';
    
    const possiblePhoneProperties = [
      'phoneNumber',
      'phone',
      'phone_number',
      'mobile',
      'mobileNumber',
      'contactNumber'
    ];
    
    for (const prop of possiblePhoneProperties) {
      if (user[prop]) {
        console.log(`Found phone number in property '${prop}':`, user[prop]);
        return user[prop];
      }
    }
    
    if (user.profile?.phoneNumber) return user.profile.phoneNumber;
    if (user.profile?.phone) return user.profile.phone;
    if (user.user?.phoneNumber) return user.user.phoneNumber;
    if (user.user?.phone) return user.user.phone;
    
    console.log('No phone number found in user object');
    return '';
  }

  private loadProfilePicture(): void {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
      console.log('Loaded profile image from localStorage');
      this.profileImage = savedImage;
      return;
    }

    const avatarSources = ['avatar', 'profilePicture', 'picture', 'image', 'photo'];
    for (const source of avatarSources) {
      if (this.user[source]) {
        console.log(`Found profile image in property '${source}':`, this.user[source]);
        this.profileImage = this.user[source];
        localStorage.setItem('profileImage', this.user[source]);
        return;
      }
    }

    console.log('Generating initial avatar');
    this.profileImage = this.generateInitialAvatar(this.user?.fullName || this.user?.name || 'User');
    
    this.loadProfilePictureFromApi();
  }

  private loadProfilePictureFromApi(): void {
    console.log('Attempting to load profile picture from API');
    this.propertyService.getProfilePicture().subscribe({
      next: (response: any) => {
        console.log('Profile picture API response:', response);
        
        const imageUrl = response.data || response.pictureUrl || response.avatar || response.url;
        
        if (response.success && imageUrl) {
          console.log('Profile picture loaded from API:', imageUrl);
          this.preloadImage(imageUrl).then(() => {
            this.profileImage = imageUrl;
            localStorage.setItem('profileImage', imageUrl);
            this.updateProfileImageEvent(imageUrl);
          }).catch(() => {
            console.log('Failed to preload image from API');
          });
        } else {
          console.log('No profile picture found in API response');
        }
      },
      error: (error: any) => {
        console.log('Profile picture API call failed:', error);
      }
    });
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
  }

  private updateProfileImageEvent(imageUrl: string): void {
    window.dispatchEvent(new CustomEvent('profileImageUpdated', { 
      detail: { imageUrl } 
    }));
  }

  private generateInitialAvatar(name: string): string {
    const names = name.split(' ');
    const initials = names.map(n => n.charAt(0).toUpperCase()).join('').slice(0, 2);
    
    const colors = ['#1e40af', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  }

  private createProfileForm(): FormGroup {
    return this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [
        Validators.required,
        Validators.pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/),
        Validators.minLength(10)
      ]],
      bio: ['', [Validators.maxLength(500)]]
    });
  }

  private createPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmNewPassword = control.get('confirmNewPassword');
    
    if (!newPassword || !confirmNewPassword) {
      return null;
    }
    
    return newPassword.value === confirmNewPassword.value ? null : { passwordMismatch: true };
  }

  private populateForm(): void {
    if (this.user) {
      console.log('Populating form with user data:', this.user);
      
      const fullName = this.user.fullName || this.user.name || this.user.username || '';
      const bio = this.user.bio || this.user.description || this.user.about || '';
      const email = this.user.email || this.user.emailAddress || '';
      
      console.log('Extracted form data:', { fullName, email, phoneNumber: this.currentPhoneNumber, bio });
      
      this.profileForm.patchValue({
        fullName: fullName,
        email: email,
        phoneNumber: this.currentPhoneNumber,
        bio: bio
      });

      console.log('Form values after population:', this.profileForm.value);
      console.log('Form valid:', this.profileForm.valid);
      
    } else {
      console.error('No user data available to populate form');
      this.snackBar.open('Failed to load user data', 'Close', { duration: 3000 });
    }
  }

  changePhoto(): void {
    this.closeAvatarDialog();
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/jpg,image/png,image/webp';
    fileInput.onchange = (event: any) => this.handleImageUpload(event);
    fileInput.click();
  }

  private handleImageUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.snackBar.open('Please select a valid image file (JPEG, PNG, WebP)', 'Close', { duration: 3000 });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.snackBar.open('Image size must be less than 10MB', 'Close', { duration: 3000 });
      return;
    }

    this.isUploadingPhoto = true;

    const uploadMethod = this.isDefaultAvatar() 
      ? this.propertyService.uploadProfilePicture(file)
      : this.propertyService.updateProfilePicture(file);

    uploadMethod.subscribe({
      next: (response: any) => {
        this.isUploadingPhoto = false;
        
        const imageUrl = response.data || response.pictureUrl || response.avatar;
        
        if (response.success && imageUrl) {
          this.snackBar.open('Profile photo updated successfully', 'Close', { duration: 2000 });
          
          this.profileImage = imageUrl;
          localStorage.setItem('profileImage', imageUrl);
          this.updateProfileImageEvent(imageUrl);
          
        } else {
          this.snackBar.open(response.message || 'Failed to upload photo', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isUploadingPhoto = false;
        console.error('Upload error:', error);
        this.snackBar.open('Failed to upload profile photo', 'Close', { duration: 3000 });
      }
    });
  }

  deletePhoto(): void {
    this.closeAvatarDialog();
    
    if (this.isDeletingPhoto) return;

    if (!confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    this.isDeletingPhoto = true;

    this.propertyService.deleteProfilePicture().subscribe({
      next: (response: any) => {
        this.isDeletingPhoto = false;
        if (response.success) {
          const newAvatar = this.generateInitialAvatar(this.user?.fullName || 'User');
          this.profileImage = newAvatar;
          localStorage.removeItem('profileImage');
          this.updateProfileImageEvent(newAvatar);
          
          this.snackBar.open('Profile photo removed', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open(response.message || 'Failed to remove photo', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isDeletingPhoto = false;
        console.error('Delete error:', error);
        this.snackBar.open('Failed to remove profile photo', 'Close', { duration: 3000 });
      }
    });
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.snackBar.open('Please fill in all password fields correctly', 'Close', { duration: 3000 });
      return;
    }

    // Additional validation to ensure new password is different from current
    const { currentPassword, newPassword, confirmNewPassword } = this.passwordForm.value;
    
    if (currentPassword === newPassword) {
      this.snackBar.open('New password must be different from current password', 'Close', { duration: 3000 });
      return;
    }

    this.isChangingPassword = true;

    this.authService.updatePassword(currentPassword, newPassword, confirmNewPassword).subscribe({
      next: (response: any) => {
        this.isChangingPassword = false;
        
        if (response.success) {
          this.snackBar.open('Password changed successfully!', 'Close', { 
            duration: 3000,
            panelClass: ['snackbar-success']
          });
          this.closePasswordDialog();
          this.passwordForm.reset();
        } else {
          // Backend returned success: false with a message
          const errorMessage = response.message || 'Failed to change password';
          this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
          
          // If the error is about incorrect current password, mark the field with error
          if (errorMessage.toLowerCase().includes('current password') || 
              errorMessage.toLowerCase().includes('incorrect password')) {
            this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
          }
        }
      },
      error: (error: any) => {
        this.isChangingPassword = false;
        console.error('Password change error:', error);
        
        // Extract error message from different possible locations
        const errorMessage = error.error?.message || error.message || 'Failed to change password';
        this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
        
        // If it's a 401 or the message indicates wrong current password, mark the field
        if (error.status === 401 || 
            errorMessage.toLowerCase().includes('current password') || 
            errorMessage.toLowerCase().includes('incorrect password') ||
            errorMessage.toLowerCase().includes('invalid password')) {
          this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
        }
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid || !this.user) {
      this.profileForm.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmitting = true;
    
    const newPhoneNumber = this.profileForm.value.phoneNumber?.trim();
    const phoneChanged = newPhoneNumber !== this.originalPhoneNumber;

    if (phoneChanged && newPhoneNumber) {
      this.updatePhoneNumber(newPhoneNumber);
    } else {
      this.updateUserProfile();
    }
  }

  private updatePhoneNumber(newPhoneNumber: string): void {
    this.authService.updatePhone(newPhoneNumber).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.originalPhoneNumber = newPhoneNumber;
          this.currentPhoneNumber = newPhoneNumber;
          this.snackBar.open('Phone number updated successfully', 'Close', { duration: 2000 });
          this.updateUserProfile();
        } else {
          this.isSubmitting = false;
          this.snackBar.open(response.message || 'Failed to update phone number', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        console.error('Phone update error:', error);
        this.snackBar.open(error.message || 'Failed to update phone number', 'Close', { duration: 3000 });
      }
    });
  }

  private updateUserProfile(): void {
    if (!this.user) return;

    const updatedUserData = {
      fullName: this.profileForm.value.fullName,
      email: this.profileForm.value.email,
      bio: this.profileForm.value.bio
    };

    this.propertyService.updateUserProfile(updatedUserData).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        
        if (response.success && response.user) {
          this.snackBar.open('Profile updated successfully', 'Close', { duration: 2000 });
          
          this.updateLocalUserData(response.user);
          
          setTimeout(() => {
            this.router.navigate(['/landlord-dashboard/profile/view']);
          }, 500);
        } else {
          this.snackBar.open(response.message || 'Failed to update profile', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        console.error('Profile update error:', error);
        this.snackBar.open('Failed to update profile', 'Close', { duration: 3000 });
      }
    });
  }

  private updateLocalUserData(userData: any): void {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...userData };
        
        const localStorageUser = localStorage.getItem('userData');
        const isPermanent = !!localStorageUser;
        
        if (isPermanent) {
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        } else {
          sessionStorage.setItem('userData', JSON.stringify(updatedUser));
        }
        
        this.user = updatedUser;
      }
    } catch (error) {
      console.error('Error updating local user data:', error);
    }
  }

  goBack(): void {
    this.router.navigate(['/landlord-dashboard/profile/view']);
  }

  cancel(): void {
    if (this.profileForm.dirty || this.passwordForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.router.navigate(['/landlord-dashboard/profile/view']);
      }
    } else {
      this.router.navigate(['/landlord-dashboard/profile/view']);
    }
  }

  isDefaultAvatar(): boolean {
    return this.profileImage?.includes('data:image/svg+xml') || false;
  }

  handleImageError(): void {
    this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
  }

  get fullName() { return this.profileForm.get('fullName'); }
  get email() { return this.profileForm.get('email'); }
  get phoneNumber() { return this.profileForm.get('phoneNumber'); }
  get bio() { return this.profileForm.get('bio'); }

  get currentPassword() { return this.passwordForm.get('currentPassword'); }
  get newPassword() { return this.passwordForm.get('newPassword'); }
  get confirmNewPassword() { return this.passwordForm.get('confirmNewPassword'); }
}