import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getCurrentUser();
  
  const userRole = normalizeRole(user?.role);
  
  console.log('Auth Guard Check:', {
    url: state.url,
    isAuthenticated: isAuthenticated,
    rawRole: user?.role,
    normalizedRole: userRole
  });

  const currentPath = extractPathFromUrl(state.url);
  
  console.log('Current Path:', currentPath);

  const publicRoutes = [
    '/login',
    '/admin/login', 
    '/business-login',
    '/landlord-login',
    '/tenant-login',
    '/caretaker-login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ];

  const isPublicRoute = publicRoutes.some(publicRoute => 
    currentPath.startsWith(publicRoute)
  );

  if (isPublicRoute) {
    console.log('Public route - allowing access');
    return true;
  }

  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    
    const queryParams = {
      returnUrl: state.url,
      ...route.queryParams
    };

    if (currentPath.startsWith('/admin-dashboard') || currentPath.startsWith('/admin/')) {
      console.log('Redirecting to admin login');
      router.navigate(['/admin/login'], { queryParams });
    } else {
      console.log('Redirecting to regular login');
      router.navigate(['/login'], { queryParams });
    }
    return false;
  }

  const isAdminRoute = currentPath.startsWith('/admin-dashboard') || currentPath.startsWith('/admin/');
  const isLandlordRoute = currentPath.startsWith('/landlord-dashboard');
  const isTenantRoute = currentPath.startsWith('/tenant-dashboard');
  const isBusinessRoute = currentPath.startsWith('/business-dashboard');
  const isCaretakerRoute = currentPath.startsWith('/caretaker-dashboard');

  if (isAdminRoute && userRole !== 'admin') {
    console.log('Non-admin user trying to access admin routes');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  if (isLandlordRoute && !['landlord', 'admin'].includes(userRole)) {
    console.log('Non-landlord user trying to access landlord routes');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  if (isTenantRoute && userRole !== 'tenant') {
    console.log('Non-tenant user trying to access tenant routes');
    if (userRole === 'admin') {
      router.navigate(['/admin-dashboard/overview']);
    } else {
      redirectToUserDashboard(userRole, router);
    }
    return false;
  }

  if (isBusinessRoute && !['business', 'admin'].includes(userRole)) {
    console.log('Non-business user trying to access business routes');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  if (isCaretakerRoute && !['caretaker', 'admin'].includes(userRole)) {
    console.log('Non-caretaker user trying to access caretaker routes');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  if (currentPath === '/' || currentPath === '/dashboard') {
    console.log('Root/dashboard path - Redirecting to user dashboard');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  console.log('Access granted for:', currentPath);
  return true;
};

function extractPathFromUrl(url: string): string {
  if (url.includes('#')) {
    const hashPart = url.split('#')[1];
    return hashPart.split('?')[0];
  }
  return url.split('?')[0];
}

function normalizeRole(role: string | undefined): string {
  if (!role) return 'unknown';
  
  const normalized = role.toLowerCase().trim();
  
  const roleMap: Record<string, string> = {
    'admin': 'admin',
    'administrator': 'admin',
    'landlord': 'landlord',
    'property_owner': 'landlord',
    'tenant': 'tenant',
    'renter': 'tenant',
    'business': 'business',
    'external_business': 'business',
    'business_owner': 'business',
    'company': 'business',
    'vendor': 'business',
    'caretaker': 'caretaker',
    'property_manager': 'caretaker'
  };
  
  return roleMap[normalized] || normalized;
}

function redirectToUserDashboard(userRole: string, router: Router): void {
  console.log(`Redirecting user with role: ${userRole}`);
  
  const routes: Record<string, string> = {
    'admin': '/admin-dashboard/overview',
    'landlord': '/landlord-dashboard/home',
    'tenant': '/tenant-dashboard/overview',
    'business': '/business-dashboard/dashboard',
    'caretaker': '/caretaker-dashboard/overview'
  };
  
  const targetRoute = routes[userRole] || '/login';
  console.log(`Redirecting to: ${targetRoute}`);
  router.navigate([targetRoute]);
}