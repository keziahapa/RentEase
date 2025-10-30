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
  AcceptInvitationResponse
} from '../services/invitation-interfaces';

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
      console.error('❌ User might be logged out or token storage is corrupted');
      throw new Error('Authentication required - please login again');
    }
    
    const headersConfig: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    console.log('🔐 Headers created with Authorization bearer token');
    return new HttpHeaders(headersConfig);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Service temporarily unavailable';
    
    if (error.status === 401) {
      errorMessage = 'Authentication failed. Your session may have expired. Please login again.';
      console.error('❌ 401 Unauthorized - Token might be invalid or expired');
      console.error('❌ Error details:', error);
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

  inviteTenant(inviteData: InviteTenantRequest): Observable<InvitationResponse> {
    const token = this.authService.getToken();
    console.log('🔐 Sending tenant invitation with token:', !!token);
    console.log('📤 Invite data:', inviteData);
    
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
    console.log('📤 Invite data:', inviteData);
    
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

  acceptInvitation(token: string): Observable<AcceptInvitationResponse> {
    return this.http.post<AcceptInvitationResponse>(
      `${this.apiUrl}/accept-invitation`,
      { token: token },
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
  }

  getSentInvitations(): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/sent`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }

  getReceivedInvitations(): Observable<InvitationListResponse> {
    return this.http.get<InvitationListResponse>(
      `${this.apiUrl}/invitations/received`,
      { headers: this.createHeaders(), responseType: 'json' }
    ).pipe(catchError(this.handleError));
  }
}