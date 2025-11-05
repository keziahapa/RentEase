import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const resetPasswordGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  try {
    const email = sessionStorage.getItem('resetEmail');
    const otpCode = sessionStorage.getItem('resetOtp');
    const otpVerified = sessionStorage.getItem('otpVerified');
    
   
    const isValid = 
      email !== null && 
      email !== '' && 
      otpCode !== null && 
      otpCode !== '' && 
      otpVerified === 'true';
    
    console.log('ResetPasswordGuard check:', {
      email: !!email,
      otpCode: !!otpCode,
      otpVerified,
      isValid
    });
    
    if (isValid) {
      return true;
    }
    
  
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('resetOtp');
    sessionStorage.removeItem('otpVerified');
    
    console.log('ResetPasswordGuard: Navigation not allowed, redirecting to forgot-password');
    
    router.navigate(['/forgot-password'], {
      queryParams: { 
        error: 'session_invalid',
        message: 'Please complete the password reset process from the beginning'
      },
      replaceUrl: true
    });
    
    return false;
    
  } catch (error) {
    console.error('ResetPasswordGuard error:', error);
    router.navigate(['/forgot-password']);
    return false;
  }
};