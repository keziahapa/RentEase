import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { MarketplaceService, MarketplaceListing, MarketplaceCategory } from '../../../../services/marketplace.service';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.scss']
})
export class MarketplaceComponent implements OnInit, OnDestroy {
  private marketplaceService = inject(MarketplaceService);
  private subscriptions = new Subscription();

  @Input() collapsedSections: Set<string> = new Set();
  @Input() animatingSections: Set<string> = new Set();

  @Output() backClick = new EventEmitter<void>();
  @Output() sectionToggle = new EventEmitter<string>();

  activeMarketplaceTab: MarketplaceCategory = 'items';
  listings: MarketplaceListing[] = [];
  isLoading = false;
  loadError: string | null = null;

  ngOnInit(): void {
    this.fetchMarketplaceListings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  fetchMarketplaceListings(): void {
    this.isLoading = true;
    this.loadError = null;

    const sub = this.marketplaceService.getTenantMarketplaceListings().subscribe({
      next: listings => {
        this.listings = listings;
        this.isLoading = false;
      },
      error: error => {
        this.loadError = error?.message || 'Unable to load marketplace listings.';
        this.isLoading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-KE').format(num);
  }

  isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSections?.has(sectionId) || false;
  }

  isAnimating(sectionId: string): boolean {
    return this.animatingSections?.has(sectionId) || false;
  }

  toggleSection(sectionId: string): void {
    this.sectionToggle.emit(sectionId);
  }

  goBack(): void {
    this.backClick.emit();
  }

  setActiveMarketplaceTab(tab: MarketplaceCategory): void {
    if (this.activeMarketplaceTab === tab) {
      return;
    }
    this.activeMarketplaceTab = tab;
  }

  get visibleListings(): MarketplaceListing[] {
    return this.listings.filter(item => item.category === this.activeMarketplaceTab);
  }
}
