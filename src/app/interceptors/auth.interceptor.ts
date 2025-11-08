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

  // Remove Authorization header from public endpoints
  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    return next(cleanRequest);
  }

  // Add Authorization header to protected endpoints
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
        // Categorize the endpoint type
        const isLandlordEndpoint = req.url.includes('/landlord/');
        const isTenantEndpoint = req.url.includes('/tenant/');
        const isCaretakerEndpoint = req.url.includes('/caretaker/');
        const isAdminEndpoint = req.url.includes('/admin/');
        const isLogoutEndpoint = req.url.includes('/auth/logout');
        const isProfileEndpoint = req.url.includes('/api/profile');
        const isBusinessEndpoint = req.url.includes('/external-business/');
        
        console.log('🔐 401 Error Analysis:', {
          isLandlordEndpoint,
          isTenantEndpoint,
          isCaretakerEndpoint,
          isAdminEndpoint,
          isLogoutEndpoint, 
          isProfileEndpoint,
          isBusinessEndpoint,
          url: req.url
        });

        // Case 1: Logout endpoint - expected 401, don't do anything
        if (isLogoutEndpoint) {
          console.log('🔐 Logout endpoint 401 - Expected behavior');
          return throwError(() => error);
        }
        
        // Case 2: Role-based endpoints - user lacks permission, don't logout
        // Let the component handle this gracefully
        if (isLandlordEndpoint || isTenantEndpoint || isCaretakerEndpoint || 
            isAdminEndpoint || isBusinessEndpoint) {
          console.warn('🛡️ Role-based endpoint 401 - Insufficient permissions');
          snackBar.open('Access denied. You may not have permission for this action.', 'Close', { 
            duration: 5000 
          });
          return throwError(() => error);
        }
        
        // Case 3: Profile endpoint - data issue, not auth issue
        if (isProfileEndpoint) {
          console.warn('👤 Profile endpoint 401 - Data issue');
          return throwError(() => error);
        }
        
        // Case 4: General endpoint - this is a real auth failure, logout required
        console.warn('🔐 General endpoint 401 - Session invalid, logging out');
        authService.logoutSync();
        snackBar.open('Session expired. Please log in again.', 'Close', { duration: 5000 });
        router.navigate(['/login']);
      }

      // Handle 403 Forbidden
      if (error.status === 403) {
        snackBar.open('Access denied - insufficient permissions', 'Close', { duration: 5000 });
      }

      // Handle 500+ Server Errors
      if (error.status >= 500) {
        snackBar.open('Server error. Please try again later.', 'Close', { duration: 5000 });
      }

      return throwError(() => error);
    })
  );
};