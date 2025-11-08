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
  
  // ✅ SIMPLE & RELIABLE public endpoints list
  const publicEndpoints = [
    // Auth endpoints
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    '/api/auth/refresh-token',
    
    // ✅ BUSINESS REGISTRATION - exact match
    '/api/external-business/register-business',
    
    // Public advertisements
    '/api/external-business/advertisements/approved',
    
    // M-Pesa endpoints
    '/api/open/mobile-money/',
    
    // Other public endpoints
    '/api/public/',
    '/api/open/'
  ];

  // ✅ SIMPLE CHECK: Is this a public endpoint?
  const isPublicEndpoint = publicEndpoints.some(endpoint => {
    // For business registration - exact match
    if (endpoint === '/api/external-business/register-business') {
      return req.url.includes('/api/external-business/register-business');
    }
    // For other endpoints - partial match
    return req.url.includes(endpoint);
  });

  console.log('🔐 Interceptor:');
  console.log('- URL:', req.url);
  console.log('- Is Public:', isPublicEndpoint);

  // ✅ CRITICAL: SKIP ALL AUTH for public endpoints
  if (isPublicEndpoint) {
    console.log('🚫 NO AUTH: Public endpoint detected');
    
    // Remove any existing auth headers
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    
    return next(cleanRequest);
  }

  // ✅ ONLY FOR PRIVATE ENDPOINTS: Continue with auth logic
  console.log('🔑 AUTH REQUIRED: Private endpoint');
  
  const isAuthRequest = req.url.includes('/auth/');
  const isRefreshTokenRequest = req.url.includes('/auth/refresh-token');

  // Token refresh logic (keep your existing code here)
  if (!isAuthRequest && !isRefreshTokenRequest && authService.isAuthenticated()) {
    if (authService.isTokenAboutToExpire()) {
      console.log('🔄 Token refresh needed');
      
      return authService.refreshToken().pipe(
        switchMap((refreshResponse) => {
          console.log('✅ Token refreshed');
          const newToken = authService.getToken();
          const authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`
            }
          });
          return next(authReq);
        }),
        catchError((refreshError) => {
          console.error('❌ Token refresh failed');
          authService.logoutSync();
          snackBar.open('Session expired. Please login again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          router.navigate(['/login']);
          return throwError(() => new Error('Session expired'));
        })
      );
    }
  }

  // Add auth header for private endpoints
  let finalRequest = req;
  const token = authService.getToken();
  
  if (token && authService.hasValidToken()) {
    finalRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('🔑 Auth header added');
  } else if (!token) {
    console.warn('⚠️ No token for private endpoint');
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Request failed:', error.status, error.url);

      if (error.status === 401 && !isPublicEndpoint) {
        authService.logoutSync();
        snackBar.open('Session expired. Please login again.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};