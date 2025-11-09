import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

// Simple token management
const getToken = (): string | null => {
  return localStorage.getItem('auth_token') || 
         localStorage.getItem('token') ||
         sessionStorage.getItem('auth_token');
};

const isTokenValid = (): boolean => {
  const token = getToken();
  if (!token) return false;

  try {
    // Check if it's a JWT token
    if (token.split('.').length === 3) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      
      if (isExpired) {
        console.warn('🔐 Token expired at:', new Date(payload.exp * 1000));
        logout();
        return false;
      }
      return true;
    }
    // If not JWT, assume valid
    return true;
  } catch (error) {
    console.warn('🔐 Token validation error, assuming valid');
    return true;
  }
};

const logout = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  sessionStorage.removeItem('auth_token');
  // ✅ FIXED: Use hash-based routing URL
  window.location.href = '/#/login';
};

const canRefreshToken = (): boolean => {
  return !!localStorage.getItem('refresh_token');
};

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  
  // Define ONLY truly public endpoints that don't require ANY authentication
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

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));
  const isPaymentEndpoint = req.url.includes('/mobile-money/');

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
  const token = getToken();
  
  if (token && isTokenValid()) {
    finalRequest = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}` 
      }
    });
    console.log('✅ Added valid Auth header to request');
  } else if (token) {
    console.warn('⚠️ Token exists but may be invalid - still sending request');
    finalRequest = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}` 
      }
    });
  } else {
    console.error('❌ No auth token available for protected endpoint');
    // Show specific error for payment endpoints
    if (isPaymentEndpoint) {
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
        isPaymentEndpoint,
        hasAuthHeader: finalRequest.headers.has('Authorization'),
        tokenExists: !!token,
        tokenValid: token ? isTokenValid() : false
      });

      // Handle 401 Unauthorized errors
      if (error.status === 401 && !isPublicEndpoint) {
        return handleUnauthorizedError(error, req, router, snackBar, token, isPaymentEndpoint);
      }

      // Handle 403 Forbidden errors
      if (error.status === 403) {
        console.warn('🚫 403 Forbidden - Insufficient permissions');
        snackBar.open('Access denied. You do not have permission for this action.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      }

      // Handle 500+ Server Errors
      if (error.status >= 500) {
        console.error('💥 Server Error:', error.status);
        snackBar.open('Server error. Please try again later.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      // Handle network errors
      if (error.status === 0) {
        console.error('🌐 Network Error - No connection');
        snackBar.open('Network error. Please check your internet connection.', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

      return throwError(() => error);
    })
  );
};

// Handle 401 Unauthorized errors
function handleUnauthorizedError(
  error: HttpErrorResponse,
  req: HttpRequest<any>,
  router: Router,
  snackBar: MatSnackBar,
  token: string | null,
  isPaymentEndpoint: boolean
) {
  
  const isLogoutEndpoint = req.url.includes('/auth/logout');
  const isRefreshEndpoint = req.url.includes('/auth/refresh-token');
  
  console.log('🔐 401 Error Analysis:', {
    isPaymentEndpoint,
    isLogoutEndpoint,
    isRefreshEndpoint,
    url: req.url,
    tokenExists: !!token,
    tokenValid: token ? isTokenValid() : false
  });

  // Case 1: Logout endpoint - expected 401, don't do anything
  if (isLogoutEndpoint) {
    console.log('🔐 Logout endpoint 401 - Expected behavior');
    return throwError(() => error);
  }

  // Case 2: Refresh token endpoint - avoid infinite loop
  if (isRefreshEndpoint) {
    console.error('🔐 Refresh token endpoint failed - forcing logout');
    logout();
    return throwError(() => error);
  }

  // Case 3: Payment endpoint - specific handling
  if (isPaymentEndpoint) {
    console.error('💳 Payment endpoint 401 - Authentication failed');
    
    if (token && isTokenValid()) {
      snackBar.open('Payment authentication failed. Please try logging in again.', 'Close', { 
        duration: 5000,
        panelClass: ['snackbar-error']
      });
    } else {
      snackBar.open('Please log in to make payments', 'Close', { 
        duration: 5000,
        panelClass: ['snackbar-error']
      });
    }
    
    // Don't auto-logout for payment errors - let user decide
    return throwError(() => error);
  }

  // Case 4: General 401 error - token is invalid
  console.warn('🔐 General 401 - Token is invalid/expired');
  
  if (token) {
    // Token exists but is invalid
    snackBar.open('Your session has expired. Please log in again.', 'Close', { 
      duration: 5000,
      panelClass: ['snackbar-warning']
    });
  } else {
    // No token at all
    snackBar.open('Please log in to continue', 'Close', { 
      duration: 5000,
      panelClass: ['snackbar-info']
    });
  }

  // Logout and redirect to login (with hash routing)
  logout();
  
  return throwError(() => error);
}