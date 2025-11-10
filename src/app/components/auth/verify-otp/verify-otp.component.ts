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

        if (!this.email) {
          // Try to get email from session storage as fallback
          const pendingEmail = this.authService.getPendingEmail();
          if (pendingEmail) {
            this.email = pendingEmail;
          } else {
            this.showMessage('No email found. Please restart the process.', 'error');
            setTimeout(() => this.router.navigate(['/registration']), 3000);
            return;
          }
        }

        this.phoneNumber = this.extractPhoneNumber();
        this.updateUIText();
        
        // Auto-start resend timer if needed
        if (!this.canResend) {
          this.startResendTimer();
        }
      })
    );
  }

  private extractPhoneNumber(): string {
    try {
      const pendingUser = sessionStorage.getItem('pendingUser');
      if (pendingUser) {
        const userData = JSON.parse(pendingUser);
        return userData.phoneNumber || '';
      }
      return this.route.snapshot.queryParams['phoneNumber'] || '';
    } catch {
      return '';
    }
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

      console.log('🔐 Verifying OTP:', verifyRequest);

      const response = await firstValueFrom(this.authService.verifyOtp(verifyRequest));

      console.log('🔐 OTP Verification Response:', response);

      if (response.success) {
  this.showMessage('Email verified successfully!', 'success');
  
  setTimeout(() => {
    this.router.navigate(['/waiting-landlord'], {
      queryParams: {
        email: this.email,
        userType: this.userType
      },
      replaceUrl: true
    });
  }, 1500);
} else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      console.error('🔐 OTP Verification Error:', error);
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
      this.showMessage('Account already verified. Redirecting to login...', 'info');
      setTimeout(() => {
        this.router.navigate(['/login'], { 
          queryParams: { email: this.email }
        });
      }, 2000);
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
      console.error('🔐 Resend OTP Error:', error);
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

  onDigitInput(event: Event, position: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
    
    // Validate input based on position
    if (position === 1) {
      // First character must be a letter
      value = value.replace(/[^A-Z]/g, '');
    } else {
      // Remaining characters must be numbers
      value = value.replace(/[^0-9]/g, '');
    }

    const digitKey = `digit${position}` as keyof typeof this.otpData;
    this.otpData[digitKey] = value.slice(-1);

    // Auto-focus next input
    if (value && position < 7) {
      const nextInput = this.otpInputs.toArray()[position];
      if (nextInput) {
        setTimeout(() => nextInput.nativeElement.focus(), 10);
      }
    }

    // Auto-submit when complete
    if (this.isOtpComplete() && !this.isLoading) {
      setTimeout(() => this.verifyOtp(), 300);
    }
  }

  onKeyDown(event: KeyboardEvent, position: number) {
    const digitKey = `digit${position}` as keyof typeof this.otpData;
    
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (!this.otpData[digitKey] && position > 1) {
        // Move to previous input if current is empty
        const prevInput = this.otpInputs.toArray()[position - 2];
        if (prevInput) {
          prevInput.nativeElement.focus();
          // Clear the previous input
          const prevKey = `digit${position - 1}` as keyof typeof this.otpData;
          this.otpData[prevKey] = '';
        }
      } else {
        // Clear current input
        this.otpData[digitKey] = '';
      }
    } else if (event.key === 'Enter' && this.isOtpComplete() && !this.isLoading) {
      this.verifyOtp();
    } else if (event.key === 'ArrowLeft' && position > 1) {
      event.preventDefault();
      const prevInput = this.otpInputs.toArray()[position - 2];
      if (prevInput) prevInput.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && position < 7) {
      event.preventDefault();
      const nextInput = this.otpInputs.toArray()[position];
      if (nextInput) nextInput.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const cleanOtp = pastedData.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

    if (cleanOtp.length === 7 && /^[A-Z][0-9]{6}$/.test(cleanOtp)) {
      // Fill all inputs with pasted data
      for (let i = 0; i < 7; i++) {
        const key = `digit${i + 1}` as keyof typeof this.otpData;
        this.otpData[key] = cleanOtp[i];
      }
      
      // Auto-verify after paste
      setTimeout(() => {
        if (this.isOtpComplete() && !this.isLoading) {
          this.verifyOtp();
        }
      }, 300);
    } else {
      this.showMessage('Invalid code format. Must be 1 letter + 6 numbers.', 'error');
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

  getResendButtonDisabled(): boolean {
    return !this.canResend || this.isLoading || this.isResending;
  }

  getVerifyButtonDisabled(): boolean {
    return !this.isOtpComplete() || this.isLoading;
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