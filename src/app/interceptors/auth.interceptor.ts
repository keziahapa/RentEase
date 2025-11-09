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
  
  // Define truly public endpoints that don't require ANY authentication
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
    '/api/public/'
  ];

  // Payment endpoints - REMOVED from public endpoints as they require authentication
  const paymentEndpoints = [
    '/api/open/mobile-money/stk-push',
    '/api/open/mobile-money/stk-push/callback', 
    '/api/open/mobile-money/validation',
    '/api/open/mobile-money/confirmation',
    '/api/open/mobile-money/transaction-status'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));
  const isPaymentEndpoint = paymentEndpoints.some(endpoint => req.url.includes(endpoint));

  console.log('🔐 Interceptor - URL:', req.url, 'Public:', isPublicEndpoint, 'Payment:', isPaymentEndpoint);

  // Remove Authorization header ONLY from truly public endpoints
  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    console.log('🔐 Removed Auth header from public endpoint');
    return next(cleanRequest);
  }

  // Add Authorization header to ALL other endpoints (including payment endpoints)
  let finalRequest = req;
  const token = authService.getToken();
  
  if (token) {
    finalRequest = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}` 
      }
    });
    console.log('🔐 Added Auth header to request');
  } else {
    console.warn('🔐 No auth token available for protected endpoint:', req.url);
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Request failed:', { 
        url: req.url, 
        status: error.status,
        error: error.message,
        isPublicEndpoint,
        isPaymentEndpoint
      });

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
        const isPaymentEndpoint = req.url.includes('/mobile-money/');
        
        console.log('🔐 401 Error Analysis:', {
          isLandlordEndpoint,
          isTenantEndpoint,
          isCaretakerEndpoint,
          isAdminEndpoint,
          isLogoutEndpoint, 
          isProfileEndpoint,
          isBusinessEndpoint,
          isCommunicationsEndpoint,
          isPaymentEndpoint,
          url: req.url,
          tokenExists: !!token,
          tokenValid: authService.hasValidToken ? authService.hasValidToken() : 'method-not-available'
        });

        // Case 1: Logout endpoint - expected 401, don't do anything
        if (isLogoutEndpoint) {
          console.log('🔐 Logout endpoint 401 - Expected behavior');
          return throwError(() => error);
        }
        
        // Case 2: Payment endpoint 401 - specific handling
        if (isPaymentEndpoint) {
          console.error('💳 Payment endpoint 401 - Authentication required for payments');
          snackBar.open('Authentication required for payments. Please ensure you are logged in.', 'Close', { 
            duration: 5000,
            panelClass: ['snackbar-warning']
          });
          return throwError(() => error);
        }
        
        // Case 3: Check if token is actually valid - if yes, this is authorization issue
        if (authService.hasValidToken && authService.hasValidToken()) {
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
        
        // Case 4: Token is invalid/expired - try silent re-authentication
        console.warn('🔐 Token invalid/expired - Attempting silent re-authentication');
        
        // Try silent re-authentication if credentials are stored
        if (authService.canRefreshToken && authService.canRefreshToken()) {
          if (authService.silentReauth) {
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
                
                  snackBar.open('Session issue detected. Some features may not work.', 'Close', { 
                    duration: 5000,
                    panelClass: ['snackbar-warning']
                  });
                }
              },
              error: () => {
                console.warn('❌ Silent re-authentication error');
              
              }
            });
          }
        } else {
          console.warn('🔐 No stored credentials for silent re-authentication');
       
          snackBar.open('Please log in again to refresh your session.', 'Close', { 
            duration: 5000,
            panelClass: ['snackbar-info']
          });
        }
        
      
        return throwError(() => error);
      }

    
      if (error.status === 403) {
        console.warn('🚫 403 Forbidden - Insufficient permissions');
        snackBar.open('Access denied - insufficient permissions', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }

    
      if (error.status === 400) {
        console.warn('⚠️ 400 Bad Request - Invalid input');
        
      }

    
      if (error.status === 404) {
        console.warn('🔍 404 Not Found - Resource not available');
        snackBar.open('Requested resource not found', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }

    
      if (error.status === 422) {
        console.warn('📝 422 Unprocessable Entity - Validation failed');
      
      }

     
      if (error.status === 429) {
        console.warn('🚦 429 Too Many Requests - Rate limit exceeded');
        snackBar.open('Too many requests. Please slow down.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }

   
      if (error.status >= 500) {
        console.error('💥 Server Error:', error.status);
        snackBar.open('Server error. Please try again later.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      if (error.status === 0) {
        console.error('🌐 Network Error - No connection');
        snackBar.open('Network error. Please check your connection.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      return throwError(() => error);
    })
  );
};