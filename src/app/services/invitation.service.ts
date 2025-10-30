import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

    console.warn('Service error handled gracefully:', errorMessage);
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

 
  inviteTenant(inviteData: InviteTenantRequest): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/landlord/invite-tenant`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
  }

 
  inviteCaretaker(inviteData: InviteCaretakerRequest): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(
      `${this.apiUrl}/landlord/invite-caretaker`, 
      inviteData,
      { 
        headers: this.createHeaders(),
        responseType: 'json'
      }
    ).pipe(catchError(this.handleError));
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