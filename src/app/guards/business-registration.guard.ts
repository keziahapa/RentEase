import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BusinessRegistrationGuard implements CanActivate {
  constructor(
    private businessService: BusinessService,
    private router: Router
  ) {}

  canActivate() {
    return this.businessService.hasBusinessProfile().pipe(
      map(hasProfile => {
        if (hasProfile) {
          return true;
        } else {
          this.router.navigate(['/business-registration']);
          return false; 
        }
      }),
      catchError(() => {
        this.router.navigate(['/business-registration']);
        return of(false);
      })
    );
  }
}