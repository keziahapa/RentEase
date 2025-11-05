import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ]
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  resetForm: FormGroup;
  email: string = '';
  otpCode: string = '';
  hidePassword: boolean = true;
  hideConfirmPassword: boolean = true;
  isLoading: boolean = false;
  private routeSub?: Subscription;

  passwordError: string = '';
  confirmPasswordError: string = '';

  constructor() {
    this.resetForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(6),
        this.passwordStrengthValidator
      ]],
      confirmNewPassword: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit() {
    console.log(' ResetPasswordComponent Initializing...');
    
   
    this.email = sessionStorage.getItem('resetEmail') || '';
    this.otpCode = sessionStorage.getItem('resetOtp') || '';
    const isOtpVerified = sessionStorage.getItem('otpVerified') === 'true';

    console.log(' Session Storage Data:', {
      email: this.email,
      otpCode: this.otpCode,
      isOtpVerified: isOtpVerified
    });

   
    if (!this.email || !this.otpCode) {
      console.log('Falling back to query params...');
      this.routeSub = this.route.queryParams.subscribe(params => {
        this.email = params['email'] || this.email;
        this.otpCode = params['otp'] || this.otpCode;
        
        console.log(' Query Params Data:', {
          email: this.email,
          otpCode: this.otpCode
        });
      });
    }

    if (!this.email || !this.otpCode || !isOtpVerified) {
      console.error(' Invalid reset session:', {
        email: this.email,
        otpCode: this.otpCode,
        isOtpVerified: isOtpVerified
      });
      
      this.showSnackBar('Invalid or expired reset session. Please request a new password reset.', 'error');
      this.clearResetSession();
      this.router.navigate(['/forgot-password']);
      return;
    }

    console.log(' Valid reset session found');
    this.cleanUrl();
  }

  ngOnDestroy() {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  private cleanUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  private clearResetSession() {
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('resetOtp');
    sessionStorage.removeItem('otpVerified');
    console.log(' Reset session cleared');
  }

  private clearAllAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('profileImage');
    localStorage.removeItem('isLoggedIn');
    
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('profileImage');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('resetOtp');
    sessionStorage.removeItem('otpVerified');
    
    console.log(' All auth data cleared');
  }

  onPasswordInput(): void {
    this.passwordError = '';
    this.validatePasswordField();
  }

  onConfirmPasswordInput(): void {
    this.confirmPasswordError = '';
    this.validateConfirmPasswordField();
  }

  onPasswordBlur(): void {
    this.validatePasswordField();
  }

  onConfirmPasswordBlur(): void {
    this.validateConfirmPasswordField();
  }

  private validatePasswordField(): void {
    const passwordControl = this.resetForm.get('newPassword');
    
    if (!passwordControl?.touched && !passwordControl?.dirty) {
      return;
    }

    if (passwordControl?.hasError('required')) {
      this.passwordError = 'Password is required';
      return;
    }

    if (passwordControl?.hasError('minLength')) {
      this.passwordError = 'Password must be at least 6 characters long';
      return;
    }

    const passwordErrors = passwordControl?.errors;
    if (passwordErrors) {
      if (passwordErrors['lowercase']) {
        this.passwordError = 'Password must contain at least one lowercase letter';
        return;
      }
      if (passwordErrors['uppercase']) {
        this.passwordError = 'Password must contain at least one uppercase letter';
        return;
      }
      if (passwordErrors['number']) {
        this.passwordError = 'Password must contain at least one number';
        return;
      }
      if (passwordErrors['specialChar']) {
        this.passwordError = 'Password must contain at least one special character';
        return;
      }
    }

    this.passwordError = '';
  }

  private validateConfirmPasswordField(): void {
    const confirmControl = this.resetForm.get('confirmNewPassword');
    const passwordControl = this.resetForm.get('newPassword');
    
    if (!confirmControl?.touched && !confirmControl?.dirty) {
      return;
    }

    if (confirmControl?.hasError('required')) {
      this.confirmPasswordError = 'Please confirm your password';
      return;
    }

    if (this.resetForm.hasError('mismatch')) {
      this.confirmPasswordError = 'Passwords do not match';
      return;
    }

    if (passwordControl?.value && confirmControl?.value && passwordControl.value !== confirmControl.value) {
      this.confirmPasswordError = 'Passwords do not match';
      return;
    }

    this.confirmPasswordError = '';
  }

  passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const newPassword = form.get('newPassword')?.value;
    const confirmNewPassword = form.get('confirmNewPassword')?.value;
    return newPassword && confirmNewPassword && newPassword !== confirmNewPassword ? { mismatch: true } : null;
  }

  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    
    const errors: ValidationErrors = {};
    
    if (value.length < 6) {
      errors['minLength'] = true;
    }
    if (!/(?=.*[a-z])/.test(value)) {
      errors['lowercase'] = true;
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      errors['uppercase'] = true;
    }
    if (!/(?=.*\d)/.test(value)) {
      errors['number'] = true;
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) {
      errors['specialChar'] = true;
    }
    
    return Object.keys(errors).length ? errors : null;
  }

  get hasMinLength(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return password.length >= 6;
  }

  get hasUpperCase(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /(?=.*[A-Z])/.test(password);
  }

  get hasLowerCase(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /(?=.*[a-z])/.test(password);
  }

  get hasNumber(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /(?=.*\d)/.test(password);
  }

  get hasSpecialChar(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password);
  }

  get passwordsMatch(): boolean {
    const newPassword = this.resetForm.get('newPassword')?.value;
    const confirmNewPassword = this.resetForm.get('confirmNewPassword')?.value;
    return newPassword === confirmNewPassword && newPassword !== '';
  }

  get isPasswordValid(): boolean {
    return this.hasMinLength && this.hasUpperCase && this.hasLowerCase && this.hasNumber && this.hasSpecialChar;
  }

  get passwordStrength(): string {
    let strength = 0;
    if (this.hasMinLength) strength++;
    if (this.hasUpperCase) strength++;
    if (this.hasLowerCase) strength++;
    if (this.hasNumber) strength++;
    if (this.hasSpecialChar) strength++;
    switch (strength) {
      case 0:
      case 1:
        return 'weak';
      case 2:
      case 3:
        return 'medium';
      case 4:
      case 5:
        return 'strong';
      default:
        return 'weak';
    }
  }

  getStrengthPercentage(): number {
    let strength = 0;
    if (this.hasMinLength) strength++;
    if (this.hasUpperCase) strength++;
    if (this.hasLowerCase) strength++;
    if (this.hasNumber) strength++;
    if (this.hasSpecialChar) strength++;
    return (strength / 5) * 100;
  }

  togglePasswordVisibility() {
    if (!this.isLoading) {
      this.hidePassword = !this.hidePassword;
    }
  }

  toggleConfirmPasswordVisibility() {
    if (!this.isLoading) {
      this.hideConfirmPassword = !this.hideConfirmPassword;
    }
  }

  async onSubmit() {
    if (this.isLoading) return;

    console.log('Starting password reset process...', {
      email: this.email,
      otpCode: this.otpCode
    });

    this.validateAllFields();

    if (this.passwordError || this.confirmPasswordError || this.resetForm.invalid) {
      console.warn('Form validation failed:', {
        passwordError: this.passwordError,
        confirmPasswordError: this.confirmPasswordError,
        formInvalid: this.resetForm.invalid,
        formErrors: this.resetForm.errors
      });
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.disableForm();

    const payload = {
      email: this.email,
      otpCode: this.otpCode,
      newPassword: this.resetForm.value.newPassword
    };

    console.log('Sending reset password request:', {
      email: payload.email,
      otpCode: payload.otpCode,
      passwordLength: payload.newPassword.length
    });

    try {
      const response = await this.authService.resetPassword(payload).toPromise();
      console.log('Reset password response:', response);

      if (response.success) {
        this.showSnackBar('Password reset successfully! Redirecting to login...', 'success');
        
        this.clearAllAuthData();
        this.clearResetSession();
        
        setTimeout(() => {
          this.router.navigate(['/login'], {
            queryParams: { 
              message: 'Password reset successful! Please login with your new password.' 
            }
          });
        }, 2000);
      } else {
        this.isLoading = false;
        this.enableForm();
        console.error(' Reset password failed:', response.message);
        this.handleApiError(response.message || 'Failed to reset password');
      }
    } catch (error: any) {
      this.isLoading = false;
      this.enableForm();
      console.error(' Reset password error:', error);
      this.handleApiError(error);
    }
  }

  private validateAllFields(): void {
    this.validatePasswordField();
    this.validateConfirmPasswordField();
  }

  private disableForm(): void {
    this.resetForm.disable();
    console.log('Form disabled');
  }

  private enableForm(): void {
    this.resetForm.enable();
    console.log(' Form enabled');
  }

  private handleApiError(error: any): void {
    let errorMessage = 'Failed to reset password. Please try again.';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.error?.message) {
      errorMessage = this.parseBackendError(error.error.message);
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 400) {
      errorMessage = 'Invalid request. Please check your inputs.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid or expired OTP. Please request a new password reset.';
    } else if (error.status === 404) {
      errorMessage = 'Reset password endpoint not found. Please contact support.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    console.error('API Error handled:', errorMessage);
    this.showSnackBar(errorMessage, 'error');
  }

  private parseBackendError(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('otp') && (msg.includes('invalid') || msg.includes('incorrect'))) {
      this.clearResetSession();
      return 'Invalid or expired OTP code. Please request a new password reset';
    } else if (msg.includes('otp') && msg.includes('expired')) {
      this.clearResetSession();
      return 'OTP code has expired. Please request a new password reset';
    } else if (msg.includes('password') && msg.includes('same')) {
      this.passwordError = 'Cannot use previous password';
      return 'New password cannot be the same as your old password';
    } else if (msg.includes('password') && msg.includes('weak')) {
      this.passwordError = 'Password too weak';
      return 'Password is too weak. Please use a stronger password';
    } else if (msg.includes('user') && msg.includes('not found')) {
      return 'Account not found. Please check your email address';
    } else if (msg.includes('validation failed')) {
      return 'Invalid request data. Please check your inputs';
    } else if (msg.includes('already used') || msg.includes('consumed')) {
      this.clearResetSession();
      return 'This OTP has already been used. Please request a new password reset';
    } else {
      return message;
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.resetForm.controls).forEach(key => {
      const control = this.resetForm.get(key);
      control?.markAsTouched();
      control?.markAsDirty();
    });
    
    this.validateAllFields();
  }

  private showSnackBar(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: type === 'success' ? ['snackbar-success'] : ['snackbar-error']
    });
  }

  navigateToLogin() {
    if (!this.isLoading) {
      this.router.navigate(['/login']);
    }
  }

  navigateToForgotPassword() {
    if (!this.isLoading) {
      this.router.navigate(['/forgot-password']);
    }
  }

  get newPasswordControl() {
    return this.resetForm.get('newPassword');
  }

  get confirmNewPasswordControl() {
    return this.resetForm.get('confirmNewPassword');
  }

  get isFormValid(): boolean {
    return this.resetForm.valid && this.isPasswordValid && this.passwordsMatch;
  }
}