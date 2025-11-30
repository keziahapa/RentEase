import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProfilePictureService } from '../../services/profile-picture.service'; // CHANGED THIS

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.scss']
})
export class ChangePasswordDialogComponent {
  passwordForm: FormGroup;
  isSubmitting = false;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private profilePictureService: ProfilePictureService, // CHANGED THIS
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.passwordForm = this.createForm();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmNewPassword = control.get('confirmNewPassword');
    
    if (!newPassword || !confirmNewPassword) return null;
    
    return newPassword.value === confirmNewPassword.value ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.snackBar.open('Please fill in all fields correctly', 'Close', { duration: 3000 });
      return;
    }

    // Additional validation - new password should be different from current
    const formValue = this.passwordForm.value;
    if (formValue.currentPassword === formValue.newPassword) {
      this.snackBar.open('New password must be different from current password', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmitting = true;

    this.profilePictureService.updatePassword( // CHANGED THIS
      formValue.currentPassword,
      formValue.newPassword,
      formValue.confirmNewPassword
    ).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        if (response.success) {
          this.snackBar.open('Password updated successfully!', 'Close', { duration: 3000 });
          this.dialogRef.close('success');
        } else {
          const errorMessage = response.message || 'Failed to update password';
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
          
          // Mark current password as incorrect if the error indicates it
          if (errorMessage.toLowerCase().includes('current password') || 
              errorMessage.toLowerCase().includes('incorrect password')) {
            this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
          }
        }
      },
      error: (error: any) => { // CHANGED ERROR TYPE
        this.isSubmitting = false;
        console.error('Password update error:', error);
        
        let errorMessage = error.message || 'Failed to update password. Please try again.';
        
        // Handle specific error cases
        if (error.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        
        // Mark current password as incorrect if the error indicates it
        if (errorMessage.toLowerCase().includes('current password') || 
            errorMessage.toLowerCase().includes('incorrect password') ||
            error.status === 401) {
          this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
        }
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  toggleCurrentPasswordVisibility(): void {
    this.hideCurrentPassword = !this.hideCurrentPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.hideNewPassword = !this.hideNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  get currentPassword() { return this.passwordForm.get('currentPassword'); }
  get newPassword() { return this.passwordForm.get('newPassword'); }
  get confirmNewPassword() { return this.passwordForm.get('confirmNewPassword'); }
}