import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  AdminStats,
  Business,
  Advertisement,
  ExternalBusiness,
  ApiResponse,
  SearchParams
} from './admin-interfaces';
import { AdminService } from './admin.service';

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private readonly adminService = inject(AdminService);

  private dashboardStats: AdminStats = {
    totalUsers: 0,
    totalProperties: 0,
    activeBusinesses: 0,
    totalBusinesses: 0,
    monthlyRevenue: 0,
    commissionRevenue: 0,
    pendingApprovals: 0,
    activeDisputes: 0,
    userGrowth: 0,
    revenueGrowth: 0,
    propertiesGrowth: 0,
    totalLandlords: 0,
    totalTenants: 0,
    totalCaretakers: 0,
    totalAdmins: 0,
    platformEarnings: 0,
    systemHealth: 'unknown'
  };

  private businesses: Business[] = [];
  private advertisements: Advertisement[] = [];
  private externalBusinesses: ExternalBusiness[] = [];

  getDashboardStats(): Observable<ApiResponse<AdminStats>> {
    return this.adminService.getDashboardStats().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.dashboardStats = { ...response.data };
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('dashboard stats', error);
        return of<ApiResponse<AdminStats>>({
          success: true,
          data: { ...this.dashboardStats },
          message: this.extractErrorMessage(error) || 'Using cached dashboard stats.'
        });
      }),
      map(response => {
        if (response?.success && response.data) {
          return response;
        }
        return {
          success: true,
          data: { ...this.dashboardStats },
          message: response?.message ?? 'Using cached dashboard stats.'
        };
      })
    );
  }

  getBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.adminService.getBusinesses().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setBusinesses(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('business list', error);
        return of<ApiResponse<Business[]>>({
          success: true,
          data: this.cloneBusinesses(this.businesses),
          message: this.extractErrorMessage(error) || 'Serving cached businesses.'
        });
      }),
      map(response => {
        if (response?.success && response.data) {
          return {
            success: true,
            data: this.cloneBusinesses(response.data),
            message: response.message
          };
        }
        return {
          success: true,
          data: this.cloneBusinesses(this.businesses),
          message: response?.message ?? 'Serving cached businesses.'
        };
      })
    );
  }

  getPendingBusinesses(): Observable<ApiResponse<Business[]>> {
    return this.adminService.getPendingBusinesses().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setBusinesses(response.data, true);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('pending business list', error);
        const pending = this.businesses.filter(business => 
          business.status === 'pending' || business.registrationStatus === 'PENDING'
        );
        return of<ApiResponse<Business[]>>({
          success: true,
          data: this.cloneBusinesses(pending),
          message: this.extractErrorMessage(error) || 'Serving cached pending businesses.'
        });
      }),
      map(response => {
        if (response?.success && response.data) {
          return {
            success: true,
            data: this.cloneBusinesses(response.data),
            message: response.message
          };
        }
        const pending = this.businesses.filter(business => 
          business.status === 'pending' || business.registrationStatus === 'PENDING'
        );
        return {
          success: true,
          data: this.cloneBusinesses(pending),
          message: response?.message ?? 'Serving cached pending businesses.'
        };
      })
    );
  }

  approveBusiness(businessId: number): Observable<ApiResponse<Business>> {
    return this.adminService.approveBusiness(businessId).pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.upsertBusiness(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`approve business ${businessId}`, error);
        const business = this.updateBusinessStatus(businessId, 'approved', 'APPROVED');
        if (!business) {
          return throwError(() => new Error('Business not found'));
        }
        return of<ApiResponse<Business>>({
          success: true,
          data: business,
          message: this.extractErrorMessage(error) || 'Business approved locally.'
        });
      })
    );
  }

  rejectBusiness(businessId: number, rejectionReason: string): Observable<ApiResponse<Business>> {
    return this.adminService.rejectBusiness(businessId, rejectionReason).pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.upsertBusiness(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`reject business ${businessId}`, error);
        const business = this.updateBusinessStatus(businessId, 'rejected', 'REJECTED', rejectionReason);
        if (!business) {
          return throwError(() => new Error('Business not found'));
        }
        return of<ApiResponse<Business>>({
          success: true,
          data: business,
          message: this.extractErrorMessage(error) || 'Business rejected locally.'
        });
      })
    );
  }

  suspendBusiness(businessId: number, reason: string): Observable<ApiResponse<Business>> {
    return this.adminService.suspendBusiness(businessId, reason).pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.upsertBusiness(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`suspend business ${businessId}`, error);
        const business = this.updateBusinessStatus(businessId, 'suspended', 'SUSPENDED', undefined, reason);
        if (!business) {
          return throwError(() => new Error('Business not found'));
        }
        return of<ApiResponse<Business>>({
          success: true,
          data: business,
          message: this.extractErrorMessage(error) || 'Business suspended locally.'
        });
      })
    );
  }

  getAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.adminService.getAdvertisements().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setAdvertisements(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('advertisement list', error);
        return of<ApiResponse<Advertisement[]>>({
          success: true,
          data: this.cloneAdvertisements(this.advertisements),
          message: this.extractErrorMessage(error) || 'Serving cached advertisements.'
        });
      }),
      map(response => {
        if (response?.success && response.data) {
          return {
            success: true,
            data: this.cloneAdvertisements(response.data),
            message: response.message
          };
        }
        return {
          success: true,
          data: this.cloneAdvertisements(this.advertisements),
          message: response?.message ?? 'Serving cached advertisements.'
        };
      })
    );
  }

  getPendingAdvertisements(): Observable<ApiResponse<Advertisement[]>> {
    return this.adminService.getPendingAdvertisements().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setAdvertisements(response.data, true);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('pending advertisement list', error);
        const pending = this.advertisements.filter(ad => ad.status === 'PENDING');
        return of<ApiResponse<Advertisement[]>>({
          success: true,
          data: this.cloneAdvertisements(pending),
          message: this.extractErrorMessage(error) || 'Serving cached pending advertisements.'
        });
      }),
      map(response => {
        if (response?.success && response.data) {
          return {
            success: true,
            data: this.cloneAdvertisements(response.data),
            message: response.message
          };
        }
        const pending = this.advertisements.filter(ad => ad.status === 'PENDING');
        return {
          success: true,
          data: this.cloneAdvertisements(pending),
          message: response?.message ?? 'Serving cached pending advertisements.'
        };
      })
    );
  }

  approveAdvertisement(advertisementId: number): Observable<ApiResponse<Advertisement>> {
    return this.adminService.approveAdvertisement(advertisementId).pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.upsertAdvertisement(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`approve advertisement ${advertisementId}`, error);
        const advertisement = this.updateAdvertisementStatus(advertisementId, 'APPROVED');
        if (!advertisement) {
          return throwError(() => new Error('Advertisement not found'));
        }
        return of<ApiResponse<Advertisement>>({
          success: true,
          data: advertisement,
          message: this.extractErrorMessage(error) || 'Advertisement approved locally.'
        });
      })
    );
  }

  rejectAdvertisement(advertisementId: number, reason: string): Observable<ApiResponse<Advertisement>> {
    return this.adminService.rejectAdvertisement(advertisementId, reason).pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.upsertAdvertisement(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`reject advertisement ${advertisementId}`, error);
        const advertisement = this.updateAdvertisementStatus(advertisementId, 'REJECTED', reason);
        if (!advertisement) {
          return throwError(() => new Error('Advertisement not found'));
        }
        return of<ApiResponse<Advertisement>>({
          success: true,
          data: advertisement,
          message: this.extractErrorMessage(error) || 'Advertisement rejected locally.'
        });
      })
    );
  }

  getExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    return this.adminService.getExternalBusinesses().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setExternalBusinesses(response.data);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('external business list', error);
        return of<ApiResponse<ExternalBusiness[]>>({
          success: true,
          data: this.cloneExternalBusinesses(this.externalBusinesses),
          message: this.extractErrorMessage(error) || 'Serving cached external businesses.'
        });
      })
    );
  }

  getPendingExternalBusinesses(): Observable<ApiResponse<ExternalBusiness[]>> {
    return this.adminService.getPendingExternalBusinesses().pipe(
      tap(response => {
        if (response?.success && response.data) {
          this.setExternalBusinesses(response.data, true);
        }
      }),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback('pending external business list', error);
        const pending = this.externalBusinesses.filter(business => business.registrationStatus === 'PENDING');
        return of<ApiResponse<ExternalBusiness[]>>({
          success: true,
          data: this.cloneExternalBusinesses(pending),
          message: this.extractErrorMessage(error) || 'Serving cached pending external businesses.'
        });
      })
    );
  }

  generateReport(reportType: string, params?: SearchParams): Observable<ApiResponse<any>> {
    return this.adminService.generateReport(reportType, params).pipe(
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`generate report ${reportType}`, error);
        return of({
          success: false,
          message: 'Report generation unavailable while offline. Please retry later.',
          data: null
        });
      })
    );
  }

  exportReport(reportType: string, format: 'csv' | 'pdf', params?: SearchParams): Observable<Blob> {
    return this.adminService.exportReport(reportType, format, params).pipe(
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`export report ${reportType}`, error);
        const message = `Export for ${reportType} unavailable while offline.`;
        return of(new Blob([message], { type: 'text/plain' }));
      })
    );
  }

  private setBusinesses(businesses: Business[], merge = false): void {
    if (merge) {
      const merged = [...this.businesses];
      businesses.forEach(business => {
        const index = merged.findIndex(existing => existing.id === business.id);
        if (index === -1) {
          merged.push({ ...business });
        } else {
          merged[index] = { ...business };
        }
      });
      this.businesses = this.cloneBusinesses(merged);
    } else {
      this.businesses = this.cloneBusinesses(businesses);
    }
  }

  private upsertBusiness(business: Business): void {
    const index = this.businesses.findIndex(existing => existing.id === business.id);
    if (index === -1) {
      this.businesses = [{ ...business }, ...this.businesses];
    } else {
      const updated = [...this.businesses];
      updated[index] = { ...business };
      this.businesses = updated;
    }
  }

  private updateBusinessStatus(
    businessId: number,
    status: Business['status'],
    registrationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    rejectionReason?: string,
    suspensionReason?: string
  ): Business | null {
    const index = this.businesses.findIndex(business => business.id === businessId);
    if (index === -1) {
      return null;
    }
    const business = { ...this.businesses[index], status };
    if (registrationStatus) {
      business.registrationStatus = registrationStatus;
    }
    if (rejectionReason !== undefined) {
      business.rejectionReason = rejectionReason;
    } else if (status !== 'rejected') {
      delete business.rejectionReason;
    }
    if (suspensionReason !== undefined) {
      business.suspensionReason = suspensionReason;
    } else if (status !== 'suspended') {
      delete business.suspensionReason;
    }
    const updated = [...this.businesses];
    updated[index] = business;
    this.businesses = updated;
    return business;
  }

  private setAdvertisements(advertisements: Advertisement[], merge = false): void {
    if (merge) {
      const merged = [...this.advertisements];
      advertisements.forEach(ad => {
        const index = merged.findIndex(existing => existing.id === ad.id);
        if (index === -1) {
          merged.push({ ...ad });
        } else {
          merged[index] = { ...ad };
        }
      });
      this.advertisements = this.cloneAdvertisements(merged);
    } else {
      this.advertisements = this.cloneAdvertisements(advertisements);
    }
  }

  private upsertAdvertisement(advertisement: Advertisement): void {
    const index = this.advertisements.findIndex(existing => existing.id === advertisement.id);
    if (index === -1) {
      this.advertisements = [{ ...advertisement }, ...this.advertisements];
    } else {
      const updated = [...this.advertisements];
      updated[index] = { ...advertisement };
      this.advertisements = updated;
    }
  }

  private updateAdvertisementStatus(
    advertisementId: number,
    status: Advertisement['status'],
    rejectionReason?: string
  ): Advertisement | null {
    const index = this.advertisements.findIndex(ad => ad.id === advertisementId);
    if (index === -1) {
      return null;
    }
    const advertisement = { ...this.advertisements[index], status };
    if (rejectionReason !== undefined) {
      advertisement.rejectionReason = rejectionReason;
    } else if (status !== 'REJECTED') {
      delete advertisement.rejectionReason;
    }
    const updated = [...this.advertisements];
    updated[index] = advertisement;
    this.advertisements = updated;
    return advertisement;
  }

  private setExternalBusinesses(businesses: ExternalBusiness[], merge = false): void {
    if (merge) {
      const merged = [...this.externalBusinesses];
      businesses.forEach(business => {
        const index = merged.findIndex(existing => existing.id === business.id);
        if (index === -1) {
          merged.push({ ...business });
        } else {
          merged[index] = { ...business };
        }
      });
      this.externalBusinesses = this.cloneExternalBusinesses(merged);
    } else {
      this.externalBusinesses = this.cloneExternalBusinesses(businesses);
    }
  }

  private cloneBusinesses(businesses: Business[]): Business[] {
    return businesses.map(business => ({ ...business }));
  }

  private cloneAdvertisements(advertisements: Advertisement[]): Advertisement[] {
    return advertisements.map(advertisement => ({ ...advertisement }));
  }

  private cloneExternalBusinesses(businesses: ExternalBusiness[]): ExternalBusiness[] {
    return businesses.map(business => ({ ...business }));
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    if (error.status === 0 || error.status >= 500) {
      return true;
    }
    return false;
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[AdminDataService] Falling back to local data for ${context}`, error);
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return '';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    return '';
  }
}