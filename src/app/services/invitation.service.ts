import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    
    if (!token) {
      throw new Error('Authentication required - please login again');
    }
    
    const cleanToken = token.replace(/['"]/g, '').trim();
    
    const headersConfig: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanToken}`
    };
    
    return new HttpHeaders(headersConfig);
  }

  private createAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      const cleanToken = token.replace(/['"]/g, '').trim();
      headers = headers.set('Authorization', `Bearer ${cleanToken}`);
    }

    return headers;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Service temporarily unavailable';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed. Your session may have expired. Please login again.';
      this.authService.logoutSync();
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

  inviteTenant(inviteData: any): Observable<any> {
    const token = this.authService.getToken();
    
    if (!token) {
      return throwError(() => ({
        status: 401,
        message: 'Authentication required',
        error: null
      }));
    }
    
    return this.http.post<any>(
      `${this.apiUrl}/landlord/invite-tenant`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
  }

  acceptInvitation(token: string): Observable<any> {
    const authToken = this.authService.getToken();
    
    const headers = this.createAuthHeaders();

    const requestBody = {
      invitationToken: token
    };

    return this.http.post<any>(
      `${this.apiUrl}/accept-invitation`,
      requestBody,
      { 
        headers: headers,
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
  }

  inviteCaretaker(inviteData: any): Observable<any> {
    const token = this.authService.getToken();
    
    if (!token) {
      return throwError(() => ({
        status: 401,
        message: 'Authentication required',
        error: null
      }));
    }
    
    return this.http.post<any>(
      `${this.apiUrl}/landlord/invite-caretaker`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
  }

  getSentInvitations(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/sent`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getPendingInvitations(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/pending`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getReceivedInvitations(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/received`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  cancelInvitation(invitationId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/invitations/${invitationId}`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  resendInvitation(invitationId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/invitations/${invitationId}/resend`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getInvitationById(invitationId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/${invitationId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getInvitationsByProperty(propertyId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/property/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getInvitationsByStatus(status: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/status/${status}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getInvitationDetails(token: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/invitations/details/${token}`,
      { headers: this.createAuthHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  validateInvitation(token: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/invitations/validate`,
      { invitationToken: token },
      { headers: this.createAuthHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }
}