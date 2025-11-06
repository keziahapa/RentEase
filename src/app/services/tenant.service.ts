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
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getTenantUnits(): Observable<any> {
    const token = this.authService.getToken();
    if (!token) {
      return of(this.getMockUnitsData());
    }

    return this.http.get<any>(
      `${this.apiUrl}/tenant/units`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching tenant units:', error);
        return of(this.getMockUnitsData());
      })
    );
  }

  getTenantDashboardData(): Observable<TenantData> {
    return this.getTenantUnits().pipe(
      map(response => this.processDashboardData(response))
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
    console.log('🚀 Submitting move-out notice with data:', request);
    
    return this.http.post<any>(
      `${this.apiUrl}/tenant/move-out-notices`,
      request,
      { 
        headers: this.createHeaders()
        // 🟢 REMOVED observe: 'response' - This was causing the issue
      }
    ).pipe(
      map(response => {
        console.log('✅ Move-out notice submitted successfully:', response);
        return {
          success: true,
          message: 'Move-out notice submitted successfully!',
          data: response?.data || request // 🟢 FIXED: response is now the actual API response
        };
      }),
      catchError(error => {
        console.error('❌ Error submitting move-out notice:', error);
        
        // Handle 401 specifically
        if (error.status === 401) {
          console.warn('🔄 Token expired during submission');
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

  private processDashboardData(unitsResponse: any): TenantData {
    const units = Array.isArray(unitsResponse?.data) ? unitsResponse.data : [];
    
    if (units.length === 0) {
      return this.getDefaultTenantData();
    }

    const primaryUnit = units[0];
    const leaseEndDays = this.calculateDaysUntilDate(primaryUnit.leaseEndDate);

    return {
      currentRent: primaryUnit.rentAmount || 0,
      paymentStatus: primaryUnit.paymentStatus || 'Current',
      daysUntilDue: primaryUnit.daysUntilDue || 0,
      openMaintenance: primaryUnit.openMaintenanceRequests || 0,
      leaseEndDays: leaseEndDays,
      propertyAddress: primaryUnit.propertyAddress || '',
      landlordName: primaryUnit.landlordName || '',
      depositAmount: primaryUnit.depositAmount || 0,
      unitNumber: primaryUnit.unitNumber || '',
      propertyName: primaryUnit.propertyName || '',
      nextPaymentDate: primaryUnit.nextPaymentDate,
      pendingMoveOutNotices: 0,
      hasActiveMoveOut: false
    };
  }

  private calculateDaysUntilDate(endDate: string): number {
    if (!endDate) return 0;
    const today = new Date();
    const targetDate = new Date(endDate);
    const timeDiff = targetDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  private getMockUnitsData(): any {
    return {
      success: true,
      data: [
        {
          id: 1,
          unitNumber: 'A101',
          propertyName: 'Sunrise Apartments',
          propertyAddress: '123 Main Street, Nairobi',
          landlordName: 'John Doe',
          rentAmount: 25000,
          depositAmount: 50000,
          leaseStartDate: '2024-01-01',
          leaseEndDate: '2024-12-31',
          occupancyStatus: 'occupied',
          openMaintenanceRequests: 1,
          paymentStatus: 'Current',
          daysUntilDue: 12,
          nextPaymentDate: '2024-03-01'
        }
      ]
    };
  }

  private getMockMoveOutNotices(): MoveOutNoticeResponse {
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 10
    };
  }

  private getDefaultTenantData(): TenantData {
    return {
      currentRent: 0,
      paymentStatus: 'No Data',
      daysUntilDue: 0,
      openMaintenance: 0,
      leaseEndDays: 0,
      propertyAddress: 'No property assigned',
      landlordName: '',
      depositAmount: 0,
      unitNumber: '',
      propertyName: ''
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