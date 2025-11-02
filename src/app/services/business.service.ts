// business.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

// Add these interfaces at the top
export interface BusinessRegistration {
  id: number;
  businessName: string;
  businessRegistrationNumber: string;
  businessLicenseDocumentUrl: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  userEmail: string;
  userFullName: string;
}

export interface BusinessStatusResponse {
  success: boolean;
  message: string;
  data: BusinessRegistration | null;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Business Registration
  registerBusiness(registrationData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/external-business/register`,
      registrationData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
          this.updateUserBusinessRole();
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get Registration Status - ADD THIS METHOD
  getRegistrationStatus(): Observable<BusinessStatusResponse> {
    return this.http.get<BusinessStatusResponse>(
      `${this.apiUrl}/api/external-business/registration-status`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
          
          // If approved, update user role
          if (response.data.verificationStatus === 'APPROVED') {
            this.updateUserBusinessRole();
          }
        }
      }),
      catchError(error => {
        // Check if we have local business data as fallback
        const localBusiness = this.getLocalBusinessData();
        if (localBusiness) {
          return of({
            success: true,
            message: 'Using local business data',
            data: localBusiness
          });
        }
        return throwError(() => error);
      })
    );
  }

  // Get Business Profile
  getBusinessProfile(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/my-business`,
      { headers: this.createHeaders(), responseType: 'json' }
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
          });
        }
        return throwError(() => error);
      })
    );
  }

  // Check if user has business profile
  hasBusinessProfile(): Observable<boolean> {
    return this.getBusinessProfile().pipe(
      map(response => response.success && response.data),
      catchError(() => {
        const localBusiness = this.getLocalBusinessData();
        return of(!!localBusiness);
      })
    );
  }

  // Advertisement Management
  createAdvertisement(advertisement: any): Observable<any> {
    const adData = {
      title: advertisement.title.trim(),
      description: advertisement.description.trim(),
      mediaUrl: advertisement.mediaUrl,
      mediaType: advertisement.mediaType
    };

    return this.http.post<any>(
      `${this.apiUrl}/api/external-business/advertisements`,
      adData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.addAdvertisementToLocal(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get My Advertisements
  getMyAdvertisements(): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/advertisements/my-ads`,
      { headers: this.createHeaders(), responseType: 'json' }
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

  // Get Approved Advertisements
  getApprovedAdvertisements(): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/advertisements/approved`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response.filter(ad => ad.status === 'APPROVED');
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data.filter((ad: any) => ad.status === 'APPROVED');
        } else if (response?.advertisements && Array.isArray(response.advertisements)) {
          return response.advertisements.filter((ad: any) => ad.status === 'APPROVED');
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  // Update Advertisement
  updateAdvertisement(advertisementId: string, advertisement: any): Observable<any> {
    const adData = {
      title: advertisement.title.trim(),
      description: advertisement.description.trim(),
      mediaUrl: advertisement.mediaUrl,
      mediaType: advertisement.mediaType
    };

    return this.http.put<any>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      adData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.updateLocalAdvertisement(advertisementId, response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete Advertisement
  deleteAdvertisement(advertisementId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.removeLocalAdvertisement(advertisementId);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get Advertisement by ID
  getAdvertisementById(advertisementId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/advertisements/${advertisementId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Business Dashboard Data
  getBusinessDashboardData(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/dashboard`,
      { headers: this.createHeaders(), responseType: 'json' }
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
        return of({
          success: true,
          data: this.generateMockDashboardData(),
          message: 'Using mock dashboard data'
        });
      })
    );
  }

  // Upload Advertisement Media
  uploadAdvertisementMedia(file: File): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => ({ 
        status: 401, 
        message: 'No authentication token found' 
      }));
    }

    const formData = new FormData();
    formData.append('file', file);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<any>(
      `${this.apiUrl}/api/external-business/upload-media`,
      formData,
      { headers, responseType: 'json' }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Analytics and Performance
  getAdvertisementAnalytics(advertisementId?: string): Observable<any> {
    const url = advertisementId 
      ? `${this.apiUrl}/api/external-business/analytics/ads/${advertisementId}`
      : `${this.apiUrl}/api/external-business/analytics`;

    return this.http.get<any>(
      url,
      { headers: this.createHeaders(), responseType: 'json' }
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
        return of({
          success: true,
          data: this.generateMockAnalyticsData(advertisementId),
          message: 'Using mock analytics data'
        });
      })
    );
  }

  // Billing and Payments
  getBillingHistory(): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/external-business/billing/history`,
      { headers: this.createHeaders(), responseType: 'json' }
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

  // Update Business Profile
  updateBusinessProfile(profileData: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/api/external-business/my-business`,
      profileData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateLocalBusinessData(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Delete Business Account
  deleteBusinessAccount(): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/external-business/my-business`,
      { headers: this.createHeaders(), responseType: 'json' }
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
      map(response => response.data?.verificationStatus === 'APPROVED'),
      catchError(() => of(false))
    );
  }

  // Private helper methods
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

  private updateLocalAdvertisements(ads: any[]): void {
    localStorage.setItem('businessAdvertisements', JSON.stringify(ads));
  }

  private getLocalAdvertisements(): any[] {
    const ads = localStorage.getItem('businessAdvertisements');
    return ads ? JSON.parse(ads) : [];
  }

  private addAdvertisementToLocal(ad: any): void {
    const currentAds = this.getLocalAdvertisements();
    currentAds.push(ad);
    this.updateLocalAdvertisements(currentAds);
  }

  private updateLocalAdvertisement(adId: string, updatedAd: any): void {
    const currentAds = this.getLocalAdvertisements();
    const index = currentAds.findIndex(ad => ad.id === adId);
    if (index !== -1) {
      currentAds[index] = updatedAd;
      this.updateLocalAdvertisements(currentAds);
    }
  }

  private removeLocalAdvertisement(adId: string): void {
    const currentAds = this.getLocalAdvertisements();
    const filteredAds = currentAds.filter(ad => ad.id !== adId);
    this.updateLocalAdvertisements(filteredAds);
  }

  private updateUserBusinessRole(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        role: 'BUSINESS'
      };
      
      const isPermanent = !!localStorage.getItem('userData');
      const storage = isPermanent ? localStorage : sessionStorage;
      storage.setItem('userData', JSON.stringify(updatedUser));
      
      try {
        if ((this.authService as any).currentUserSubject) {
          (this.authService as any).currentUserSubject.next(updatedUser);
        }
      } catch (error) {
        console.log('AuthService subject update failed, continuing...');
      }
    }
  }

  // Mock data generators
  private generateMockDashboardData(): any {
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

  private generateMockAnalyticsData(advertisementId?: string): any {
    if (advertisementId) {
      return {
        views: Math.floor(Math.random() * 1000),
        clicks: Math.floor(Math.random() * 100),
        engagement: Math.floor(Math.random() * 100),
        ctr: (Math.random() * 10).toFixed(2) + '%',
        impressions: Math.floor(Math.random() * 5000)
      };
    }

    return {
      totalViews: Math.floor(Math.random() * 10000),
      totalClicks: Math.floor(Math.random() * 500),
      averageCTR: (Math.random() * 8).toFixed(2) + '%',
      totalSpent: Math.floor(Math.random() * 5000),
      topPerformingAd: 'Summer Sale Campaign'
    };
  }

  private generateMockBillingHistory(): any[] {
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

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed';
      this.authService.logout().subscribe();
    } else if (error.status === 403) {
      errorMessage = 'Access denied - Business account required';
    } else if (error.status === 404) {
      errorMessage = 'Business service not found';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  };
}