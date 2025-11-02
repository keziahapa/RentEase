import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getTenantDashboardData(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getDefaultDashboardData());
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/dashboard`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(() => of(this.getDefaultDashboardData()))
    );
  }

  getCurrentProperty(): Observable<any> {
    // Mock property data - replace with actual API when ready
    const mockProperty = {
      success: true,
      data: {
        id: 1,
        name: 'Sunrise Apartments',
        address: '123 Main Street, Nairobi',
        landlordName: 'John Doe'
      }
    };
    return of(mockProperty);
  }

  submitMaintenanceRequest(request: any): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ success: false, message: 'No authentication token' });
    }

    return this.http.post<any>(
      `${this.apiUrl}/tenant/maintenance-requests`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to submit maintenance request' 
      }))
    );
  }

  getMaintenanceRequests(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of([]);
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/maintenance-requests`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  getPaymentHistory(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of([]);
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/payment-history`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  private getDefaultDashboardData(): any {
    return {
      success: true,
      data: {
        propertyAddress: '123 Main Street, Nairobi',
        landlordName: 'John Doe',
        depositAmount: 50000,
        currentRent: 25000,
        paymentStatus: 'Current',
        daysUntilDue: 15,
        openMaintenance: 0,
        leaseEndDays: 120
      }
    };
  }

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}