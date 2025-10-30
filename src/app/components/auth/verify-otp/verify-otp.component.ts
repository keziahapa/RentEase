import { Component, ViewChildren, QueryList, ElementRef, AfterViewInit, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { BusinessService } from '../../../services/business.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { OtpVerifyRequest, OtpRequest } from '../../../services/auth-interfaces';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.scss']
})
export class VerifyOtpComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  otpData = {
    digit1: '', digit2: '', digit3: '', digit4: '', digit5: '', digit6: '', digit7: ''
  };

  isLoading = false;
  isResending = false;
  resendTimer = 0;
  canResend = true;

  email = '';
  userType = '';
  phoneNumber = '';

  pageTitle = 'Verify Your Account';
  infoText = 'We\'ve sent a 7-character verification code to your email';

  private resendTimerInterval: any;
  private subscription = new Subscription();

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private businessService = inject(BusinessService);
  private snackBar = inject(MatSnackBar);

  ngOnInit() {
    this.initializeComponent();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      const firstInput = this.otpInputs.first;
      if (firstInput) firstInput.nativeElement.focus();
    }, 100);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.clearResendTimer();
  }

  private initializeComponent() {
    this.subscription.add(
      this.route.queryParams.subscribe(params => {
        this.email = (params['email'] || '').trim().toLowerCase();
        this.userType = params['userType'] || '';
        this.phoneNumber = params['phoneNumber'] || '';

        console.log('🔍 OTP Component - Query Params:', params);
        console.log('🔍 OTP Component - userType:', this.userType);

        if (!this.email) {
          this.showMessage('No email found. Please restart the process.', 'error');
          setTimeout(() => this.router.navigate(['/registration']), 3000);
          return;
        }

        this.phoneNumber = this.extractPhoneNumber();
        this.updateUIText();
      })
    );
  }

  private extractPhoneNumber(): string {
    const sources = [
      () => this.route.snapshot.queryParams['phoneNumber'],
      () => {
        try {
          const pendingUser = sessionStorage.getItem('pendingUser');
          return pendingUser ? JSON.parse(pendingUser).phoneNumber : null;
        } catch {
          return null;
        }
      },
      () => sessionStorage.getItem('pendingPhoneNumber'),
      () => {
        try {
          const navigation = this.router.getCurrentNavigation();
          return navigation?.extras?.state?.['phoneNumber'] || null;
        } catch {
          return null;
        }
      },
      () => {
        try {
          const pendingVerification = sessionStorage.getItem('pendingVerificationEmail');
          if (pendingVerification) {
            const pendingUser = sessionStorage.getItem('pendingUser');
            return pendingUser ? JSON.parse(pendingUser).phoneNumber : null;
          }
          return null;
        } catch {
          return null;
        }
      }
    ];

    for (const source of sources) {
      const phone = source();
      if (phone && this.isValidPhoneNumber(phone)) {
        return phone;
      }
    }

    return '';
  }

  private isValidPhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/\s/g, '');
    return /^(\+254|0)[1-9]\d{8}$/.test(cleanPhone);
  }

  private updateUIText() {
    const userTypeDisplay = this.getUserTypeDisplay();
    this.pageTitle = `Verify Your ${userTypeDisplay} Account`;
    this.infoText = `We've sent a 7-character code to complete your ${userTypeDisplay.toLowerCase()} registration`;
  }

  private getUserTypeDisplay(): string {
    if (!this.userType) return 'User';
    
    const normalized = this.userType.toLowerCase().trim();
    const displayMap: { [key: string]: string } = {
      'landlord': 'Landlord',
      'tenant': 'Tenant',
      'caretaker': 'Caretaker',
      'business': 'Business',
      'admin': 'Admin',
    };
    
    return displayMap[normalized] || this.userType.charAt(0).toUpperCase() + this.userType.slice(1);
  }

  async verifyOtp() {
    if (this.isLoading) return;

    const otpCode = Object.values(this.otpData).join('').toUpperCase();
    const validationError = this.validateOtp(otpCode);

    if (validationError) {
      this.showMessage(validationError, 'error');
      this.shakeInputs();
      return;
    }

    this.isLoading = true;

    try {
      const verifyRequest: OtpVerifyRequest = {
        email: this.email,
        otpCode: otpCode,
        type: 'email_verification'
      };

      const response = await firstValueFrom(this.authService.verifyOtp(verifyRequest));

      if (response.success) {
        this.showMessage('Verification successful! Redirecting...', 'success');
        await this.handleSuccessfulVerification(response);
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      this.handleVerificationError(error);
      this.shakeInputs();
      this.clearOtpInputs();
    } finally {
      this.isLoading = false;
    }
  }

  private validateOtp(otpCode: string): string | null {
    if (!otpCode) return 'Please enter the verification code.';
    if (otpCode.length !== 7) return `Code must be 7 characters. You entered ${otpCode.length}.`;
    if (!/^[A-Z][0-9]{6}$/.test(otpCode)) {
      return 'Code must be 1 letter followed by 6 numbers (e.g., A123456).';
    }
    return null;
  }

  private async handleSuccessfulVerification(response: any) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('🔍 Verification Response:', response);
    console.log('🔍 Query param userType:', this.userType);
    
    const userRole = this.userType || response.user?.role || '';
    console.log('🔍 Final determined role for navigation:', userRole);

    if (!userRole) {
      this.showMessage('User role not found. Please contact support.', 'error');
      await this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    if (userRole.toUpperCase() === 'BUSINESS') {
      await this.handleBusinessUserVerification();
    } else {
      await this.handleRegularUserVerification(userRole);
    }
  }

  private async handleBusinessUserVerification() {
    try {
      const hasBusinessProfile = await firstValueFrom(this.businessService.hasBusinessProfile());
      
      if (hasBusinessProfile) {
        await this.router.navigate(['/business-dashboard'], { replaceUrl: true });
      } else {
        await this.router.navigate(['/business-registration'], { replaceUrl: true });
      }
    } catch (error) {
      console.error('Error checking business profile:', error);
      await this.router.navigate(['/business-registration'], { replaceUrl: true });
    }
  }

  private async handleRegularUserVerification(userRole: string) {
    const dashboardRoute = this.getDashboardRoute(userRole);
    
    console.log('🔍 Navigating to dashboard route:', dashboardRoute);
    
    // If no valid route, it will redirect to login
    if (dashboardRoute === '/login') {
      return; // Error already shown, user will be at login
    }
    
    try {
      const navigationSuccess = await this.router.navigate([dashboardRoute], { 
        replaceUrl: true 
      });
      
      if (!navigationSuccess) {
        console.error('❌ Navigation failed for route:', dashboardRoute);
        this.showMessage('Dashboard navigation failed. Please try logging in manually.', 'error');
        await this.router.navigate(['/login'], { replaceUrl: true });
      }
    } catch (navigationError) {
      console.error('Navigation error:', navigationError);
      this.showMessage('Navigation error. Please try logging in manually.', 'error');
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private getDashboardRoute(role: string): string {
    console.log('🔍 getDashboardRoute called with role:', role);
    
    const normalizedRole = role.toUpperCase().trim();
    console.log('🔍 Normalized role:', normalizedRole);
    
    const routeMap: { [key: string]: string } = {
      'LANDLORD': '/landlord-dashboard/home',
      'TENANT': '/tenant-dashboard/dashboard', 
      'CARETAKER': '/caretaker-dashboard/overview',
      'BUSINESS': '/business-dashboard/dashboard',
      'ADMIN': '/admin-dashboard/overview'
    };
    
    // NO FALLBACK - Each role must have specific route
    if (!routeMap[normalizedRole]) {
      console.error('❌ No dashboard route defined for role:', normalizedRole);
      this.showMessage(`No dashboard configured for ${role} role. Please contact support.`, 'error');
      return '/login'; // Redirect to login instead of wrong dashboard
    }
    
    const finalRoute = routeMap[normalizedRole];
    console.log('🔍 Final route:', finalRoute);
    
    return finalRoute;
  }

  private handleVerificationError(error: any) {
    const errorMsg = (error.message || '').toLowerCase();
    
    if (errorMsg.includes('expired')) {
      this.showMessage('Code has expired. Please request a new one.', 'error');
      this.canResend = true;
    } else if (errorMsg.includes('invalid')) {
      this.showMessage('Invalid code. Please check and try again.', 'error');
    } else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      this.showMessage('Account not found. Please check your email or register.', 'error');
    } else if (errorMsg.includes('already verified')) {
      this.showMessage('Account already verified. Redirecting...', 'info');
      const userRole = this.userType || '';
      if (userRole.toUpperCase() === 'BUSINESS') {
        this.handleBusinessUserVerification();
      } else if (userRole) {
        const dashboardRoute = this.getDashboardRoute(userRole);
        if (dashboardRoute !== '/login') {
          this.router.navigate([dashboardRoute]);
        }
      } else {
        this.router.navigate(['/login']);
      }
    } else {
      this.showMessage(error.message || 'Verification failed. Please try again.', 'error');
    }
  }

  async resendOtp() {
    if (!this.canResend || this.isLoading || this.isResending) return;
    
    this.isResending = true;

    try {
      const resendRequest: OtpRequest = {
        email: this.email,
        type: 'email_verification'
      };

      const response = await firstValueFrom(this.authService.resendOtp(resendRequest));

      if (response.success) {
        this.showMessage('New code sent! Check your email.', 'success');
        this.startResendTimer();
        this.clearOtpInputs();
      } else {
        throw new Error(response.message || 'Failed to resend code');
      }
    } catch (error: any) {
      this.showMessage(error.message || 'Failed to resend code. Please try again.', 'error');
    } finally {
      this.isResending = false;
    }
  }

  private startResendTimer() {
    this.canResend = false;
    this.resendTimer = 60;
    
    this.clearResendTimer();
    this.resendTimerInterval = setInterval(() => {
      this.resendTimer--;
      if (this.resendTimer <= 0) {
        this.clearResendTimer();
        this.canResend = true;
      }
    }, 1000);
  }

  private clearResendTimer() {
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
      this.resendTimerInterval = null;
    }
  }

  onDigitInput(event: any, position: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
    
    if (position === 1) {
      value = value.replace(/[^A-Z]/g, '');
    } else {
      value = value.replace(/[^0-9]/g, '');
    }

    const digitKey = `digit${position}` as keyof typeof this.otpData;
    this.otpData[digitKey] = value.slice(-1);

    if (value && position < 7) {
      const nextInput = this.otpInputs.toArray()[position];
      if (nextInput) nextInput.nativeElement.focus();
    }

    if (this.isOtpComplete() && !this.isLoading) {
      setTimeout(() => this.verifyOtp(), 300);
    }
  }

  onKeyDown(event: KeyboardEvent, position: number) {
    const digitKey = `digit${position}` as keyof typeof this.otpData;
    
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.otpData[digitKey]) {
        this.otpData[digitKey] = '';
      } else if (position > 1) {
        const prevKey = `digit${position - 1}` as keyof typeof this.otpData;
        this.otpData[prevKey] = '';
        const prevInput = this.otpInputs.toArray()[position - 2];
        if (prevInput) prevInput.nativeElement.focus();
      }
    } else if (event.key === 'Enter' && this.isOtpComplete() && !this.isLoading) {
      this.verifyOtp();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const cleanOtp = pastedData.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

    for (let i = 0; i < cleanOtp.length && i < 7; i++) {
      const key = `digit${i + 1}` as keyof typeof this.otpData;
      const char = cleanOtp[i];
      this.otpData[key] = i === 0 ? (/[A-Z]/.test(char) ? char : '') : (/[0-9]/.test(char) ? char : '');
    }

    if (cleanOtp.length === 7) {
      setTimeout(() => this.verifyOtp(), 300);
    }
  }

  isOtpComplete(): boolean {
    return Object.values(this.otpData).every(digit => digit.length === 1);
  }

  private clearOtpInputs() {
    Object.keys(this.otpData).forEach(key => {
      (this.otpData as any)[key] = '';
    });
    setTimeout(() => {
      const firstInput = this.otpInputs.first;
      if (firstInput) firstInput.nativeElement.focus();
    }, 100);
  }

  private shakeInputs() {
    const container = document.querySelector('.otp-inputs');
    if (container) {
      container.classList.add('shake');
      setTimeout(() => container.classList.remove('shake'), 500);
    }
  }

  goBack() {
    this.router.navigate(['/registration']);
  }

  getResendText(): string {
    if (this.isResending) return 'Sending...';
    return this.canResend ? 'Resend Code' : `Resend in ${this.resendTimer}s`;
  }

  getDisplayEmail(): string {
    if (!this.email) return '';
    const [localPart, domain] = this.email.split('@');
    if (!domain) return this.email;
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(Math.min(localPart.length - 2, 3))
      : localPart;
    return `${maskedLocal}@${domain}`;
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.snackBar.open(message, 'Close', {
      duration: type === 'error' ? 5000 : 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`snackbar-${type}`]
    });
  }
}