import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  FinancialService,
  TenantPaymentRecord,
  TenantScheduledPayment,
  TenantPaymentSummary,
  TenantPaymentPayload,
  TenantPaymentSchedulePayload
} from '../../../../services/financial.service';
import { Subscription } from 'rxjs';

interface Payment {
  id: string;
  date: Date;
  type: string;
  amount: number;
  method: string;
  methodDetails?: string;
  status: 'paid' | 'pending' | 'failed' | 'processing';
  reference: string;
  lateFee?: number;
  description?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  details?: string;
  enabled: boolean;
}

interface PaymentSort {
  field: 'date' | 'amount' | 'status';
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private financialService = inject(FinancialService);
  private subscriptions = new Subscription();

  // Payment Summary Data
  nextPaymentAmount: number = 50000;
  nextPaymentDate: string = 'March 1, 2024';
  totalPaidThisYear: number = 600000;
  paymentsThisYear: number = 12;
  paymentStreak: number = 18;
  averagePaymentDays: number = 3;

  // Quick Payment
  paymentAmount: number = 0;
  rentAmount: number = 50000;
  selectedPaymentMethod: string = '';

  paymentMethods: PaymentMethod[] = [
    { id: 'mpesa', name: 'M-Pesa', icon: 'phone_android', details: '****7890', enabled: true },
    { id: 'bank', name: 'Bank Transfer', icon: 'account_balance', details: 'KCB Bank ****4567', enabled: true },
    { id: 'card', name: 'Credit Card', icon: 'credit_card', details: '****1234', enabled: true },
    { id: 'paypal', name: 'PayPal', icon: 'payment', details: 'john.doe@email.com', enabled: false }
  ];

  // Payment History
  paymentHistory: Payment[] = [];

  filteredPaymentHistory: Payment[] = [];
  currentPaymentPage = 1;
  itemsPerPage = 10;
  totalPayments = 0;
  totalPaymentPages = 0;
  paymentFilter: string = 'all';
  paymentSort: PaymentSort = { field: 'date', direction: 'desc' };

  // Scheduled Payments
  scheduledPayments: TenantScheduledPayment[] = [];

  // Insights
  earlyPaymentSavings = 7500;
  preferredPaymentDay = '1st';
  preferredPaymentMethod = 'M-Pesa';

  // Loading & error state
  summaryLoading = false;
  summaryError: string | null = null;

  historyLoading = false;
  historyError: string | null = null;

  scheduledLoading = false;
  scheduledError: string | null = null;

  isProcessingPayment = false;
  paymentError: string | null = null;
  paymentSuccess: string | null = null;

  ngOnInit(): void {
    this.subscribeToStreams();
    this.loadFinancialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadFinancialData(): void {
    this.summaryLoading = true;
    this.summaryError = null;
    const summaryFetch = this.financialService.getTenantPaymentSummary().subscribe({
      next: () => {
        this.summaryLoading = false;
      },
      error: (error) => {
        this.summaryLoading = false;
        this.summaryError = error?.message || 'Failed to load payment summary.';
      }
    });

    this.historyLoading = true;
    this.historyError = null;
    const historyFetch = this.financialService.getTenantPaymentHistory().subscribe({
      next: () => {
        this.historyLoading = false;
      },
      error: (error) => {
        this.historyLoading = false;
        this.historyError = error?.message || 'Failed to load payment history.';
      }
    });

    this.scheduledLoading = true;
    this.scheduledError = null;
    const scheduledFetch = this.financialService.getTenantScheduledPayments().subscribe({
      next: () => {
        this.scheduledLoading = false;
      },
      error: (error) => {
        this.scheduledLoading = false;
        this.scheduledError = error?.message || 'Failed to load scheduled payments.';
      }
    });

    this.subscriptions.add(summaryFetch);
    this.subscriptions.add(historyFetch);
    this.subscriptions.add(scheduledFetch);
  }

  private initializePaymentData(): void {
    this.totalPayments = this.paymentHistory.length;
    this.filteredPaymentHistory = [...this.paymentHistory];
    this.updatePagination();
  }

  isPaymentDue(): boolean {
    const dueDate = new Date(this.nextPaymentDate);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  }

  // Quick Payment
  setPaymentAmount(amount: number): void {
    this.paymentAmount = amount;
  }

  selectPaymentMethod(methodId: string): void {
    this.selectedPaymentMethod = methodId;
  }

  isPaymentValid(): boolean {
    return this.paymentAmount > 0 && this.selectedPaymentMethod !== '';
  }

  processPayment(): void {
    if (!this.isPaymentValid() || this.isProcessingPayment) {
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = null;
    this.paymentSuccess = null;

    const payload: TenantPaymentPayload = {
      amount: this.paymentAmount,
      method: this.selectedPaymentMethod,
      type: 'Rent Payment',
      description: `Rent payment on ${new Date().toISOString()}`
    };

    const sub = this.financialService.initiateTenantPayment(payload).subscribe({
      next: (record) => {
        this.paymentSuccess = `Payment of KSH ${this.formatNumber(record.amount)} initiated successfully.`;
        this.resetQuickPaymentForm();
      },
      error: (error) => {
        this.paymentError = error?.message || 'Failed to process payment. Please try again.';
      },
      complete: () => {
        this.isProcessingPayment = false;
      }
    });

    this.subscriptions.add(sub);
  }

  schedulePayment(): void {
    if (!this.isPaymentValid() || this.isProcessingPayment) {
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = null;
    this.paymentSuccess = null;

    const payload: TenantPaymentSchedulePayload = {
      amount: this.paymentAmount,
      method: this.selectedPaymentMethod,
      type: 'Scheduled Rent Payment',
      description: `Scheduled rent payment`,
      scheduleDate: new Date().toISOString()
    };

    const sub = this.financialService.scheduleTenantPayment(payload).subscribe({
      next: () => {
        this.paymentSuccess = `Payment of KSH ${this.formatNumber(this.paymentAmount)} scheduled successfully.`;
        this.resetQuickPaymentForm();
      },
      error: (error) => {
        this.paymentError = error?.message || 'Failed to schedule payment. Please try again.';
      },
      complete: () => {
        this.isProcessingPayment = false;
      }
    });

    this.subscriptions.add(sub);
  }

  // History
  filterPayments(): void {
    const now = new Date();
    let filtered = [...this.paymentHistory];
    if (this.paymentFilter === 'thisYear') {
      filtered = filtered.filter(p => p.date.getFullYear() === now.getFullYear());
    } else if (this.paymentFilter === 'thisMonth') {
      filtered = filtered.filter(p => p.date.getFullYear() === now.getFullYear() && p.date.getMonth() === now.getMonth());
    } else if (this.paymentFilter === 'last6Months') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      filtered = filtered.filter(p => p.date >= sixMonthsAgo);
    }
    this.filteredPaymentHistory = filtered;
    this.totalPayments = filtered.length;
    this.currentPaymentPage = 1;
    this.sortPayments(this.paymentSort.field);
    this.updatePagination();
  }

  sortPayments(field: 'date' | 'amount' | 'status'): void {
    if (this.paymentSort.field === field) {
      this.paymentSort.direction = this.paymentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.paymentSort.field = field;
      this.paymentSort.direction = 'desc';
    }
    this.filteredPaymentHistory.sort((a, b) => {
      let aValue: any = a[field];
      let bValue: any = b[field];
      if (field === 'date') {
        aValue = a.date.getTime();
        bValue = b.date.getTime();
      }
      return this.paymentSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  updatePagination(): void {
    this.totalPaymentPages = Math.ceil(this.totalPayments / this.itemsPerPage);
  }

  previousPaymentPage(): void {
    if (this.currentPaymentPage > 1) this.currentPaymentPage--;
  }

  nextPaymentPage(): void {
    if (this.currentPaymentPage < this.totalPaymentPages) this.currentPaymentPage++;
  }

  getPaymentRangeStart(): number {
    return (this.currentPaymentPage - 1) * this.itemsPerPage + 1;
  }

  getPaymentRangeEnd(): number {
    return Math.min(this.currentPaymentPage * this.itemsPerPage, this.totalPayments);
  }

  private applyPaymentSummary(summary: TenantPaymentSummary): void {
    this.nextPaymentAmount = summary.nextPaymentAmount;
    this.nextPaymentDate = summary.nextPaymentDate;
    this.totalPaidThisYear = summary.totalPaidThisYear;
    this.paymentsThisYear = summary.paymentsThisYear;
    this.paymentStreak = summary.paymentStreak;
    this.averagePaymentDays = summary.averagePaymentDays;
    this.preferredPaymentDay = summary.preferredPaymentDay;
    this.preferredPaymentMethod = summary.preferredPaymentMethod;
    this.rentAmount = summary.nextPaymentAmount;
  }

  // Utilities
  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-KE').format(value);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getRelativeDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return date < now ? 'Yesterday' : 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days ${date < now ? 'ago' : 'from now'}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ${date < now ? 'ago' : 'from now'}`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ${date < now ? 'ago' : 'from now'}`;
    return `${Math.floor(diffDays / 365)} years ${date < now ? 'ago' : 'from now'}`;
  }

  getPaymentTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'monthly rent': return 'home';
      case 'security deposit': return 'security';
      case 'utilities': return 'electric_bolt';
      case 'maintenance': return 'build';
      default: return 'payment';
    }
  }

  getPaymentMethodIcon(method: string): string {
    switch (method.toLowerCase()) {
      case 'm-pesa': return 'phone_android';
      case 'bank transfer': return 'account_balance';
      case 'credit card': return 'credit_card';
      case 'paypal': return 'payment';
      default: return 'attach_money';
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'status-success';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      case 'processing': return 'status-processing';
      default: return '';
    }
  }

  getPaymentStatusIcon(status: string): string {
    switch (status) {
      case 'paid': return 'check_circle';
      case 'pending': return 'schedule';
      case 'failed': return 'error';
      case 'processing': return 'hourglass_empty';
      default: return 'help';
    }
  }

  trackPayment(index: number, payment: Payment): string {
    return payment.id;
  }

  viewPaymentDetails(payment: Payment): void {
    this.paymentSuccess = `Payment ${payment.reference} • ${payment.status.toUpperCase()}`;
  }

  downloadReceipt(payment: Payment): void {
    this.paymentSuccess = `Receipt download started for ${payment.reference}`;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
    this.paymentSuccess = 'Reference copied to clipboard.';
  }

  downloadPaymentHistory(): void {
    // Placeholder for actual export integration
    this.paymentSuccess = 'Payment history export started.';
  }

  editScheduledPayment(payment: TenantScheduledPayment): void {
    this.paymentSuccess = `Editing scheduled payment: ${payment.description}`;
  }

  cancelScheduledPayment(payment: TenantScheduledPayment): void {
    if (confirm(`Cancel scheduled payment for ${payment.description}?`)) {
      this.scheduledPayments = this.scheduledPayments.filter(p => p.id !== payment.id);
    }
  }

  getPaymentConsistency(): number {
    if (this.paymentHistory.length === 0) {
      return 0;
    }
    const onTimePayments = this.paymentHistory.filter(p => !p.lateFee).length;
    return Math.round((onTimePayments / this.paymentHistory.length) * 100);
  }

  private subscribeToStreams(): void {
    const summarySub = this.financialService.watchPaymentSummary().subscribe(summary => {
      this.applyPaymentSummary(summary);
      this.summaryLoading = false;
    });

    const historySub = this.financialService.watchPaymentHistory().subscribe(records => {
      this.paymentHistory = records.map(record => ({
        ...record,
        date: new Date(record.date)
      }) as Payment);
      this.initializePaymentData();
      this.filterPayments();
      this.historyLoading = false;
    });

    const scheduledSub = this.financialService.watchScheduledPayments().subscribe(scheduled => {
      this.scheduledPayments = scheduled;
      this.scheduledLoading = false;
    });

    this.subscriptions.add(summarySub);
    this.subscriptions.add(historySub);
    this.subscriptions.add(scheduledSub);
  }

  private resetQuickPaymentForm(): void {
    this.paymentAmount = 0;
    this.selectedPaymentMethod = '';
  }

}
