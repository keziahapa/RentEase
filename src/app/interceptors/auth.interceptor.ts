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
          // Clear any corrupted auth state
          authService.clearCorruptedStorage();
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
          authService.clearCorruptedStorage();
        }
        return throwError(() => error);
      })
    );
  }

  // Validate token before sending (optional but recommended)
  if (!authService.hasValidToken()) {
    console.warn('⚠️ Token appears invalid for endpoint:', req.url);
    
    // Don't block the request, but log the warning
    // The server will reject it if it's truly invalid
  }

  // Clone the request and add the Authorization header
  // Use the token as-is - AuthService.getToken() already cleans it
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log('✅ Added Authorization header to:', req.url);
  console.log('🔐 Token length:', token.length);
  
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
          
          // Debug token state
          console.log('🔍 Debugging token state on 401:');
          console.log('- isAuthenticated():', authService.isAuthenticated());
          console.log('- hasValidToken():', authService.hasValidToken());
          console.log('- Token exists:', !!authService.getToken());
          
          // Show appropriate message
          if (authService.isAuthenticated()) {
            snackBar.open('Session expired. Please login again.', 'Close', {
              duration: 5000,
              panelClass: ['snackbar-warning']
            });
            // Clear auth state on 401 when we thought we were authenticated
            authService.clearCorruptedStorage();
          } else {
            snackBar.open('Authentication required. Please login.', 'Close', {
              duration: 5000,
              panelClass: ['snackbar-error']
            });
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