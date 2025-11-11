import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Auth Interceptor
 * - Attaches Bearer token to protected endpoints.
 * - Skips token for public endpoints (auth, otp, etc.).
 * - Handles 401 errors with a friendly snackbar + redirect.
 */

let errorShown = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const snackBar = inject(MatSnackBar);

  // ✅ Define only truly public endpoints
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

  // Check if request matches a public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  // 🔹 Remove token for public endpoints only
  if (isPublicEndpoint) {
    const cleanRequest = req.clone({
      headers: req.headers.delete('Authorization')
    });
    return next(cleanRequest);
  }

  // 🔹 Otherwise, attach the token
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

  // 🔹 Handle response errors (esp. 401)
  return next(finalRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicEndpoint && !errorShown) {
        errorShown = true;
        snackBar.open('Session expired. Please log in again.', 'Close', {
          duration: 5000,
          panelClass: ['snackbar-info']
        });

        setTimeout(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/#/login';
          errorShown = false;
        }, 2000);
      }

      return throwError(() => error);
    })
  );
};
