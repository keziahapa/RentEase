// components/payment/payments.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MpesaService } from '../../../../services/mpesa.service';
import { PaymentService } from '../../../../services/payment.service'; 
import { STKPushRequest, PaymentStatus } from '../../../../services/mpesa.interface';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule // ✅ Add this import
  ],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private mpesaService = inject(MpesaService);
  private paymentService = inject(PaymentService);
  private fb = inject(FormBuilder);

  paymentForm: FormGroup;
  isLoading = false;
  paymentStatus: PaymentStatus | null = null;
  private statusSubscription?: Subscription;

  constructor() {
    this.paymentForm = this.createForm();
    this.statusSubscription = this.paymentService.paymentStatus$.subscribe(
      status => this.paymentStatus = status
    );
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      phoneNumber: ['', [Validators.required, Validators.pattern(/^(?:254|\+254|0)?(7[0-9]{8})$/)]],
      amount: ['', [Validators.required, Validators.min(1), Validators.max(150000)]],
      accountReference: ['', [Validators.required, Validators.minLength(3)]],
      transactionDesc: ['Payment for services']
    });
  }

  initiatePayment(): void {
    if (this.paymentForm.valid) {
      this.isLoading = true;
      
      const formData = this.paymentForm.value;
      const stkPushData: STKPushRequest = {
        phoneNumber: this.paymentService.formatPhoneNumber(formData.phoneNumber),
        amount: formData.amount,
        accountReference: formData.accountReference,
        transactionDesc: formData.transactionDesc
      };

      this.mpesaService.initiateSTKPush(stkPushData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.paymentService.updatePaymentStatus({
            status: 'pending',
            message: 'Payment initiated successfully! Please check your phone to complete the transaction.',
            timestamp: new Date()
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.paymentService.updatePaymentStatus({
            status: 'failed',
            message: 'Failed to initiate payment. Please try again.',
            timestamp: new Date()
          });
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.paymentForm.controls).forEach(key => {
      this.paymentForm.get(key)?.markAsTouched();
    });
  }

  onPhoneNumberInput(event: any): void {
    const formatted = this.paymentService.formatPhoneNumber(event.target.value);
    this.paymentForm.patchValue({ phoneNumber: formatted });
  }

  resetForm(): void {
    this.paymentForm.reset({
      transactionDesc: 'Payment for services'
    });
    this.paymentService.resetPaymentStatus();
  }

  // Form control getters
  get phoneNumber() {
    return this.paymentForm.get('phoneNumber');
  }

  get amount() {
    return this.paymentForm.get('amount');
  }

  get accountReference() {
    return this.paymentForm.get('accountReference');
  }

  get transactionDesc() {
    return this.paymentForm.get('transactionDesc');
  }
}