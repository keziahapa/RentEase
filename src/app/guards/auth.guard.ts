// admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isLoggedIn = authService.isLoggedIn();
  const isAdmin = authService.isAdmin();
  
  if (isLoggedIn && isAdmin) {
    return true;
  }
  
  if (isLoggedIn && !isAdmin) {
    // Logged in but not admin - redirect to access denied
    router.navigate(['/access-denied']);
    return false;
  }
  
  // Not logged in - redirect to login
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};