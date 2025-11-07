import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // ✅ ADD M-PESA ENDPOINTS TO SKIP AUTH
  const skipAuth = [
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    // ✅ ADD THESE M-PESA ENDPOINTS
    '/api/open/mobile-money/stk-push',
    '/api/open/mobile-money/stk-push/callback', 
    '/api/open/mobile-money/validation',
    '/api/open/mobile-money/confirmation',
    '/api/open/mobile-money/transaction-status'
  ].some(endpoint => req.url.includes(endpoint));

  let clonedReq = req;
  const token = authService.getToken();
  
  console.log('🔐 Interceptor - URL:', req.url);
  console.log('🔐 Interceptor - Token exists:', !!token);
  console.log('🔐 Interceptor - Skip auth:', skipAuth);
  
  if (token && !skipAuth) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('🔐 Interceptor - Added Authorization header');
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isInvitationRequest = 
        req.url.includes('/invite-tenant') || 
        req.url.includes('/invite-caretaker') ||
        req.url.includes('/invitations/details/'); 
      
      console.log('🔐 Interceptor - Request failed:', {
        url: req.url,
        status: error.status,
        isInvitationRequest: isInvitationRequest
      });
      
      if (error.status === 401 && !skipAuth && !isInvitationRequest) {
        console.warn('Received 401 response for', req.url, '- keeping session and delegating to caller for fallback.');
      }
      
      return throwError(() => error);
    })
  );
};