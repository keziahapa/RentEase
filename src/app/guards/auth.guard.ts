import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getCurrentUser();
  const userRole = user?.role?.toLowerCase() || '';
  
  console.log('Auth Guard Check:', {
    url: state.url,
    isAuthenticated: isAuthenticated,
    userRole: userRole,
    fullUrl: window.location.href
  });

  const hashPath = state.url.replace('#', '');
  
  const isAdminRoute = hashPath.includes('/admin-dashboard') || hashPath.includes('/admin/');
  const isLandlordRoute = hashPath.includes('/landlord-dashboard');
  const isTenantRoute = hashPath.includes('/tenant-dashboard');
  const isBusinessRoute = hashPath.includes('/business-dashboard');
  const isCaretakerRoute = hashPath.includes('/caretaker-dashboard');

  if (!isAuthenticated) {
    const queryParams = {
      returnUrl: state.url,
      ...route.queryParams
    };

    if (isAdminRoute) {
      console.log('Redirecting to ADMIN login');
      router.navigate(['/admin/login'], { queryParams });
    } else {
      console.log('Redirecting to regular login');
      router.navigate(['/login'], { queryParams });
    }
    return false;
  }

  // Role-based access control
  if (isAdminRoute) {
    if (userRole === 'admin') {
      return true;
    } else {
      console.log('Non-admin user trying to access admin routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  if (isLandlordRoute) {
    if (userRole === 'landlord' || userRole === 'admin') {
      return true;
    } else {
      console.log('Non-landlord user trying to access landlord routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  if (isTenantRoute) {
    if (userRole === 'tenant' || userRole === 'admin') {
      return true;
    } else {
      console.log('Non-tenant user trying to access tenant routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  if (isBusinessRoute) {
    if (userRole === 'business' || userRole === 'admin' || 
        userRole === 'external_business' || userRole === 'business_owner' ||
        userRole === 'company' || userRole === 'vendor') {
      return true;
    } else {
      console.log('Non-business user trying to access business routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  if (isCaretakerRoute) {
    if (userRole === 'caretaker' || userRole === 'admin') {
      return true;
    } else {
      console.log('Non-caretaker user trying to access caretaker routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  // Redirect to appropriate dashboard for root or generic dashboard routes
  if (hashPath === '/' || hashPath === '/dashboard') {
    redirectToUserDashboard(userRole, router);
    return false;
  }

  return true;
};

function redirectToUserDashboard(userRole: string, router: Router): void {
  const normalizedRole = userRole.toLowerCase();
  
  switch (normalizedRole) {
    case 'admin':
      console.log('Redirecting admin to admin dashboard');
      router.navigate(['/admin-dashboard/overview']);
      break;
    case 'landlord':
      console.log('Redirecting landlord to landlord dashboard');
      router.navigate(['/landlord-dashboard/home']);
      break;
    case 'tenant':
      console.log('Redirecting tenant to tenant dashboard');
      router.navigate(['/tenant-dashboard/dashboard']);
      break;
    case 'business':
    case 'external_business':
    case 'business_owner':
    case 'company':
    case 'vendor':
      console.log('Redirecting business user to business dashboard');
      router.navigate(['/business-dashboard']);
      break;
    case 'caretaker':
      console.log('Redirecting caretaker to caretaker dashboard');
      router.navigate(['/caretaker-dashboard/overview']);
      break;
    default:
      console.log('Unknown role, redirecting to default tenant dashboard');
      router.navigate(['/tenant-dashboard/dashboard']);
      break;
  }
}