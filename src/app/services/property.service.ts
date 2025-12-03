import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ProfilePictureService } from './profile-picture.service';

@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private profileService = inject(ProfilePictureService);
  
  private readonly apiUrl = 'https://rentease-4.onrender.com';

  getPropertyByName(propertyName: string): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => {
        let propertiesArray: any[] = [];
        
        if (Array.isArray(response)) {
          propertiesArray = response;
        } else if (response?.data && Array.isArray(response.data)) {
          propertiesArray = response.data;
        } else if (response?.properties && Array.isArray(response.properties)) {
          propertiesArray = response.properties;
        } else if (response?.content && Array.isArray(response.content)) {
          propertiesArray = response.content;
        } else if (response?.success && Array.isArray(response.data)) {
          propertiesArray = response.data;
        }

        const foundProperty = propertiesArray.find(property => 
          property.name?.toLowerCase() === propertyName?.toLowerCase() ||
          property.propertyName?.toLowerCase() === propertyName?.toLowerCase() ||
          property.title?.toLowerCase() === propertyName?.toLowerCase()
        );

        if (foundProperty) {
          return {
            success: true,
            message: 'Property found',
            data: foundProperty
          };
        }

        return {
          success: false,
          message: `Property "${propertyName}" not found`,
          data: null
        };
      }),
      catchError(error => {
        return of({
          success: false,
          message: 'Error searching for property',
          data: null
        });
      })
    );
  }

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

  getTenantUnits(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.get<any>(
      `${this.apiUrl}/api/tenant/units`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => this.normalizeTenantUnitsResponse(response)),
      catchError(error => {
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
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties`, 
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => this.normalizePropertiesResponse(response)),
      catchError(error => {
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

  getUnitsByPropertyId(propertyId: string): Observable<any[]> {
    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/properties/${propertyId}/units`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      map(response => this.normalizeUnitsResponse(response)),
      catchError(error => {
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

  getLandlordMoveOutNotices(page: number = 1, pageSize: number = 10, status?: string): Observable<any> {
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

    return this.http.get<any>(
      `${this.apiUrl}/api/landlord/move-out-notices`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  approveMoveOutNotice(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    return this.http.post<any>(
      `${this.apiUrl}/api/landlord/move-out-notices/${noticeId}/approve`,
      null,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => this.handleMoveOutError(error))
    );
  }

  rejectMoveOutNotice(noticeId: number, reason: string): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    const params = new HttpParams().set('reason', reason);

    return this.http.post<any>(
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
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
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
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  private normalizeTenantUnitsResponse(response: any): any[] {
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
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
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