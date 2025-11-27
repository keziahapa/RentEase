import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError, switchMap } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';


export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const snackBar = inject(MatSnackBar);

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

  // Get token from storage (try both localStorage and sessionStorage)
  let token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  
  // If no token exists, proceed without adding it (will likely fail with 401)
  if (!token) {
    console.warn('No token found for protected endpoint:', req.url);
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

  // Clean the token (remove quotes and 'Bearer ' prefix if present)
  token = token.trim();
  if ((token.startsWith('"') && token.endsWith('"')) || 
      (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1);
  }
  if (token.startsWith('Bearer ')) {
    token = token.substring(7).trim();
  }

  // Clone the request and add the Authorization header
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log('Added Authorization header to:', req.url);
  
  // Forward the request and handle errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('401 Unauthorized for:', req.url);
        snackBar.open('Session expired or invalid. Please login again.', 'Close', {
          duration: 5000,
          panelClass: ['snackbar-warning']
        });
      } else if (error.status === 403) {
        console.warn('403 Forbidden for:', req.url);
        snackBar.open('Access denied: Insufficient permissions', 'Close', {
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }
      return throwError(() => error);
    })
  );
};