import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type ReviewSubject = 'landlord' | 'property' | 'caretaker' | 'service';

export interface TenantReview {
  id: string;
  subjectType: ReviewSubject;
  subjectName: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: string;
  response?: {
    author: string;
    message: string;
    createdAt: string;
  };
}

export interface SubmitReviewPayload {
  subjectType: ReviewSubject;
  subjectName: string;
  rating: number;
  comment: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution?: Record<number, number>;
  responseCount?: number;
  lastReviewedAt?: string;
}

export interface ReviewQuery {
  subjectType?: ReviewSubject;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class RatingService {
  private readonly http = inject(HttpClient);
  private readonly reviewsUrl = `${environment.apiUrl}/reviews`;
  private readonly summaryUrl = `${this.reviewsUrl}/summary`;

  private fallbackReviews: TenantReview[] = [
    {
      id: 'rev-1',
      subjectType: 'landlord',
      subjectName: 'Sarah Johnson',
      reviewer: 'You',
      rating: 4,
      comment: 'Responsive landlord, quick to handle maintenance issues.',
      createdAt: '2024-02-10T09:30:00Z',
      response: {
        author: 'Sarah Johnson',
        message: 'Thank you for the feedback! We aim to keep improving.',
        createdAt: '2024-02-11T08:05:00Z'
      }
    },
    {
      id: 'rev-2',
      subjectType: 'caretaker',
      subjectName: 'James Otieno',
      reviewer: 'You',
      rating: 5,
      comment: 'Always punctual and helpful with property issues.',
      createdAt: '2024-01-22T14:12:00Z'
    },
    {
      id: 'rev-3',
      subjectType: 'service',
      subjectName: 'QuickMove Logistics',
      reviewer: 'You',
      rating: 4,
      comment: 'Handled moving efficiently, minor delay but overall good.',
      createdAt: '2023-12-18T11:45:00Z'
    }
  ];

  private reviewsCache: TenantReview[] = this.cloneReviews(this.fallbackReviews);
  private reviewsSubject = new BehaviorSubject<TenantReview[]>(this.cloneReviews(this.fallbackReviews));
  private summarySubject = new BehaviorSubject<ReviewSummary>(this.computeSummary(this.fallbackReviews));

  getTenantReviews(query: ReviewQuery = {}): Observable<TenantReview[]> {
    const params = this.buildReviewParams(query);

    return this.http
      .get<TenantReview[] | { data?: TenantReview[]; items?: TenantReview[] }>(this.reviewsUrl, { params })
      .pipe(
        map(response => this.normalizeReviews(this.extractReviews(response))),
        tap(reviews => this.setReviews(reviews)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load reviews', error);
          const fallback = this.getReviewsSnapshot();
          this.reviewsSubject.next(this.cloneReviews(fallback));
          return of(fallback);
        })
      );
  }

  submitReview(payload: SubmitReviewPayload): Observable<TenantReview> {
    const sanitizedPayload: SubmitReviewPayload = {
      subjectType: payload.subjectType,
      subjectName: payload.subjectName.trim(),
      rating: payload.rating,
      comment: payload.comment.trim()
    };

    if (!sanitizedPayload.subjectName.length) {
      return throwError(() => new Error('Subject name is required'));
    }

    if (sanitizedPayload.rating < 1 || sanitizedPayload.rating > 5) {
      return throwError(() => new Error('Rating must be between 1 and 5'));
    }

    return this.http
      .post<TenantReview | { data?: TenantReview }>(this.reviewsUrl, sanitizedPayload)
      .pipe(
        map(response => {
          const review = this.unwrapReview(response);
          if (!review) {
            throw new Error('Empty review response');
          }
          return this.normalizeReview(review);
        }),
        tap(review => this.cacheReview(review)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('submit review', error);
          const fallbackReview = this.createLocalReview(sanitizedPayload);
          this.cacheReview(fallbackReview);
          return of(fallbackReview);
        })
      );
  }

  getReviewSummary(query: ReviewQuery = {}): Observable<ReviewSummary> {
    const params = this.buildReviewParams(query);
    const fallbackSummary = this.computeSummary(this.reviewsCache, query.subjectType);

    return this.http
      .get<ReviewSummary | { data?: ReviewSummary }>(this.summaryUrl, { params })
      .pipe(
        map(response => this.unwrapSummary(response, fallbackSummary)),
        tap(summary => this.summarySubject.next(summary)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load review summary', error);
          const summary = this.computeSummary(this.reviewsCache, query.subjectType);
          this.summarySubject.next(summary);
          return of(summary);
        })
      );
  }

  watchReviews(query: ReviewQuery = {}): Observable<TenantReview[]> {
    if (query.subjectType) {
      return this.reviewsSubject.asObservable().pipe(
        map(reviews => reviews.filter(review => review.subjectType === query.subjectType))
      );
    }
    return this.reviewsSubject.asObservable();
  }

  watchSummary(): Observable<ReviewSummary> {
    return this.summarySubject.asObservable();
  }

  private buildReviewParams(query: ReviewQuery): HttpParams {
    let params = new HttpParams();

    if (query.subjectType) {
      params = params.set('subjectType', query.subjectType);
    }
    if (typeof query.page === 'number') {
      params = params.set('page', String(query.page));
    }
    if (typeof query.pageSize === 'number') {
      params = params.set('pageSize', String(query.pageSize));
    }

    return params;
  }

  private setReviews(reviews: TenantReview[]): void {
    this.reviewsCache = this.cloneReviews(reviews);
    this.reviewsSubject.next(this.cloneReviews(this.reviewsCache));
    this.summarySubject.next(this.computeSummary(this.reviewsCache));
  }

  private cacheReview(review: TenantReview): void {
    this.reviewsCache = [review, ...this.reviewsCache.filter(existing => existing.id !== review.id)];
    this.reviewsSubject.next(this.cloneReviews(this.reviewsCache));
    this.summarySubject.next(this.computeSummary(this.reviewsCache));
  }

  private getReviewsSnapshot(): TenantReview[] {
    return this.cloneReviews(this.reviewsCache);
  }

  private cloneReviews(reviews: TenantReview[]): TenantReview[] {
    return reviews.map(review => ({
      ...review,
      response: review.response ? { ...review.response } : undefined
    }));
  }

  private normalizeReviews(reviews: TenantReview[]): TenantReview[] {
    return reviews.map(review => this.normalizeReview(review));
  }

  private normalizeReview(input: Partial<TenantReview> & Record<string, any>): TenantReview {
    const rawResponse = input.response as (Partial<TenantReview['response']> & Record<string, unknown>) | undefined;
    const response = rawResponse
      ? {
          author:
            rawResponse.author ??
            (typeof rawResponse['responderName'] === 'string' ? (rawResponse['responderName'] as string) : undefined) ??
            'Moderator',
          message:
            rawResponse.message ??
            (typeof rawResponse['body'] === 'string' ? (rawResponse['body'] as string) : undefined) ??
            '',
          createdAt: this.normalizeDate(rawResponse.createdAt) ?? new Date().toISOString()
        }
      : undefined;

    return {
      id: input.id ?? `rev-${Date.now()}`,
      subjectType: input.subjectType ?? 'landlord',
      subjectName: input.subjectName ?? input['subject'] ?? 'Unknown',
      reviewer: input.reviewer ?? input['reviewerName'] ?? 'You',
      rating: Number(input.rating ?? 0),
      comment: input.comment ?? input['body'] ?? '',
      createdAt: this.normalizeDate(input.createdAt) ?? new Date().toISOString(),
      response
    };
  }

  private createLocalReview(payload: SubmitReviewPayload): TenantReview {
    return {
      id: `tmp-rev-${Date.now()}`,
      subjectType: payload.subjectType,
      subjectName: payload.subjectName.trim(),
      reviewer: 'You',
      rating: payload.rating,
      comment: payload.comment.trim(),
      createdAt: new Date().toISOString()
    };
  }

  private extractReviews(response: unknown): TenantReview[] {
    if (Array.isArray(response)) {
      return response as TenantReview[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as TenantReview[];
      }
    }
    return this.getReviewsSnapshot();
  }

  private unwrapReview(response: TenantReview | { data?: TenantReview } | null | undefined): TenantReview | null {
    if (!response) {
      return null;
    }
    if (typeof response === 'object' && 'data' in response) {
      return (response as { data?: TenantReview }).data ?? null;
    }
    return response as TenantReview;
  }

  private unwrapSummary(
    response: ReviewSummary | { data?: ReviewSummary } | null | undefined,
    fallback: ReviewSummary
  ): ReviewSummary {
    if (!response) {
      return fallback;
    }
    if (typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }
    return response as ReviewSummary;
  }

  private computeSummary(reviews: TenantReview[], subjectType?: ReviewSubject): ReviewSummary {
    const filtered = subjectType ? reviews.filter(review => review.subjectType === subjectType) : reviews;
    if (!filtered.length) {
      return { averageRating: 0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, responseCount: 0 };
    }

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let responseCount = 0;
    let lastReviewedAt: string | undefined;

    filtered.forEach(review => {
      total += review.rating;
      distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
      if (review.response) {
        responseCount++;
      }
      if (!lastReviewedAt || new Date(review.createdAt) > new Date(lastReviewedAt)) {
        lastReviewedAt = review.createdAt;
      }
    });

    return {
      averageRating: Number((total / filtered.length).toFixed(1)),
      totalReviews: filtered.length,
      distribution,
      responseCount,
      lastReviewedAt
    };
  }

  private normalizeDate(value: string | Date | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }
    if (error.status === 0 || error.status >= 500) {
      return true;
    }
    return false;
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[RatingService] Falling back to local data for ${context}`, error);
  }
}
