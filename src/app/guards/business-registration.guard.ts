import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
 
  const skipAuth = [
    '/api/auth/login',
    '/api/auth/signup', 
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
    '/api/auth/resend-otp',
    '/api/external-business/register-business',  
    '/api/external-business/advertisements/approved' 
  ].some(endpoint => req.url.includes(endpoint));

  let clonedReq = req;
  const token = authService.getToken();
  
  console.log(' Interceptor - URL:', req.url);
  console.log(' Interceptor - Skip auth:', skipAuth);
  console.log(' Interceptor - Token exists:', !!token);
  
  
  if (token && !skipAuth) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log(' Interceptor - Added Authorization header');
  } else if (skipAuth) {
    console.log(' Interceptor - Skipping auth for public endpoint');
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isInvitationRequest = 
        req.url.includes('/invite-tenant') || 
        req.url.includes('/invite-caretaker') ||
        req.url.includes('/invitations/details/'); 
      
      console.log(' Interceptor - Request failed:', {
        url: req.url,
        status: error.status,
        statusText: error.statusText,
        error: error.error
      });
      
      
      if (error.status === 401 && !skipAuth && !isInvitationRequest) {
        console.warn(' 401 Unauthorized for authenticated endpoint');
      }
      
      return throwError(() => error);
    })
  );
};