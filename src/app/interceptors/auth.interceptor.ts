import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError, switchMap, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  
  // ✅ ENDPOINTS TO SKIP AUTH - INCLUDING EXTERNAL BUSINESS REGISTRATION
  const skipAuthEndpoints = [
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    '/api/auth/refresh-token',
    // ✅ EXTERNAL BUSINESS ENDPOINTS (SHOULD BE PUBLIC)
    '/api/external-business/register-business',
    '/api/external-business/',
    // ✅ M-PESA ENDPOINTS
    '/api/open/mobile-money/stk-push',
    '/api/open/mobile-money/stk-push/callback', 
    '/api/open/mobile-money/validation',
    '/api/open/mobile-money/confirmation',
    '/api/open/mobile-money/transaction-status',
    // ✅ PUBLIC ENDPOINTS
    '/api/public/',
    '/api/open/'
  ];

  const shouldSkipAuth = skipAuthEndpoints.some(endpoint => req.url.includes(endpoint));
  const isAuthRequest = req.url.includes('/auth/');
  const isRefreshTokenRequest = req.url.includes('/auth/refresh-token');

  console.log('🔐 Interceptor - URL:', req.url);
  console.log('🔐 Interceptor - Skip auth:', shouldSkipAuth);
  console.log('🔐 Interceptor - Is auth request:', isAuthRequest);

  // Check if token needs refresh (skip for auth requests, refresh token requests, and public endpoints)
  if (!shouldSkipAuth && !isAuthRequest && !isRefreshTokenRequest && authService.isAuthenticated()) {
    if (authService.isTokenAboutToExpire()) {
      console.log('🔄 Token is about to expire, attempting refresh...');
      
      return authService.refreshToken().pipe(
        switchMap((refreshResponse) => {
          console.log('✅ Token refreshed successfully, proceeding with original request');
          // Retry the original request with new token
          const newToken = authService.getToken();
          const authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`
            }
          });
          return next(authReq);
        }),
        catchError((refreshError) => {
          console.error('❌ Token refresh failed:', refreshError);
          // Refresh failed, logout user
          authService.logoutSync();
          snackBar.open('Your session has expired. Please log in again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          router.navigate(['/login']);
          return throwError(() => new Error('Session expired'));
        })
      );
    }
  }

  // Add authorization header only for requests that need it and have valid token
  let clonedReq = req;
  const token = authService.getToken();
  
  if (token && !shouldSkipAuth && authService.hasValidToken()) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('🔐 Interceptor - Added Authorization header');
  } else if (token && !shouldSkipAuth && !authService.hasValidToken()) {
    console.warn('🔐 Interceptor - Token exists but is invalid, clearing auth data');
    authService.clearCorruptedStorage();
  } else if (!token && !shouldSkipAuth) {
    console.warn('🔐 Interceptor - No token available for authenticated endpoint:', req.url);
  } else if (shouldSkipAuth) {
    console.log('🔐 Interceptor - Skipping auth for public endpoint');
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('🔐 Interceptor - Request failed:', {
        url: req.url,
        status: error.status,
        statusText: error.statusText,
        error: error.error
      });

      const isInvitationRequest = 
        req.url.includes('/invite-tenant') || 
        req.url.includes('/invite-caretaker') ||
        req.url.includes('/invitations/details/');

     
      if (error.status === 401 && !shouldSkipAuth && !isInvitationRequest) {
        console.warn('🔐 Interceptor - 401 Unauthorized for', req.url);
        
        if (!isRefreshTokenRequest) {
          authService.logoutSync();
          snackBar.open('Your session has expired. Please log in again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          router.navigate(['/login']);
        }
      }

    
      if (error.status === 403) {
        console.warn('🔐 Interceptor - 403 Forbidden for', req.url);
        snackBar.open('You do not have permission to access this resource.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }

    
      if (error.status >= 500) {
        console.error('🔐 Interceptor - Server error for', req.url);
        snackBar.open('Server error. Please try again later.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }

    
      if (error.status === 0) {
        console.error('🔐 Interceptor - Network error for', req.url);
        snackBar.open('Network error. Please check your connection.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }

      return throwError(() => error);
    })
  );
};