
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PaymentStatus } from './mpesa.interface';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private paymentStatusSubject = new BehaviorSubject<PaymentStatus | null>(null);
  public paymentStatus$ = this.paymentStatusSubject.asObservable();

  
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
    return /^254[71][0-9]{8}$/.test(cleaned);
  }
}