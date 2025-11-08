import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { 
  RegisterRequest, 
  UserRole, 
  ApiResponse,
  RegistrationFormData,
  RegistrationFieldErrors 
} from '../../../services/auth-interfaces';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  encapsulation: ViewEncapsulation.None
})
export class RegistrationComponent implements OnInit {
  private router: Router = inject(Router);
  private authService: AuthService = inject(AuthService);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  formData: RegistrationFormData = {
    role: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  };

  availableRoles = [
    { value: UserRole.TENANT, label: 'Tenant' },
    { value: UserRole.LANDLORD, label: 'Landlord' },
    { value: UserRole.CARETAKER, label: 'Caretaker' },
    { value: UserRole.EXTERNAL_BUSINESS, label: 'Business' }
  ];

  hidePassword = true;
  hideConfirmPassword = true;
  agreedToTerms = false;
  isLoading = false;

  fieldErrors: RegistrationFieldErrors = {
    role: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  };

  ngOnInit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.formData = {
      role: '',
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: ''
    };
    this.agreedToTerms = false;
    this.clearAllErrors();
  }

  clearAllErrors(): void {
    Object.keys(this.fieldErrors).forEach(key => {
      this.fieldErrors[key as keyof RegistrationFieldErrors] = '';
    });
  }

  clearFieldError(field: keyof RegistrationFieldErrors): void {
    this.fieldErrors[field] = '';
  }

  validateEmail(email: string): string {
    if (!email.trim()) {
      return 'Email is required';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email.includes('@')) {
      return 'Email needs @ symbol';
    }
    
    if (!email.includes('.')) {
      return 'Email needs .com ';
    }
    
    if (!emailRegex.test(email)) {
      return 'Please check your email format';
    }
    
    return '';
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  onEmailInput(): void {
    if (this.formData.email) {
      this.fieldErrors.email = this.validateEmail(this.formData.email);
    } else {
      this.fieldErrors.email = '';
    }
  }

  onPhoneNumberInput(): void {
    if (this.formData.phoneNumber) {
      const phoneRegex = /^(\+254|0)[1-9]\d{8}$/;
      if (!phoneRegex.test(this.formData.phoneNumber.replace(/\s/g, ''))) {
        this.fieldErrors.phoneNumber = 'Please enter a valid Kenyan phone number';
      } else {
        this.fieldErrors.phoneNumber = '';
      }
    } else {
      this.fieldErrors.phoneNumber = '';
    }
  }

  onPasswordInput(): void {
    this.fieldErrors.password = '';
    this.checkPasswordMatch();
  }

  onConfirmPasswordInput(): void {
    this.fieldErrors.confirmPassword = '';
    this.checkPasswordMatch();
  }

  checkPasswordMatch(): void {
    if (this.formData.confirmPassword && !this.passwordsMatch()) {
      this.fieldErrors.confirmPassword = 'Passwords do not match';
    } else {
      this.fieldErrors.confirmPassword = '';
    }
  }

  passwordsMatch(): boolean {
    return this.formData.password === this.formData.confirmPassword && this.formData.confirmPassword !== '';
  }

  validateForm(): boolean {
    this.clearAllErrors();
    let isValid = true;

    if (!this.formData.role) {
      this.fieldErrors.role = 'Please select a role';
      isValid = false;
    }

    if (!this.formData.fullName.trim()) {
      this.fieldErrors.fullName = 'Full name is required';
      isValid = false;
    } else if (this.formData.fullName.trim().length < 3) {
      this.fieldErrors.fullName = 'Full name must be at least 3 characters';
      isValid = false;
    }

    const emailError = this.validateEmail(this.formData.email);
    if (emailError) {
      this.fieldErrors.email = emailError;
      isValid = false;
    }

    if (!this.formData.phoneNumber.trim()) {
      this.fieldErrors.phoneNumber = 'Phone number is required';
      isValid = false;
    } else {
      const phoneRegex = /^(\+254|0)[1-9]\d{8}$/;
      const cleanPhone = this.formData.phoneNumber.replace(/\s/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        this.fieldErrors.phoneNumber = 'Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)';
        isValid = false;
      } else {
        this.formData.phoneNumber = this.formatPhoneNumber(cleanPhone);
      }
    }

    if (!this.formData.password) {
      this.fieldErrors.password = 'Password is required';
      isValid = false;
    } else if (this.formData.password.length < 8) {
      this.fieldErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(this.formData.password)) {
      this.fieldErrors.password = 'Password must include uppercase, lowercase, number, and special character';
      isValid = false;
    }

    if (!this.formData.confirmPassword) {
      this.fieldErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (!this.passwordsMatch()) {
      this.fieldErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!this.agreedToTerms) {
      this.showError('Please agree to Terms and Conditions');
      return false;
    }

    return isValid;
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.startsWith('0')) {
      return '+254' + phone.substring(1);
    }
    if (phone.startsWith('254')) {
      return '+' + phone;
    }
    return phone;
  }

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.isLoading = true;

    const registerRequest: RegisterRequest = {
      fullName: this.formData.fullName.trim(),
      email: this.formData.email.trim().toLowerCase(),
      phoneNumber: this.formData.phoneNumber.replace(/\s/g, ''),
      password: this.formData.password,
      confirmPassword: this.formData.confirmPassword,
      role: this.formData.role as UserRole
    };

    console.log('Registering user with role:', registerRequest.role);

    const pendingUserData = {
      fullName: registerRequest.fullName,
      email: registerRequest.email,
      phoneNumber: registerRequest.phoneNumber,
      role: registerRequest.role
    };
    
    sessionStorage.setItem('pendingUser', JSON.stringify(pendingUserData));
    sessionStorage.setItem('pendingPhoneNumber', registerRequest.phoneNumber);

    this.authService.register(registerRequest).subscribe({
      next: (response: ApiResponse) => {
        this.isLoading = false;
        if (response.success) {
          sessionStorage.setItem('pendingVerificationEmail', registerRequest.email);
          
          console.log('Registration successful for role:', registerRequest.role);
          
          this.showSuccess(response.message || 'Registration successful! Please check your email for verification code');
        
          this.router.navigate(['/verify-otp'], { 
            queryParams: { 
              email: registerRequest.email,
              userType: registerRequest.role,
              phoneNumber: registerRequest.phoneNumber
            },
            state: { 
              phoneNumber: registerRequest.phoneNumber 
            }
          });
        } else {
          sessionStorage.removeItem('pendingUser');
          sessionStorage.removeItem('pendingPhoneNumber');
          this.handleApiError(response.message || 'Registration failed. Please try again.');
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        sessionStorage.removeItem('pendingUser');
        sessionStorage.removeItem('pendingPhoneNumber');
        this.handleApiError(error);
      }
    });
  }

  private handleApiError(error: any): void {
    let errorMessage = 'Registration failed. Please try again.';
    let showSnackbar = true;
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.error?.message) {
      const msg = error.error.message.toLowerCase();
      
      if (msg.includes('email') && (msg.includes('already') || msg.includes('exists') || msg.includes('taken'))) {
        this.fieldErrors.email = 'Email already registered';
        errorMessage = 'This email is already registered. Please use a different email or login';
        showSnackbar = false;
      } else if (msg.includes('email') && msg.includes('invalid')) {
        this.fieldErrors.email = 'Invalid email format';
        errorMessage = 'Please enter a valid email address';
        showSnackbar = false;
      } else if (msg.includes('email') && msg.includes('required')) {
        this.fieldErrors.email = 'Email is required';
        errorMessage = 'Please enter your email address';
        showSnackbar = false;
        
      } else if (msg.includes('phone') && (msg.includes('already') || msg.includes('exists') || msg.includes('taken'))) {
        this.fieldErrors.phoneNumber = 'Phone number already registered';
        errorMessage = 'This phone number is already registered. Please use a different number';
        showSnackbar = false;
      } else if (msg.includes('phone') && msg.includes('invalid')) {
        this.fieldErrors.phoneNumber = 'Invalid phone number';
        errorMessage = 'Please enter a valid phone number';
        showSnackbar = false;
      } else if (msg.includes('phone') && msg.includes('required')) {
        this.fieldErrors.phoneNumber = 'Phone number is required';
        errorMessage = 'Please enter your phone number';
        showSnackbar = false;
        
      } else if (msg.includes('name') && (msg.includes('already') || msg.includes('exists') || msg.includes('taken'))) {
        this.fieldErrors.fullName = 'Name already taken';
        errorMessage = 'This name is already taken. Please choose a different name';
        showSnackbar = false;
      } else if (msg.includes('name') && msg.includes('required')) {
        this.fieldErrors.fullName = 'Full name is required';
        errorMessage = 'Please enter your full name';
        showSnackbar = false;
        
      } else if (msg.includes('password') && msg.includes('weak')) {
        this.fieldErrors.password = 'Password too weak';
        errorMessage = 'Password is too weak. Please use a stronger password with letters, numbers, and symbols';
        showSnackbar = false;
      } else if (msg.includes('password') && msg.includes('required')) {
        this.fieldErrors.password = 'Password is required';
        errorMessage = 'Please enter a password';
        showSnackbar = false;
      } else if (msg.includes('password') && msg.includes('short')) {
        this.fieldErrors.password = 'Password too short';
        errorMessage = 'Password must be at least 8 characters long';
        showSnackbar = false;
      } else if (msg.includes('password') && msg.includes('mismatch')) {
        this.fieldErrors.confirmPassword = 'Passwords do not match';
        errorMessage = 'The passwords you entered do not match';
        showSnackbar = false;
      
        
      } else if (msg.includes('role') && msg.includes('required')) {
        this.fieldErrors.role = 'Please select a role';
        errorMessage = 'Please select your account type';
        showSnackbar = false;
      } else if (msg.includes('role') && msg.includes('invalid')) {
        this.fieldErrors.role = 'Invalid role selected';
        errorMessage = 'Please select a valid account type';
        showSnackbar = false;
        
      } else if (msg.includes('network') || msg.includes('connection')) {
        errorMessage = 'Connection problem. Check your internet and try again';
      } else if (msg.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again';
      } else if (error.status === 500) {
        errorMessage = 'Temporary server issue. Please try again in a moment';
      } else {
        errorMessage = error.error.message;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Cannot connect to server. Please check your internet connection';
    } else if (error.status === 400) {
      errorMessage = 'Invalid registration data. Please check all fields';
    } else if (error.status === 409) {
      this.fieldErrors.email = 'Email already exists';
      errorMessage = 'An account with this email already exists. Please login or use a different email';
      showSnackbar = false;
    } else if (error.status === 429) {
      errorMessage = 'Too many registration attempts. Please wait 15 minutes before trying again';
    }
    
    if (errorMessage.includes('password') || 
        errorMessage.includes('already exists') ||
        errorMessage.includes('taken')) {
      this.formData.password = '';
      this.formData.confirmPassword = '';
    }
    
    if (showSnackbar) {
      this.showError(errorMessage);
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', { 
      duration: 5000, 
      horizontalPosition: 'right', 
      verticalPosition: 'top', 
      panelClass: ['snackbar-success'] 
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', { 
      duration: 5000, 
      horizontalPosition: 'right', 
      verticalPosition: 'top', 
      panelClass: ['snackbar-error'] 
    });
  }

  navigateToLogin(): void { 
    this.router.navigate(['/login']); 
  }
  
  navigateToTerms(): void { 
    window.open('/terms', '_blank'); 
  }
  
  navigateToPrivacy(): void { 
    window.open('/privacy', '_blank'); 
  }

  get isFormValid(): boolean {
    return (
      this.formData.role !== '' &&
      this.formData.fullName.trim() !== '' &&
      this.formData.fullName.trim().length >= 3 &&
      this.formData.email.trim() !== '' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email) &&
      this.formData.phoneNumber.trim() !== '' &&
      /^(\+254|0)[1-9]\d{8}$/.test(this.formData.phoneNumber.replace(/\s/g, '')) &&
      this.formData.password !== '' &&
      this.formData.password.length >= 8 &&
      /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(this.formData.password) &&
      this.formData.confirmPassword !== '' &&
      this.passwordsMatch() &&
      this.agreedToTerms
    );
  }
}