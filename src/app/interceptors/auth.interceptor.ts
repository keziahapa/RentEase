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
  
  // ✅ FIXED: Business registration REMOVED from public endpoints
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
    
    // ❌ BUSINESS REGISTRATION REMOVED - it requires authentication
    // '/api/external-business/register-business', ← REMOVED THIS LINE
    
    // Public advertisements
    '/api/external-business/advertisements/approved',
    
    // M-Pesa endpoints
    '/api/open/mobile-money/stk-push',
    '/api/open/mobile-money/stk-push/callback', 
    '/api/open/mobile-money/validation',
    '/api/open/mobile-money/confirmation',
    '/api/open/mobile-money/transaction-status',
    
    // Other public endpoints
    '/api/public/',
    '/api/open/'
  ];

  // ✅ Check if current URL matches any public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => {
    const fullUrl = req.url.toLowerCase();
    const endpointLower = endpoint.toLowerCase();
    
    // For exact matches
    if (endpoint === '/api/external-business/advertisements/approved') {
      return fullUrl.includes('/api/external-business/advertisements/approved');
    }
    
    // For prefix matches
    return fullUrl.includes(endpointLower);
  });

  console.log('🔐 Interceptor:');
  console.log('- URL:', req.url);
  console.log('- Is Public:', isPublicEndpoint);

  // ✅ SKIP AUTH only for truly public endpoints
  if (isPublicEndpoint) {
    console.log('🚫 NO AUTH: Public endpoint detected');
    
    // Remove any existing auth headers
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    
    return next(cleanRequest);
  }

  // ✅ BUSINESS REGISTRATION & OTHER PRIVATE ENDPOINTS: Require auth
  console.log('🔑 AUTH REQUIRED: Private endpoint');
  
  const isAuthRequest = req.url.includes('/auth/');
  const isRefreshTokenRequest = req.url.includes('/auth/refresh-token');

  // Token refresh logic for authenticated endpoints
  if (!isAuthRequest && !isRefreshTokenRequest && authService.isAuthenticated()) {
    if (authService.isTokenAboutToExpire()) {
      console.log('🔄 Token is about to expire, attempting refresh...');
      
      return authService.refreshToken().pipe(
        switchMap((refreshResponse) => {
          console.log('✅ Token refreshed successfully');
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

  // ✅ ADD AUTH HEADER for private endpoints (including business registration)
  let finalRequest = req;
  const token = authService.getToken();
  
  if (token && authService.hasValidToken()) {
    finalRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('🔐 Auth header added for private endpoint');
  } else if (token && !authService.hasValidToken()) {
    console.warn('⚠️ Token exists but is invalid');
    authService.clearCorruptedStorage();
  } else if (!token) {
    console.warn('⚠️ No token available for authenticated endpoint');
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ Request failed:', {
        url: req.url,
        status: error.status,
        error: error.error
      });

      // Handle 401 errors for private endpoints
      if (error.status === 401 && !isPublicEndpoint) {
        console.warn('🔐 401 Unauthorized - Authentication required');
        
        if (!isRefreshTokenRequest) {
          authService.logoutSync();
          snackBar.open('Authentication required. Please log in again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          router.navigate(['/login']);
        }
      }

      // Handle other error cases
      if (error.status === 403) {
        snackBar.open('Access denied. You do not have permission.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }

      if (error.status >= 500) {
        snackBar.open('Server error. Please try again later.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }

      return throwError(() => error);
    })
  );
};