import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

let errorShown = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
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
    '/api/public/',
    '/api/open/'  // ADDED THIS - This fixes your 401 error
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  // Remove Authorization header from public endpoints
  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    return next(cleanRequest);
  }

  // Add Authorization header to protected endpoints
  let finalRequest = req;
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  
  if (token) {
    finalRequest = req.clone({
      setHeaders: { 
        Authorization: `Bearer ${token}` 
      }
    });
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Show error only once
      if (error.status === 401 && !isPublicEndpoint && !errorShown) {
        errorShown = true;
        snackBar.open('Please log in to continue', 'Close', { 
          duration: 5000,
          panelClass: ['snackbar-info']
        });
        
        // Redirect after a delay
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/#/login';
        }, 2000);
      }

      return throwError(() => error);
    })
  );
};