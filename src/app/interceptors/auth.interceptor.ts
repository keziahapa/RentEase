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
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    '/api/auth/refresh-token',
    '/api/public/',
    '/api/open/'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    return next(cleanRequest);
  }

  const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('authToken');
  let finalRequest = req;

  if (token) {
    let cleanToken = token.trim();

    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }

    finalRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${cleanToken}`
      }
    });
  }

  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
   
      if (error.status === 401 && !isPublicEndpoint) {
        console.log(' Authentication error - 401 detected:', {
          url: req.url,
          hasToken: !!token
        });

       
        snackBar.open('Authentication failed. Please check your credentials.', 'Close', {
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      }

    
      return throwError(() => error);
    })
  );
};