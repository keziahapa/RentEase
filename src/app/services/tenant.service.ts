import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { 
  TenantData, 
  MoveOutNoticeRequest, 
  MoveOutNotice, 
  MoveOutNoticeResponse,
  TenantUnit 
} from './tenant-interface';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ✅ FIXED: Properly return tenant units with detailed error handling
  getTenantUnits(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('⚠️ No authentication token - returning empty units');
      return of({ success: false, data: [], message: 'Not authenticated' });
    }

    console.log('🔍 Fetching tenant units from:', `${this.apiUrl}/tenant/units`);

    return this.http.get<any>(
      `${this.apiUrl}/tenant/units`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Tenant units API response:', response);
      }),
      map(response => {
        // Handle different response structures
        if (Array.isArray(response)) {
          console.log(`📦 Received ${response.length} units as array`);
          return { success: true, data: response };
        }
        
        if (response?.data && Array.isArray(response.data)) {
          console.log(`📦 Received ${response.data.length} units in response.data`);
          return { success: true, data: response.data };
        }
        
        if (response?.units && Array.isArray(response.units)) {
          console.log(`📦 Received ${response.units.length} units in response.units`);
          return { success: true, data: response.units };
        }

        if (response?.content && Array.isArray(response.content)) {
          console.log(`📦 Received ${response.content.length} units in response.content`);
          return { success: true, data: response.content };
        }

        // If response is an object with success flag
        if (response?.success !== undefined) {
          return response;
        }

        // Single unit object
        if (response?.id || response?.unitId) {
          console.log('📦 Received single unit object');
          return { success: true, data: [response] };
        }

        console.warn('⚠️ Unexpected response structure:', response);
        return { success: true, data: [] };
      }),
      catchError((error) => {
        console.error('❌ Error fetching tenant units:', error);
        console.error('Error details:', {
          status: error.status,
          message: error.message,
          url: error.url,
          error: error.error
        });
        
        return of({ 
          success: false, 
          data: [],
          message: error.error?.message || 'Failed to load your units',
          error: {
            status: error.status,
            statusText: error.statusText
          }
        });
      })
    );
  }

  getMoveOutNotices(page: number = 1, limit: number = 10): Observable<MoveOutNoticeResponse> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getMockMoveOutNotices());
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<MoveOutNoticeResponse>(
      `${this.apiUrl}/tenant/move-out-notices`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching move-out notices:', error);
        return of(this.getMockMoveOutNotices());
      })
    );
  }

  submitMoveOutNotice(request: MoveOutNoticeRequest): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/tenant/move-out-notices`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      map(response => {
        return {
          success: true,
          message: 'Move-out notice submitted successfully!',
          data: response?.data || request
        };
      }),
      catchError(error => {
        if (error.status === 401) {
          return of({
            success: false,
            message: 'Session expired. Please login again.',
            sessionExpired: true
          });
        }

        return of({
          success: false,
          message: error.error?.message || 'Failed to submit move-out notice',
          error: error
        });
      })
    );
  }

  cancelMoveOutNotice(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ success: true, message: 'Move-out notice cancelled successfully' });
    }

    return this.http.post<any>(
      `${this.apiUrl}/tenant/move-out-notices/${noticeId}/cancel`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        if (error.status === 401) {
          this.authService.logoutSync();
        }
        
        return of({ 
          success: false, 
          message: error.error?.message || 'Failed to cancel move-out notice' 
        });
      })
    );
  }

  getMoveOutNoticeById(noticeId: number): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of({ success: false, message: 'No authentication token' });
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/move-out-notices/${noticeId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        if (error.status === 401) {
          this.authService.logoutSync();
        }
        
        return of({ 
          success: false, 
          message: error.error?.message || 'Failed to fetch move-out notice' 
        });
      })
    );
  }

  getMoveOutNoticeDetails(noticeId: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/tenant/move-out-notices/${noticeId}/details`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        if (error.status === 401) {
          this.authService.logoutSync();
        }
        
        return of({ 
          success: false, 
          message: error.error?.message || 'Failed to fetch move-out notice details' 
        });
      })
    );
  }

  updateMoveOutNotice(noticeId: number, updates: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/tenant/move-out-notices/${noticeId}`,
      updates,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        if (error.status === 401) {
          this.authService.logoutSync();
        }
        
        return of({ 
          success: false, 
          message: error.error?.message || 'Failed to update move-out notice' 
        });
      })
    );
  }

  private getMockMoveOutNotices(): MoveOutNoticeResponse {
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 10
    };
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
}