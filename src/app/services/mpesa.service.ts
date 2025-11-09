import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  STKPushRequest, 
  STKPushResponse, 
  STKCallback, 
  ValidationRequest,
  AcknowledgeResponse,
  PaymentStatus 
} from './mpesa.interface';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class MpesaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'https://rentease-3-sfgx.onrender.com/api/open/mobile-money';

  // Initiate STK Push - requires authentication
  initiateSTKPush(request: STKPushRequest): Observable<STKPushResponse> {
    const token = this.authService.getToken();
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Include auth token if available
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    console.log('💰 STK Push Request:', {
      url: `${this.apiUrl}/stk-push`,
      headers: headers.keys(),
      hasAuth: headers.has('Authorization'),
      body: request
    });

    return this.http.post<STKPushResponse>(
      `${this.apiUrl}/stk-push`,
      request,
      { headers }
    );
  }

  // Handle STK Callback - may require different authentication
  handleSTKCallback(callback: STKCallback): Observable<AcknowledgeResponse> {
    const token = this.authService.getToken();
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<AcknowledgeResponse>(
      `${this.apiUrl}/stk-push/callback`,
      callback,
      { headers }
    );
  }

  // Check transaction status
  checkTransactionStatus(checkoutRequestID: string): Observable<any> {
    const token = this.authService.getToken();
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<any>(
      `${this.apiUrl}/transaction-status/${checkoutRequestID}`,
      { headers }
    );
  }

  validateTransaction(validation: ValidationRequest): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/validation`,
      validation,
      { headers: this.createHeaders() }
    );
  }

  confirmTransaction(confirmation: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/confirmation`,
      confirmation,
      { headers: this.createHeaders() }
    );
  }

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }
}