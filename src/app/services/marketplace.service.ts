import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type MarketplaceCategory = 'items' | 'services' | 'housing' | string;

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  seller: string;
  category: MarketplaceCategory;
  datePosted: string;
  contactPhone?: string;
  rating?: number;
  reviewsCount?: number;
}

export interface MarketplaceCategoryOption {
  id: string;
  name: string;
  slug: MarketplaceCategory;
  description?: string;
}

export interface MarketplaceFilterOptions {
  category?: MarketplaceCategory;
  search?: string;
  limit?: number;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
}

export interface CreateMarketplaceListingPayload {
  title: string;
  description: string;
  price: number;
  location: string;
  seller: string;
  category: MarketplaceCategory;
  contactPhone?: string;
  tags?: string[];
  attachments?: File[];
}

export interface MarketplaceInquiryPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarketplaceService {
  private readonly http = inject(HttpClient);
  private readonly listingsUrl = `${environment.apiUrl}/marketplace/listings`;
  private readonly categoriesUrl = `${environment.apiUrl}/marketplace/categories`;

  private fallbackListings: MarketplaceListing[] = [
    {
      id: 'market-1',
      title: 'Sofa Set - 3 Seater',
      description: 'Comfortable leather sofa in excellent condition with minimal wear.',
      price: 35000,
      location: 'Westlands',
      seller: 'Mary Wanjiku',
      category: 'items',
      datePosted: '2024-02-10',
      contactPhone: '+254700123456',
      rating: 4.8,
      reviewsCount: 12
    },
    {
      id: 'market-2',
      title: 'House Cleaning Service',
      description: 'Professional cleaning service for apartments with eco-friendly supplies.',
      price: 2500,
      location: 'Nairobi CBD',
      seller: 'Clean Pro Services',
      category: 'services',
      datePosted: '2024-02-12',
      contactPhone: '+254711987654',
      rating: 4.6,
      reviewsCount: 34
    },
    {
      id: 'market-3',
      title: '2BR Apartment for Rent',
      description: 'Modern 2-bedroom apartment with parking and 24/7 security.',
      price: 45000,
      location: 'Karen',
      seller: 'Prime Properties',
      category: 'housing',
      datePosted: '2024-02-08',
      contactPhone: '+254701223344',
      rating: 4.9,
      reviewsCount: 21
    },
    {
      id: 'market-4',
      title: 'Moving Services',
      description: 'Reliable movers available for same-day service within Nairobi.',
      price: 8000,
      location: 'Kilimani',
      seller: 'QuickMove Logistics',
      category: 'services',
      datePosted: '2024-02-05',
      contactPhone: '+254733665544',
      rating: 4.7,
      reviewsCount: 18
    },
    {
      id: 'market-5',
      title: 'Dining Table Set',
      description: '6-seater mahogany dining table with chairs, lightly used.',
      price: 28000,
      location: 'Lavington',
      seller: 'Daniel Otieno',
      category: 'items',
      datePosted: '2024-02-13',
      contactPhone: '+254702456789',
      rating: 4.5,
      reviewsCount: 9
    },
    {
      id: 'market-6',
      title: '1BR Serviced Apartment',
      description: 'Fully furnished apartment with weekly cleaning and Wi-Fi included.',
      price: 60000,
      location: 'Upper Hill',
      seller: 'Skyline Stays',
      category: 'housing',
      datePosted: '2024-02-11',
      contactPhone: '+254709111222',
      rating: 4.8,
      reviewsCount: 27
    }
  ];

  private fallbackCategories: MarketplaceCategoryOption[] = [
    { id: 'cat-items', name: 'Items for Sale', slug: 'items', description: 'Furniture, appliances, and household items from your community.' },
    { id: 'cat-services', name: 'Trusted Services', slug: 'services', description: 'Cleaning, moving, repair, and other professional services.' },
    { id: 'cat-housing', name: 'Housing & Rentals', slug: 'housing', description: 'Apartments, short stays, and shared housing opportunities.' }
  ];

  private listingsCache: MarketplaceListing[] = this.cloneListings(this.fallbackListings);
  private categoriesCache: MarketplaceCategoryOption[] = [...this.fallbackCategories];

  getTenantMarketplaceListings(filters: MarketplaceFilterOptions = {}): Observable<MarketplaceListing[]> {
    const params = this.buildListingParams(filters);

    return this.http
      .get<MarketplaceListing[] | { data?: MarketplaceListing[]; items?: MarketplaceListing[] }>(this.listingsUrl, {
        params
      })
      .pipe(
        map(response => this.normalizeListings(this.extractListings(response))),
        tap(listings => this.setListings(listings)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load marketplace listings', error);
          return of(this.getListingsSnapshot());
        })
      );
  }

  getLandlordMarketplaceListings(filters: MarketplaceFilterOptions = {}): Observable<MarketplaceListing[]> {
    return this.getTenantMarketplaceListings(filters);
  }

  createListing(payload: CreateMarketplaceListingPayload): Observable<MarketplaceListing> {
    const formData = this.buildListingFormData(payload);

    return this.http
      .post<MarketplaceListing | { data?: MarketplaceListing }>(this.listingsUrl, formData)
      .pipe(
        map(response => {
          const listing = this.unwrapListing(response);
          if (!listing) {
            throw new Error('Empty marketplace listing response');
          }
          return this.normalizeListing(listing);
        }),
        tap(listing => this.cacheListing(listing)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('create marketplace listing', error);
          const fallbackListing = this.createLocalListing(payload);
          this.cacheListing(fallbackListing);
          return of(fallbackListing);
        })
      );
  }

  sendListingInquiry(listingId: string, payload: MarketplaceInquiryPayload): Observable<void> {
    const endpoint = `${this.listingsUrl}/${listingId}/inquiries`;

    return this.http.post<void | { data?: unknown }>(endpoint, payload).pipe(
      map(() => void 0),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`send marketplace inquiry for listing ${listingId}`, error);
        return of(void 0);
      })
    );
  }

  getMarketplaceCategories(): Observable<MarketplaceCategoryOption[]> {
    return this.http
      .get<MarketplaceCategoryOption[] | { data?: MarketplaceCategoryOption[]; items?: MarketplaceCategoryOption[] }>(this.categoriesUrl)
      .pipe(
        map(response => this.normalizeCategories(this.extractCategories(response))),
        tap(categories => this.setCategories(categories)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load marketplace categories', error);
          return of(this.getCategoriesSnapshot());
        })
      );
  }

  private buildListingParams(filters: MarketplaceFilterOptions): HttpParams {
    let params = new HttpParams();
    const entries: Array<[string, string | number | undefined]> = [
      ['category', filters.category],
      ['search', filters.search],
      ['limit', filters.limit],
      ['location', filters.location],
      ['minPrice', filters.minPrice],
      ['maxPrice', filters.maxPrice],
      ['sort', filters.sort]
    ];

    entries.forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        params = params.set(key, String(value));
      }
    });

    return params;
  }

  private buildListingFormData(payload: CreateMarketplaceListingPayload): FormData {
    const formData = new FormData();
    formData.append('title', payload.title.trim());
    formData.append('description', payload.description.trim());
    formData.append('price', String(payload.price));
    formData.append('location', payload.location.trim());
    formData.append('seller', payload.seller.trim());
    formData.append('category', payload.category);
    if (payload.contactPhone) {
      formData.append('contactPhone', payload.contactPhone.trim());
    }
    (payload.tags ?? []).forEach(tag => formData.append('tags', tag));
    (payload.attachments ?? []).forEach((file, index) => {
      if (!file) {
        return;
      }
      const filename = file.name || `attachment-${index + 1}`;
      formData.append('attachments', file, filename);
    });
    return formData;
  }

  private normalizeListings(listings: MarketplaceListing[]): MarketplaceListing[] {
    return listings.map(listing => this.normalizeListing(listing));
  }

  private normalizeListing(input: Partial<MarketplaceListing> & Record<string, any>): MarketplaceListing {
    return {
      id: input.id ?? `listing-${Date.now()}`,
      title: input.title ?? 'Untitled Listing',
      description: input.description ?? '',
      price: typeof input.price === 'string' ? Number.parseFloat(input.price) : Number(input.price ?? 0),
      location: input.location ?? 'Nairobi',
      seller: input.seller ?? input['ownerName'] ?? 'Community Member',
      category: input.category ?? input['categoryId'] ?? 'items',
      datePosted: this.normalizeDateString(input.datePosted) ?? new Date().toISOString(),
      contactPhone: input.contactPhone ?? input['phone'] ?? undefined,
      rating: typeof input.rating === 'string' ? Number.parseFloat(input.rating) : input.rating,
      reviewsCount: typeof input.reviewsCount === 'string' ? Number.parseInt(input.reviewsCount, 10) : input.reviewsCount
    };
  }

  private normalizeCategories(categories: MarketplaceCategoryOption[]): MarketplaceCategoryOption[] {
    return categories.map(category => ({
      id: category.id ?? category.slug ?? category.name ?? `category-${Date.now()}`,
      name: category.name ?? this.formatCategoryName(category.slug ?? 'items'),
      slug: category.slug ?? (category as any).code ?? category.id ?? 'items',
      description: category.description
    }));
  }

  private createLocalListing(payload: CreateMarketplaceListingPayload): MarketplaceListing {
    return {
      id: `tmp-${Date.now()}`,
      title: payload.title.trim(),
      description: payload.description.trim(),
      price: payload.price,
      location: payload.location.trim(),
      seller: payload.seller.trim(),
      category: payload.category,
      datePosted: new Date().toISOString(),
      contactPhone: payload.contactPhone,
      rating: undefined,
      reviewsCount: 0
    };
  }

  private cacheListing(listing: MarketplaceListing): void {
    this.listingsCache = [listing, ...this.listingsCache.filter(existing => existing.id !== listing.id)];
  }

  private setListings(listings: MarketplaceListing[]): void {
    this.listingsCache = this.cloneListings(listings);
  }

  private setCategories(categories: MarketplaceCategoryOption[]): void {
    this.categoriesCache = categories.map(category => ({ ...category }));
  }

  private getListingsSnapshot(): MarketplaceListing[] {
    return this.cloneListings(this.listingsCache);
  }

  private getCategoriesSnapshot(): MarketplaceCategoryOption[] {
    return this.categoriesCache.map(category => ({ ...category }));
  }

  private cloneListings(listings: MarketplaceListing[]): MarketplaceListing[] {
    return listings.map(listing => ({ ...listing }));
  }

  private extractListings(response: unknown): MarketplaceListing[] {
    if (Array.isArray(response)) {
      return response as MarketplaceListing[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as MarketplaceListing[];
      }
    }
    return this.getListingsSnapshot();
  }

  private unwrapListing(response: MarketplaceListing | { data?: MarketplaceListing } | null | undefined): MarketplaceListing | null {
    if (!response) {
      return null;
    }
    if (typeof response === 'object' && 'data' in response) {
      return (response as { data?: MarketplaceListing }).data ?? null;
    }
    return response as MarketplaceListing;
  }

  private extractCategories(response: unknown): MarketplaceCategoryOption[] {
    if (Array.isArray(response)) {
      return response as MarketplaceCategoryOption[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as MarketplaceCategoryOption[];
      }
    }
    return this.getCategoriesSnapshot();
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

  private normalizeDateString(value: string | Date | undefined | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  }

  private formatCategoryName(slug: MarketplaceCategory): string {
    if (typeof slug !== 'string' || !slug.length) {
      return 'Marketplace';
    }
    return slug
      .split(/[-_ ]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[MarketplaceService] Falling back to local data for ${context}`, error);
  }
}
