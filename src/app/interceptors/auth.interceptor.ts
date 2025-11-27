import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const snackBar = inject(MatSnackBar);

  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/resend-otp'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    req.url === endpoint || req.url.endsWith(endpoint)
  );

  if (!isPublicEndpoint) {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (token) {
      let cleanToken = token.trim();
      
      if (cleanToken.startsWith('Bearer ')) {
        cleanToken = cleanToken.substring(7).trim();
      }
      
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${cleanToken}`
        }
      });
      
      return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            console.error('Authentication failed for:', req.url);
            snackBar.open('Session expired. Please login again.', 'Close', {
              duration: 5000,
              panelClass: ['snackbar-error']
            });
          }
          return throwError(() => error);
        })
      );
    }
  }

  return next(req);
};