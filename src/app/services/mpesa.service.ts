import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  STKPushRequest, 
  STKPushResponse, 
  STKCallback, 
  ValidationRequest,
  AcknowledgeResponse
} from './mpesa.interface';

@Injectable({
  providedIn: 'root'
})
export class MpesaService {
  private http = inject(HttpClient);
  private apiUrl = 'https://rentease-4.onrender.com/api/open/mobile-money';

  // Initiate STK Push
  initiateSTKPush(request: STKPushRequest): Observable<STKPushResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('💰 STK Push Request:', request);
    return this.http.post<STKPushResponse>(`${this.apiUrl}/stk-push`, request, { headers });
  }

  // Handle STK Callback
  handleSTKCallback(callback: STKCallback): Observable<AcknowledgeResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('📩 STK Callback:', callback);
    return this.http.post<AcknowledgeResponse>(`${this.apiUrl}/stk-push/callback`, callback, { headers });
  }

  // Check the transaction status
  checkTransactionStatus(checkoutRequestID: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('🔍 Checking status for:', checkoutRequestID);
    return this.http.get<any>(`${this.apiUrl}/transaction-status/${checkoutRequestID}`, { headers });
  }

  // Validate transaction
  validateTransaction(validation: ValidationRequest): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('✅ Validation Request:', validation);
    return this.http.post<any>(`${this.apiUrl}/validation`, validation, { headers });
  }

  // Confirm transaction
  confirmTransaction(confirmation: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('✅ Confirmation Request:', confirmation);
    return this.http.post<any>(`${this.apiUrl}/confirmation`, confirmation, { headers });
  }
}
