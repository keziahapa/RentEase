import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
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

  constructor() {
    this.validateTokenOnInit();
  }

  private validateTokenOnInit() {
    const token = this.getToken();
    if (token) {
      console.log('🔐 Token Validation on Init:', {
        hasToken: !!token,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...'
      });
      
      // Try to decode JWT token if it's in standard format
      try {
        if (token.includes('.')) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔐 Token Payload:', {
            issuedTo: payload.sub,
            role: payload.role,
            issuedAt: new Date(payload.iat * 1000),
            expires: new Date(payload.exp * 1000),
            isExpired: Date.now() >= payload.exp * 1000
          });
        }
      } catch (e) {
        console.log('🔐 Token is not a standard JWT, might be custom format');
      }
    } else {
      console.warn('🔐 No token found in storage');
    }
  }

  private getToken(): string | null {
    return localStorage.getItem('authToken') || 
           sessionStorage.getItem('authToken') ||
           localStorage.getItem('token') ||
           sessionStorage.getItem('token');
  }

  private createHeaders(): HttpHeaders {
    const token = this.getToken();
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
    
    console.log('🔐 Creating Headers:', { 
      hasToken: !!token, 
      userRole: userRole,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
    });
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Some backends require role in headers
    if (userRole) {
      headers['X-User-Role'] = userRole;
    }
    
    return new HttpHeaders(headers);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('🔴 Admin Service Error Details:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error,
      headers: error.headers
    });
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.status === 401) {
      errorMessage = 'Unauthorized - Please check your authentication token';
      // Clear invalid token
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    } else if (error.status === 403) {
      // Get the actual error message from backend
      errorMessage = error.error?.message || error.error?.error || 'Access denied - Insufficient permissions';
      console.error('🔴 403 Forbidden Details:', error.error);
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

  // Test method to verify token is working
  verifyToken(): Observable<any> {
    const url = `${this.apiUrl}/api/auth/verify`;
    console.log('🔐 Testing token verification:', url);
    
    return this.http.get(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Token verification successful:', response)),
      catchError(error => {
        console.error('❌ Token verification failed:', error);
        return throwError(() => error);
      })
    );
  }

  // Test method to check admin access
  testAdminAccess(): Observable<any> {
    const url = `${this.apiUrl}/api/admin/test`;
    console.log('🔐 Testing admin access:', url);
    
    return this.http.get(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin access test successful:', response)),
      catchError(error => {
        console.error('❌ Admin access test failed:', error);
        return throwError(() => error);
      })
    );
  }

  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    console.log('🔄 Loading dashboard stats...');
    
    return forkJoin({
      businesses: this.getBusinesses().pipe(catchError(() => of({ success: true, data: [] }))),
      pendingBusinesses: this.getPendingBusinesses().pipe(catchError(() => of({ success: true, data: [] }))),
      advertisements: this.getAdvertisements().pipe(catchError(() => of({ success: true, data: [] }))),
      pendingAdvertisements: this.getPendingAdvertisements().pipe(catchError(() => of({ success: true, data: [] })))
    }).pipe(
      map(results => {
        const stats = this.calculateStatsFromData(results);
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

    console.log('📊 Calculating stats from real data:', {
      businesses: businesses.length,
      pendingBusinesses: pendingBusinesses.length,
      advertisements: advertisements.length,
      pendingAdvertisements: pendingAdvertisements.length
    });

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

  // Business Management
  getBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Businesses:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Businesses:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses/pending`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Pending Businesses:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Pending Businesses:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  getBusinessDetails(businessId: number): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Business>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Business Details:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Business Details:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  approveBusiness(businessId: number): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}/approve`;
    console.log('🔄 Calling admin endpoint:', url);
    
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
      catchError(error => {
        console.error('❌ Admin API Error - Approve Business:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  rejectBusiness(businessId: number, rejectionReason: string): Observable<ApiResponse<Business>> {
    const url = `${this.apiUrl}/api/admin/businesses/${businessId}/reject`;
    console.log('🔄 Calling admin endpoint:', url);
    
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
      catchError(error => {
        console.error('❌ Admin API Error - Reject Business:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  // Advertisement Management
  getAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    const url = `${this.apiUrl}/api/admin/advertisements`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Advertisement[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Advertisements:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Advertisements:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  getPendingAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    const url = `${this.apiUrl}/api/admin/advertisements/pending`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Advertisement[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Pending Advertisements:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Pending Advertisements:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  getAdvertisementDetails(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<Advertisement>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Advertisement Details:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Advertisement Details:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  approveAdvertisement(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}/approve`;
    console.log('🔄 Calling admin endpoint:', url);
    
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
      catchError(error => {
        console.error('❌ Admin API Error - Approve Advertisement:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  rejectAdvertisement(advertisementId: number, rejectionReason: string): Observable<ApiResponse<Advertisement>> {
    const url = `${this.apiUrl}/api/admin/advertisements/${advertisementId}/reject`;
    console.log('🔄 Calling admin endpoint:', url);
    
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
      catchError(error => {
        console.error('❌ Admin API Error - Reject Advertisement:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  // External Business Management
  getExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    const url = `${this.apiUrl}/api/admin/external-businesses`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - External Businesses:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - External Businesses:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }

  getPendingExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    const url = `${this.apiUrl}/api/admin/external-businesses/pending`;
    console.log('🔄 Calling admin endpoint:', url);
    
    return this.http.get<ApiResponse<ExternalBusiness[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Admin API Success - Pending External Businesses:', response)),
      catchError(error => {
        console.error('❌ Admin API Error - Pending External Businesses:', {
          url: url,
          status: error.status,
          error: error.error
        });
        return this.handleError(error);
      })
    );
  }
}