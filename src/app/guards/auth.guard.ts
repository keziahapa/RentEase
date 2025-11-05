
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isLoggedIn = authService.isLoggedIn();
  

  if (state.url.includes('/admin-dashboard')) {
    if (isLoggedIn && authService.isAdmin()) {
      return true;
    } else {
      console.log('Access denied to admin dashboard - not an admin');
      router.navigate(['/access-denied']);
      return false;
    }
  }
  

  if (isLoggedIn) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};


export default authGuard;