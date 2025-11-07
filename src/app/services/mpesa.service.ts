// services/mpesa.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  ValidationRequest, 
  STKPushCallback, 
  AcknowledgeResponse, 
  STKPushRequest, 
  STKPushResponse,
  PaymentStatus 
} from '../services/mpesa.interface';

@Injectable({
  providedIn: 'root'
})
export class MpesaService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/open/mobile-money';

  constructor(private http: HttpClient) { }

  // Handle validation callback from M-Pesa
  handleValidation(validationData: ValidationRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    return this.http.post(`${this.apiUrl}/validation`, validationData, { headers });
  }

  // Handle STK Push callback
  handleSTKPushCallback(callbackData: STKPushCallback): Observable<AcknowledgeResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    return this.http.post<AcknowledgeResponse>(
      `${this.apiUrl}/stk-push/callback`, 
      callbackData, 
      { headers }
    );
  }

  // Handle confirmation callback
  handleConfirmation(confirmationData: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    return this.http.post(`${this.apiUrl}/confirmation`, confirmationData, { headers });
  }

  // Initiate STK Push
  initiateSTKPush(stkPushData: STKPushRequest): Observable<STKPushResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<STKPushResponse>(
      `${this.apiUrl}/stk-push`, 
      stkPushData, 
      { headers }
    );
  }

  
  checkPaymentStatus(checkoutRequestId: string): Observable<PaymentStatus> {
    return this.http.get<PaymentStatus>(`${this.apiUrl}/payment-status/${checkoutRequestId}`);
  }
}