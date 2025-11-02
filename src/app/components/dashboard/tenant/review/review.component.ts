import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import {
  RatingService,
  TenantReview,
  SubmitReviewPayload,
  ReviewSubject,
  ReviewSummary
} from '../../../../services/rating.service';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss']
})
export class ReviewComponent implements OnInit, OnDestroy {
  private ratingService = inject(RatingService);
  private subscriptions = new Subscription();

  reviews: TenantReview[] = [];
  reviewSummary: ReviewSummary = {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    responseCount: 0
  };

  isLoadingReviews = false;
  loadError: string | null = null;

  subjectType: ReviewSubject = 'landlord';
  subjectName = '';
  rating = 5;
  comment = '';
  isSubmitting = false;

  ngOnInit(): void {
    const reviewsWatch = this.ratingService.watchReviews().subscribe(reviews => {
      this.reviews = reviews;
    });

    const summaryWatch = this.ratingService.watchSummary().subscribe(summary => {
      this.reviewSummary = summary;
    });

    this.subscriptions.add(reviewsWatch);
    this.subscriptions.add(summaryWatch);

    this.loadReviews();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get averageRating(): number {
    return this.reviewSummary.averageRating ?? 0;
  }

  get totalReviews(): number {
    return this.reviewSummary.totalReviews ?? 0;
  }

  loadReviews(): void {
    this.isLoadingReviews = true;
    this.loadError = null;

    const sub = this.ratingService.getTenantReviews().subscribe({
      next: () => {
        this.isLoadingReviews = false;
      },
      error: error => {
        this.loadError = error?.message || 'Unable to load reviews.';
        this.isLoadingReviews = false;
      }
    });

    this.subscriptions.add(sub);

    const summarySub = this.ratingService.getReviewSummary().subscribe({
      error: error => {
        this.handleError(error, 'load review summary');
      }
    });

    this.subscriptions.add(summarySub);
  }

  setSubjectType(type: ReviewSubject): void {
    this.subjectType = type;
  }

  submitReview(): void {
    if (!this.subjectName.trim() || !this.comment.trim()) {
      return;
    }

    const payload: SubmitReviewPayload = {
      subjectType: this.subjectType,
      subjectName: this.subjectName,
      rating: this.rating,
      comment: this.comment
    };

    this.isSubmitting = true;

    const sub = this.ratingService.submitReview(payload).subscribe({
      next: review => {
        this.reviews = [review, ...this.reviews];
        this.resetForm();
        this.isSubmitting = false;
      },
      error: error => {
        this.loadError = error?.message || 'Failed to submit review.';
        this.isSubmitting = false;
      }
    });

    this.subscriptions.add(sub);
  }

  getStars(count: number): number[] {
    return Array.from({ length: count });
  }

  isFilledStar(index: number): boolean {
    return index < Math.round(this.averageRating);
  }

  getStarIcon(index: number): string {
    return this.isFilledStar(index) ? 'star' : 'star_border';
  }

  getStarClasses(index: number, rating: number): string {
    return index < rating ? 'filled' : 'empty';
  }

  trackByReviewId(index: number, review: TenantReview): string {
    return review.id;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private resetForm(): void {
    this.subjectType = 'landlord';
    this.subjectName = '';
    this.rating = 5;
    this.comment = '';
  }

  private handleError(error: unknown, context: string): void {
    console.error(`ReviewComponent error during ${context}:`, error);
  }
}
