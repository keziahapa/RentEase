import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ProfilePictureService, UpdateProfileResponse, ProfilePictureResponse } from './profile-picture.service';
import { 
  LandlordMoveOutNotice, 
  LandlordMoveOutNoticeResponse, 
  MoveOutActionRequest,
  TenantMoveOutNoticeResponse,
  MoveOutNoticeRequest,
  MoveOutStats
} from './dashboard-interface';

@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com';
  private readonly fallbackProperties: any[] = [
    {
      id: 'property-101',
      name: 'Greenwood Gardens',
      location: 'Lavington, Nairobi',
      propertyType: 'APARTMENT',
      totalUnits: 12,
      description: 'Modern apartments with parking, CCTV, and borehole water.',
      ownerId: 'landlord-1',
      createdAt: '2024-01-05T08:00:00Z',
      updatedAt: '2024-02-13T12:30:00Z',
      status: 'active',
      units: [
        {
          id: 'unit-101',
          unitNumber: 'A-01',
          unitType: '2BR',
          rentAmount: 55000,
          deposit: 55000,
          status: 'occupied',
          tenant: {
            id: 'tenant-101',
            name: 'Amina Njoroge',
            email: 'amina.njoroge@example.com'
          }
        },
        {
          id: 'unit-102',
          unitNumber: 'A-02',
          unitType: '1BR',
          rentAmount: 42000,
          deposit: 42000,
          status: 'vacant'
        },
        {
          id: 'unit-103',
          unitNumber: 'A-03',
          unitType: '3BR',
          rentAmount: 68000,
          deposit: 68000,
          status: 'maintenance'
        }
      ]
    },
    {
      id: 'property-205',
      name: 'Skyview Towers',
      location: 'Westlands, Nairobi',
      propertyType: 'MIXED',
      totalUnits: 20,
      description: 'Mixed-use development with retail on ground floor.',
      ownerId: 'landlord-1',
      createdAt: '2023-09-12T06:15:00Z',
      updatedAt: '2024-02-11T10:02:00Z',
      status: 'active',
      units: [
        {
          id: 'unit-205-1',
          unitNumber: 'Penthouse 8A',
          unitType: '3BR',
          rentAmount: 95000,
          deposit: 120000,
          status: 'occupied',
          tenant: {
            id: 'tenant-205-1',
            name: 'Brian Kamau',
            email: 'brian.kamau@example.com'
          }
        },
        {
          id: 'unit-205-2',
          unitNumber: 'Shop G-2',
          unitType: 'RETAIL',
          rentAmount: 75000,
          deposit: 90000,
          status: 'occupied',
          tenant: {
            id: 'tenant-205-2',
            name: 'Prime Clinic',
            email: 'info@primeclinic.co.ke'
          }
        },
        {
          id: 'unit-205-3',
          unitNumber: 'Office 5B',
          unitType: 'OFFICE',
          rentAmount: 68000,
          deposit: 68000,
          status: 'vacant'
        }
      ]
    }
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private profileService: ProfilePictureService
  ) {}

  // ============================================================================
  // PROFILE METHODS
  // ============================================================================

  getCurrentUserProfile(): Observable<UpdateProfileResponse> {
    return this.profileService.getCurrentUserProfile();
  }

  updateUserProfile(profileData: any): Observable<UpdateProfileResponse> {
    return this.profileService.updateProfilePartial(profileData);
  }

  getProfilePicture(): Observable<ProfilePictureResponse> {
    return this.profileService.getProfilePicture();
  }

  uploadProfilePicture(file: File): Observable<ProfilePictureResponse> {
    return this.profileService.uploadProfilePicture(file);
  }

  updateProfilePicture(file: File): Observable<ProfilePictureResponse> {
    return this.profileService.updateProfilePicture(file);
  }

  deleteProfilePicture(): Observable<ProfilePictureResponse> {
    return this.profileService.deleteProfilePicture();
  }

  // ============================================================================
  // PROPERTY METHODS
  // ============================================================================

  createProperty(request: any): Observable<any> {
    const backendRequest = {
      name: request.name.trim(),
      location: request.location.trim(),
      propertyType: request.propertyType,
      totalUnits: Number(request.totalUnits),
      description: request.description?.trim() || ''
    };

    return this.http.post<any>(
      `${this.apiUrl}/api/landlord/properties`,
      backendRequest,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getProperties(): Observable<any[]> {
    try {
      return this.http.get<any>(
        `${this.apiUrl}/api/landlord/properties`, 
        { headers: this.createHeaders(), responseType: 'json' }
      ).pipe(
        map(response => this.normalizePropertiesResponse(response)),
        catchError(error => this.handlePropertiesError(error))
      );
    } catch (error) {
      return this.handlePropertiesError(error);
    }
  }

  getPropertyById(propertyId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        if (response?.data) {
          return response.data;
        } else if (response?.property) {
          return response.property;
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  updateProperty(propertyId: string, request: any): Observable<any> {
    const backendRequest = {
      name: request.name.trim(),
      location: request.location.trim(),
      propertyType: request.propertyType,
      totalUnits: Number(request.totalUnits),
      description: request.description?.trim() || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      backendRequest,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  deleteProperty(propertyId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getUnitsByPropertyId(propertyId: string): Observable<any[]> {
    try {
      return this.http.get<any>(
        `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
        { headers: this.createHeaders(), responseType: 'json' }
      ).pipe(
        map(response => this.normalizeUnitsResponse(response)),
        catchError(error => this.handleUnitsError(propertyId, error))
      );
    } catch (error) {
      return this.handleUnitsError(propertyId, error);
    }
  }

  getPropertyUnits(propertyId: string): Observable<any[]> {
    return this.getUnitsByPropertyId(propertyId);
  }

  createUnit(propertyId: string, unit: any): Observable<any> {
    const unitData = {
      unitNumber: unit.unitNumber.trim(),
      unitType: unit.unitType,
      rentAmount: Number(unit.rentAmount),
      deposit: Number(unit.deposit),
      description: unit.description?.trim() || ''
    };

    return this.http.post<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
      unitData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  updateUnit(propertyId: string, unitId: string, unit: any): Observable<any> {
    const unitData = {
      unitNumber: unit.unitNumber?.trim(),
      unitType: unit.unitType,
      rentAmount: Number(unit.rentAmount),
      deposit: Number(unit.deposit),
      description: unit.description?.trim() || ''
    };

    return this.http.put<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units/${unitId}`,
      unitData,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  deleteUnit(propertyId: string, unitId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units/${unitId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/dashboard/stats`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getPropertyStats(propertyId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/stats`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  // ============================================================================
  // MOVE-OUT NOTICE METHODS - LANDLORD
  // ============================================================================

  getLandlordMoveOutNotices(page: number = 1, limit: number = 10, status?: string): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getDefaultLandlordMoveOutNotices());
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      catchError(() => of(this.getDefaultLandlordMoveOutNotices()))
    );
  }

  approveMoveOutNotice(noticeId: number, request?: MoveOutActionRequest): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as LandlordMoveOutNotice
      });
    }

    return this.http.post<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}/approve`,
      request || {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to approve move-out notice',
        data: {} as LandlordMoveOutNotice
      }))
    );
  }

  rejectMoveOutNotice(noticeId: number, request?: MoveOutActionRequest): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as LandlordMoveOutNotice
      });
    }

    return this.http.post<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}/reject`,
      request || {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to reject move-out notice',
        data: {} as LandlordMoveOutNotice
      }))
    );
  }

  getLandlordMoveOutNoticeById(noticeId: number): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as LandlordMoveOutNotice
      });
    }

    return this.http.get<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to fetch move-out notice',
        data: {} as LandlordMoveOutNotice
      }))
    );
  }

  getMoveOutStats(): Observable<MoveOutStats> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getDefaultMoveOutStats());
    }

    return this.http.get<MoveOutStats>(
      `${this.apiUrl}/api/landlord/move-out-notices/stats`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(() => of(this.getDefaultMoveOutStats()))
    );
  }

  // ============================================================================
  // MOVE-OUT NOTICE METHODS - TENANT
  // ============================================================================

  getTenantMoveOutNotices(page: number = 1, limit: number = 10): Observable<TenantMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getDefaultTenantMoveOutNotices());
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<TenantMoveOutNoticeResponse>(
      `${this.apiUrl}/api/tenant/move-out-notices`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      catchError(() => of(this.getDefaultTenantMoveOutNotices()))
    );
  }

  submitMoveOutNotice(request: MoveOutNoticeRequest): Observable<TenantMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as any
      });
    }

    return this.http.post<TenantMoveOutNoticeResponse>(
      `${this.apiUrl}/api/tenant/move-out-notices`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to submit move-out notice',
        data: {} as any
      }))
    );
  }

  cancelMoveOutNotice(noticeId: number): Observable<TenantMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as any
      });
    }

    return this.http.patch<TenantMoveOutNoticeResponse>(
      `${this.apiUrl}/api/tenant/move-out-notices/${noticeId}/cancel`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to cancel move-out notice',
        data: {} as any
      }))
    );
  }

  getTenantMoveOutNoticeById(noticeId: number): Observable<TenantMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ 
        success: false, 
        message: 'No authentication token',
        data: {} as any
      });
    }

    return this.http.get<TenantMoveOutNoticeResponse>(
      `${this.apiUrl}/api/tenant/move-out-notices/${noticeId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => of({ 
        success: false, 
        message: error.message || 'Failed to fetch move-out notice',
        data: {} as any
      }))
    );
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private normalizePropertiesResponse(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response?.properties && Array.isArray(response.properties)) {
      return response.properties;
    }
    if (response?.content && Array.isArray(response.content)) {
      return response.content;
    }
    return [];
  }

  private normalizeUnitsResponse(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response?.units && Array.isArray(response.units)) {
      return response.units;
    }
    if (response?.content && Array.isArray(response.content)) {
      return response.content;
    }
    return [];
  }

  private handlePropertiesError(error: unknown): Observable<any[]> {
    if (this.shouldFallback(error)) {
      this.logFallback('properties list', error);
      return of(this.cloneProperties(this.fallbackProperties));
    }
    return throwError(() => this.normalizeError(error));
  }

  private handleUnitsError(propertyId: string, error: unknown): Observable<any[]> {
    if (this.shouldFallback(error)) {
      this.logFallback(`units for property ${propertyId}`, error);
      const property = this.fallbackProperties.find(item => item.id === propertyId);
      return of(this.cloneUnits(property?.units ?? []));
    }
    return throwError(() => this.normalizeError(error));
  }

  private normalizeError(error: unknown): any {
    if (error instanceof HttpErrorResponse) {
      return {
        status: error.status,
        message: error.error?.message || error.message || 'Service temporarily unavailable',
        error: error.error
      };
    }
    if (typeof error === 'object' && error !== null && 'message' in (error as Record<string, any>)) {
      return error;
    }
    return { status: 500, message: 'Service temporarily unavailable', error };
  }

  private shouldFallback(error: unknown): boolean {
    if (!error) {
      return true;
    }

    if (error instanceof HttpErrorResponse) {
      return error.status === 0 || error.status >= 500 || error.status === 404 || error.status === 401;
    }

    const status = (error as any)?.status;
    if (typeof status === 'number') {
      return status === 0 || status >= 500 || status === 404 || status === 401;
    }

    return true;
  }

  private cloneProperties(properties: any[]): any[] {
    return properties.map(property => ({
      ...property,
      units: this.cloneUnits(property.units ?? [])
    }));
  }

  private cloneUnits(units: any[]): any[] {
    return units.map(unit => ({ ...unit }));
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[PropertyService] Falling back for ${context}:`, error);
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

    if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  };

  // ============================================================================
  // DEFAULT MOVE-OUT NOTICE DATA
  // ============================================================================

  private getDefaultLandlordMoveOutNotices(): LandlordMoveOutNoticeResponse {
    return {
      success: true,
      data: [],
      message: 'Using mock data',
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  private getDefaultTenantMoveOutNotices(): TenantMoveOutNoticeResponse {
    return {
      success: true,
      data: [],
      message: 'Using mock data',
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  private getDefaultMoveOutStats(): MoveOutStats {
    return {
      totalNotices: 0,
      pendingNotices: 0,
      approvedNotices: 0,
      rejectedNotices: 0,
      cancelledNotices: 0,
      upcomingMoveOuts: 0,
      averageProcessingTime: 0,
      monthlyTrend: [],
      reasonBreakdown: []
    };
  }
}