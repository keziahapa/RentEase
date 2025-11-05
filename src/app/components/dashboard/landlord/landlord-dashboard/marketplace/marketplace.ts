import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import {
  MarketplaceService,
  MarketplaceListing,
  MarketplaceCategoryOption,
  MarketplaceFilterOptions
} from '../../../../../services/marketplace.service';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-landlord-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    SkeletonListComponent
  ],
  templateUrl: './marketplace.html',
  styleUrls: ['./marketplace.scss']
})
export class LandlordMarketplaceComponent implements OnInit, OnDestroy {
  private readonly subscriptions = new Subscription();

  listings: MarketplaceListing[] = [];
  filteredListings: MarketplaceListing[] = [];
  categories: MarketplaceCategoryOption[] = [];

  isLoading = false;
  errorMessage: string | null = null;

  categoryControl = new FormControl<string>('all', { nonNullable: true });
  sortControl = new FormControl<'newest' | 'price_asc' | 'price_desc'>('newest', { nonNullable: true });
  searchControl = new FormControl<string>('', { nonNullable: true });

  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.categoryControl.valueChanges.subscribe(() => this.applyFilters()));
    this.subscriptions.add(this.sortControl.valueChanges.subscribe(() => this.applyFilters()));
    this.subscriptions.add(
      this.searchControl.valueChanges.pipe(debounceTime(150)).subscribe(() => this.applyFilters())
    );

    this.loadMarketplaceData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  refresh(): void {
    this.loadMarketplaceData(true);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0
    }).format(price ?? 0);
  }

  private loadMarketplaceData(force = false): void {
    if (this.isLoading && !force) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const filters: MarketplaceFilterOptions = {
      category: this.categoryControl.value === 'all' ? undefined : this.categoryControl.value,
      search: this.searchControl.value,
      sort: this.sortControl.value
    };

    const listingsSub = this.marketplaceService.getLandlordMarketplaceListings(filters).subscribe({
      next: listings => {
        this.listings = listings;
        this.filteredListings = listings;
        this.isLoading = false;
        this.applyFilters();
      },
      error: error => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'Unable to load marketplace listings right now.';
        const message = this.errorMessage ?? 'Unable to load marketplace listings right now.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });

    this.subscriptions.add(listingsSub);

    const categoriesSub = this.marketplaceService.getMarketplaceCategories().subscribe({
      next: categories => {
        this.categories = categories;
      },
      error: () => {
        this.categories = [];
      }
    });

    this.subscriptions.add(categoriesSub);
  }

  private applyFilters(): void {
    const category = this.categoryControl.value;
    const sort = this.sortControl.value;
    const term = this.searchControl.value.trim().toLowerCase();

    const filtered = this.listings.filter(listing => {
      const matchesCategory = category === 'all' || listing.category === category;
      const matchesSearch =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.description.toLowerCase().includes(term) ||
        listing.location.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });

    switch (sort) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      default:
        filtered.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime());
        break;
    }

    this.filteredListings = filtered;
  }
}
