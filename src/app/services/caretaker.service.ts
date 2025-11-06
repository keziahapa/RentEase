// caretaker.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { 
  Property, 
  Unit, 
  MoveOutNotice, 
  DashboardStats, 
  CreateUnitRequest,
  ApiResponse 
} from '../services/caretaker-interfaces'

@Injectable({
  providedIn: 'root'
})
export class CaretakerService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const headersConfig: any = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headersConfig['Authorization'] = `Bearer ${token}`;
    }
    
    return new HttpHeaders(headersConfig);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Service temporarily unavailable';
    
    if (error.status === 401) {
      errorMessage = 'Please check your authentication';
    } else if (error.status === 404) {
      errorMessage = 'Feature not available yet';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    console.warn('Caretaker service error handled:', errorMessage);
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  // ===== PROPERTY METHODS =====
  getProperties(): Observable<Property[]> {
    return this.http.get<ApiResponse<Property[]>>(`${this.apiUrl}/caretaker/properties`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getPropertyDetails(propertyId: number): Observable<Property> {
    return this.http.get<ApiResponse<Property>>(`${this.apiUrl}/caretaker/properties/${propertyId}`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ===== UNIT METHODS =====
  getPropertyUnits(propertyId: number): Observable<Unit[]> {
    return this.http.get<ApiResponse<Unit[]>>(`${this.apiUrl}/caretaker/properties/${propertyId}/units`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getAllUnits(): Observable<Unit[]> {
    return this.http.get<ApiResponse<Unit[]>>(`${this.apiUrl}/caretaker/units`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createUnit(propertyId: number, unit: CreateUnitRequest): Observable<Unit> {
    return this.http.post<ApiResponse<Unit>>(`${this.apiUrl}/caretaker/properties/${propertyId}/units`, unit, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateUnit(unitId: number, unit: Partial<Unit>): Observable<Unit> {
    return this.http.put<ApiResponse<Unit>>(`${this.apiUrl}/caretaker/units/${unitId}`, unit, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  deleteUnit(unitId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/caretaker/units/${unitId}`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== TENANT METHODS =====
  inviteTenant(tenantEmail: string, unitId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/caretaker/invite-tenant`, { 
      tenantEmail, 
      unitId 
    }, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response),
      catchError(this.handleError)
    );
  }

  // ===== MOVE-OUT NOTICE METHODS =====
  getMoveOutNotices(page: number = 1, limit: number = 10, status?: string): Observable<MoveOutNotice[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ApiResponse<MoveOutNotice[]>>(`${this.apiUrl}/caretaker/move-out-notices`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getPendingMoveOutNotices(page: number = 1, limit: number = 10): Observable<MoveOutNotice[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<MoveOutNotice[]>>(`${this.apiUrl}/caretaker/move-out-notices/pending`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getMovedOutNotices(page: number = 1, limit: number = 10): Observable<MoveOutNotice[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<MoveOutNotice[]>>(`${this.apiUrl}/caretaker/move-out-notices/moved`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getMoveOutNoticeById(noticeId: number): Observable<MoveOutNotice> {
    return this.http.get<ApiResponse<MoveOutNotice>>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ===== MOVE-OUT ACTIONS =====
  approveMoveOutNotice(noticeId: number, notes?: string): Observable<any> {
    const requestBody: any = {};
    if (notes) {
      requestBody.notes = notes;
    }

    return this.http.post<any>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}/approve`, requestBody, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response),
      catchError(this.handleError)
    );
  }

  rejectMoveOutNotice(noticeId: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}/reject`, {
      reason
    }, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response),
      catchError(this.handleError)
    );
  }

  scheduleInspection(noticeId: number, inspectionDate: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}/schedule-inspection`, {
      inspectionDate
    }, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response),
      catchError(this.handleError)
    );
  }

  processDeposit(noticeId: number, depositStatus: string, refundAmount?: number, deductionReason?: string): Observable<any> {
    const requestBody: any = { depositStatus };
    
    if (refundAmount !== undefined) {
      requestBody.refundAmount = refundAmount;
    }
    
    if (deductionReason) {
      requestBody.deductionReason = deductionReason;
    }

    return this.http.post<any>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}/process-deposit`, requestBody, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response),
      catchError(this.handleError)
    );
  }

  // ===== DASHBOARD & STATS =====
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.apiUrl}/caretaker/dashboard/stats`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getMoveOutStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices/stats`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ===== MAINTENANCE METHODS =====
  getMaintenanceRequests(propertyId?: number, status?: string): Observable<any[]> {
    let params = new HttpParams();
    
    if (propertyId) {
      params = params.set('propertyId', propertyId.toString());
    }
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/caretaker/maintenance-requests`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  updateMaintenanceRequest(requestId: number, updates: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/caretaker/maintenance-requests/${requestId}`, updates, {
      headers: this.createHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ===== UTILITY METHODS =====
  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, {
      headers: this.createHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCurrentUserId(): number {
  const currentUser = this.authService.getCurrentUser();
  // FIX: Ensure we're working with a string before parsing
  const userId = currentUser?.id?.toString();
  return userId ? parseInt(userId, 10) : 0;
}

  // Helper method to get current user role
  getCurrentUserRole(): string {
    try {
      const currentUser = this.authService.getCurrentUser();
      return currentUser?.role || '';
    } catch (error) {
      console.error('Error getting current user role:', error);
      return '';
    }
  }

  // Helper method to format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  }

  // Helper method to format date
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}