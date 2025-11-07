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
  private apiUrl = 'https://rentease-3-sfgx.onrender.com/api/open/mobile-money';

  initiateSTKPush(request: STKPushRequest): Observable<STKPushResponse> {
    return this.http.post<STKPushResponse>(
      `${this.apiUrl}/stk-push`,
      request,
      { headers: this.createHeaders() }
    );
  }

  handleSTKCallback(callback: STKCallback): Observable<AcknowledgeResponse> {
    return this.http.post<AcknowledgeResponse>(
      `${this.apiUrl}/stk-push/callback`,
      callback,
      { headers: this.createHeaders() }
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

  checkTransactionStatus(checkoutRequestID: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/transaction-status/${checkoutRequestID}`,
      { headers: this.createHeaders() }
    );
  }

  private createHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }
}
