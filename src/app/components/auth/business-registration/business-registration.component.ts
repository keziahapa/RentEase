import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { BusinessService } from '../../../services/business.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-business-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule
  ],
  templateUrl: './business-registration.component.html',
  styleUrls: ['./business-registration.component.scss']
})
export class BusinessRegistrationComponent implements OnInit, OnDestroy {
  private businessService = inject(BusinessService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  businessForm: FormGroup;
  isLoading = false;
  selectedFile: File | null = null;
  fileName = '';
  currentUser: any;

  constructor() {
    this.businessForm = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      businessRegistrationNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]]
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.showMessage('Please log in to register a business', 'error');
      this.router.navigate(['/login']);
      return;
    }
  }

  ngOnDestroy() {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        this.showMessage('Please select a JPEG, PNG, or PDF file', 'error');
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showMessage('File size must be less than 5MB', 'error');
        return;
      }

      this.selectedFile = file;
      this.fileName = file.name;
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.fileName = '';
    const fileInput = document.getElementById('licenseDocument') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  async onSubmit(): Promise<void> {
    if (this.businessForm.invalid || !this.selectedFile) {
      this.markAllFieldsAsTouched();
      if (!this.selectedFile) {
        this.showMessage('Please upload your business license document', 'error');
      }
      return;
    }

    this.isLoading = true;

    try {
      const formData = new FormData();
      formData.append('businessName', this.businessForm.get('businessName')?.value);
      formData.append('businessRegistrationNumber', this.businessForm.get('businessRegistrationNumber')?.value);
      formData.append('licenseDocument', this.selectedFile);

      const response = await this.businessService.registerBusiness(formData).toPromise();

      if (response?.success) {
        this.showMessage('Business registration submitted for verification!', 'success');
        
        // Store business registration data
        sessionStorage.setItem('pendingBusinessRegistration', JSON.stringify({
          businessId: response.data.id,
          businessName: response.data.businessName,
          status: response.data.verificationStatus
        }));

        // Navigate to status page
        setTimeout(() => {
          this.router.navigate(['/business/registration-status']);
        }, 2000);
      } else {
        throw new Error(response?.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Business registration error:', error);
      this.showMessage(
        error.error?.message || error.message || 'Registration failed. Please try again.',
        'error'
      );
    } finally {
      this.isLoading = false;
    }
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.businessForm.controls).forEach(key => {
      this.businessForm.get(key)?.markAsTouched();
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`snackbar-${type}`]
    });
  }

  // Getters for form validation
  get businessName() { return this.businessForm.get('businessName'); }
  get businessRegistrationNumber() { return this.businessForm.get('businessRegistrationNumber'); }
}