import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isAuthenticated = authService.isAuthenticated();
  
  console.log('🛡️ Auth Guard Check:', {
    url: state.url,
    isAuthenticated: isAuthenticated,
    hasToken: !!authService.getToken(),
    queryParams: route.queryParams
  });


  if (state.url.includes('/admin-dashboard')) {
    if (isAuthenticated && authService.isAdmin()) {
      return true;
    } else {
      console.log('Access denied to admin dashboard - not an admin');
      router.navigate(['/access-denied']);
      return false;
    }
  }


  if (state.url.includes('/business/registration-status')) {
    if (isAuthenticated) {
      const user = authService.getCurrentUser();
      if (user && user.role?.toUpperCase() === 'EXTERNAL_BUSINESS') {
        return true;
      } else {
        console.log('Access denied to business registration status - not an external business user');
        router.navigate(['/dashboard']);
        return false;
      }
    }
  }


  if (isAuthenticated) {
    return true;
  } else {
    const queryParams = {
      returnUrl: state.url,
      ...route.queryParams
    };
    
    console.log('🔐 Redirecting to login with params:', queryParams);
    router.navigate(['/login'], { queryParams });
    return false;
  }
};

export default authGuard;