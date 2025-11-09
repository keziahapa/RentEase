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
    ReactiveFormsModule
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
  private currentCheckoutRequestID: string | null = null;

  constructor() {
    this.paymentForm = this.createForm();
    this.statusSubscription = this.paymentService.paymentStatus$.subscribe(
      status => {
        this.paymentStatus = status;
        console.log('💰 Payment Status Updated:', status);
      }
    );
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
    if (this.currentCheckoutRequestID) {
      this.paymentService.stopPolling(this.currentCheckoutRequestID);
    }
    this.paymentService.stopAllPolling();
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

      console.log('🚀 Initiating STK Push with:', stkPushData);

      this.mpesaService.initiateSTKPush(stkPushData).subscribe({
        next: (response) => {
          console.log('✅ STK Push Initiated:', response);
          this.isLoading = false;
          this.currentCheckoutRequestID = response.CheckoutRequestID;
          
          this.paymentService.updatePaymentStatus({
            status: 'pending',
            message: 'Payment initiated successfully! Please check your phone to complete the transaction.',
            timestamp: new Date(),
            checkoutRequestID: response.CheckoutRequestID
          });

          // Start polling for transaction status
          this.startStatusPolling(response.CheckoutRequestID);
        },
        error: (error) => {
          console.error('❌ STK Push Failed:', error);
          this.isLoading = false;
          let errorMessage = 'Failed to initiate payment. Please try again.';
          
          if (error.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (error.status === 400) {
            errorMessage = 'Invalid request. Please check your input.';
          } else if (error.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          }

          this.paymentService.updatePaymentStatus({
            status: 'failed',
            message: errorMessage,
            timestamp: new Date()
          });
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private startStatusPolling(checkoutRequestID: string): void {
    this.paymentService.startPolling(checkoutRequestID, (requestID: string) => {
      this.mpesaService.checkTransactionStatus(requestID).subscribe({
        next: (statusResponse) => {
          console.log('📊 Transaction Status Check:', statusResponse);
          
          if (statusResponse.ResultCode === '0') {
            // Payment successful
            this.paymentService.stopPolling(requestID);
            this.paymentService.updatePaymentStatus({
              status: 'success',
              message: 'Payment completed successfully!',
              timestamp: new Date(),
              transactionId: statusResponse.TransactionID,
              amount: this.paymentForm.value.amount
            });
          } else if (statusResponse.ResultCode && statusResponse.ResultCode !== '1032') {
            // Payment failed (1032 is "Request cancelled by user")
            this.paymentService.stopPolling(requestID);
            const errorMessage = this.getErrorMessage(statusResponse.ResultCode, statusResponse.ResultDesc);
            
            this.paymentService.updatePaymentStatus({
              status: 'failed',
              message: errorMessage,
              timestamp: new Date()
            });
          }
          // If ResultCode is 1032 or still processing, continue polling
        },
        error: (error) => {
          console.error('❌ Status Check Error:', error);
          // Don't stop polling on temporary errors
        }
      });
    });
  }

  private getErrorMessage(resultCode: string, resultDesc: string): string {
    const errorMap: { [key: string]: string } = {
      '1': 'Insufficient funds in your M-Pesa account.',
      '1032': 'Payment cancelled by user.',
      '1037': 'Request cancelled by user.',
      '1010': 'Transaction failed. Please try again.',
      '2001': 'Invalid phone number format.',
      '2002': 'Transaction amount is too low.',
      '2003': 'Transaction amount is too high.',
      '2004': 'Invalid account reference.',
      '2005': 'Invalid transaction description.'
    };

    return errorMap[resultCode] || `Payment failed: ${resultDesc}`;
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
    if (this.currentCheckoutRequestID) {
      this.paymentService.stopPolling(this.currentCheckoutRequestID);
    }
    this.paymentService.resetPaymentStatus();
  }

  // Helper method to check if payment is in progress
  get isPaymentInProgress(): boolean {
    return this.paymentStatus?.status === 'pending';
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