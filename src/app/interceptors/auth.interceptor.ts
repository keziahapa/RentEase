import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const skipAuth = [
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp'
  ].some(endpoint => req.url.includes(endpoint));

  let clonedReq = req;
  const token = authService.getToken();
  
  if (token && !skipAuth) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't auto-logout for invitation errors
      const isInvitationRequest = 
        req.url.includes('/invite-tenant') || 
        req.url.includes('/invite-caretaker');
      
      if (error.status === 401 && !skipAuth && !isInvitationRequest) {
        console.warn('Received 401 response for', req.url, '- keeping session and delegating to caller for fallback.');
      }
      
      // For invitation errors, just pass through the error without logging out
      return throwError(() => error);
    })
  );
};
