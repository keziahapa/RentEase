import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';
import { InvitationService } from '../../../services/invitation.service';
import { BusinessService } from '../../../services/business.service';
import { LoginRequest, AuthResponse } from '../../../services/auth-interfaces';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private authService: AuthService = inject(AuthService);
  private invitationService: InvitationService = inject(InvitationService);
  private businessService = inject(BusinessService);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  loginData = { email: '', password: '' };
  showPassword = false;
  rememberMe = false;
  isLoading = false;
  returnUrl: string = '/dashboard';
  autoSubmitTimer: any;
  countdown: number = 0;
  showAutoLoginNotice: boolean = false;
  private pendingAutoPassword: string | null = null;
  
  emailError: string = '';
  passwordError: string = '';

  
  fieldTouched = {
    email: false,
    password: false
  };

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const hasPendingInvitation = this.route.snapshot.queryParams['hasPendingInvitation'];
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      
      if (hasPendingInvitation && returnUrl) {
        this.router.navigateByUrl(returnUrl);
        return;
      }
      
      this.redirectToDashboard();
      return;
    }
    
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    
    const emailFromReset = this.route.snapshot.queryParams['email'];
    const passwordFromReset = this.route.snapshot.queryParams['prefillPassword'];
    
    if (emailFromReset && passwordFromReset) {
      this.loginData.email = emailFromReset;
      this.pendingAutoPassword = passwordFromReset;
      this.showAutoLoginNotice = true;
      this.startAutoSubmitCountdown();
    }
    
    const message = this.route.snapshot.queryParams['message'];
    if (message) {
      this.showSnackbar(message, 'success');
    }

    this.checkPendingInvitation();
  }

  private checkPendingInvitation(): void {
    const pendingToken = this.route.snapshot.queryParams['token'];
    const hasPendingInvitation = this.route.snapshot.queryParams['hasPendingInvitation'];
    
    if (pendingToken && hasPendingInvitation) {
      sessionStorage.setItem('pendingInvitationToken', pendingToken);
    }
  }

  startAutoSubmitCountdown(): void {
    this.countdown = 3;
    
    this.autoSubmitTimer = setInterval(() => {
      this.countdown--;
      
      if (this.countdown <= 0) {
        this.stopAutoSubmit();
        if (!this.isLoading && this.pendingAutoPassword) {
          this.onSubmit(this.pendingAutoPassword);
        }
      }
    }, 1000);
  }

  stopAutoSubmit(): void {
    if (this.autoSubmitTimer) {
      clearInterval(this.autoSubmitTimer);
      this.autoSubmitTimer = null;
      this.showAutoLoginNotice = false;
    }
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
      return 'Email needs domain (e.g., .com)';
    }
    
    if (!emailRegex.test(email)) {
      return 'Please check your email format';
    }
    
    return '';
  }

  
  onFieldBlur(field: 'email' | 'password'): void {
    if (this.isLoading) return;
    
    this.fieldTouched[field] = true;
    this.validateField(field);
  }


  validateField(field: 'email' | 'password'): void {
    if (field === 'email') {
      if (this.loginData.email) {
        this.emailError = this.validateEmail(this.loginData.email);
      } else {
        this.emailError = 'Email is required';
      }
    } else if (field === 'password') {
      const password = this.loginData.password;
      if (!password) {
        this.passwordError = 'Password is required';
      } else if (password.length < 6) {
        this.passwordError = 'Password must be at least 6 characters';
      } else {
        this.passwordError = '';
      }
    }
  }

  togglePasswordVisibility(): void {
    if (this.isLoading) return;
    this.showPassword = !this.showPassword;
  }

  onEmailInput(): void {
    if (this.isLoading) return;
    
    
    if (this.fieldTouched.email) {
      this.emailError = this.validateEmail(this.loginData.email);
    } else {
      this.emailError = '';
    }
    
    this.stopAutoSubmit();
  }

  onPasswordInput(): void {
    if (this.isLoading) return;
    
  
    if (this.fieldTouched.password) {
      this.validateField('password');
    } else {
      this.passwordError = '';
    }
    
    this.pendingAutoPassword = null;
    this.stopAutoSubmit();
  }

  onPasswordPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const cleanText = pastedText.trim();
    this.loginData.password = cleanText;
  }

  
  showFormValidationErrors(): void {
 
    this.fieldTouched.email = true;
    this.fieldTouched.password = true;

    
    this.validateField('email');
    this.validateField('password');
  }

  validateForm(passwordOverride?: string): boolean {
    this.emailError = '';
    this.passwordError = '';

    const emailError = this.validateEmail(this.loginData.email);
    if (emailError) {
      this.emailError = emailError;
    }

    const passwordToValidate = (passwordOverride ?? this.loginData.password).trim();

    if (!passwordToValidate) {
      this.passwordError = 'Password is required';
    } else if (passwordToValidate.length < 6) {
      this.passwordError = 'Password must be at least 6 characters';
    }

    return !this.emailError && !this.passwordError;
  }

  onSubmit(passwordOverride?: string): void {
    this.stopAutoSubmit();
    
    if (this.isLoading) return;

    
    if (!this.isFormValid) {
      this.showFormValidationErrors();
      return;
    }
    
    const passwordToUse = (passwordOverride ?? this.loginData.password).trim();

    if (!this.validateForm(passwordToUse)) {
      return;
    }
    
    this.isLoading = true;

    this.emailError = '';
    this.passwordError = '';
    this.pendingAutoPassword = null;

    const loginRequest: LoginRequest = {
      email: this.loginData.email.trim().toLowerCase(),
      password: passwordToUse,
      rememberMe: this.rememberMe
    };
    
    this.authService.login(loginRequest).subscribe({
      next: (response: AuthResponse) => {
        this.handleSuccessfulLogin(response);
      },
      error: (error) => {
        this.isLoading = false;
        this.handleApiError(error);
      }
    });
  }

  private async handleSuccessfulLogin(response: AuthResponse): Promise<void> {
    this.isLoading = false;
    
    if (this.rememberMe) {
      this.authService.storeCredentialsSecurely(
        this.loginData.email.trim().toLowerCase(),
        this.loginData.password
      );
    }
    
    this.loginData.password = '';
    
    const token = this.authService.getToken();
    if (!token) {
      this.showSnackbar('Login failed: Authentication token missing', 'error');
      return;
    }
    
    const pendingToken = sessionStorage.getItem('pendingInvitationToken');
    const hasPendingInvitation = this.route.snapshot.queryParams['hasPendingInvitation'];
    
    if (pendingToken && hasPendingInvitation) {
      this.acceptPendingInvitation(pendingToken, response.role);
    } else {
      this.showSnackbar('Login successful!', 'success');
      await this.checkBusinessRegistrationStatus(response.role);
    }
  }

  private async checkBusinessRegistrationStatus(userRole?: string): Promise<void> {
    try {
      const normalizedRole = userRole?.toUpperCase() || '';
      const isBusinessUser = this.isBusinessRole(normalizedRole);
      
      if (!isBusinessUser) {
        this.redirectBasedOnRole(userRole || '');
        return;
      }

      const businessStatus = await this.businessService.getRegistrationStatus().toPromise();
      
      if (businessStatus?.success && businessStatus.data) {
        const status = businessStatus.data.verificationStatus?.toUpperCase() || 
                      businessStatus.data.status?.toUpperCase() ||
                      businessStatus.data.registrationStatus?.toUpperCase();
        
        console.log('Business registration status:', status);
        
        switch (status) {
          case 'APPROVED':
          case 'ACTIVE':
            this.showSnackbar('Business login successful!', 'success');
            this.router.navigate(['/business-dashboard']);
            break;
          case 'PENDING':
          case 'UNDER_REVIEW':
            this.showSnackbar('Your business registration is under review', 'info');
            this.router.navigate(['/business/registration-status'], {
              queryParams: { status: 'pending' }
            });
            break;
          case 'REJECTED':
          case 'DECLINED':
            this.showSnackbar('Your business registration was rejected. Please update and resubmit.', 'warning');
            this.router.navigate(['/business/register'], {
              queryParams: { rejected: true }
            });
            break;
          case 'SUSPENDED':
            this.showSnackbar('Your business account has been suspended. Please contact support.', 'error');
            this.router.navigate(['/business/suspended']);
            break;
          default:
            this.showSnackbar('Please complete your business registration to continue', 'info');
            this.router.navigate(['/business/register']);
            break;
        }
      } else {
        this.showSnackbar('Please complete your business registration to continue', 'info');
        this.router.navigate(['/business/register']);
      }
    } catch (error: any) {
      console.error('Error checking business registration status:', error);
      
      if (error.status === 404) {
        this.showSnackbar('Please complete your business registration', 'info');
        this.router.navigate(['/business/register']);
      } else {
        const normalizedRole = userRole?.toUpperCase() || '';
        if (this.isBusinessRole(normalizedRole)) {
          this.showSnackbar('Please complete your business registration', 'info');
          this.router.navigate(['/business/register']);
        } else {
          this.redirectBasedOnRole(userRole || '');
        }
      }
    }
  }

  private isBusinessRole(role: string): boolean {
    const businessRoles = [
      'EXTERNAL_BUSINESS',
      'BUSINESS',
      'BUSINESS_OWNER',
      'COMPANY',
      'VENDOR',
      'ADMIN'
    ];
    return businessRoles.includes(role.toUpperCase());
  }

  private acceptPendingInvitation(token: string, userRole: string): void {
    this.invitationService.acceptInvitation(token).subscribe({
      next: (invitationResponse: any) => {
        sessionStorage.removeItem('pendingInvitationToken');
        localStorage.removeItem('pendingInvitation');
        
        const invitationType = invitationResponse.invitationType || 'tenant';
        const dashboardName = this.getDashboardDisplayName(invitationType);
        this.showSnackbar(`Invitation accepted! Redirecting to your ${dashboardName}...`, 'success');
        
        this.redirectAfterInvitationAcceptance(userRole, invitationResponse);
      },
      error: (error: any) => {
        sessionStorage.removeItem('pendingInvitationToken');
        this.showSnackbar('Invitation could not be accepted, but you are logged in.', 'info');
        this.checkBusinessRegistrationStatus(userRole);
      }
    });
  }

  private redirectAfterInvitationAcceptance(userRole: string, invitationResponse: any): void {
    this.checkBusinessRegistrationStatus(userRole);
  }

  private getInvitationDashboard(invitationResponse: any): string | null {
    if (invitationResponse.invitationType === 'tenant') {
      return '/tenant-dashboard/dashboard';
    } else if (invitationResponse.invitationType === 'caretaker') {
      return '/caretaker-dashboard/overview';
    }
    return null;
  }

  private redirectBasedOnRole(userRole: string): void {
    const normalizedRole = userRole.toUpperCase().trim();
    
    const roleMap: Record<string, string> = {
      'LANDLORD': '/landlord-dashboard/home',
      'TENANT': '/tenant-dashboard/dashboard',
      'EXTERNAL_BUSINESS': '/business-dashboard',
      'BUSINESS': '/business-dashboard',
      'BUSINESS_OWNER': '/business-dashboard',
      'COMPANY': '/business-dashboard',
      'VENDOR': '/business-dashboard',
      'CARETAKER': '/caretaker-dashboard/overview',
      'ADMIN': '/admin-dashboard'
    };

    const dashboardRoute = roleMap[normalizedRole] || '/dashboard';
    
    const hasPendingInvitation = this.route.snapshot.queryParams['hasPendingInvitation'];
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    
    if (hasPendingInvitation && returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate([dashboardRoute]).then(success => {
        if (!success) {
          this.router.navigate(['/dashboard']);
        }
      });
    }
  }

  private getDashboardDisplayName(invitationType: string): string {
    const names: Record<string, string> = {
      'tenant': 'Tenant Dashboard',
      'caretaker': 'Caretaker Dashboard',
      'landlord': 'Landlord Dashboard',
      'external_business': 'Business Dashboard',
      'business': 'Business Dashboard',
      'admin': 'Admin Dashboard'
    };
    return names[invitationType] || 'Dashboard';
  }

  private handleApiError(error: any): void {
    this.emailError = '';
    this.passwordError = '';
    this.pendingAutoPassword = null;
    
    let errorMessage = 'Login failed. Please try again.';
    let showSnackbar = true;
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.error?.message) {
      const msg = error.error.message.toLowerCase();
      
      if (msg.includes('email') && msg.includes('not found')) {
        this.emailError = 'No account with this email';
        errorMessage = 'This email is not registered';
        showSnackbar = false;
      } else if (msg.includes('password') && msg.includes('incorrect')) {
        this.passwordError = 'Wrong password';
        errorMessage = 'The password you entered is incorrect';
        showSnackbar = false;
      } else if (msg.includes('invalid') && msg.includes('credentials')) {
        this.emailError = 'Check email or password';
        this.passwordError = 'Check email or password';
        errorMessage = 'The email or password you entered is incorrect';
        showSnackbar = false;
      } else {
        errorMessage = error.error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Cannot connect to server. Check your internet connection.';
    } else if (error.status === 401) {
      this.emailError = 'Incorrect email or password';
      this.passwordError = 'Incorrect email or password';
      errorMessage = 'The email or password you entered is not correct';
      showSnackbar = false;
    } else if (error.status === 404) {
      this.emailError = 'Email not registered';
      errorMessage = 'No account found with this email address';
      showSnackbar = false;
    }
    
    if (showSnackbar) {
      this.showSnackbar(errorMessage, 'error');
    }
  }

  private redirectToDashboard(): void {
    const user = this.authService.getCurrentUser();
    
    if (user?.role) {
      this.checkBusinessRegistrationStatus(user.role);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  navigateToForgotPassword(): void {
    if (this.isLoading) return;
    this.router.navigate(['/forgot-password']);
  }

  navigateToRegister(): void {
    if (this.isLoading) return;
    this.router.navigate(['/registration']);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isLoading) {
      this.onSubmit();
    }
  }

  get isFormValid(): boolean {
    const passwordValue = this.pendingAutoPassword ?? this.loginData.password;
    const trimmedPassword = passwordValue ? passwordValue.trim() : '';
    return (
      this.loginData.email.trim() !== '' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.loginData.email) &&
      trimmedPassword !== '' &&
      trimmedPassword.length >= 6 &&
      !this.emailError &&
      !this.passwordError
    );
  }

  get loginButtonText(): string {
    if (this.isLoading) return 'Signing In...';
    if (this.countdown > 0) return `Logging in... (${this.countdown})`;
    return 'Sign In';
  }

  resetForm(): void {
    this.loginData = { email: '', password: '' };
    this.rememberMe = false;
    this.isLoading = false;
    this.emailError = '';
    this.passwordError = '';
    this.fieldTouched = { email: false, password: false };
    this.stopAutoSubmit();
  }

  private showSnackbar(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass:
        type === 'success'
          ? ['snackbar-success']
          : type === 'error'
          ? ['snackbar-error']
          : type === 'warning'
          ? ['snackbar-warning']
          : ['snackbar-info']
    });
  }

  ngOnDestroy(): void {
    this.stopAutoSubmit();
  }
}