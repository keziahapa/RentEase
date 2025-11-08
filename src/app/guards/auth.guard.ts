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

  // ✅ FIXED: Check if trying to access admin routes
  const isAdminRoute = state.url.includes('/admin-dashboard') || state.url.includes('/admin/');

  if (isAdminRoute) {
    if (isAuthenticated && authService.isAdmin()) {
      return true;
    } else {
      console.log('🚫 Access denied to admin routes');
      
      const queryParams = {
        returnUrl: state.url,
        ...route.queryParams
      };
      
      if (isAuthenticated && !authService.isAdmin()) {
        // ✅ User is logged in but not admin - show access denied
        console.log('🔐 User is authenticated but not admin');
        router.navigate(['/access-denied']);
      } else {
        // ✅ User not logged in - redirect to ADMIN login
        console.log('🔐 Redirecting to ADMIN login');
        router.navigate(['/admin/login'], { queryParams });
      }
      return false;
    }
  }

  // Regular routes
  if (isAuthenticated) {
    return true;
  } else {
    const queryParams = {
      returnUrl: state.url,
      ...route.queryParams
    };
    
    console.log('🔐 Redirecting to regular login with params:', queryParams);
    router.navigate(['/login'], { queryParams });
    return false;
  }
};

export default authGuard;