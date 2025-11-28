import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BusinessService } from '../services/business.service';
import { TenantService } from '../services/tenant.service';
import { CaretakerService } from '../services/caretaker.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const businessService = inject(BusinessService);
  const tenantService = inject(TenantService);
  const caretakerService = inject(CaretakerService);
  
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
    '/reset-password',
    '/waiting-room'
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

  // Check if user is trying to access tenant routes without property access
  if (userRole === 'tenant' && currentPath.startsWith('/tenant-dashboard')) {
    console.log('Tenant accessing tenant dashboard - checking property access');
    
    // Return observable that checks property access
    return tenantService.getTenantUnits().pipe(
      map(response => {
        // Tenant service returns { data: [] } format
        const hasUnits = response.data && response.data.length > 0;
        console.log('🏠 Tenant property access check:', hasUnits ? 'Has units' : 'No units');
        
        if (!hasUnits) {
          console.log('🚫 Tenant has no property access, redirecting to waiting room');
          router.navigate(['/waiting-room']);
          return false;
        }
        
        console.log('✅ Tenant has property access, allowing dashboard access');
        return true;
      }),
      catchError(error => {
        console.error('Error checking tenant property access:', error);
        router.navigate(['/waiting-room']);
        return of(false);
      })
    );
  }

  // Check if user is trying to access caretaker routes without property access
  if (userRole === 'caretaker' && currentPath.startsWith('/caretaker-dashboard')) {
    console.log('Caretaker accessing caretaker dashboard - checking property access');
    
    return caretakerService.getCaretakerProperties().pipe(
      map(properties => {
        // getCaretakerProperties() already returns the array directly (no .data needed)
        const hasProperties = properties && properties.length > 0;
        console.log('🔍 Caretaker property access check:', hasProperties ? 'Has properties' : 'No properties');
        
        if (!hasProperties) {
          console.log('🚫 Caretaker has no property access, redirecting to waiting room');
          router.navigate(['/waiting-room']);
          return false;
        }
        
        console.log('✅ Caretaker has property access, allowing dashboard access');
        return true;
      }),
      catchError(error => {
        console.error('Error checking caretaker property access:', error);
        router.navigate(['/waiting-room']);
        return of(false);
      })
    );
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

  if (isBusinessRoute && userRole === 'business') {
    console.log('Business user - verification handled in dashboard component');
  }

  if (isCaretakerRoute && !['caretaker', 'admin'].includes(userRole)) {
    console.log('Non-caretaker user trying to access caretaker routes');
    redirectToUserDashboard(userRole, router);
    return false;
  }

  if (currentPath === '/' || currentPath === '/dashboard') {
    console.log('Root/dashboard path - Redirecting based on property access');
    
    // For tenants and caretakers, check property access before redirecting
    if (userRole === 'tenant') {
      return tenantService.getTenantUnits().pipe(
        map(response => {
          const hasUnits = response.data && response.data.length > 0;
          if (hasUnits) {
            router.navigate(['/tenant-dashboard/overview']);
          } else {
            router.navigate(['/waiting-room']);
          }
          return false;
        }),
        catchError(error => {
          console.error('Error checking tenant units:', error);
          router.navigate(['/waiting-room']);
          return of(false);
        })
      );
    } else if (userRole === 'caretaker') {
      return caretakerService.getCaretakerProperties().pipe(
        map(properties => {
          const hasProperties = properties && properties.length > 0;
          if (hasProperties) {
            router.navigate(['/caretaker-dashboard/overview']);
          } else {
            router.navigate(['/waiting-room']);
          }
          return false;
        }),
        catchError(error => {
          console.error('Error checking caretaker properties:', error);
          router.navigate(['/waiting-room']);
          return of(false);
        })
      );
    } else {
      // For other roles, use normal redirect
      redirectToUserDashboard(userRole, router);
      return false;
    }
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