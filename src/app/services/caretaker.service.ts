import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CaretakerService {
  private readonly apiUrl = 'https://rentease-4.onrender.com/api';

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
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  getCaretakerProperties(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/properties`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
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
      }),
      catchError(error => {
        return of([]);
      })
    );
  }

  getCaretakerDashboardData(): Observable<any> {
    return this.getProperties().pipe(
      map(properties => {
        const totalProperties = properties.length;
        const totalUnits = properties.reduce((sum, property) => sum + (property.totalUnits || 0), 0);
        const occupiedUnits = properties.reduce((sum, property) => sum + (property.occupiedUnits || 0), 0);
        const vacantUnits = totalUnits - occupiedUnits;
        
        return {
          hasProperties: totalProperties > 0,
          totalProperties,
          totalUnits,
          occupiedUnits,
          vacantUnits,
          occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
          properties: properties
        };
      }),
      catchError(error => {
        return of({
          hasProperties: false,
          totalProperties: 0,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          occupancyRate: 0,
          properties: []
        });
      })
    );
  }

  getProperties(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/properties`, {
      headers: this.createHeaders()
    }).pipe(
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
        }
        
        return propertiesArray;
      }),
      catchError(this.handleError)
    );
  }

  getPropertyDetails(propertyId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/properties/${propertyId}`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        if (response?.property) return response.property;
        return response;
      }),
      catchError(this.handleError)
    );
  }

  getPropertyUnits(propertyId: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/properties/${propertyId}/units`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        let unitsArray: any[] = [];
        
        if (Array.isArray(response)) {
          unitsArray = response;
        } else if (response?.data && Array.isArray(response.data)) {
          unitsArray = response.data;
        } else if (response?.units && Array.isArray(response.units)) {
          unitsArray = response.units;
        } else if (response?.content && Array.isArray(response.content)) {
          unitsArray = response.content;
        }
        
        return unitsArray;
      }),
      catchError(error => {
        return this.handleError(error);
      })
    );
  }

  getAllUnits(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/units`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        let unitsArray: any[] = [];
        
        if (Array.isArray(response)) {
          unitsArray = response;
        } else if (response?.data && Array.isArray(response.data)) {
          unitsArray = response.data;
        } else if (response?.units && Array.isArray(response.units)) {
          unitsArray = response.units;
        }
        
        return unitsArray;
      }),
      catchError(this.handleError)
    );
  }

  createUnit(propertyId: number, unit: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/caretaker/properties/${propertyId}/units`, unit, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        if (response?.unit) return response.unit;
        return response;
      }),
      catchError(this.handleError)
    );
  }

  updateUnit(unitId: number, unit: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/caretaker/units/${unitId}`, unit, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        if (response?.unit) return response.unit;
        return response;
      }),
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

  getMoveOutNotices(page: number = 1, limit: number = 10, status?: string): Observable<any[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      }),
      catchError(this.handleError)
    );
  }

  getPendingMoveOutNotices(page: number = 1, limit: number = 10): Observable<any[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices/pending`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      }),
      catchError(this.handleError)
    );
  }

  getMovedOutNotices(page: number = 1, limit: number = 10): Observable<any[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices/moved`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      }),
      catchError(this.handleError)
    );
  }

  getMoveOutNoticeById(noticeId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices/${noticeId}`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        return response;
      }),
      catchError(this.handleError)
    );
  }

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

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/dashboard/stats`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        return response;
      }),
      catchError(this.handleError)
    );
  }

  getMoveOutStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/caretaker/move-out-notices/stats`, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        return response;
      }),
      catchError(this.handleError)
    );
  }

  getMaintenanceRequests(propertyId?: number, status?: string): Observable<any[]> {
    let params = new HttpParams();
    
    if (propertyId) {
      params = params.set('propertyId', propertyId.toString());
    }
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/caretaker/maintenance-requests`, {
      headers: this.createHeaders(),
      params
    }).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      }),
      catchError(this.handleError)
    );
  }

  updateMaintenanceRequest(requestId: number, updates: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/caretaker/maintenance-requests/${requestId}`, updates, {
      headers: this.createHeaders()
    }).pipe(
      map(response => {
        if (response?.data) return response.data;
        return response;
      }),
      catchError(this.handleError)
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, {
      headers: this.createHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCurrentUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser?.id?.toString();
    return userId ? parseInt(userId, 10) : 0;
  }

  getCurrentUserRole(): string {
    try {
      const currentUser = this.authService.getCurrentUser();
      return currentUser?.role || '';
    } catch (error) {
      console.error('Error getting current user role:', error);
      return '';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}