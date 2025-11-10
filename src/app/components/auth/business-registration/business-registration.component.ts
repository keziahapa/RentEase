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
import { FileSizePipe } from '../../../pipes/file-size.pipe'; 

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
    MatIconModule,
    FileSizePipe 
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
  fileError: string | null = null;
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

    this.checkExistingBusinessRegistration();
  }

  async checkExistingBusinessRegistration() {
    try {
      const businessStatus = await this.businessService.getRegistrationStatus().toPromise();
      
      if (businessStatus?.success && businessStatus.data) {
        const status = businessStatus.data.verificationStatus;
        
        if (status === 'PENDING') {
          this.showMessage('You already have a business registration pending approval', 'info');
          this.router.navigate(['/business/registration-status']);
        } else if (status === 'APPROVED') {
          this.showMessage('Your business is already approved', 'info');
          this.router.navigate(['/business-dashboard']);
        } else if (status === 'REJECTED') {
          this.businessForm.patchValue({
            businessName: businessStatus.data.businessName,
            businessRegistrationNumber: businessStatus.data.businessRegistrationNumber
          });
          this.showMessage('Please update your business registration details', 'info');
        }
      }
    } catch (error) {
      console.log('No existing business registration found');
    }
  }

  ngOnDestroy() {}

  triggerFileInput(): void {
    const fileInput = document.getElementById('licenseDocument') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.fileError = null;

   
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      this.fileError = 'Please select a JPEG, PNG, or PDF file';
      this.showMessage('Invalid file type. Please select JPG, PNG, or PDF', 'error');
      return;
    }


    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.fileError = 'File size must be less than 5MB';
      this.showMessage('File too large. Maximum size is 5MB', 'error');
      return;
    }

    this.selectedFile = file;
    this.fileName = file.name;
    console.log(' File selected:', file.name, '(', file.size, 'bytes)');
  }

  removeFile(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.fileError = null;
    const fileInput = document.getElementById('licenseDocument') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  async onSubmit(): Promise<void> {
    if (this.businessForm.invalid) {
      this.markAllFieldsAsTouched();
      this.showMessage('Please fill in all required fields correctly', 'error');
      return;
    }

    if (!this.selectedFile) {
      this.fileError = 'Business license document is required';
      this.showMessage('Please upload your business license document', 'error');
      return;
    }

    this.isLoading = true;
    this.fileError = null;

    try {
      const businessData = {
        businessName: this.businessForm.get('businessName')?.value.trim(),
        businessRegistrationNumber: this.businessForm.get('businessRegistrationNumber')?.value.trim()
      };

      console.log('Submitting business registration:');
      console.log('Business data:', businessData);
      console.log('File:', this.selectedFile.name, this.selectedFile.size, 'bytes');

    
      const formData = new FormData();
      formData.append('data', JSON.stringify(businessData));
      formData.append('licenseDocument', this.selectedFile, this.selectedFile.name);

     
      const response = await this.businessService.registerBusiness(formData).toPromise();

      this.isLoading = false;

      if (response?.success) {
        this.showMessage(
          'Business registration submitted successfully! Please wait for admin approval.',
          'success'
        );
        
        setTimeout(() => {
          this.router.navigate(['/business/registration-status'], {
            queryParams: {
              message: 'Registration submitted successfully',
              status: 'pending'
            }
          });
        }, 2000);
      } else {
        throw new Error(response?.message || 'Registration failed');
      }
    } catch (error: any) {
      this.isLoading = false;
      console.error(' Business registration error:', error);
      
      const errorMessage = error.error?.message || error.message || 'Registration failed. Please try again.';
      this.showMessage(errorMessage, 'error');
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

  get businessName() { 
    return this.businessForm.get('businessName'); 
  }
  
  get businessRegistrationNumber() { 
    return this.businessForm.get('businessRegistrationNumber'); 
  }
}