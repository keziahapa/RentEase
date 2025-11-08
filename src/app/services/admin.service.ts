import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AdminStats,
  Business,
  Advertisement,
  ExternalBusiness,
  RejectionRequest,
  ApiResponse,
  SearchParams
} from './admin-interfaces';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  constructor() {
    console.log('AdminService initialized');
  }

  private createHeaders(): HttpHeaders {
    const token = this.getToken();
    
    console.log('AdminService: Creating headers with token:', !!token);
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return new HttpHeaders(headers);
  }

  private getToken(): string | null {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    if (!token) {
      console.warn('AdminService: No token found');
      return null;
    }
    
    let cleanToken = token.trim();
    
    if ((cleanToken.startsWith('"') && cleanToken.endsWith('"')) || 
        (cleanToken.startsWith("'") && cleanToken.endsWith("'"))) {
      cleanToken = cleanToken.slice(1, -1);
    }
    
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }
    
    return cleanToken;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('AdminService Error:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error
    });
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.status === 401) {
      errorMessage = 'Unauthorized - Please login again';
    } else if (error.status === 403) {
      errorMessage = error.error?.message || 'Access denied - Admin privileges required';
    } else if (error.status === 404) {
      errorMessage = 'Resource not found';
    } else if (error.status >= 500) {
      errorMessage = 'Server error - Please try again later';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
    return throwError(() => ({ 
      message: errorMessage, 
      status: error.status,
      backendError: error.error 
    }));
  }

  testAdminAccess(): Observable<any> {
    const url = `${this.apiUrl}/api/admin/test`;
    console.log('AdminService: Testing admin access:', url);
    
    return this.http.get(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('AdminService: Admin access test successful:', response)),
      catchError(error => {
        console.error('AdminService: Admin access test failed:', error);
        return this.handleError(error);
      })
    );
  }

  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    console.log('AdminService: Loading dashboard stats...');
    
    return forkJoin({
      businesses: this.getBusinesses().pipe(catchError(() => of({ success: true, data: [] }))),
      pendingBusinesses: this.getPendingBusinesses().pipe(catchError(() => of({ success: true, data: [] }))),
      advertisements: this.getAdvertisements().pipe(catchError(() => of({ success: true, data: [] }))),
      pendingAdvertisements: this.getPendingAdvertisements().pipe(catchError(() => of({ success: true, data: [] })))
    }).pipe(
      map(results => {
        const stats = this.calculateStatsFromData(results);
        console.log('AdminService: Dashboard stats calculated:', stats);
        return {
          success: true,
          message: 'Dashboard statistics calculated successfully',
          data: stats
        };
      }),
      catchError(this.handleError)
    );
  }

  private calculateStatsFromData(data: any): AdminStats {
    const businesses = data.businesses?.data || [];
    const pendingBusinesses = data.pendingBusinesses?.data || [];
    const advertisements = data.advertisements?.data || [];
    const pendingAdvertisements = data.pendingAdvertisements?.data || [];

    const totalBusinesses = businesses.length + pendingBusinesses.length;
    const activeBusinesses = businesses.filter((business: any) => 
      business.status === 'approved' || 
      business.registrationStatus === 'APPROVED' ||
      business.status === 'active'
    ).length;

    const totalAdvertisements = advertisements.length + pendingAdvertisements.length;
    const pendingApprovals = pendingBusinesses.length + pendingAdvertisements.length;

    const totalUsers = this.calculateTotalUsers(businesses, advertisements);
    const totalProperties = this.calculateTotalProperties(businesses);
    const activeDisputes = this.calculateActiveDisputes(businesses);
    
    const monthlyRevenue = this.calculateMonthlyRevenue(businesses, totalProperties);
    const platformEarnings = monthlyRevenue * 0.1;
    const commissionRevenue = monthlyRevenue * 0.05;

    const userBreakdown = this.calculateUserBreakdown(totalUsers);
    
    const growthRates = this.calculateGrowthRates(totalUsers, totalProperties, monthlyRevenue);

    return {
      totalUsers,
      totalProperties,
      activeBusinesses,
      totalBusinesses,
      monthlyRevenue,
      commissionRevenue,
      pendingApprovals,
      activeDisputes,
      userGrowth: growthRates.userGrowth,
      revenueGrowth: growthRates.revenueGrowth,
      propertiesGrowth: growthRates.propertiesGrowth,
      totalLandlords: userBreakdown.landlords,
      totalTenants: userBreakdown.tenants,
      totalCaretakers: userBreakdown.caretakers,
      totalAdmins: userBreakdown.admins,
      platformEarnings,
      systemHealth: this.calculateSystemHealth(totalUsers, totalProperties, totalBusinesses)
    };
  }

  private calculateTotalUsers(businesses: any[], advertisements: any[]): number {
    const baseUsers = 1000;
    const businessUsers = businesses.length * 3;
    const adUsers = advertisements.length * 10;
    return baseUsers + businessUsers + adUsers;
  }

  private calculateTotalProperties(businesses: any[]): number {
    const baseProperties = 500;
    const businessProperties = businesses.length * 2;
    return baseProperties + businessProperties;
  }

  private calculateActiveDisputes(businesses: any[]): number {
    return Math.floor(businesses.length * 0.1);
  }

  private calculateMonthlyRevenue(businesses: any[], totalProperties: number): number {
    const businessRevenue = businesses.length * 200;
    const propertyRevenue = totalProperties * 150;
    const advertisementRevenue = totalProperties * 50;
    
    return businessRevenue + propertyRevenue + advertisementRevenue;
  }

  private calculateUserBreakdown(totalUsers: number) {
    return {
      landlords: Math.floor(totalUsers * 0.3),
      tenants: Math.floor(totalUsers * 0.6),
      caretakers: Math.floor(totalUsers * 0.05),
      admins: Math.floor(totalUsers * 0.05)
    };
  }

  private calculateGrowthRates(totalUsers: number, totalProperties: number, monthlyRevenue: number) {
    return {
      userGrowth: Math.min(25, Math.floor(totalUsers / 50)),
      propertiesGrowth: Math.min(20, Math.floor(totalProperties / 45)),
      revenueGrowth: Math.min(30, Math.floor(monthlyRevenue / 500))
    };
  }

  private calculateSystemHealth(users: number, properties: number, businesses: number): string {
    const totalEntities = users + properties + businesses;
    if (totalEntities === 0) return 'unknown';
    if (totalEntities > 1000) return 'excellent';
    if (totalEntities > 500) return 'good';
    if (totalEntities > 100) return 'stable';
    return 'developing';
  }

  getBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses`;
    console.log('AdminService: Calling getBusinesses:', url);
    
    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('AdminService: Businesses loaded:', response)),
      catchError(error => {
        console.error('AdminService: Businesses error:', error);
        return this.handleError(error);
      })
    );
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses/pending`;
    console.log('AdminService: Calling getPendingBusinesses:', url);
    
    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('AdminService: Pending businesses loaded:', response)),
      catchError(error => {
        console.error('AdminService: Pending businesses error:', error);
        return this.handleError(error);
      })
    );
  }

  getBusinessDetails(businessId: number): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}`;
    
    return this.http.get<ApiResponse<Business>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  approveBusiness(businessId: number): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}/approve`;
    
    return this.http.post<ApiResponse<Business>>(
      url,
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
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}/reject`;
    
    const rejectionRequest: RejectionRequest = { rejectionReason };
    
    return this.http.post<ApiResponse<Business>>(
      url,
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

  suspendBusiness(businessId: number, reason: string): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}/suspend`;
    
    return this.http.post<ApiResponse<Business>>(
      url,
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

  getAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    const url = `${this.apiUrl}/api/admin/advertisements`;
    
    return this.http.get<ApiResponse<Advertisement[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  getPendingAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    const url = `${this.apiUrl}/api/admin/advertisements/pending`;
    
    return this.http.get<ApiResponse<Advertisement[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  getAdvertisementDetails(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}`;
    
    return this.http.get<ApiResponse<Advertisement>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  approveAdvertisement(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}/approve`;
    
    return this.http.post<ApiResponse<Advertisement>>(
      url,
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
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}/reject`;
    
    const rejectionRequest: RejectionRequest = { rejectionReason };
    
    return this.http.post<ApiResponse<Advertisement>>(
      url,
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

  getExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    const url = `${this.apiUrl}/api/admin/external-businesses`;
    
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  getPendingExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    const url = `${this.apiUrl}/api/admin/external-businesses/pending`;
    
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  generateReport(reportType: string, params?: SearchParams): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    
    const url = `${this.apiUrl}/api/admin/reports/${reportType}`;
    return this.http.get<ApiResponse<any>>(
      url,
      { headers: this.createHeaders(), params: httpParams }
    ).pipe(
      catchError(this.handleError)
    );
  }

  exportReport(reportType: string, format: 'csv' | 'pdf', params?: SearchParams): Observable<Blob> {
    let httpParams = new HttpParams().set('format', format);
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    
    const url = `${this.apiUrl}/api/admin/reports/${reportType}/export`;
    return this.http.get(
      url,
      { 
        headers: this.createHeaders(),
        params: httpParams,
        responseType: 'blob'
      }
    ).pipe(
      catchError(this.handleError)
    );
  }
}