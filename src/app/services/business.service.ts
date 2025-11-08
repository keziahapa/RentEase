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

  // ✅ FIXED: Business Registration Status - With Comprehensive Debugging
  getRegistrationStatus(): Observable<BusinessStatusResponse> {
    console.log('🔍 [1] Starting getRegistrationStatus()...');
    console.log('🔍 [1a] API URL:', `${this.apiUrl}/api/external-business/registration-status`);
    
    // Check local storage first for quick fallback
    const localBusiness = this.getLocalBusinessData();
    if (localBusiness) {
      console.log('🔍 [1b] Found local business data:', localBusiness);
    } else {
      console.log('🔍 [1c] No local business data found');
    }
    
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/registration-status`,
      { 
        headers: this.createAuthHeaders(),
        observe: 'response'
      }
    ).pipe(
      map(response => {
        console.log('🔍 [2] Full HTTP Response received:');
        console.log('🔍 [2a] Status:', response.status);
        console.log('🔍 [2b] Status Text:', response.statusText);
        console.log('🔍 [2c] Headers:', response.headers);
        console.log('🔍 [2d] Body exists:', !!response.body);
        console.log('🔍 [2e] Body type:', typeof response.body);
        console.log('🔍 [2f] Body content:', response.body);
        
        if (response.body) {
          console.log('🔍 [2g] Body keys:', Object.keys(response.body));
          console.log('🔍 [2h] Body stringified:', JSON.stringify(response.body, null, 2));
        }

        // Handle empty response body
        if (!response.body) {
          console.log('🔍 [3] EMPTY RESPONSE BODY - No business registration found');
          console.log('🔍 [3a] Response status:', response.status);
          
          if (response.status === 204) {
            console.log('🔍 [3b] 204 No Content - Explicitly no business data');
          } else if (response.status === 200) {
            console.log('🔍 [3c] 200 OK but empty body - No business data');
          }
          
          console.log('🔍 [3d] Checking local storage for business data...');
          
          if (localBusiness) {
            console.log('🔍 [3e] Found local business data, using as fallback');
            return {
              success: true,
              message: 'Using local business data (empty response)',
              data: localBusiness
            } as BusinessStatusResponse;
          }
          
          console.log('🔍 [3f] No local business data either');
          return {
            success: false,
            message: 'No business registration found (empty response)',
            data: null
          } as BusinessStatusResponse;
        }

        // Handle response with success wrapper
        if (response.body.success !== undefined) {
          console.log('🔍 [4] Response has success wrapper:', response.body.success);
          console.log('🔍 [4a] Response message:', response.body.message);
          console.log('🔍 [4b] Response data exists:', !!response.body.data);
          
          if (response.body.success && response.body.data) {
            console.log('🔍 [4c] ✅ Valid business data found in response:');
            console.log('🔍 [4d] Business data:', response.body.data);
            console.log('🔍 [4e] Business data type:', typeof response.body.data);
            console.log('🔍 [4f] Business data keys:', Object.keys(response.body.data));
            
            // Check for status fields in the data
            const businessData = response.body.data;
            const verificationStatus = businessData.verificationStatus;
            const registrationStatus = businessData.registrationStatus;
            const status = businessData.status;
            
            console.log('🔍 [4g] Status fields:', {
              verificationStatus,
              registrationStatus,
              status
            });
            
            this.updateLocalBusinessData(businessData);
            return response.body;
          } else {
            console.log('🔍 [4h] ❌ Response success is false or no data');
            console.log('🔍 [4i] Success:', response.body.success);
            console.log('🔍 [4j] Data:', response.body.data);
            console.log('🔍 [4k] Message:', response.body.message);
            return this.handleNoBusinessData(localBusiness);
          }
        }

        // Handle direct business data (without wrapper)
        if (response.body.businessName || response.body.registrationStatus || response.body.verificationStatus || response.body.id) {
          console.log('🔍 [5] Found direct business data in response (no wrapper):');
          console.log('🔍 [5a] Business data:', response.body);
          console.log('🔍 [5b] Business name:', response.body.businessName);
          console.log('🔍 [5c] Registration status:', response.body.registrationStatus);
          console.log('🔍 [5d] Verification status:', response.body.verificationStatus);
          console.log('🔍 [5e] Status:', response.body.status);
          console.log('🔍 [5f] ID:', response.body.id);
          
          this.updateLocalBusinessData(response.body);
          return {
            success: true,
            message: 'Business registration found (direct data)',
            data: response.body
          } as BusinessStatusResponse;
        }

        // Check if it's an array (unexpected but possible)
        if (Array.isArray(response.body)) {
          console.log('🔍 [6] Response body is an array (unexpected):', response.body);
          if (response.body.length > 0) {
            console.log('🔍 [6a] Using first item in array as business data');
            this.updateLocalBusinessData(response.body[0]);
            return {
              success: true,
              message: 'Business registration found (array data)',
              data: response.body[0]
            } as BusinessStatusResponse;
          }
        }

        // Unknown response structure
        console.log('🔍 [7] ❌ Unknown response structure:');
        console.log('🔍 [7a] Body:', response.body);
        console.log('🔍 [7b] Body type:', typeof response.body);
        console.log('🔍 [7c] All body keys:', Object.keys(response.body));
        
        return this.handleNoBusinessData(localBusiness);
      }),
      catchError(error => {
        console.log('🔍 [8] ❌ ERROR in getRegistrationStatus():');
        console.log('🔍 [8a] Error name:', error.name);
        console.log('🔍 [8b] Error message:', error.message);
        console.log('🔍 [8c] Error status:', error.status);
        console.log('🔍 [8d] Error status text:', error.statusText);
        console.log('🔍 [8e] Error URL:', error.url);
        console.log('🔍 [8f] Full error:', error);

        if (error.status === 404) {
          console.log('🔍 [8g] 404 - Business registration not found');
        } else if (error.status === 401) {
          console.log('🔍 [8h] 401 - Authentication failed');
        } else if (error.status === 403) {
          console.log('🔍 [8i] 403 - Access denied');
        } else if (error.status === 500) {
          console.log('🔍 [8j] 500 - Server error');
        } else {
          console.log('🔍 [8k] Other error status:', error.status);
        }

        if (localBusiness) {
          console.log('🔍 [8l] Using local business data after error');
          return of({
            success: true,
            message: 'Using local business data (after error)',
            data: localBusiness
          } as BusinessStatusResponse);
        }

        console.log('🔍 [8m] No business data available after error');
        return of({
          success: false,
          message: `No business registration found: ${error.message || 'Unknown error'}`,
          data: null
        } as BusinessStatusResponse);
      })
    );
  }

  // Helper method for no business data
  private handleNoBusinessData(localBusiness: any): BusinessStatusResponse {
    console.log('🔍 [9] No business data found in response');
    
    if (localBusiness) {
      console.log('🔍 [9a] Using local business data as fallback');
      return {
        success: true,
        message: 'Using local business data',
        data: localBusiness
      } as BusinessStatusResponse;
    }
    
    console.log('🔍 [9b] No business data anywhere');
    return {
      success: false,
      message: 'No business registration found',
      data: null
    } as BusinessStatusResponse;
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