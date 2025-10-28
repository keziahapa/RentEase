import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BusinessService } from '../../../services/business.service';

@Component({
  selector: 'app-business-registration-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './business-registration-form.component.html',
  styleUrls: ['./business-registration-form.component.scss']
})
export class BusinessRegistrationFormComponent implements OnInit {
  registrationData = {
    data: {
      businessName: '',
      businessRegistrationNumber: ''
    },
    licenseDocument: ''
  };

  isLoading = false;
  isSubmitting = false;

  constructor(
    private businessService: BusinessService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.checkExistingRegistration();
  }

  checkExistingRegistration(): void {
    this.isLoading = true;
    this.businessService.hasBusinessProfile().subscribe({
      next: (hasProfile: boolean) => {
        this.isLoading = false;
        if (hasProfile) {
          this.router.navigate(['/business-dashboard']);
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;

    this.businessService.registerBusiness(this.registrationData).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        if (response.success) {
          this.snackBar.open('Business registration submitted successfully!', 'Close', {
            duration: 5000
          });
          this.router.navigate(['/business-dashboard']);
        } else {
          this.snackBar.open(response.message || 'Registration failed', 'Close', {
            duration: 5000
          });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.snackBar.open(error.message || 'Failed to submit registration', 'Close', {
          duration: 5000
        });
      }
    });
  }

  validateForm(): boolean {
    if (!this.registrationData.data.businessName.trim()) {
      this.snackBar.open('Please enter business name', 'Close', { duration: 3000 });
      return false;
    }
    if (!this.registrationData.data.businessRegistrationNumber.trim()) {
      this.snackBar.open('Please enter business registration number', 'Close', { duration: 3000 });
      return false;
    }
    if (!this.registrationData.licenseDocument.trim()) {
      this.snackBar.open('Please enter license document URL', 'Close', { duration: 3000 });
      return false;
    }
    return true;
  }
}