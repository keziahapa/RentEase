import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ProfilePictureService } from '../../../services/profile-picture.service';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule
  ],
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss']
})
export class ProfileEditComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private profilePictureService = inject(ProfilePictureService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  user: any = null;
  profileImage: string | null = null;
  
  isLoadingProfilePicture = false;
  isSubmitting = false;
  isUploadingPhoto = false;
  isDeletingPhoto = false;
  isChangingPassword = false;
  
  showAvatarDialog = false;
  showPasswordDialog = false;
  
  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.initializeForms();
    this.loadUserData();
    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.pattern(/^[+]?[\d\s\-()]+$/)]],
      bio: ['', [Validators.maxLength(500)]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
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

  private subscribeToUpdates(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.user = user;
          this.populateForm();
          this.loadProfilePictureFromApi();
        }
      })
    );
  }

  private loadUserData(): void {
    this.user = this.authService.getCurrentUser();
    
    if (this.user) {
      this.populateForm();
      this.loadCachedProfileImage();
    }

    this.loadUserDataFromApi();
  }

  private loadUserDataFromApi(): void {
    this.profilePictureService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        if (response.success && response.user) {
          this.user = response.user;
          this.populateForm();
          this.updateLocalUserData(response.user);
          this.loadProfilePictureFromApi();
        }
      },
      error: (error: any) => {
        if (!this.user) {
          this.user = this.authService.getCurrentUser();
          if (this.user) {
            this.populateForm();
          }
        }
      }
    });
  }

  private populateForm(): void {
    if (this.user && this.profileForm) {
      this.profileForm.patchValue({
        fullName: this.user.fullName || '',
        email: this.user.email || '',
        phoneNumber: this.user.phoneNumber || this.user.phone || '',
        bio: this.user.bio || ''
      });
    }
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
    
    this.profilePictureService.getProfilePicture().subscribe({
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
      this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
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
    this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
  }

  isDefaultAvatar(): boolean {
    return !this.profileImage || this.profileImage.includes('svg+xml');
  }

  openAvatarDialog(): void {
    this.showAvatarDialog = true;
  }

  closeAvatarDialog(): void {
    this.showAvatarDialog = false;
  }

  openPasswordDialog(): void {
    this.passwordForm.reset();
    this.showPasswordDialog = true;
  }

  closePasswordDialog(): void {
    this.showPasswordDialog = false;
  }

  onTabChange(event: any): void {
  }

  changePhoto(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.uploadPhoto(file);
      }
    };
    
    input.click();
  }

  uploadPhoto(file: File): void {
    this.isUploadingPhoto = true;
    
    this.profilePictureService.uploadProfilePicture(file).subscribe({
      next: (response: any) => {
        this.isUploadingPhoto = false;
        if (response.success && response.pictureUrl) {
          const timestamp = new Date().getTime();
          const cacheBustedUrl = `${response.pictureUrl}?t=${timestamp}`;
          this.profileImage = cacheBustedUrl;
          localStorage.setItem('profileImage', cacheBustedUrl);
          
          window.dispatchEvent(new Event('profileImageUpdated'));
          this.closeAvatarDialog();
          
          this.snackBar.open('Profile picture updated!', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open('Failed to upload profile picture', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isUploadingPhoto = false;
        this.snackBar.open('Error uploading profile picture', 'Close', { duration: 3000 });
      }
    });
  }

  deletePhoto(): void {
    if (this.isDefaultAvatar()) {
      this.snackBar.open('No custom photo to delete', 'Close', { duration: 3000 });
      return;
    }

    this.isDeletingPhoto = true;
    
    this.profilePictureService.deleteProfilePicture().subscribe({
      next: (response: any) => {
        this.isDeletingPhoto = false;
        if (response.success) {
          this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
          localStorage.removeItem('profileImage');
          
          window.dispatchEvent(new Event('profileImageUpdated'));
          this.closeAvatarDialog();
          
          this.snackBar.open('Profile picture deleted!', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open('Failed to delete profile picture', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isDeletingPhoto = false;
        this.snackBar.open('Error deleting profile picture', 'Close', { duration: 3000 });
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formData = this.profileForm.value;
      
      this.profilePictureService.updateProfile(formData).subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response.success) {
            this.snackBar.open('Profile updated successfully!', 'Close', { duration: 3000 });
            this.router.navigate(['/tenant-dashboard/profile/view']);
          } else {
            this.snackBar.open('Failed to update profile', 'Close', { duration: 3000 });
          }
        },
        error: (error: any) => {
          this.isSubmitting = false;
          this.snackBar.open('Error updating profile', 'Close', { duration: 3000 });
        }
      });
    }
  }

  onChangePassword(): void {
    if (this.passwordForm.valid && !this.isChangingPassword) {
      this.isChangingPassword = true;

      const passwordData = this.passwordForm.value;
      
      this.authService.changePassword(passwordData).subscribe({
        next: (response: any) => {
          this.isChangingPassword = false;
          if (response.success) {
            this.snackBar.open('Password changed successfully!', 'Close', { duration: 3000 });
            this.closePasswordDialog();
            this.passwordForm.reset();
          } else {
            this.snackBar.open(response.message || 'Failed to change password', 'Close', { duration: 3000 });
          }
        },
        error: (error: any) => {
          this.isChangingPassword = false;
          this.snackBar.open(error.message || 'Error changing password', 'Close', { duration: 3000 });
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/tenant-dashboard/profile/view']);
  }

  get fullName() { return this.profileForm.get('fullName'); }
  get email() { return this.profileForm.get('email'); }
  get phoneNumber() { return this.profileForm.get('phoneNumber'); }
  get bio() { return this.profileForm.get('bio'); }
  get currentPassword() { return this.passwordForm.get('currentPassword'); }
  get newPassword() { return this.passwordForm.get('newPassword'); }
  get confirmNewPassword() { return this.passwordForm.get('confirmNewPassword'); }
}