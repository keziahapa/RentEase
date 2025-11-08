import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { AuthService } from '../services/auth.service';
import { map, catchError } from 'rxjs/operators';
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
          
          switch (business.verificationStatus?.toUpperCase()) {
            case 'APPROVED':
              this.router.navigate(['/business-dashboard'], {
                queryParams: { 
                  message: 'Your business is already approved and active'
                }
              });
              return false;
              
            case 'PENDING':
              this.router.navigate(['/business/registration-status'], {
                queryParams: { 
                  message: 'Your business registration is pending approval',
                  status: 'pending'
                }
              });
              return false;
              
            case 'REJECTED':
              return true;
              
            default:
              return true;
          }
        } else {
          return true;
        }
      }),
      catchError(error => {
        console.error('Business registration guard error:', error);
        
        if (error.status === 404) {
          return of(true);
        } else if (error.status === 401 || error.status === 403) {
          this.router.navigate(['/login'], {
            queryParams: { 
              returnUrl: route.url.join('/'),
              message: 'Session expired. Please login again.'
            }
          });
          return of(false);
        } else {
          console.warn('Allowing registration despite error:', error.message);
          return of(true);
        }
      })
    );
  }
}