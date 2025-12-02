import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ProfilePictureService } from './profile-picture.service';
import { 
  LandlordMoveOutNoticeResponse, 
  MoveOutActionRequest,
  DashboardResponse,
  StatsResponse,
  MoveOutStats 
} from './dashboard-interface';

@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private profileService = inject(ProfilePictureService);
  
  private readonly apiUrl = 'https://rentease-4.onrender.com';

  // PROFILE METHODS
  getCurrentUserProfile(): Observable<any> {
    return this.profileService.getCurrentUserProfile();
  }

  updateUserProfile(profileData: any): Observable<any> {
    return this.profileService.updateProfilePartial(profileData);
  }

  getProfilePicture(): Observable<any> {
    return this.profileService.getProfilePicture();
  }

  uploadProfilePicture(file: File): Observable<any> {
    return this.profileService.uploadProfilePicture(file);
  }

  updateProfilePicture(file: File): Observable<any> {
    return this.profileService.updateProfilePicture(file);
  }

  deleteProfilePicture(): Observable<any> {
    return this.profileService.deleteProfilePicture();
  }

  // ✅ FIXED TENANT METHODS - Better error handling and logging
  getTenantUnits(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    console.log('🔍 PropertyService: Fetching tenant units from:', `${this.apiUrl}/api/tenant/units`);

    return this.http.get<any>(
      `${this.apiUrl}/api/tenant/units`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        console.log('✅ PropertyService: Tenant units response:', response);
      }),
      map(response => this.normalizeTenantUnitsResponse(response)),
      catchError(error => {
        console.error('❌ PropertyService: Error fetching tenant units:', error);
        return this.handleTenantError(error);
      })
    );
  }

  getTenantDashboardData(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/tenant/dashboard`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      catchError(error => this.handleTenantError(error))
    );
  }

  // PROPERTY METHODS
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
    console.log('🔍 PropertyService: Fetching landlord properties');
    
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties`, 
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        console.log('✅ PropertyService: Landlord properties response:', response);
      }),
      map(response => this.normalizePropertiesResponse(response)),
      catchError(error => {
        console.error('❌ PropertyService: Error fetching properties:', error);
        return this.handlePropertiesError(error);
      })
    );
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

  // ✅ FIXED UNIT METHODS - Better response handling
  getUnitsByPropertyId(propertyId: string): Observable<any[]> {
    console.log('🔍 PropertyService: Fetching units for property:', propertyId);
    
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => {
        console.log('✅ PropertyService: Units response for property', propertyId, ':', response);
      }),
      map(response => this.normalizeUnitsResponse(response)),
      catchError(error => {
        console.error('❌ PropertyService: Error fetching units for property', propertyId, ':', error);
        return this.handleUnitsError(error);
      })
    );
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

  // DASHBOARD METHODS
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

  // MOVE OUT NOTICES - LANDLORD
  getLandlordMoveOutNotices(page: number = 1, pageSize: number = 10, status?: string): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', pageSize.toString());

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
      catchError(error => this.handleMoveOutError(error))
    );
  }

  approveMoveOutNotice(noticeId: number): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.post<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}/approve`,
      null,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  rejectMoveOutNotice(noticeId: number, reason: string): Observable<LandlordMoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    const params = new HttpParams().set('reason', reason);

    return this.http.post<LandlordMoveOutNoticeResponse>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}/reject`,
      null,
      { 
        headers: this.createHeaders(),
        params
      }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  getLandlordMoveOutNoticeById(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  getMoveOutStats(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/move-out-notices/stats`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  // MOVE OUT NOTICES - TENANT
  getTenantMoveOutNotices(page: number = 1, limit: number = 10): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(
      `${this.apiUrl}/api/tenant/move-out-notices`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  submitMoveOutNotice(request: any): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.post<any>(
      `${this.apiUrl}/api/tenant/move-out-notices`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  cancelMoveOutNotice(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.post<any>(
      `${this.apiUrl}/api/tenant/move-out-notices/${noticeId}/cancel`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  getTenantMoveOutNoticeById(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/tenant/move-out-notices/${noticeId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  // ✅ IMPROVED NORMALIZATION METHODS
  private normalizePropertiesResponse(response: any): any[] {
    console.log('📋 Normalizing properties response:', response);
    
    if (Array.isArray(response)) {
      console.log(`✅ Direct array: ${response.length} properties`);
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      console.log(`✅ response.data: ${response.data.length} properties`);
      return response.data;
    }
    if (response?.properties && Array.isArray(response.properties)) {
      console.log(`✅ response.properties: ${response.properties.length} properties`);
      return response.properties;
    }
    if (response?.content && Array.isArray(response.content)) {
      console.log(`✅ response.content: ${response.content.length} properties`);
      return response.content;
    }
    if (response?.success && Array.isArray(response.data)) {
      console.log(`✅ response.success + data: ${response.data.length} properties`);
      return response.data;
    }
    
    console.warn('⚠️ Could not find properties array in response, returning empty array');
    return [];
  }

  private normalizeUnitsResponse(response: any): any[] {
    console.log('📋 Normalizing units response:', response);
    
    if (Array.isArray(response)) {
      console.log(`✅ Direct array: ${response.length} units`);
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      console.log(`✅ response.data: ${response.data.length} units`);
      return response.data;
    }
    if (response?.units && Array.isArray(response.units)) {
      console.log(`✅ response.units: ${response.units.length} units`);
      return response.units;
    }
    if (response?.content && Array.isArray(response.content)) {
      console.log(`✅ response.content: ${response.content.length} units`);
      return response.content;
    }
    if (response?.success && Array.isArray(response.data)) {
      console.log(`✅ response.success + data: ${response.data.length} units`);
      return response.data;
    }
    
    console.warn('⚠️ Could not find units array in response, returning empty array');
    return [];
  }

  private normalizeTenantUnitsResponse(response: any): any[] {
    console.log('📋 Normalizing tenant units response:', response);
    
    if (Array.isArray(response)) {
      console.log(`✅ Direct array: ${response.length} tenant units`);
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      console.log(`✅ response.data: ${response.data.length} tenant units`);
      return response.data;
    }
    if (response?.units && Array.isArray(response.units)) {
      console.log(`✅ response.units: ${response.units.length} tenant units`);
      return response.units;
    }
    if (response?.content && Array.isArray(response.content)) {
      console.log(`✅ response.content: ${response.content.length} tenant units`);
      return response.content;
    }
    if (response?.success && Array.isArray(response.data)) {
      console.log(`✅ response.success + data: ${response.data.length} tenant units`);
      return response.data;
    }
    
    console.warn('⚠️ Could not find tenant units array in response, returning empty array');
    return [];
  }

  private handlePropertiesError(error: unknown): Observable<never> {
    return throwError(() => this.normalizeError(error));
  }

  private handleUnitsError(error: unknown): Observable<never> {
    return throwError(() => this.normalizeError(error));
  }

  private handleTenantError(error: unknown): Observable<never> {
    return throwError(() => this.normalizeError(error));
  }

  private handleMoveOutError(error: any): Observable<never> {
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
}