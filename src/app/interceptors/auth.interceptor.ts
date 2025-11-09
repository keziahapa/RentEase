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
  
  // ✅ FIXED: ONLY endpoints that truly don't need authentication
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
    '/api/external-business/advertisements/approved'
    // ❌ REMOVED: All payment endpoints - they need auth!
    // ❌ REMOVED: '/api/open/' - payment endpoints are under this path but NEED auth
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  console.log('🔐 Interceptor - URL:', req.url, 'Public:', isPublicEndpoint, 'NeedsAuth:', !isPublicEndpoint);

  // Remove Authorization header ONLY from truly public endpoints
  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    console.log('🔐 Removed Auth header from public endpoint');
    return next(cleanRequest);
  }

  // ✅ FIXED: ALL other endpoints (including /api/open/mobile-money/) get auth headers
  let finalRequest = req;
  const token = authService.getToken();
  
  if (token) {
    finalRequest = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}` 
      }
    });
    console.log('✅ Added Auth header to request:', finalRequest.headers.keys());
  } else {
    console.error('❌ No auth token found for protected endpoint:', req.url);
    // Show error for payment endpoints specifically
    if (req.url.includes('/mobile-money/')) {
      snackBar.open('Please log in to make payments', 'Close', { 
        duration: 5000,
        panelClass: ['snackbar-error']
      });
    }
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Request failed:', { 
        url: req.url, 
        status: error.status,
        error: error.message,
        isPublicEndpoint,
        hasAuthHeader: finalRequest.headers.has('Authorization')
      });

      // Handle payment endpoint errors specifically
      if (error.status === 401 && req.url.includes('/mobile-money/')) {
        const hasAuth = finalRequest.headers.has('Authorization');
        console.error('💳 Payment 401 - Auth Header Present:', hasAuth);
        
        if (!hasAuth) {
          snackBar.open('Authentication missing. Please log in again.', 'Close', { 
            duration: 5000,
            panelClass: ['snackbar-error']
          });
        } else {
          snackBar.open('Payment authentication failed. Please check your login.', 'Close', { 
            duration: 5000,
            panelClass: ['snackbar-error']
          });
        }
      }

      return throwError(() => error);
    })
  );
};