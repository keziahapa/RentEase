import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { catchError, throwError, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const snackBar = inject(MatSnackBar);
  const authService = inject(AuthService);

  // List of endpoints that don't need authentication
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/resend-otp'
  ];

  // Check if this is a public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    req.url.includes(endpoint)
  );

  // If it's a public endpoint, proceed without adding token
  if (isPublicEndpoint) {
    return next(req);
  }

  // Check if user is authenticated using AuthService
  if (!authService.isAuthenticated()) {
    console.warn('🚫 User not authenticated for protected endpoint:', req.url);
    
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          snackBar.open('Authentication required. Please login.', 'Close', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
        }
        return throwError(() => error);
      })
    );
  }

  // Get token using AuthService (handles cleaning internally)
  const token = authService.getToken();
  
  if (!token) {
    console.error('❌ No token available for protected endpoint:', req.url);
    
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          snackBar.open('Authentication token missing. Please login again.', 'Close', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
        }
        return throwError(() => error);
      })
    );
  }

  // Clone the request and add the Authorization header
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log('✅ Added Authorization header to:', req.url);
  
  // Forward the request and handle errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('🔴 HTTP Error:', {
        url: req.url,
        status: error.status,
        statusText: error.statusText,
        method: req.method
      });

      switch (error.status) {
        case 401:
          console.warn('🔴 401 Unauthorized for:', req.url);
          
          // Check if this is a role-based access issue vs actual auth failure
          const isRoleBasedUnauthorized = isRoleBasedAccessIssue(req.url, authService);
          
          if (isRoleBasedUnauthorized) {
            console.log('🎯 Role-based access issue - not logging out');
            // Show specific message for role-based access
            snackBar.open('Access denied: You don\'t have permission for this action', 'Close', {
              duration: 5000,
              panelClass: ['snackbar-warning']
            });
          } else {
            console.warn('🔐 Actual authentication failure');
            
            // Debug token state
            console.log('🔍 Debugging token state on 401:');
            console.log('- isAuthenticated():', authService.isAuthenticated());
            console.log('- hasValidToken():', authService.hasValidToken());
            console.log('- Token exists:', !!authService.getToken());
            
            // Only logout if this is an actual authentication failure
            if (authService.isAuthenticated()) {
              snackBar.open('Session expired. Please login again.', 'Close', {
                duration: 5000,
                panelClass: ['snackbar-warning']
              });
              // Only clear storage if token is actually invalid
              if (!authService.hasValidToken()) {
                console.log('🔄 Token is invalid, performing logout...');
                authService.logoutSync();
              } else {
                console.log('🔐 Token is still valid, might be server issue');
              }
            } else {
              snackBar.open('Authentication required. Please login.', 'Close', {
                duration: 5000,
                panelClass: ['snackbar-error']
              });
            }
          }
          break;

        case 403:
          console.warn('🔴 403 Forbidden for:', req.url);
          snackBar.open('Access denied: Insufficient permissions', 'Close', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
          break;

        case 0:
          console.error('🔴 Network error - cannot connect to server');
          snackBar.open('Network error: Cannot connect to server', 'Close', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
          break;

        case 500:
          console.error('🔴 Server error for:', req.url);
          snackBar.open('Server error. Please try again later.', 'Close', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
          break;

        default:
          // Don't show snackbar for other errors to avoid spam
          break;
      }
      
      return throwError(() => error);
    })
  );
};

// Helper function to detect role-based access issues
function isRoleBasedAccessIssue(url: string, authService: AuthService): boolean {
  // Check if it's a tenant endpoint but user is not a tenant
  if (url.includes('/api/tenant/') && !authService.isTenant()) {
    return true;
  }
  
  // Check if it's a landlord endpoint but user is not a landlord
  if (url.includes('/api/landlord/') && !authService.isLandlord()) {
    return true;
  }
  
  // Check if it's a caretaker endpoint but user is not a caretaker
  if (url.includes('/api/caretaker/') && !authService.isCaretaker()) {
    return true;
  }
  
  return false;
}