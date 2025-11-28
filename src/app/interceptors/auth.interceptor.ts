import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { catchError, throwError, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);

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
    req.url.includes(endpoint)
  );

  if (isPublicEndpoint) {
    return next(req);
  }

  if (!authService.isAuthenticated()) {
    console.warn('User not authenticated for protected endpoint:', req.url);
    return next(req);
  }

  const token = authService.getToken();
  
  if (!token) {
    console.error('No token available for protected endpoint:', req.url);
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log('Added Authorization header to:', req.url);
  
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('HTTP Error:', {
        url: req.url,
        status: error.status,
        statusText: error.statusText,
        method: req.method
      });

      if (error.status === 401) {
        console.warn('401 Unauthorized for:', req.url);
        
        const isRoleBasedUnauthorized = isRoleBasedAccessIssue(req.url, authService);
        
        if (isRoleBasedUnauthorized) {
          console.log('Role-based access issue');
        } else {
          console.warn('Actual authentication failure');
          
          if (authService.isAuthenticated() && !authService.hasValidToken()) {
            console.log('Token is invalid, performing logout...');
            authService.logoutSync();
          }
        }
      }

      return throwError(() => error);
    })
  );
};

function isRoleBasedAccessIssue(url: string, authService: AuthService): boolean {
  if (url.includes('/api/tenant/') && !authService.isTenant()) {
    return true;
  }
  
  if (url.includes('/api/landlord/') && !authService.isLandlord()) {
    return true;
  }
  
  if (url.includes('/api/caretaker/') && !authService.isCaretaker()) {
    return true;
  }
  
  return false;
}