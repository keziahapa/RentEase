import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
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
    MatDialogModule
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

  user: any = null;
  profileImage: string | null = null;
  profileForm: FormGroup;
  isSubmitting = false;
  isUploadingPhoto = false;
  isDeletingPhoto = false;
  showAvatarDialog = false;
  
  originalPhoneNumber: string = '';
  currentPhoneNumber: string = '';

  constructor() {
    this.profileForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  ngOnDestroy(): void {}

  openAvatarDialog(): void {
    this.showAvatarDialog = true;
  }

  closeAvatarDialog(): void {
    this.showAvatarDialog = false;
  }

  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    
    if (!currentUser || !token) {
      this.snackBar.open('Please log in to continue', 'Close', { duration: 3000 });
      this.router.navigate(['/login']);
      return;
    }

    this.originalPhoneNumber = currentUser.phoneNumber || '';
    this.currentPhoneNumber = currentUser.phoneNumber || '';
    
    this.user = currentUser;
    this.populateForm();
    this.loadProfilePicture();
  }

  private loadProfilePicture(): void {
    this.propertyService.getProfilePicture().subscribe({
      next: (response: any) => {
        const imageUrl = response.data || response.pictureUrl;
        
        if (response.success && imageUrl) {
          this.profileImage = imageUrl;
          localStorage.setItem('profileImage', imageUrl);
        } else {
          this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
        }
      },
      error: (error: any) => {
        const cachedImage = localStorage.getItem('profileImage');
        if (cachedImage) {
          this.profileImage = cachedImage;
        } else {
          this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
        }
      }
    });
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

  private createForm(): FormGroup {
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

  private populateForm(): void {
    if (this.user) {
      this.profileForm.patchValue({
        fullName: this.user.fullName || '',
        email: this.user.email || '',
        phoneNumber: this.originalPhoneNumber || '',
        bio: this.user.bio || ''
      });

      this.currentPhoneNumber = this.profileForm.value.phoneNumber;
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
      this.snackBar.open('Please select a valid image file', 'Close', { duration: 3000 });
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
        
        const imageUrl = response.data || response.pictureUrl;
        
        if (response.success && imageUrl) {
          this.snackBar.open('Profile photo updated successfully', 'Close', { duration: 2000 });
          
          this.profileImage = imageUrl;
          localStorage.setItem('profileImage', imageUrl);
          
          window.dispatchEvent(new Event('profileImageUpdated'));
          
        } else {
          this.snackBar.open(response.message || 'Failed to upload photo', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isUploadingPhoto = false;
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
          this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
          localStorage.removeItem('profileImage');
          
          window.dispatchEvent(new Event('profileImageUpdated'));
          
          this.snackBar.open('Profile photo removed', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open(response.message || 'Failed to remove photo', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isDeletingPhoto = false;
        this.snackBar.open('Failed to remove profile photo', 'Close', { duration: 3000 });
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid || !this.user) {
      this.profileForm.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
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
          this.snackBar.open('Phone number updated successfully', 'Close', { duration: 2000 });
          this.updateUserProfile();
        } else {
          this.isSubmitting = false;
          this.snackBar.open(response.message || 'Failed to update phone number', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
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
          
          setTimeout(() => {
            this.router.navigate(['/landlord-dashboard/profile/view']);
          }, 500);
        } else {
          this.snackBar.open(response.message || 'Failed to update profile', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.snackBar.open('Failed to update profile', 'Close', { duration: 3000 });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/landlord-dashboard/profile/view']);
  }

  cancel(): void {
    if (this.profileForm.dirty) {
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
}