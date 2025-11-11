import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getCurrentUser();
  
 
  const userRole = normalizeRole(user?.role);
  
  console.log(' Auth Guard Check:', {
    url: state.url,
    isAuthenticated: isAuthenticated,
    rawRole: user?.role,
    normalizedRole: userRole,
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
      console.log(' Not authenticated - Redirecting to ADMIN login');
      router.navigate(['/admin/login'], { queryParams });
    } else {
      console.log(' Not authenticated - Redirecting to regular login');
      router.navigate(['/login'], { queryParams });
    }
    return false;
  }

 
  if (isAdminRoute) {
    if (userRole === 'admin') {
      console.log(' Admin accessing admin routes - ALLOWED');
      return true;
    } else {
      console.log('Non-admin user trying to access admin routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

 
  if (isLandlordRoute) {
    if (userRole === 'landlord' || userRole === 'admin') {
      console.log('andlord/Admin accessing landlord routes - ALLOWED');
      return true;
    } else {
      console.log(' Non-landlord user trying to access landlord routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  
  if (isTenantRoute) {
    
    if (userRole === 'tenant') {
      console.log(' Tenant accessing tenant routes - ALLOWED');
      return true;
    } else if (userRole === 'admin') {
      console.log(' Admin trying to access tenant routes - Redirecting to ADMIN dashboard');
      router.navigate(['/admin-dashboard/overview']);
      return false;
    } else {
      console.log(' Non-tenant user trying to access tenant routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  
  if (isBusinessRoute) {
    if (userRole === 'business' || userRole === 'admin') {
      console.log(' Business/Admin accessing business routes - ALLOWED');
      return true;
    } else {
      console.log(' Non-business user trying to access business routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  
  if (isCaretakerRoute) {
    if (userRole === 'caretaker' || userRole === 'admin') {
      console.log(' Caretaker/Admin accessing caretaker routes - ALLOWED');
      return true;
    } else {
      console.log(' Non-caretaker user trying to access caretaker routes');
      redirectToUserDashboard(userRole, router);
      return false;
    }
  }

  
  if (hashPath === '/' || hashPath === '/dashboard') {
    console.log(' Root/dashboard path - Redirecting to user dashboard');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  return true;
};


function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  
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
  console.log(` Redirecting user with role: ${userRole}`);
  
  switch (userRole) {
    case 'admin':
      console.log(' Redirecting to: /admin-dashboard/overview');
      router.navigate(['/admin-dashboard/overview']);
      break;
      
    case 'landlord':
      console.log(' Redirecting to: /landlord-dashboard/home');
      router.navigate(['/landlord-dashboard/home']);
      break;
      
    case 'tenant':
      console.log(' Redirecting to: /tenant-dashboard/overview');
      router.navigate(['/tenant-dashboard/overview']);
      break;
      
    case 'business':
      console.log(' Redirecting to: /business-dashboard/dashboard');
      router.navigate(['/business-dashboard/dashboard']);
      break;
      
    case 'caretaker':
      console.log(' Redirecting to: /caretaker-dashboard/overview');
      router.navigate(['/caretaker-dashboard/overview']);
      break;
      
    default:
      console.log(' Unknown role, redirecting to: /login');
      router.navigate(['/login']);
      break;
  }
}