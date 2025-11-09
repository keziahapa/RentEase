import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PaymentStatus } from './mpesa.interface';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private paymentStatusSubject = new BehaviorSubject<PaymentStatus | null>(null);
  public paymentStatus$ = this.paymentStatusSubject.asObservable();

  private pollingIntervals: { [key: string]: any } = {};

  updatePaymentStatus(status: PaymentStatus): void {
    this.paymentStatusSubject.next(status);
  }

  resetPaymentStatus(): void {
    this.paymentStatusSubject.next(null);
  }

  formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[\s\-\+]/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }

  isValidKenyanPhone(phone: string): boolean {
    const cleaned = this.formatPhoneNumber(phone);
    return /^254[17][0-9]{8}$/.test(cleaned);
  }

  // Polling management
  startPolling(checkoutRequestID: string, callback: (status: any) => void): void {
    // Clear existing polling for this request
    this.stopPolling(checkoutRequestID);

    // Start new polling
    this.pollingIntervals[checkoutRequestID] = setInterval(() => {
      callback(checkoutRequestID);
    }, 3000); // Poll every 3 seconds

    // Auto-stop after 10 minutes
    setTimeout(() => {
      this.stopPolling(checkoutRequestID);
    }, 600000);
  }

  stopPolling(checkoutRequestID: string): void {
    if (this.pollingIntervals[checkoutRequestID]) {
      clearInterval(this.pollingIntervals[checkoutRequestID]);
      delete this.pollingIntervals[checkoutRequestID];
    }
  }

  stopAllPolling(): void {
    Object.keys(this.pollingIntervals).forEach(key => {
      clearInterval(this.pollingIntervals[key]);
      delete this.pollingIntervals[key];
    });
  }
}