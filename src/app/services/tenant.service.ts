import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
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
  private readonly apiUrl = 'https://rentease-4.onrender.com/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getTenantUnits(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      console.log('No token available, returning empty units');
      return of({ success: true, data: [] });
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/units`,
      { headers: this.createHeaders() }
    ).pipe(
      map(response => {
        console.log('📊 Tenant units API response:', response);
        return response;
      }),
      catchError((error) => {
        console.error('Error fetching tenant units:', error);
        return of({ success: false, data: [] });
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
    console.log('Submitting move-out notice with data:', request);

    return this.http.post<any>(
      `${this.apiUrl}/tenant/move-out-notices`,
      request,
      {
        headers: this.createHeaders()

      }
    ).pipe(
      map(response => {
        console.log('Move-out notice submitted successfully:', response);
        return {
          success: true,
          message: 'Move-out notice submitted successfully!',
          data: response?.data || request
        };
      }),
      catchError(error => {
        console.error('Error submitting move-out notice:', error);

       
        if (error.status === 401) {
          console.warn('Token expired during submission');
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
        console.error('Error cancelling move-out notice:', error);
        
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
        console.error('Error fetching move-out notice:', error);
        
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
        console.error('Error fetching move-out notice details:', error);
        
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
        console.error('Error updating move-out notice:', error);
        
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