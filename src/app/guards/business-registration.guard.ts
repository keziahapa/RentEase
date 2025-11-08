import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { AuthService } from '../services/auth.service';
import { map, catchError, tap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BusinessRegistrationGuard implements CanActivate {
  private businessService = inject(BusinessService);
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    // First check if user is authenticated and is EXTERNAL_BUSINESS
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: route.url.join('/') }
      });
      return of(false);
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || currentUser.role?.toUpperCase() !== 'EXTERNAL_BUSINESS') {
      this.router.navigate(['/dashboard']);
      return of(false);
    }

    // Check business registration status
    return this.businessService.getRegistrationStatus().pipe(
      map(response => {
        if (response.success && response.data) {
          const business = response.data;
          
          switch (business.verificationStatus) {
            case 'APPROVED':
              // Business is already approved, redirect to dashboard
              this.router.navigate(['/business-dashboard'], {
                queryParams: { 
                  message: 'Your business is already approved and active'
                }
              });
              return false;
              
            case 'PENDING':
              // Business is pending approval, redirect to status page
              this.router.navigate(['/business/registration-status'], {
                queryParams: { 
                  message: 'Your business registration is pending approval',
                  autoRefresh: true
                }
              });
              return false;
              
            case 'REJECTED':
              // Business was rejected, allow access to registration to update
              return true;
              
            default:
              // Unknown status or no business, allow registration
              return true;
          }
        } else {
          // No business found, allow registration
          return true;
        }
      }),
      catchError(error => {
        console.error('Business registration guard error:', error);
        
        // Handle different error scenarios
        if (error.status === 404) {
          // No business registration found - allow access to registration
          return of(true);
        } else if (error.status === 401) {
          // Unauthorized - redirect to login
          this.router.navigate(['/login'], {
            queryParams: { 
              returnUrl: route.url.join('/'),
              message: 'Please login again'
            }
          });
          return of(false);
        } else {
          // Other errors - allow access to registration
          console.log('Allowing registration due to error:', error.message);
          return of(true);
        }
      })
    );
  }
}