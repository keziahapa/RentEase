import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AdminStats,
  Business,
  Advertisement,
  ExternalBusiness,
  RejectionRequest,
  ApiResponse
} from './admin-interfaces';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  private createHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const headersConfig: any = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headersConfig['Authorization'] = `Bearer ${token}`;
    }
    
    return new HttpHeaders(headersConfig);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Unauthorized access. Please check your permissions.';
      } else if (error.status === 403) {
        errorMessage = 'Access denied. Insufficient permissions.';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (error.status === 409) {
        errorMessage = 'Conflict occurred. Please check your data.';
      } else if (error.status === 422) {
        errorMessage = 'Invalid data provided.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }
    
    console.error('Admin Service Error:', error);
    return throwError(() => ({ message: errorMessage, status: error.status }));
  }

  // ==================== DASHBOARD STATISTICS ====================
  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(
      `${this.apiUrl}/api/v1/admin/dashboard/stats`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ==================== BUSINESS MANAGEMENT ====================
  getBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.http.get<ApiResponse<Business[]>>(
      `${this.apiUrl}/api/admin/businesses`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.http.get<ApiResponse<Business[]>>(
      `${this.apiUrl}/api/admin/businesses/pending`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getBusinessDetails(businessId: number): Observable<ApiResponse<Business>> {
    return this.http.get<ApiResponse<Business>>(
      `${this.apiUrl}/api/admin/businesses/${businessId}`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  approveBusiness(businessId: number): Observable<ApiResponse<Business>> {
    return this.http.post<ApiResponse<Business>>(
      `${this.apiUrl}/api/admin/businesses/${businessId}/approve`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Business approved successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  rejectBusiness(businessId: number, rejectionReason: string): Observable<ApiResponse<Business>> {
    const rejectionRequest: RejectionRequest = { rejectionReason };
    
    return this.http.post<ApiResponse<Business>>(
      `${this.apiUrl}/api/admin/businesses/${businessId}/reject`,
      rejectionRequest,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Business rejected successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== ADVERTISEMENT MANAGEMENT ====================
  getAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.http.get<ApiResponse<Advertisement[]>>(
      `${this.apiUrl}/api/admin/advertisements`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getPendingAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.http.get<ApiResponse<Advertisement[]>>(
      `${this.apiUrl}/api/admin/advertisements/pending`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getAdvertisementDetails(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    return this.http.get<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/admin/advertisements/${advertisementId}`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  approveAdvertisement(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    return this.http.post<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/admin/advertisements/${advertisementId}/approve`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Advertisement approved successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  rejectAdvertisement(advertisementId: number, rejectionReason: string): Observable<ApiResponse<Advertisement>> {
    const rejectionRequest: RejectionRequest = { rejectionReason };
    
    return this.http.post<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/admin/advertisements/${advertisementId}/reject`,
      rejectionRequest,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Advertisement rejected successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== EXTERNAL BUSINESS MANAGEMENT ====================
  getExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      `${this.apiUrl}/api/admin/external-businesses`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getPendingExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      `${this.apiUrl}/api/admin/external-businesses/pending`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }
}