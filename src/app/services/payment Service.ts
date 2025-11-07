// services/payment.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PaymentStatus } from '../services/mpesa.interface';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private paymentStatusSubject = new BehaviorSubject<PaymentStatus | null>(null);
  public paymentStatus$ = this.paymentStatusSubject.asObservable();

  constructor() {}

  updatePaymentStatus(status: PaymentStatus): void {
    this.paymentStatusSubject.next(status);
  }

  getCurrentPaymentStatus(): PaymentStatus | null {
    return this.paymentStatusSubject.value;
  }

  resetPaymentStatus(): void {
    this.paymentStatusSubject.next(null);
  }

  // Utility function to format phone number
  formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  }

  // Validate phone number
  validatePhoneNumber(phoneNumber: string): boolean {
    const kenyanPhoneRegex = /^(?:254|\+254|0)?(7[0-9]{8})$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }
}