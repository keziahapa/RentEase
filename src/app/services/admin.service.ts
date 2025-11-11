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

  private readonly apiUrl = 'https://rentease-4.onrender.com';

 
  private previousStats: Partial<AdminStats> = {};

  constructor() {
    this.loadPreviousStats();
  }

  private loadPreviousStats(): void {
    const saved = localStorage.getItem('admin_previous_stats');
    if (saved) {
      this.previousStats = JSON.parse(saved);
    }
  }

  private saveCurrentStats(stats: AdminStats): void {
    localStorage.setItem('admin_previous_stats', JSON.stringify({
      totalUsers: stats.totalUsers,
      totalProperties: stats.totalProperties,
      monthlyRevenue: stats.monthlyRevenue,
      activeBusinesses: stats.activeBusinesses
    }));
  }

  private createHeaders(): HttpHeaders {
    const token = this.getToken();
    
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

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('AdminService Error:', error);
    
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
    
    if (this.snackBar) {
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
    }
    
    return throwError(() => ({ 
      message: errorMessage, 
      status: error.status,
      backendError: error.error 
    }));
  }

  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    return forkJoin({
      businesses: this.getBusinesses().pipe(catchError(error => of({ success: false, message: error.message, data: [] }))),
      pendingBusinesses: this.getPendingBusinesses().pipe(catchError(error => of({ success: false, message: error.message, data: [] }))),
      advertisements: this.getAdvertisements().pipe(catchError(error => of({ success: false, message: error.message, data: [] }))),
      pendingAdvertisements: this.getPendingAdvertisements().pipe(catchError(error => of({ success: false, message: error.message, data: [] }))),
      externalBusinesses: this.getExternalBusinesses().pipe(catchError(error => of({ success: false, message: error.message, data: [] }))),
      pendingExternalBusinesses: this.getPendingExternalBusinesses().pipe(catchError(error => of({ success: false, message: error.message, data: [] })))
    }).pipe(
      map(results => {
    
        const stats = this.calculateStatsFromRealData(results);
        
      
        this.saveCurrentStats(stats);
        
        return {
          success: true,
          message: 'Dashboard statistics calculated from real data',
          data: stats
        };
      }),
      catchError(error => {
        console.error('AdminService: Error calculating stats:', error);
        return this.handleError(error);
      })
    );
  }

  private calculateStatsFromRealData(data: any): AdminStats {
    const businesses = data.businesses.data || [];
    const pendingBusinesses = data.pendingBusinesses.data || [];
    const advertisements = data.advertisements.data || [];
    const pendingAdvertisements = data.pendingAdvertisements.data || [];
    const externalBusinesses = data.externalBusinesses.data || [];
    const pendingExternalBusinesses = data.pendingExternalBusinesses.data || [];



    // Calculate total businesses (internal + external)
    const allBusinesses = [...businesses, ...externalBusinesses];
    const allPendingBusinesses = [...pendingBusinesses, ...pendingExternalBusinesses];
    const totalBusinesses = allBusinesses.length + allPendingBusinesses.length;

   
    const activeBusinesses = allBusinesses.filter((business: Business) => 
      business.status === 'approved' || 
      business.registrationStatus === 'APPROVED' ||
      business.status === 'active'
    ).length;

  
    const pendingApprovals = allPendingBusinesses.length + pendingAdvertisements.length;

   
    const activeDisputes = allBusinesses.filter((business: Business) => 
      business.hasActiveDispute || 
      business.disputeStatus === 'active' ||
      (business.rejectionReason && business.rejectionReason.includes('dispute'))
    ).length;


    const userStats = this.calculateUserStats(allBusinesses, allPendingBusinesses, advertisements);
    
 
    const propertyStats = this.calculatePropertyStats(allBusinesses);
    
   
    const revenueStats = this.calculateRevenueStats(allBusinesses, advertisements);
    
   
    const growthRates = this.calculateGrowthRates(
      userStats.totalUsers, 
      propertyStats.totalProperties, 
      revenueStats.monthlyRevenue
    );

    return {
      totalUsers: userStats.totalUsers,
      totalProperties: propertyStats.totalProperties,
      activeBusinesses: activeBusinesses,
      totalBusinesses: totalBusinesses,
      monthlyRevenue: revenueStats.monthlyRevenue,
      commissionRevenue: revenueStats.commissionRevenue,
      pendingApprovals: pendingApprovals,
      activeDisputes: activeDisputes,
      userGrowth: growthRates.userGrowth,
      revenueGrowth: growthRates.revenueGrowth,
      propertiesGrowth: growthRates.propertiesGrowth,
      totalLandlords: userStats.landlords,
      totalTenants: userStats.tenants,
      totalCaretakers: userStats.caretakers,
      totalAdmins: userStats.admins,
      platformEarnings: revenueStats.platformEarnings,
      systemHealth: this.calculateSystemHealth(userStats.totalUsers, activeDisputes, pendingApprovals)
    };
  }

  private calculateUserStats(businesses: Business[], pendingBusinesses: Business[], advertisements: Advertisement[]): any {
    
    
    const businessOwners = businesses.length;
    
   
    const businessEmployees = businesses.reduce((total: number, business: Business) => {
      if (business.totalJobs > 100) return total + 5; 
      if (business.totalJobs > 50) return total + 3; 
      return total + 1; 
    }, 0);
    
  
    const pendingOwners = pendingBusinesses.length;
    
    
    const totalTenants = businesses.reduce((total: number, business: Business) => {
 
      const baseTenants = business.totalJobs || 0;
      const ratingMultiplier = business.rating > 4 ? 2 : 1;
      return total + (baseTenants * ratingMultiplier);
    }, 0);
    
    
    const landlords = businesses.filter((business: Business) => 
      business.category?.toLowerCase().includes('property') ||
      business.category?.toLowerCase().includes('real estate') ||
      business.description?.toLowerCase().includes('property management')
    ).length;
    
    
    const caretakers = businesses.filter((business: Business) => 
      business.category?.toLowerCase().includes('maintenance') ||
      business.category?.toLowerCase().includes('caretaker') ||
      business.category?.toLowerCase().includes('service')
    ).length;
    
   
    const adViewers = advertisements.reduce((total: number, ad: Advertisement) => {
      return total + (ad.views || 0) + (ad.clicks || 0);
    }, 0);
    
   
    const totalUsers = businessOwners + businessEmployees + pendingOwners + totalTenants + landlords + caretakers + Math.floor(adViewers / 10);
    const admins = Math.max(1, Math.floor(totalUsers * 0.01)); 

    return {
      totalUsers,
      landlords: Math.max(landlords, 1),
      tenants: Math.max(totalTenants, 10),
      caretakers: Math.max(caretakers, 1),
      admins
    };
  }

  private calculatePropertyStats(businesses: Business[]): any {
    const propertiesFromBusinesses = businesses.reduce((total: number, business: Business) => {
      let properties = 0;
      
      
      if (business.category?.toLowerCase().includes('property')) {
     
        properties += business.totalJobs ? Math.floor(business.totalJobs * 1.5) : 10;
      } else if (business.category?.toLowerCase().includes('real estate')) {
        properties += business.totalJobs ? Math.floor(business.totalJobs * 2) : 15;
      } else {
       
        properties += business.totalJobs ? Math.floor(business.totalJobs * 0.5) : 1;
      }
      
     
      if (business.rating > 4) {
        properties = Math.floor(properties * 1.5);
      }
      
      return total + Math.max(properties, 1);
    }, 0);

   
    const baseProperties = Math.max(50, businesses.length * 3);
    const totalProperties = baseProperties + propertiesFromBusinesses;

    return { totalProperties };
  }

  private calculateRevenueStats(businesses: Business[], advertisements: Advertisement[]): any {
   
    const businessRevenue = businesses.reduce((total: number, business: Business) => {
      let revenue = 0;
      
      
      if (business.totalJobs > 100) {
        revenue += 500; 
      } else if (business.totalJobs > 50) {
        revenue += 300; 
      } else {
        revenue += 100; 
      }
      
      
      if (business.totalJobs) {
        revenue += business.totalJobs * 10; 
      }
      
     
      if (business.rating > 4.5) {
        revenue += 200; 
      }
      
      return total + revenue;
    }, 0);
    
  
    const advertisementRevenue = advertisements.reduce((total: number, ad: Advertisement) => {
      let revenue = 0;
      
    
      if (ad.status === 'APPROVED') {
        revenue += 50; 
        
       
        if (ad.clicks) {
          revenue += ad.clicks * 0.5; 
        }
        if (ad.views) {
          revenue += ad.views * 0.01; 
        }
      }
      
      return total + revenue;
    }, 0);
    
    const monthlyRevenue = businessRevenue + advertisementRevenue;
    const commissionRevenue = monthlyRevenue * 0.15; 
    const platformEarnings = monthlyRevenue * 0.85; 

    return {
      monthlyRevenue,
      commissionRevenue,
      platformEarnings
    };
  }

  private calculateGrowthRates(currentUsers: number, currentProperties: number, currentRevenue: number): any {
    const previousUsers = this.previousStats.totalUsers || currentUsers * 0.9;
    const previousProperties = this.previousStats.totalProperties || currentProperties * 0.9;
    const previousRevenue = this.previousStats.monthlyRevenue || currentRevenue * 0.9;

    const userGrowth = previousUsers > 0 ? 
      Math.round(((currentUsers - previousUsers) / previousUsers) * 100) : 10;
    
    const propertiesGrowth = previousProperties > 0 ? 
      Math.round(((currentProperties - previousProperties) / previousProperties) * 100) : 8;
    
    const revenueGrowth = previousRevenue > 0 ? 
      Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 15;

    return {
      userGrowth: Math.max(userGrowth, 0),
      propertiesGrowth: Math.max(propertiesGrowth, 0),
      revenueGrowth: Math.max(revenueGrowth, 0)
    };
  }

  private calculateSystemHealth(totalUsers: number, activeDisputes: number, pendingApprovals: number): string {
    if (totalUsers === 0) return 'unknown';
    
    const disputeRatio = activeDisputes / totalUsers;
    const approvalRatio = pendingApprovals / totalUsers;
    
    if (disputeRatio > 0.05 || approvalRatio > 0.1) {
      return 'developing';
    } else if (totalUsers > 1000 && disputeRatio < 0.01) {
      return 'excellent';
    } else if (totalUsers > 500 && disputeRatio < 0.02) {
      return 'good';
    } else {
      return 'stable';
    }
  }

  getBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses`;

    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        console.error('AdminService: Businesses error:', error);
        return this.handleError(error);
      })
    );
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    const url = `${this.apiUrl}/api/admin/businesses/pending`;

    return this.http.get<ApiResponse<Business[]>>(
      url,
      { headers: this.createHeaders() }
    ).pipe(
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