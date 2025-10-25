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
  BulkOperationResult
} from './admin-interfaces';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/v1/admin';

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

  // Dashboard Statistics
  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.apiUrl}/dashboard/stats`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPlatformAnalytics(timeRange: string = '30d'): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('timeRange', timeRange);
    
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/analytics`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // User Management
  getUsers(params?: SearchParams): Observable<ApiResponse<User[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/users`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getUserDetails(userId: string): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/users/${userId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateUserStatus(userId: string, status: string): Observable<ApiResponse<User>> {
    return this.http.patch<ApiResponse<User>>(
      `${this.apiUrl}/users/${userId}/status`, 
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
      `${this.apiUrl}/users/${userId}/suspend`,
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
      `${this.apiUrl}/users/${userId}/activate`,
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
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/users/${userId}`, {
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

  // Property Management
  getProperties(params?: SearchParams): Observable<ApiResponse<Property[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Property[]>>(`${this.apiUrl}/properties`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getPropertyDetails(propertyId: string): Observable<ApiResponse<Property>> {
    return this.http.get<ApiResponse<Property>>(`${this.apiUrl}/properties/${propertyId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updatePropertyStatus(propertyId: string, status: string): Observable<ApiResponse<Property>> {
    return this.http.patch<ApiResponse<Property>>(
      `${this.apiUrl}/properties/${propertyId}/status`,
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

  // Business Management
  getBusinesses(params?: SearchParams): Observable<ApiResponse<Business[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Business[]>>(`${this.apiUrl}/businesses`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getBusinessDetails(businessId: string): Observable<ApiResponse<Business>> {
    return this.http.get<ApiResponse<Business>>(`${this.apiUrl}/businesses/${businessId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  approveBusiness(businessId: string): Observable<ApiResponse<Business>> {
    return this.http.patch<ApiResponse<Business>>(
      `${this.apiUrl}/businesses/${businessId}/approve`,
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

  rejectBusiness(businessId: string, reason: string): Observable<ApiResponse<Business>> {
    return this.http.patch<ApiResponse<Business>>(
      `${this.apiUrl}/businesses/${businessId}/reject`,
      { reason },
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

  suspendBusiness(businessId: string, reason: string): Observable<ApiResponse<Business>> {
    return this.http.patch<ApiResponse<Business>>(
      `${this.apiUrl}/businesses/${businessId}/suspend`,
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

  // Dispute Management
  getDisputes(params?: SearchParams): Observable<ApiResponse<Dispute[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Dispute[]>>(`${this.apiUrl}/disputes`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getDisputeDetails(disputeId: string): Observable<ApiResponse<Dispute>> {
    return this.http.get<ApiResponse<Dispute>>(`${this.apiUrl}/disputes/${disputeId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  assignDispute(disputeId: string, adminId: string): Observable<ApiResponse<Dispute>> {
    return this.http.patch<ApiResponse<Dispute>>(
      `${this.apiUrl}/disputes/${disputeId}/assign`,
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
      `${this.apiUrl}/disputes/${disputeId}/resolve`,
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
      `${this.apiUrl}/disputes/${disputeId}/escalate`,
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

  // Transaction Management
  getTransactions(params?: SearchParams): Observable<ApiResponse<Transaction[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Transaction[]>>(`${this.apiUrl}/transactions`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTransactionDetails(transactionId: string): Observable<ApiResponse<Transaction>> {
    return this.http.get<ApiResponse<Transaction>>(`${this.apiUrl}/transactions/${transactionId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  refundTransaction(transactionId: string, reason: string): Observable<ApiResponse<Transaction>> {
    return this.http.post<ApiResponse<Transaction>>(
      `${this.apiUrl}/transactions/${transactionId}/refund`,
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

  // Tenant Management
  getTenants(params?: SearchParams): Observable<ApiResponse<Tenant[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<Tenant[]>>(`${this.apiUrl}/tenants`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  getTenantDetails(tenantId: string): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.apiUrl}/tenants/${tenantId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Maintenance Management
  getMaintenanceRequests(params?: SearchParams): Observable<ApiResponse<MaintenanceRequest[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<MaintenanceRequest[]>>(`${this.apiUrl}/maintenance`, {
      headers: this.createHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Reports & Analytics
  generateReport(reportType: string, params?: SearchParams): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key as keyof SearchParams] !== null && params[key as keyof SearchParams] !== undefined) {
          httpParams = httpParams.set(key, params[key as keyof SearchParams]!.toString());
        }
      });
    }
    
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/reports/${reportType}`, {
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
    
    return this.http.get(`${this.apiUrl}/reports/${reportType}/export`, {
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

  // System Settings
  getSystemSettings(): Observable<ApiResponse<SystemSettings>> {
    return this.http.get<ApiResponse<SystemSettings>>(`${this.apiUrl}/settings`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateSystemSettings(settings: Partial<SystemSettings>): Observable<ApiResponse<SystemSettings>> {
    return this.http.put<ApiResponse<SystemSettings>>(
      `${this.apiUrl}/settings`,
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

  // Platform Management
  toggleMaintenanceMode(enabled: boolean): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.apiUrl}/platform/maintenance`,
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
      `${this.apiUrl}/platform/clear-cache`,
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

  // Admin User Management
  createAdmin(userData: any): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(
      `${this.apiUrl}/admins`,
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
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/admins`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Utility Methods
  searchUsers(query: string, role?: string): Observable<ApiResponse<User[]>> {
    let params = new HttpParams().set('query', query);
    if (role) {
      params = params.set('role', role);
    }
    
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/search/users`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  searchProperties(query: string): Observable<ApiResponse<Property[]>> {
    const params = new HttpParams().set('query', query);
    
    return this.http.get<ApiResponse<Property[]>>(`${this.apiUrl}/search/properties`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Bulk Operations
  bulkUpdateUserStatus(userIds: string[], status: string): Observable<ApiResponse<BulkOperationResult>> {
    return this.http.post<ApiResponse<BulkOperationResult>>(
      `${this.apiUrl}/users/bulk-update`,
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

  // Notification Management
  sendPlatformNotification(notification: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/notifications`,
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

  // Health Check
  checkSystemHealth(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/health`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }
}