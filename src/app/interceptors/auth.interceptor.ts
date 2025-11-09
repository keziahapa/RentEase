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

      // ✅ FIXED: Handle 401 errors intelligently - NO AUTO LOGOUT
      if (error.status === 401 && !isPublicEndpoint) {
        // Categorize the endpoint type
        const isLandlordEndpoint = req.url.includes('/landlord/');
        const isTenantEndpoint = req.url.includes('/tenant/');
        const isCaretakerEndpoint = req.url.includes('/caretaker/');
        const isAdminEndpoint = req.url.includes('/admin/');
        const isLogoutEndpoint = req.url.includes('/auth/logout');
        const isProfileEndpoint = req.url.includes('/api/profile');
        const isBusinessEndpoint = req.url.includes('/external-business/');
        const isCommunicationsEndpoint = req.url.includes('/communications/');
        
        console.log('🔐 401 Error Analysis:', {
          isLandlordEndpoint,
          isTenantEndpoint,
          isCaretakerEndpoint,
          isAdminEndpoint,
          isLogoutEndpoint, 
          isProfileEndpoint,
          isBusinessEndpoint,
          isCommunicationsEndpoint,
          url: req.url,
          tokenExists: !!token,
          tokenValid: authService.hasValidToken()
        });

        // Case 1: Logout endpoint - expected 401, don't do anything
        if (isLogoutEndpoint) {
          console.log('🔐 Logout endpoint 401 - Expected behavior');
          return throwError(() => error);
        }
        
        // Case 2: Check if token is actually valid - if yes, this is authorization issue
        if (authService.hasValidToken()) {
          console.warn('🛡️ Token is valid but endpoint returned 401 - This is an AUTHORIZATION issue (permissions)');
          
          // Show appropriate message but DON'T logout
          if (isCommunicationsEndpoint) {
            console.warn('📱 Communications endpoint 401 - User may not have notification permissions');
            // Don't show snackbar for this - let the component handle it silently
          } 
          else if (isLandlordEndpoint || isTenantEndpoint || isCaretakerEndpoint || 
                  isAdminEndpoint || isBusinessEndpoint || isProfileEndpoint) {
            console.warn('🛡️ Role/feature-based endpoint 401 - Insufficient permissions');
            snackBar.open('Access denied. You may not have permission for this action.', 'Close', { 
              duration: 5000,
              panelClass: ['snackbar-warning']
            });
          }
          
          // Return the error - let the component handle it
          return throwError(() => error);
        }
        
        // Case 3: Token is invalid/expired - try silent re-authentication
        console.warn('🔐 Token invalid/expired - Attempting silent re-authentication');
        
        // Try silent re-authentication if credentials are stored
        if (authService.canRefreshToken()) {
          authService.silentReauth().subscribe({
            next: (success) => {
              if (success) {
                console.log('✅ Silent re-authentication successful - token refreshed');
                snackBar.open('Session refreshed automatically', 'Close', { 
                  duration: 3000,
                  panelClass: ['snackbar-success']
                });
                // The component should retry the request
              } else {
                console.warn('❌ Silent re-authentication failed - token may be permanently invalid');
                // Don't auto-logout - let user continue working
                snackBar.open('Session issue detected. Some features may not work.', 'Close', { 
                  duration: 5000,
                  panelClass: ['snackbar-warning']
                });
              }
            },
            error: () => {
              console.warn('❌ Silent re-authentication error');
              // Don't auto-logout - let user continue working
            }
          });
        } else {
          console.warn('🔐 No stored credentials for silent re-authentication');
          // Don't auto-logout - let user continue working
          snackBar.open('Please log in again to refresh your session.', 'Close', { 
            duration: 5000,
            panelClass: ['snackbar-info']
          });
        }
        
        // Return the error - NEVER auto-logout from interceptor
        return throwError(() => error);
      }

      // Handle 403 Forbidden
      if (error.status === 403) {
        snackBar.open('Access denied - insufficient permissions', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }

      // Handle 500+ Server Errors
      if (error.status >= 500) {
        snackBar.open('Server error. Please try again later.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      // Handle network errors
      if (error.status === 0) {
        snackBar.open('Network error. Please check your connection.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      return throwError(() => error);
    })
  );
};