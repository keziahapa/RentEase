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
import { PropertyService } from '../../../services/property.service';
import { AuthService } from '../../../services/auth.service';

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
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss']
})
export class ProfileEditComponent implements OnInit, OnDestroy {
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
  isCameraActive = false;
  isLoadingUserData = false;
  stream: MediaStream | null = null;
  videoElement: HTMLVideoElement | null = null;
  canvasElement: HTMLCanvasElement | null = null;
  
  originalPhoneNumber: string = '';
  currentPhoneNumber: string = '';

  constructor() {
    this.profileForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.stopCamera();
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

    this.loadUserDataFromApi();
  }

  private loadUserDataFromApi(): void {
    this.isLoadingUserData = true;

    this.propertyService.getCurrentUserProfile().subscribe({
      next: (response: any) => {
        this.isLoadingUserData = false;
        
        if (response.success && response.user) {
          this.user = response.user;
          
          const apiPhoneNumber = response.user.phoneNumber || '';
          if (apiPhoneNumber) {
            this.originalPhoneNumber = apiPhoneNumber;
            this.currentPhoneNumber = apiPhoneNumber;
          }
          
          this.populateForm();
          this.updateLocalUserData(response.user);
          
        } else {
          this.snackBar.open('Failed to load latest profile data', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isLoadingUserData = false;
        
        if (error.status === 401 || error.status === 403) {
          this.snackBar.open('Authentication failed', 'Login', { duration: 5000 }).onAction().subscribe(() => {
            this.authService.logout();
          });
          this.router.navigate(['/login']);
        } else {
          this.snackBar.open('Using local profile data', 'Close', { duration: 3000 });
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

  private loadProfilePicture(): void {
    this.propertyService.getProfilePicture().subscribe({
      next: (response: any) => {
        const imageUrl = response.data || response.pictureUrl;
        
        if (response.success && imageUrl) {
          this.profileImage = imageUrl;
          localStorage.setItem('profileImage', imageUrl);
          
          setTimeout(() => {
            const timestamp = new Date().getTime();
            const cacheBustedUrl = imageUrl.includes('?') 
              ? `${imageUrl}&t=${timestamp}`
              : `${imageUrl}?t=${timestamp}`;
            
            this.profileImage = cacheBustedUrl;
          }, 100);
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
    
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="${color}" rx="100"/>
        <text x="100" y="125" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="80" font-weight="bold">${initials}</text>
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

    this.compressImage(file, 800, 0.8).then(compressedFile => {
      const uploadMethod = this.isDefaultAvatar() 
        ? this.propertyService.uploadProfilePicture(compressedFile)
        : this.propertyService.updateProfilePicture(compressedFile);

      uploadMethod.subscribe({
        next: (response: any) => {
          this.isUploadingPhoto = false;
          
          const imageUrl = response.data || response.pictureUrl;
          
          if (response.success && imageUrl) {
            this.snackBar.open('Profile photo updated successfully', 'Close', { duration: 2000 });
            
            this.profileImage = imageUrl;
            localStorage.setItem('profileImage', imageUrl);
            
            setTimeout(() => {
              const timestamp = new Date().getTime();
              const cacheBustedUrl = imageUrl.includes('?') 
                ? `${imageUrl}&t=${timestamp}`
                : `${imageUrl}?t=${timestamp}`;
              
              this.profileImage = cacheBustedUrl;
            }, 100);
            
            window.dispatchEvent(new Event('profileImageUpdated'));
            
          } else {
            this.snackBar.open(response.message || 'Failed to upload photo', 'Close', { duration: 3000 });
          }
        },
        error: (error: any) => {
          this.isUploadingPhoto = false;
          
          let errorMessage = 'Failed to upload profile photo';
          if (error.status === 500) {
            errorMessage = 'Server error - profile picture feature temporarily unavailable';
          } else if (error.status === 401) {
            errorMessage = 'Session expired';
            setTimeout(() => this.authService.logout(), 2000);
          } else if (error.status === 413) {
            errorMessage = 'Image file is too large';
          } else if (error.status === 415) {
            errorMessage = 'Unsupported image format';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.snackBar.open(errorMessage, 'Close', { duration: 4000 });
        }
      });
    }).catch(error => {
      this.isUploadingPhoto = false;
      this.snackBar.open('Error processing image', 'Close', { duration: 3000 });
    });
  }

  private compressImage(file: File, maxWidth = 800, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      if (file.size < 500 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else if (height > width && height > maxWidth) {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  async startCamera(): Promise<void> {
    try {
      this.isCameraActive = true;
      
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      setTimeout(() => {
        this.videoElement = document.getElementById('cameraVideo') as HTMLVideoElement;
        this.canvasElement = document.getElementById('cameraCanvas') as HTMLCanvasElement;
        
        if (this.videoElement && this.stream) {
          this.videoElement.srcObject = this.stream;
        }
      }, 100);
      
    } catch (error) {
      this.snackBar.open('Unable to access camera', 'Close', { duration: 4000 });
      this.stopCamera();
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  capturePhoto(): void {
    if (!this.videoElement || !this.canvasElement) {
      return;
    }

    const context = this.canvasElement.getContext('2d');
    if (!context) {
      return;
    }

    const maxDimension = 800;
    let width = this.videoElement.videoWidth;
    let height = this.videoElement.videoHeight;

    if (width > height && width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else if (height > width && height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    this.canvasElement.width = width;
    this.canvasElement.height = height;
    
    context.drawImage(this.videoElement, 0, 0, width, height);
    
    this.canvasElement.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `profile-capture-${Date.now()}.jpg`, { 
          type: 'image/jpeg' 
        });
        this.uploadCapturedPhoto(file);
      }
    }, 'image/jpeg', 0.85);
  }

  private uploadCapturedPhoto(file: File): void {
    this.isUploadingPhoto = true;

    this.propertyService.updateProfilePicture(file).subscribe({
      next: (response: any) => {
        this.isUploadingPhoto = false;
        
        const imageUrl = response.data || response.pictureUrl;
        
        if (response.success && imageUrl) {
          this.snackBar.open('Photo captured successfully', 'Close', { duration: 2000 });
          
          this.profileImage = imageUrl;
          localStorage.setItem('profileImage', imageUrl);
          
          setTimeout(() => {
            const timestamp = new Date().getTime();
            const cacheBustedUrl = imageUrl.includes('?') 
              ? `${imageUrl}&t=${timestamp}`
              : `${imageUrl}?t=${timestamp}`;
            
            this.profileImage = cacheBustedUrl;
          }, 100);
          
          window.dispatchEvent(new Event('profileImageUpdated'));
          
          this.stopCamera();
        } else {
          this.snackBar.open(response.message || 'Failed to update photo', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isUploadingPhoto = false;
        this.snackBar.open(error.message || 'Failed to upload captured photo', 'Close', { duration: 3000 });
        this.stopCamera();
      }
    });
  }

  deletePhoto(): void {
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
          
          this.updateLocalUserData(response.user);
          
          setTimeout(() => {
            const currentRoute = this.router.url;
            const baseRoute = currentRoute.replace('/edit', '');
            this.router.navigate([baseRoute], {
              state: { refreshProfile: true }
            });
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
    const currentRoute = this.router.url;
    const baseRoute = currentRoute.replace('/edit', '');
    this.router.navigate([baseRoute]);
  }

  cancel(): void {
    if (this.profileForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.goBack();
      }
    } else {
      this.goBack();
    }
  }

  isDefaultAvatar(): boolean {
    return this.profileImage?.includes('data:image/svg+xml') || false;
  }

  handleImageError(): void {
    this.profileImage = this.generateInitialAvatar(this.user?.fullName || 'User');
  }

  getCurrentDisplayedPhone(): string {
    return this.profileForm.get('phoneNumber')?.value || '';
  }

  get fullName() { return this.profileForm.get('fullName'); }
  get email() { return this.profileForm.get('email'); }
  get phoneNumber() { return this.profileForm.get('phoneNumber'); }
  get bio() { return this.profileForm.get('bio'); }
}