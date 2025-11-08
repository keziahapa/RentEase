import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    '/api/auth/refresh-token',
    '/api/external-business/advertisements/approved',
    '/api/open/mobile-money/stk-push',
    '/api/open/mobile-money/stk-push/callback', 
    '/api/open/mobile-money/validation',
    '/api/open/mobile-money/confirmation',
    '/api/open/mobile-money/transaction-status',
    '/api/public/',
    '/api/open/'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  console.log('🔐 Interceptor - URL:', req.url, 'Public:', isPublicEndpoint);

  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    return next(cleanRequest);
  }

  let finalRequest = req;
  const token = authService.getToken();
  
  if (token && authService.hasValidToken()) {
    finalRequest = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Request failed:', { url: req.url, status: error.status });

      // ✅ FIXED: Handle 401 errors intelligently
      if (error.status === 401 && !isPublicEndpoint) {
        const isAdminEndpoint = req.url.includes('/admin/');
        const isLogoutEndpoint = req.url.includes('/auth/logout');
        const isProfileEndpoint = req.url.includes('/api/profile');
        const isBusinessEndpoint = req.url.includes('/external-business/');
        
        console.log('🔐 401 Error Analysis:', {
          isAdminEndpoint,
          isLogoutEndpoint, 
          isProfileEndpoint,
          isBusinessEndpoint,
          url: req.url
        });

        if (isLogoutEndpoint) {
          console.log('🔐 Logout endpoint 401 - Expected behavior');
          return throwError(() => error);
        }
        else if (isBusinessEndpoint) {
          console.log('🔐 Business endpoint 401 - Allowing component to handle');
          return throwError(() => error);
        }
        else if (isAdminEndpoint) {
          console.warn('🛡️ Admin endpoint 401 - Permission issue');
          snackBar.open('Admin access required', 'Close', { duration: 5000 });
          return throwError(() => error);
        }
        else if (isProfileEndpoint) {
          console.warn('👤 Profile endpoint 401 - Data issue');
          return throwError(() => error);
        }
        else {
          console.warn('🔐 Regular endpoint 401 - Logging out');
          authService.logoutSync();
          snackBar.open('Session expired', 'Close', { duration: 5000 });
          router.navigate(['/login']);
        }
      }

      if (error.status === 403) {
        snackBar.open('Access denied', 'Close', { duration: 5000 });
      }

      if (error.status >= 500) {
        snackBar.open('Server error', 'Close', { duration: 5000 });
      }

      return throwError(() => error);
    })
  );
};