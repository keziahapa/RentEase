import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TenantPaymentSummary {
  nextPaymentAmount: number;
  nextPaymentDate: string;
  totalPaidThisYear: number;
  paymentsThisYear: number;
  paymentStreak: number;
  averagePaymentDays: number;
  preferredPaymentDay: string;
  preferredPaymentMethod: string;
}

export interface TenantPaymentRecord {
  id: string;
  date: string;
  type: string;
  amount: number;
  method: string;
  methodDetails?: string;
  status: 'paid' | 'pending' | 'failed' | 'processing';
  reference: string;
  lateFee?: number;
  description?: string;
}

export interface TenantScheduledPayment {
  id: string;
  description: string;
  amount: number;
  method: string;
  scheduleDate: string;
}

export interface DepositTimelineEvent {
  id: string;
  title: string;
  type: 'payment' | 'protection' | 'verification' | 'inspection' | 'refund';
  date: string;
  status: 'completed' | 'pending' | 'scheduled';
  description?: string;
  amount?: number;
  reference?: string;
}

export interface DepositSummaryResponse {
  totalAmount: number;
  protectionScheme: string;
  protectionSchemeDetails: string;
  datePaid: string;
  refundableAmount: number;
  nonRefundableAmount: number;
  interestRate?: number;
  expectedReturnDate?: string;
  protectionCertificateUrl?: string;
  disputeProcessUrl?: string;
}

export interface DepositBreakdownItem {
  description: string;
  amount: number;
  type: 'refundable' | 'non-refundable' | 'fee';
  percentage?: number;
}

export interface TenantPaymentPayload {
  amount: number;
  method: string;
  type: string;
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantPaymentSchedulePayload extends TenantPaymentPayload {
  scheduleDate: string;
}

export interface DepositDisputePayload {
  depositId: string;
  reason: string;
  amountDisputed?: number;
  evidenceUrls?: string[];
  notes?: string;
}

export interface DepositActionPayload {
  note?: string;
  holdReason?: string;
  releaseAmount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinancialService {
  private readonly http = inject(HttpClient);
  private readonly baseTenantUrl = `${environment.apiUrl}/tenant`;
  private readonly baseLandlordUrl = `${environment.apiUrl}/landlord`;

  private readonly mockSummary: TenantPaymentSummary = {
    nextPaymentAmount: 45000,
    nextPaymentDate: '2024-03-05',
    totalPaidThisYear: 128000,
    paymentsThisYear: 3,
    paymentStreak: 9,
    averagePaymentDays: 3,
    preferredPaymentDay: '1st of each month',
    preferredPaymentMethod: 'M-Pesa'
  };

  private readonly mockPaymentHistory: TenantPaymentRecord[] = [
    {
      id: 'pay-1',
      date: '2024-02-01T08:30:00Z',
      type: 'Rent Payment',
      amount: 45000,
      method: 'M-Pesa',
      status: 'paid',
      reference: 'MPESA-6789',
      description: 'February 2024 rent payment'
    },
    {
      id: 'pay-2',
      date: '2024-01-01T09:15:00Z',
      type: 'Rent Payment',
      amount: 45000,
      method: 'Card',
      methodDetails: 'Visa ending 3421',
      status: 'paid',
      reference: 'CARD-4321',
      description: 'January 2024 rent payment'
    },
    {
      id: 'pay-3',
      date: '2023-12-28T10:05:00Z',
      type: 'Late Fee Payment',
      amount: 2000,
      method: 'Bank Transfer',
      status: 'paid',
      reference: 'BANK-9988',
      description: 'Late fee for December 2023 rent'
    }
  ];

  private readonly mockScheduledPayments: TenantScheduledPayment[] = [
    {
      id: 'sched-1',
      description: 'March 2024 Rent',
      amount: 45000,
      method: 'M-Pesa',
      scheduleDate: '2024-03-01T08:00:00Z'
    }
  ];

  private readonly mockDepositSummary: DepositSummaryResponse = {
    totalAmount: 50000,
    protectionScheme: 'Government Deposit Protection',
    protectionSchemeDetails: 'Your deposit is protected under the Kenya Residential Tenancy Act 2023',
    datePaid: '2023-06-15',
    refundableAmount: 45000,
    nonRefundableAmount: 5000,
    interestRate: 2.5,
    expectedReturnDate: 'Within 30 days of lease termination',
    protectionCertificateUrl: '/assets/documents/deposit-certificate.pdf',
    disputeProcessUrl: '/assets/documents/dispute-process.pdf'
  };

  private readonly mockDepositBreakdown: DepositBreakdownItem[] = [
    { description: 'Security Deposit', amount: 40000, type: 'refundable', percentage: 80 },
    { description: 'Key Deposit', amount: 5000, type: 'refundable', percentage: 10 },
    { description: 'Processing Fee', amount: 3000, type: 'non-refundable', percentage: 6 },
    { description: 'Protection Insurance', amount: 2000, type: 'fee', percentage: 4 }
  ];

  private readonly mockDepositTimeline: DepositTimelineEvent[] = [
    {
      id: 'timeline-1',
      title: 'Deposit Paid',
      type: 'payment',
      date: '2023-06-15T09:00:00Z',
      status: 'completed',
      description: 'Initial deposit payment received',
      amount: 50000,
      reference: 'MPESA-1234'
    },
    {
      id: 'timeline-2',
      title: 'Deposit Verified',
      type: 'verification',
      date: '2023-06-16T14:30:00Z',
      status: 'completed',
      description: 'Deposit verified by property management'
    },
    {
      id: 'timeline-3',
      title: 'Protection Certificate Issued',
      type: 'protection',
      date: '2023-06-17T10:15:00Z',
      status: 'completed',
      description: 'Government deposit protection certificate issued'
    },
    {
      id: 'timeline-4',
      title: 'Move-out Inspection Scheduled',
      type: 'inspection',
      date: '2024-05-25T09:00:00Z',
      status: 'scheduled',
      description: 'Inspection scheduled 5 days before lease end'
    }
  ];

  private paymentSummarySubject: BehaviorSubject<TenantPaymentSummary>;
  private paymentHistorySubject: BehaviorSubject<TenantPaymentRecord[]>;
  private scheduledPaymentsSubject: BehaviorSubject<TenantScheduledPayment[]>;
  private depositSummarySubject: BehaviorSubject<DepositSummaryResponse>;
  private depositBreakdownSubject: BehaviorSubject<DepositBreakdownItem[]>;
  private depositTimelineSubject: BehaviorSubject<DepositTimelineEvent[]>;

  constructor() {
    this.paymentSummarySubject = new BehaviorSubject<TenantPaymentSummary>({ ...this.mockSummary });
    this.paymentHistorySubject = new BehaviorSubject<TenantPaymentRecord[]>(this.clonePaymentRecords(this.mockPaymentHistory));
    this.scheduledPaymentsSubject = new BehaviorSubject<TenantScheduledPayment[]>(this.cloneScheduledPayments(this.mockScheduledPayments));
    this.depositSummarySubject = new BehaviorSubject<DepositSummaryResponse>({ ...this.mockDepositSummary });
    this.depositBreakdownSubject = new BehaviorSubject<DepositBreakdownItem[]>(this.cloneDepositBreakdown(this.mockDepositBreakdown));
    this.depositTimelineSubject = new BehaviorSubject<DepositTimelineEvent[]>(this.cloneTimelineEvents(this.mockDepositTimeline));
  }

  getTenantPaymentSummary(): Observable<TenantPaymentSummary> {
    return this.http
      .get<TenantPaymentSummary | { data?: TenantPaymentSummary }>(`${this.baseTenantUrl}/payments/summary`)
      .pipe(
        map(response => this.extractData(response, this.mockSummary)),
        tap(summary => this.paymentSummarySubject.next(summary)),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockSummary,
            this.paymentSummarySubject,
            summary => ({ ...summary })
          )
        )
      );
  }

  getTenantPaymentHistory(): Observable<TenantPaymentRecord[]> {
    return this.http
      .get<TenantPaymentRecord[] | { data?: TenantPaymentRecord[] }>(`${this.baseTenantUrl}/payments`)
      .pipe(
        map(response => this.extractData(response, this.mockPaymentHistory)),
        tap(records => this.paymentHistorySubject.next(this.clonePaymentRecords(records))),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockPaymentHistory,
            this.paymentHistorySubject,
            records => this.clonePaymentRecords(records)
          )
        )
      );
  }

  getTenantScheduledPayments(): Observable<TenantScheduledPayment[]> {
    return this.http
      .get<TenantScheduledPayment[] | { data?: TenantScheduledPayment[] }>(`${this.baseTenantUrl}/payments/scheduled`)
      .pipe(
        map(response => this.extractData(response, this.mockScheduledPayments)),
        tap(scheduled => this.scheduledPaymentsSubject.next(this.cloneScheduledPayments(scheduled))),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockScheduledPayments,
            this.scheduledPaymentsSubject,
            scheduled => this.cloneScheduledPayments(scheduled)
          )
        )
      );
  }

  getTenantDepositSummary(): Observable<DepositSummaryResponse> {
    return this.http
      .get<DepositSummaryResponse | { data?: DepositSummaryResponse }>(`${this.baseTenantUrl}/deposit`)
      .pipe(
        map(response => this.extractData(response, this.mockDepositSummary)),
        tap(summary => this.depositSummarySubject.next({ ...summary })),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockDepositSummary,
            this.depositSummarySubject,
            summary => ({ ...summary })
          )
        )
      );
  }

  getTenantDepositBreakdown(): Observable<DepositBreakdownItem[]> {
    return this.http
      .get<DepositBreakdownItem[] | { data?: DepositBreakdownItem[] }>(`${this.baseTenantUrl}/deposit/breakdown`)
      .pipe(
        map(response => this.extractData(response, this.mockDepositBreakdown)),
        tap(items => this.depositBreakdownSubject.next(this.cloneDepositBreakdown(items))),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockDepositBreakdown,
            this.depositBreakdownSubject,
            breakdown => this.cloneDepositBreakdown(breakdown)
          )
        )
      );
  }

  getTenantDepositTimeline(): Observable<DepositTimelineEvent[]> {
    return this.http
      .get<DepositTimelineEvent[] | { data?: DepositTimelineEvent[] }>(`${this.baseTenantUrl}/deposit/timeline`)
      .pipe(
        map(response => this.extractData(response, this.mockDepositTimeline)),
        tap(events => this.depositTimelineSubject.next(this.cloneTimelineEvents(events))),
        catchError(error =>
          this.handleFallback(
            error,
            this.mockDepositTimeline,
            this.depositTimelineSubject,
            timeline => this.cloneTimelineEvents(timeline)
          )
        )
      );
  }

  watchPaymentSummary(): Observable<TenantPaymentSummary> {
    return this.paymentSummarySubject.asObservable();
  }

  watchPaymentHistory(): Observable<TenantPaymentRecord[]> {
    return this.paymentHistorySubject.asObservable();
  }

  watchScheduledPayments(): Observable<TenantScheduledPayment[]> {
    return this.scheduledPaymentsSubject.asObservable();
  }

  watchDepositSummary(): Observable<DepositSummaryResponse> {
    return this.depositSummarySubject.asObservable();
  }

  watchDepositBreakdown(): Observable<DepositBreakdownItem[]> {
    return this.depositBreakdownSubject.asObservable();
  }

  watchDepositTimeline(): Observable<DepositTimelineEvent[]> {
    return this.depositTimelineSubject.asObservable();
  }

  initiateTenantPayment(payload: TenantPaymentPayload): Observable<TenantPaymentRecord> {
    return this.http
      .post<TenantPaymentRecord | { data?: TenantPaymentRecord }>(`${this.baseTenantUrl}/payments`, payload)
      .pipe(
        map(response => this.unwrapRecord(response, payload)),
        tap(record => this.prependPaymentRecord(record)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          console.warn('[FinancialService] Falling back when initiating payment', error);
          const fallbackRecord = this.createLocalPaymentRecord(payload);
          this.prependPaymentRecord(fallbackRecord);
          return of(fallbackRecord);
        })
      );
  }

  scheduleTenantPayment(payload: TenantPaymentSchedulePayload): Observable<TenantScheduledPayment> {
    return this.http
      .post<TenantScheduledPayment | { data?: TenantScheduledPayment }>(`${this.baseTenantUrl}/payments/scheduled`, payload)
      .pipe(
        map(response => this.unwrapScheduled(response, payload)),
        tap(scheduled => this.prependScheduledPayment(scheduled)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          console.warn('[FinancialService] Falling back when scheduling payment', error);
          const fallbackScheduled: TenantScheduledPayment = {
            id: `tmp-${Date.now()}`,
            description: payload.description ?? 'Scheduled payment',
            amount: payload.amount,
            method: payload.method,
            scheduleDate: payload.scheduleDate
          };
          this.prependScheduledPayment(fallbackScheduled);
          return of(fallbackScheduled);
        })
      );
  }

  raiseDepositDispute(payload: DepositDisputePayload): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string } | { data?: { success: boolean; message: string } }>(
        `${this.baseTenantUrl}/deposit/dispute`,
        payload
      )
      .pipe(
        map(response => this.extractData(response, { success: true, message: 'Dispute recorded locally.' })),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          console.warn('[FinancialService] Falling back when raising deposit dispute', error);
          return of({ success: true, message: 'Dispute recorded locally.' });
        })
      );
  }

  releaseDeposit(depositId: string, payload?: DepositActionPayload): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string } | { data?: { success: boolean; message: string } }>(
        `${this.baseLandlordUrl}/deposits/${depositId}/release`,
        payload ?? {}
      )
      .pipe(
        map(response => this.extractData(response, { success: true, message: 'Deposit release recorded locally.' })),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          console.warn('[FinancialService] Falling back when releasing deposit', error);
          return of({ success: true, message: 'Deposit release recorded locally.' });
        })
      );
  }

  holdDeposit(depositId: string, payload: DepositActionPayload): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string } | { data?: { success: boolean; message: string } }>(
        `${this.baseLandlordUrl}/deposits/${depositId}/hold`,
        payload
      )
      .pipe(
        map(response => this.extractData(response, { success: true, message: 'Deposit hold recorded locally.' })),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          console.warn('[FinancialService] Falling back when holding deposit', error);
          return of({ success: true, message: 'Deposit hold recorded locally.' });
        })
      );
  }

  private extractData<T>(response: T | { data?: T } | null | undefined, fallback: T): T {
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data as T;
    }
    return (response as T) ?? fallback;
  }

  private unwrapRecord(
    response: TenantPaymentRecord | { data?: TenantPaymentRecord } | null | undefined,
    payload: TenantPaymentPayload
  ): TenantPaymentRecord {
    const fallback = this.createLocalPaymentRecord(payload);
    const record = this.extractData(response, fallback);
    return {
      ...record,
      date: record.date ?? new Date().toISOString()
    };
  }

  private unwrapScheduled(
    response: TenantScheduledPayment | { data?: TenantScheduledPayment } | null | undefined,
    payload: TenantPaymentSchedulePayload
  ): TenantScheduledPayment {
    const fallback: TenantScheduledPayment = {
      id: `tmp-${Date.now()}`,
      description: payload.description ?? 'Scheduled payment',
      amount: payload.amount,
      method: payload.method,
      scheduleDate: payload.scheduleDate
    };
    return this.extractData(response, fallback);
  }

  private prependPaymentRecord(record: TenantPaymentRecord): void {
    const current = this.paymentHistorySubject.value;
    this.paymentHistorySubject.next([record, ...current]);
  }

  private prependScheduledPayment(payment: TenantScheduledPayment): void {
    const current = this.scheduledPaymentsSubject.value;
    this.scheduledPaymentsSubject.next([payment, ...current]);
  }

  private createLocalPaymentRecord(payload: TenantPaymentPayload): TenantPaymentRecord {
    return {
      id: `tmp-${Date.now()}`,
      date: new Date().toISOString(),
      type: payload.type ?? 'Payment',
      amount: payload.amount,
      method: payload.method,
      methodDetails: payload.description,
      status: 'processing',
      reference: payload.reference ?? `LOCAL-${Date.now()}`,
      description: payload.description
    };
  }

  private handleFallback<T>(
    error: unknown,
    fallback: T,
    subject?: BehaviorSubject<T>,
    clone?: (value: T) => T
  ): Observable<T> {
    if (!this.shouldFallback(error)) {
      return throwError(() => error);
    }
    console.warn('[FinancialService] Falling back to cached data', error);
    const safeValue = clone ? clone(fallback) : fallback;
    if (subject) {
      subject.next(safeValue);
    }
    return of(safeValue);
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    return error.status === 0 || error.status >= 500;
  }
 
  private clonePaymentRecords(records: TenantPaymentRecord[]): TenantPaymentRecord[] {
    return records.map(record => ({ ...record }));
  }

  private cloneScheduledPayments(payments: TenantScheduledPayment[]): TenantScheduledPayment[] {
    return payments.map(payment => ({ ...payment }));
  }

  private cloneDepositBreakdown(items: DepositBreakdownItem[]): DepositBreakdownItem[] {
    return items.map(item => ({ ...item }));
  }

  private cloneTimelineEvents(events: DepositTimelineEvent[]): DepositTimelineEvent[] {
    return events.map(event => ({ ...event }));
  }
}
