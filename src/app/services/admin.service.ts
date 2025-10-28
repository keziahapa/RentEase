// admin.service.ts - COMPLETE CORRECTED VERSION
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  AdminStats,
  User,
  Property,
  Business,
  Dispute,
  Transaction,
  SystemSettings,
  Tenant,
  Unit,
  MaintenanceRequest,
  Notification,
  ApiResponse,
  SearchParams,
  BulkOperationResult,
  Advertisement,
  ExternalBusiness,
  RejectionRequest
} from './admin-interfaces';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  // CORRECTED: Use base URL without /api/v1/admin
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  constructor() {}

  private createHeaders(includeContentType: boolean = true): HttpHeaders {
    const token = this.authService.getToken();
    const headersConfig: any = {};
    
    if (includeContentType) {
      headersConfig['Content-Type'] = 'application/json';
    }
    
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
        errorMessage = 'Unauthorized access. Please login again.';
        this.authService.logoutSync();
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
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  // ==================== DASHBOARD STATISTICS ====================
  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.apiUrl}/api/v1/admin/dashboard/stats`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPlatformAnalytics(timeRange: string = '30d'): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('timeRange', timeRange);
    
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/v1/admin/analytics`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== BUSINESS MANAGEMENT ====================
  getBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.http.get<ApiResponse<Business[]>>(`${this.apiUrl}/api/admin/businesses`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.http.get<ApiResponse<Business[]>>(`${this.apiUrl}/api/admin/businesses/pending`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getBusinessDetails(businessId: number): Observable<ApiResponse<Business>> {
    return this.http.get<ApiResponse<Business>>(`${this.apiUrl}/api/admin/businesses/${businessId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
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
    return this.http.post<ApiResponse<Business>>(
      `${this.apiUrl}/api/admin/businesses/${businessId}/reject`,
      { rejectionReason },
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

  suspendBusiness(businessId: number, reason: string): Observable<ApiResponse<Business>> {
    return this.http.patch<ApiResponse<Business>>(
      `${this.apiUrl}/api/admin/businesses/${businessId}/suspend`,
      { reason },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Business suspended successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== ADVERTISEMENT MANAGEMENT ====================
  getAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.http.get<ApiResponse<Advertisement[]>>(`${this.apiUrl}/api/admin/advertisements`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPendingAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.http.get<ApiResponse<Advertisement[]>>(`${this.apiUrl}/api/admin/advertisements/pending`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getAdvertisementDetails(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    return this.http.get<ApiResponse<Advertisement>>(`${this.apiUrl}/api/admin/advertisements/${advertisementId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
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
    return this.http.post<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/admin/advertisements/${advertisementId}/reject`,
      { rejectionReason },
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
    return this.http.get<ApiResponse<ExternalBusiness[]>>(`${this.apiUrl}/api/admin/external-businesses`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPendingExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    return this.http.get<ApiResponse<ExternalBusiness[]>>(`${this.apiUrl}/api/admin/external-businesses/pending`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== USER MANAGEMENT ====================
  getUsers(params?: SearchParams): Observable<ApiResponse<User[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/api/v1/admin/users`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getUserDetails(userId: string): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/api/v1/admin/users/${userId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateUserStatus(userId: string, status: string): Observable<ApiResponse<User>> {
    return this.http.patch<ApiResponse<User>>(
      `${this.apiUrl}/api/v1/admin/users/${userId}/status`, 
      { status },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open(`User ${status} successfully`, 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  suspendUser(userId: string, reason: string): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(
      `${this.apiUrl}/api/v1/admin/users/${userId}/suspend`,
      { reason },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('User suspended successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  activateUser(userId: string): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(
      `${this.apiUrl}/api/v1/admin/users/${userId}/activate`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('User activated successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteUser(userId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/v1/admin/users/${userId}`, {
      headers: this.createHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== PROPERTY MANAGEMENT ====================
  getProperties(params?: SearchParams): Observable<ApiResponse<Property[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Property[]>>(`${this.apiUrl}/api/v1/admin/properties`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPropertyDetails(propertyId: string): Observable<ApiResponse<Property>> {
    return this.http.get<ApiResponse<Property>>(`${this.apiUrl}/api/v1/admin/properties/${propertyId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updatePropertyStatus(propertyId: string, status: string): Observable<ApiResponse<Property>> {
    return this.http.patch<ApiResponse<Property>>(
      `${this.apiUrl}/api/v1/admin/properties/${propertyId}/status`,
      { status },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open(`Property ${status} successfully`, 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== DISPUTE MANAGEMENT ====================
  getDisputes(params?: SearchParams): Observable<ApiResponse<Dispute[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Dispute[]>>(`${this.apiUrl}/api/v1/admin/disputes`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getDisputeDetails(disputeId: string): Observable<ApiResponse<Dispute>> {
    return this.http.get<ApiResponse<Dispute>>(`${this.apiUrl}/api/v1/admin/disputes/${disputeId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  assignDispute(disputeId: string, adminId: string): Observable<ApiResponse<Dispute>> {
    return this.http.patch<ApiResponse<Dispute>>(
      `${this.apiUrl}/api/v1/admin/disputes/${disputeId}/assign`,
      { adminId },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Dispute assigned successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  resolveDispute(disputeId: string, resolution: any): Observable<ApiResponse<Dispute>> {
    return this.http.patch<ApiResponse<Dispute>>(
      `${this.apiUrl}/api/v1/admin/disputes/${disputeId}/resolve`,
      resolution,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Dispute resolved successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  escalateDispute(disputeId: string, reason: string): Observable<ApiResponse<Dispute>> {
    return this.http.patch<ApiResponse<Dispute>>(
      `${this.apiUrl}/api/v1/admin/disputes/${disputeId}/escalate`,
      { reason },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Dispute escalated successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== TRANSACTION MANAGEMENT ====================
  getTransactions(params?: SearchParams): Observable<ApiResponse<Transaction[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Transaction[]>>(`${this.apiUrl}/api/v1/admin/transactions`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTransactionDetails(transactionId: string): Observable<ApiResponse<Transaction>> {
    return this.http.get<ApiResponse<Transaction>>(`${this.apiUrl}/api/v1/admin/transactions/${transactionId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  refundTransaction(transactionId: string, reason: string): Observable<ApiResponse<Transaction>> {
    return this.http.post<ApiResponse<Transaction>>(
      `${this.apiUrl}/api/v1/admin/transactions/${transactionId}/refund`,
      { reason },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Transaction refunded successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== TENANT MANAGEMENT ====================
  getTenants(params?: SearchParams): Observable<ApiResponse<Tenant[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Tenant[]>>(`${this.apiUrl}/api/v1/admin/tenants`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTenantDetails(tenantId: string): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.apiUrl}/api/v1/admin/tenants/${tenantId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== MAINTENANCE MANAGEMENT ====================
  getMaintenanceRequests(params?: SearchParams): Observable<ApiResponse<MaintenanceRequest[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<MaintenanceRequest[]>>(`${this.apiUrl}/api/v1/admin/maintenance`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== REPORTS & ANALYTICS ====================
  generateReport(reportType: string, params?: SearchParams): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/v1/admin/reports/${reportType}`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  exportReport(reportType: string, format: string, params?: SearchParams): Observable<Blob> {
    let httpParams = new HttpParams().set('format', format);
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get(`${this.apiUrl}/api/v1/admin/reports/${reportType}/export`, {
      headers: this.createHeaders(false),
      params: httpParams,
      responseType: 'blob'
    }).pipe(
      tap(blob => {
        this.snackBar.open('Report exported successfully', 'Close', { duration: 3000 });
      }),
      catchError(this.handleError)
    );
  }

  // ==================== SYSTEM SETTINGS ====================
  getSystemSettings(): Observable<ApiResponse<SystemSettings>> {
    return this.http.get<ApiResponse<SystemSettings>>(`${this.apiUrl}/api/v1/admin/settings`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateSystemSettings(settings: Partial<SystemSettings>): Observable<ApiResponse<SystemSettings>> {
    return this.http.put<ApiResponse<SystemSettings>>(
      `${this.apiUrl}/api/v1/admin/settings`,
      settings,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Settings updated successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== PLATFORM MANAGEMENT ====================
  toggleMaintenanceMode(enabled: boolean): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.apiUrl}/api/v1/admin/platform/maintenance`,
      { enabled },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const mode = enabled ? 'enabled' : 'disabled';
          this.snackBar.open(`Maintenance mode ${mode}`, 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  clearCache(cacheType: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/api/v1/admin/platform/clear-cache`,
      { cacheType },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Cache cleared successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== ADMIN USER MANAGEMENT ====================
  createAdmin(userData: any): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(
      `${this.apiUrl}/api/v1/admin/admins`,
      userData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Admin created successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  getAdmins(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/api/v1/admin/admins`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== UTILITY METHODS ====================
  searchUsers(query: string, role?: string): Observable<ApiResponse<User[]>> {
    let params = new HttpParams().set('query', query);
    if (role) {
      params = params.set('role', role);
    }
    
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/api/v1/admin/search/users`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  searchProperties(query: string): Observable<ApiResponse<Property[]>> {
    const params = new HttpParams().set('query', query);
    
    return this.http.get<ApiResponse<Property[]>>(`${this.apiUrl}/api/v1/admin/search/properties`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== BULK OPERATIONS ====================
  bulkUpdateUserStatus(userIds: string[], status: string): Observable<ApiResponse<BulkOperationResult>> {
    return this.http.post<ApiResponse<BulkOperationResult>>(
      `${this.apiUrl}/api/v1/admin/users/bulk-update`,
      { userIds, status },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Users updated successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== NOTIFICATION MANAGEMENT ====================
  sendPlatformNotification(notification: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/api/v1/admin/notifications`,
      notification,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.snackBar.open('Notification sent successfully', 'Close', { duration: 3000 });
        }
      }),
      catchError(this.handleError)
    );
  }

  // ==================== HEALTH CHECK ====================
  checkSystemHealth(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/v1/admin/health`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }
}