// invitation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  InviteTenantRequest,
  InviteCaretakerRequest,
  InvitationResponse,
  InvitationListResponse,
  AcceptInvitationResponse,
  InvitationDetails,
  AcceptInvitationRequest
} from './invitation-interfaces';

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private apiUrl = 'https://rentease-3-sfgx.onrender.com/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    console.log('🔐 InvitationService.createHeaders() called, token exists:', !!token);
    
    if (!token) {
      console.error('❌ No authentication token found in InvitationService!');
      throw new Error('Authentication required - please login again');
    }
    
    const headersConfig: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    return new HttpHeaders(headersConfig);
  }

  private createAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Service temporarily unavailable';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed. Your session may have expired. Please login again.';
    } else if (error.status === 404) {
      errorMessage = 'Feature not available yet';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    console.warn('Service error handled gracefully:', errorMessage);
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  // Accept invitation with token string parameter
  acceptInvitation(token: string): Observable<AcceptInvitationResponse> {
    const authToken = this.authService.getToken();
    console.log('🔐 Accepting invitation with invitationToken:', token);
    console.log('🔐 User authenticated:', !!authToken);
    
    const headers = this.createAuthHeaders();

    // Create the request body with invitationToken
    const requestBody: AcceptInvitationRequest = {
      invitationToken: token
    };

    return this.http.post<AcceptInvitationResponse>(
      `${this.apiUrl}/accept-invitation`,
      requestBody,
      { 
        headers: headers,
        responseType: 'json'
      }
    ).pipe(
      tap(response => console.log('✅ Invitation acceptance response:', response)),
      catchError(this.handleError)
    );
  }

  // Get invitation details by token
  getInvitationDetails(token: string): Observable<InvitationResponse> {
    return this.http.get<InvitationResponse>(
      `${this.apiUrl}/invitations/details/${token}`,
      { headers: this.createAuthHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => console.log('📧 Invitation details:', response)),
      catchError(this.handleError)
    );
  }

  // Validate invitation token
  validateInvitation(token: string): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/invitations/validate`,
      { invitationToken: token },
      { headers: this.createAuthHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  inviteTenant(inviteData: InviteTenantRequest): Observable<InvitationResponse> {
    const token = this.authService.getToken();
    console.log('🔐 Sending tenant invitation with token:', !!token);
    
    if (!token) {
      console.error('❌ Cannot send tenant invitation - no authentication token');
      return throwError(() => ({
        status: 401,
        message: 'Authentication required',
        error: null
      }));
    }
    
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/landlord/invite-tenant`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(
      tap(response => console.log('✅ Tenant invitation successful:', response)),
      catchError(this.handleError)
    );
  }

  inviteCaretaker(inviteData: InviteCaretakerRequest): Observable<InvitationResponse> {
    const token = this.authService.getToken();
    console.log('🔐 Sending caretaker invitation with token:', !!token);
    
    if (!token) {
      console.error('❌ Cannot send caretaker invitation - no authentication token');
      return throwError(() => ({
        status: 401,
        message: 'Authentication required',
        error: null
      }));
    }
    
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/landlord/invite-caretaker`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(
      tap(response => console.log('✅ Caretaker invitation successful:', response)),
      catchError(this.handleError)
    );
  }

  getSentInvitations(): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/sent`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => console.log('📨 Sent invitations response:', response)),
      catchError(this.handleError)
    );
  }

  getPendingInvitations(): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/pending`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => console.log('⏳ Pending invitations:', response)),
      catchError(this.handleError)
    );
  }

  getReceivedInvitations(): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/received`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(
      tap(response => console.log('📩 Received invitations:', response)),
      catchError(this.handleError)
    );
  }

  cancelInvitation(invitationId: string): Observable<InvitationResponse> {
    return this.http.delete<InvitationResponse>(
      `${this.apiUrl}/invitations/${invitationId}`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Invitation cancelled:', response)),
      catchError(this.handleError)
    );
  }

  resendInvitation(invitationId: string): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/invitations/${invitationId}/resend`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => console.log('✅ Invitation resent:', response)),
      catchError(this.handleError)
    );
  }

  // Get specific invitation by ID
  getInvitationById(invitationId: string): Observable<InvitationResponse> {
    return this.http.get<InvitationResponse>(
      `${this.apiUrl}/invitations/${invitationId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  // Get invitations by property
  getInvitationsByProperty(propertyId: string): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/property/${propertyId}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  // Get invitations by status
  getInvitationsByStatus(status: string): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/status/${status}`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }
}