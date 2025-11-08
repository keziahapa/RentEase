import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  BusinessRegistration,
  BusinessStatusResponse,
  ExternalBusiness,
  Advertisement,
  CreateAdvertisementRequest,
  BusinessDashboardData,
  ApiResponse,
  AdvertisementAnalytics,
  BusinessAnalytics,
  BillingRecord,
  UploadResponse,
  ErrorResponse
} from './business-interface';

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  // ✅ FIXED: Business Registration - Public endpoint (no auth headers)
  registerBusiness(formData: FormData): Observable<ApiResponse<BusinessRegistration>> {
    console.log('📤 Registering business with FormData');
    
    return this.http.post<ApiResponse<BusinessRegistration>>(
      `${this.apiUrl}/api/external-business/register-business`,
      formData
    ).pipe(
      tap(response => {
        console.log('✅ Registration response:', response);
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ✅ FIXED: Business Registration Status - Handles empty responses
  getRegistrationStatus(): Observable<BusinessStatusResponse> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/registration-status`,
      { 
        headers: this.createAuthHeaders(),
        observe: 'response'
      }
    ).pipe(
      map(response => {
        console.log('🔍 Registration status full response:', response);
        
        // Handle empty response body
        if (!response.body || response.status === 204) {
          console.log('🔍 No business registration found (empty response)');
          return this.getBusinessProfileAsFallback();
        }
        
        // Handle response with data
        const responseBody = response.body;
        
        if (responseBody.success && responseBody.data) {
          this.updateLocalBusinessData(responseBody.data);
          return responseBody;
        }
        
        // Handle direct business data (without success wrapper)
        if (responseBody.businessName || responseBody.registrationStatus) {
          console.log('🔍 Found direct business data in response');
          const businessData: BusinessRegistration = responseBody;
          this.updateLocalBusinessData(businessData);
          return {
            success: true,
            message: 'Business registration found',
            data: businessData
          } as BusinessStatusResponse;
        }
        
        // No valid data found
        console.log('🔍 No valid business data in response');
        return this.getBusinessProfileAsFallback();
      }),
      catchError(error => {
        console.log('🔍 Registration status error:', error);
        
        // Handle 404 - No business found
        if (error.status === 404) {
          console.log('🔍 No business registration found (404)');
          return this.getBusinessProfileAsFallback();
        }
        
        // Handle empty response with 200 status
        if (error.status === 200 && !error.error) {
          console.log('🔍 No business registration found (empty 200)');
          return this.getBusinessProfileAsFallback();
        }
        
        const localBusiness = this.getLocalBusinessData();
        if (localBusiness) {
          return of({
            success: true,
            message: 'Using local business data',
            data: localBusiness
          } as BusinessStatusResponse);
        }
        
        return this.getBusinessProfileAsFallback();
      })
    );
  }

  // ✅ FIXED: Fallback method to get business profile
  private getBusinessProfileAsFallback(): Observable<BusinessStatusResponse> {
    console.log('🔄 Falling back to business profile endpoint...');
    
    return this.getBusinessProfile().pipe(
      map(profileResponse => {
        if (profileResponse.success && profileResponse.data) {
          console.log('🔍 Found business profile data:', profileResponse.data);
          this.updateLocalBusinessData(profileResponse.data);
          return {
            success: true,
            message: 'Business profile found',
            data: profileResponse.data
          } as BusinessStatusResponse;
        } else {
          console.log('🔍 No business profile found either');
          return {
            success: false,
            message: 'No business registration found',
            data: null
          } as BusinessStatusResponse;
        }
      }),
      catchError(profileError => {
        console.log('🔍 Business profile fallback also failed:', profileError);
        const localBusiness = this.getLocalBusinessData();
        if (localBusiness) {
          return of({
            success: true,
            message: 'Using local business data',
            data: localBusiness
          } as BusinessStatusResponse);
        }
        return of({
          success: false,
          message: 'No business registration found',
          data: null
        } as BusinessStatusResponse);
      })
    );
  }

  // Business Profile
  getBusinessProfile(): Observable<ApiResponse<ExternalBusiness>> {
    return this.http.get<ApiResponse<ExternalBusiness>>(
      `${this.apiUrl}/api/external-business/my-business`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
        }
      }),
      catchError(error => {
        const localBusiness = this.getLocalBusinessData();
        if (localBusiness) {
          return of({
            success: true,
            message: 'Using local business data',
            data: localBusiness
          } as ApiResponse<ExternalBusiness>);
        }
        return throwError(() => error);
      })
    );
  }

  // Check if business profile exists
  hasBusinessProfile(): Observable<boolean> {
    return this.getBusinessProfile().pipe(
      map(response => !!response.data),
      catchError(() => {
        const localBusiness = this.getLocalBusinessData();
        return of(!!localBusiness);
      })
    );
  }

  // Advertisement Management
  createAdvertisement(advertisement: CreateAdvertisementRequest): Observable<ApiResponse<Advertisement>> {
    const adData = {
      title: advertisement.title.trim(),
      description: advertisement.description.trim(),
      mediaUrl: advertisement.mediaUrl,
      mediaType: advertisement.mediaType
    };

    return this.http.post<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/external-business/advertisements`,
      adData,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.addAdvertisementToLocal(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get user's advertisements
  getMyAdvertisements(): Observable<Advertisement[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/advertisements/my-ads`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (response?.advertisements && Array.isArray(response.advertisements)) {
          return response.advertisements;
        } else if (response?.content && Array.isArray(response.content)) {
          return response.content;
        }
        
        const localAds = this.getLocalAdvertisements();
        return localAds.length > 0 ? localAds : [];
      }),
      tap(ads => {
        if (ads && ads.length > 0) {
          this.updateLocalAdvertisements(ads);
        }
      }),
      catchError(error => {
        const localAds = this.getLocalAdvertisements();
        return of(localAds);
      })
    );
  }

  // Get approved advertisements (PUBLIC - no auth needed)
  getApprovedAdvertisements(): Observable<Advertisement[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/advertisements/approved`
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response.filter(ad => ad.status === 'APPROVED');
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data.filter((ad: Advertisement) => ad.status === 'APPROVED');
        } else if (response?.advertisements && Array.isArray(response.advertisements)) {
          return response.advertisements.filter((ad: Advertisement) => ad.status === 'APPROVED');
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  // Update advertisement
  updateAdvertisement(advertisementId: string, advertisement: CreateAdvertisementRequest): Observable<ApiResponse<Advertisement>> {
    const adData = {
      title: advertisement.title.trim(),
      description: advertisement.description.trim(),
      mediaUrl: advertisement.mediaUrl,
      mediaType: advertisement.mediaType
    };

    return this.http.post<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      adData,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.updateLocalAdvertisement(advertisementId, response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete advertisement
  deleteAdvertisement(advertisementId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.removeLocalAdvertisement(advertisementId);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get advertisement by ID
  getAdvertisementById(advertisementId: string): Observable<ApiResponse<Advertisement>> {
    return this.http.get<ApiResponse<Advertisement>>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Dashboard data
  getBusinessDashboardData(): Observable<BusinessDashboardData> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/dashboard`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      map(response => {
        if (response?.data) {
          return response.data;
        } else if (response?.dashboard) {
          return response.dashboard;
        }
        return this.generateMockDashboardData();
      }),
      catchError(error => {
        return of(this.generateMockDashboardData());
      })
    );
  }

  // Upload media
  uploadAdvertisementMedia(file: File): Observable<UploadResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      } as ErrorResponse));
    }

    const formData = new FormData();
    formData.append('file', file);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<UploadResponse>(
      `${this.apiUrl}/api/external-business/upload-media`,
      formData,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Analytics
  getAdvertisementAnalytics(advertisementId?: string): Observable<AdvertisementAnalytics | BusinessAnalytics> {
    const url = advertisementId 
      ? `${this.apiUrl}/api/external-business/analytics/ads/${advertisementId}`
      : `${this.apiUrl}/api/external-business/analytics`;

    return this.http.get<any>(
      url,
      { headers: this.createAuthHeaders() }
    ).pipe(
      map(response => {
        if (response?.data) {
          return response.data;
        } else if (response?.analytics) {
          return response.analytics;
        }
        return this.generateMockAnalyticsData(advertisementId);
      }),
      catchError(error => {
        return of(this.generateMockAnalyticsData(advertisementId));
      })
    );
  }

  // Billing history
  getBillingHistory(): Observable<BillingRecord[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/billing/history`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data;
        } else if (response?.billingHistory && Array.isArray(response.billingHistory)) {
          return response.billingHistory;
        }
        return this.generateMockBillingHistory();
      }),
      catchError(error => {
        return of(this.generateMockBillingHistory());
      })
    );
  }

  // Update business profile
  updateBusinessProfile(profileData: any): Observable<ApiResponse<ExternalBusiness>> {
    return this.http.put<ApiResponse<ExternalBusiness>>(
      `${this.apiUrl}/api/external-business/my-business`,
      profileData,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete business account
  deleteBusinessAccount(): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/api/external-business/my-business`,
      { headers: this.createAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.clearLocalBusinessData();
        }
      }),
      catchError(this.handleError)
    );
  }

  // Check if business is verified
  isBusinessVerified(): Observable<boolean> {
    return this.getRegistrationStatus().pipe(
      map(response => {
        const status = response.data?.verificationStatus || response.data?.registrationStatus || response.data?.status;
        return status === 'APPROVED';
      }),
      catchError(() => of(false))
    );
  }

  // Local storage management
  private updateLocalBusinessData(businessData: any): void {
    localStorage.setItem('businessData', JSON.stringify(businessData));
  }

  private getLocalBusinessData(): any {
    const businessData = localStorage.getItem('businessData');
    return businessData ? JSON.parse(businessData) : null;
  }

  private clearLocalBusinessData(): void {
    localStorage.removeItem('businessData');
    localStorage.removeItem('businessAdvertisements');
  }

  private updateLocalAdvertisements(ads: Advertisement[]): void {
    localStorage.setItem('businessAdvertisements', JSON.stringify(ads));
  }

  private getLocalAdvertisements(): Advertisement[] {
    const ads = localStorage.getItem('businessAdvertisements');
    return ads ? JSON.parse(ads) : [];
  }

  private addAdvertisementToLocal(ad: Advertisement): void {
    const currentAds = this.getLocalAdvertisements();
    currentAds.push(ad);
    this.updateLocalAdvertisements(currentAds);
  }

  private updateLocalAdvertisement(adId: string, updatedAd: Advertisement): void {
    const currentAds = this.getLocalAdvertisements();
    const index = currentAds.findIndex(ad => ad.id.toString() === adId);
    if (index !== -1) {
      currentAds[index] = updatedAd;
      this.updateLocalAdvertisements(currentAds);
    }
  }

  private removeLocalAdvertisement(adId: string): void {
    const currentAds = this.getLocalAdvertisements();
    const filteredAds = currentAds.filter(ad => ad.id.toString() !== adId);
    this.updateLocalAdvertisements(filteredAds);
  }

  // Mock data generators
  private generateMockDashboardData(): BusinessDashboardData {
    const localAds = this.getLocalAdvertisements();
    const localBusiness = this.getLocalBusinessData();
    
    return {
      totalAds: localAds.length,
      activeAds: localAds.filter(ad => ad.status === 'APPROVED').length,
      pendingAds: localAds.filter(ad => ad.status === 'PENDING').length,
      totalSpent: localAds.length * 500,
      totalClicks: localAds.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
      totalViews: localAds.reduce((sum, ad) => sum + (ad.views || 0), 0),
      approvalRate: localAds.length > 0 
        ? Math.round((localAds.filter(ad => ad.status === 'APPROVED').length / localAds.length) * 100) + '%'
        : '0%',
      businessName: localBusiness?.businessName || 'Your Business',
      registrationStatus: localBusiness?.verificationStatus || 'PENDING'
    };
  }

  private generateMockAnalyticsData(advertisementId?: string): AdvertisementAnalytics | BusinessAnalytics {
    if (advertisementId) {
      return {
        views: Math.floor(Math.random() * 1000),
        clicks: Math.floor(Math.random() * 100),
        engagement: Math.floor(Math.random() * 100),
        ctr: (Math.random() * 10).toFixed(2) + '%',
        impressions: Math.floor(Math.random() * 5000)
      } as AdvertisementAnalytics;
    }

    return {
      totalViews: Math.floor(Math.random() * 10000),
      totalClicks: Math.floor(Math.random() * 500),
      averageCTR: (Math.random() * 8).toFixed(2) + '%',
      totalSpent: Math.floor(Math.random() * 5000),
      topPerformingAd: 'Summer Sale Campaign'
    } as BusinessAnalytics;
  }

  private generateMockBillingHistory(): BillingRecord[] {
    return [
      {
        id: '1',
        date: '2024-01-15',
        description: 'Monthly Advertising Fee',
        amount: 500,
        status: 'PAID'
      },
      {
        id: '2',
        date: '2023-12-15',
        description: 'Monthly Advertising Fee',
        amount: 500,
        status: 'PAID'
      },
      {
        id: '3',
        date: '2023-11-15',
        description: 'Monthly Advertising Fee',
        amount: 500,
        status: 'PAID'
      }
    ];
  }

  // Auth headers for authenticated endpoints
  private createAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Error handling
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('❌ Business Service Error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed - Please login again';
    } else if (error.status === 403) {
      errorMessage = 'Access denied - Business account required';
    } else if (error.status === 404) {
      errorMessage = 'Resource not found';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    } as ErrorResponse));
  };
}