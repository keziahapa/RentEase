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