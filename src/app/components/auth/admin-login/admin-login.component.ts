import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../services/auth.service';
import { LoginRequest, AuthResponse } from '../../../services/auth-interfaces';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCardModule
  ],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit, OnDestroy {
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private authService: AuthService = inject(AuthService);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  loginData = { email: '', password: '' };
  showPassword = false;
  isLoading = false;
  returnUrl: string = '/admin-dashboard';
  
  emailError: string = '';
  passwordError: string = '';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      if (user?.role === 'ADMIN') {
        this.router.navigate(['/admin-dashboard']);
        return;
      }
    }
    
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin-dashboard';
    
    const message = this.route.snapshot.queryParams['message'];
    if (message) {
      this.showSnackbar(message, 'success');
    }
  }

  validateEmail(email: string): string {
    if (!email.trim()) {
      return 'Admin email is required';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return 'Please enter a valid admin email address';
    }
    
    return '';
  }

  togglePasswordVisibility(): void {
    if (this.isLoading) return;
    this.showPassword = !this.showPassword; 
  }

  onEmailInput(): void {
    if (this.isLoading) return;
    this.emailError = '';
  }

  onEmailBlur(): void {
    if (this.isLoading) return;
    const email = this.loginData.email;
    if (email) {
      this.emailError = this.validateEmail(email);
    }
  }

  onPasswordInput(): void {
    if (this.isLoading) return;
    this.passwordError = '';
  }

  onPasswordBlur(): void {
    if (this.isLoading) return;
    const password = this.loginData.password;
    if (password && password.length < 8) {
      this.passwordError = 'Admin password must be at least 8 characters';
    }
  }

  validateForm(): boolean {
    this.emailError = '';
    this.passwordError = '';

    const emailError = this.validateEmail(this.loginData.email);
    if (emailError) {
      this.emailError = emailError;
    }

    if (!this.loginData.password) {
      this.passwordError = 'Admin password is required';
    } else if (this.loginData.password.length < 8) {
      this.passwordError = 'Admin password must be at least 8 characters';
    }

    return !this.emailError && !this.passwordError;
  }

  onSubmit(): void {
    if (this.isLoading) return;

    if (!this.validateForm()) return;
    
    this.isLoading = true;
    this.emailError = '';
    this.passwordError = '';

    const loginRequest: LoginRequest = {
      email: this.loginData.email.trim().toLowerCase(),
      password: this.loginData.password,
      rememberMe: false 
    };

    console.log('🟡 Attempting admin login with:', loginRequest.email);

    this.authService.login(loginRequest).subscribe({
      next: (response: any) => {
        console.log('🟢 Login response received:', response);
        this.isLoading = false;
        
        // Check if response indicates success but with access denied
        if (response.success === false) {
          this.handleAccessDenied(response.message || 'Access denied');
          return;
        }

        // Get user data from various possible locations
        const user = this.authService.getCurrentUser();
        const userRole = user?.role || response.role || response.user?.role;

        console.log('🔵 Detected user role:', userRole);

        if (userRole === 'ADMIN') {
          this.showSnackbar('Admin login successful!', 'success');
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.handleAccessDenied('Access denied. Admin privileges required.');
        }
      },
      error: (error) => {
        console.error('🔴 Login error:', error);
        this.isLoading = false;
        this.handleApiError(error);
      }
    });
  }

  private handleAccessDenied(message: string): void {
    console.log(' Access denied:', message);
    this.authService.logoutSync();
    this.showSnackbar(message, 'error');
    this.loginData.password = '';
    this.emailError = 'Admin access required';
  }

  private handleApiError(error: any): void {
    this.emailError = '';
    this.passwordError = '';
    
    let errorMessage = 'Admin login failed. Please try again.';
    let showSnackbar = true;
    
    console.log(' Error details:', {
      status: error.status,
      message: error.message,
      error: error.error
    });

    // Handle 200 responses with error messages
    if (error.status === 200 && error.error && typeof error.error === 'object') {
      if (error.error.success === false) {
        errorMessage = error.error.message || 'Access denied';
        if (errorMessage.toLowerCase().includes('access denied') || errorMessage.toLowerCase().includes('admin')) {
          this.handleAccessDenied(errorMessage);
          return;
        }
      }
    }
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.error?.message) {
      const msg = error.error.message.toLowerCase();
      
      if (msg.includes('email') && (msg.includes('not found') || msg.includes('exist'))) {
        this.emailError = 'Admin account not found';
        errorMessage = 'No admin account with this email';
      } else if (msg.includes('password') && msg.includes('incorrect')) {
        this.passwordError = 'Incorrect admin password';
        errorMessage = 'The password you entered is incorrect';
        showSnackbar = false;
      } else if (msg.includes('invalid') && msg.includes('credentials')) {
        this.emailError = 'Invalid admin credentials';
        this.passwordError = 'Invalid admin credentials';
        errorMessage = 'The email or password you entered is incorrect';
      } else if (msg.includes('account') && (msg.includes('locked') || msg.includes('suspended'))) {
        errorMessage = 'Admin account temporarily locked. Contact system administrator.';
      } else if (msg.includes('not verified') || msg.includes('verify')) {
        errorMessage = 'Admin account requires verification. Contact system administrator.';
      } else if (msg.includes('disabled') || msg.includes('inactive')) {
        errorMessage = 'Admin account has been deactivated';
      } else if (msg.includes('access denied') || msg.includes('admin') || msg.includes('privilege')) {
        this.handleAccessDenied(error.error.message);
        return;
      } else if (msg.includes('network') || msg.includes('connection')) {
        errorMessage = 'Connection problem. Check your internet connection.';
      } else if (msg.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.status === 500) {
        errorMessage = 'Temporary server issue. Please try again.';
      } else {
        errorMessage = error.error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Cannot connect to server. Check your internet connection.';
    } else if (error.status === 401) {
      this.emailError = 'Invalid admin credentials';
      this.passwordError = 'Invalid admin credentials';
      errorMessage = 'The email or password you entered is not correct';
    } else if (error.status === 403) {
      this.handleAccessDenied('Access denied. Admin privileges required.');
      return;
    } else if (error.status === 404) {
      this.emailError = 'Admin account not found';
      errorMessage = 'No admin account found with this email address';
    } else if (error.status === 429) {
      errorMessage = 'Too many login attempts. Please wait 15 minutes.';
    }
    
    this.loginData.password = '';
    
    if (showSnackbar) {
      this.showSnackbar(errorMessage, 'error');
    }
  }

  navigateToMainLogin(): void {
    if (this.isLoading) return;
    this.router.navigate(['/login']);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isLoading) {
      this.onSubmit();
    }
  }

  get isFormValid(): boolean {
    return (
      this.loginData.email.trim() !== '' &&
      this.loginData.password !== '' &&
      this.loginData.password.length >= 8 &&
      !this.emailError
    );
  }

  private showSnackbar(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass:
        type === 'success'
          ? ['snackbar-success']
          : type === 'error'
          ? ['snackbar-error']
          : ['snackbar-info']
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}