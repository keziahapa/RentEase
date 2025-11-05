import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LandlordMarketplaceComponent } from './marketplace';
import {
  MarketplaceService,
  MarketplaceListing,
  MarketplaceCategoryOption
} from '../../../../../services/marketplace.service';

class MockMarketplaceService {
  getLandlordMarketplaceListings() {
    const listings: MarketplaceListing[] = [
      {
        id: 'listing-1',
        title: 'Professional Cleaning',
        description: 'Weekly cleaning service for apartments.',
        price: 2500,
        location: 'Nairobi',
        seller: 'Sparkle Cleaners',
        category: 'services',
        datePosted: '2024-02-20T09:30:00Z',
        contactPhone: '+254700000000'
      } as MarketplaceListing,
      {
        id: 'listing-2',
        title: 'Sofa Set',
        description: 'Gently used 3-seater sofa set.',
        price: 32000,
        location: 'Westlands',
        seller: 'Jessica',
        category: 'items',
        datePosted: '2024-02-18T11:00:00Z'
      } as MarketplaceListing
    ];
    return of(listings);
  }

  getMarketplaceCategories() {
    const categories: MarketplaceCategoryOption[] = [
      { id: 'items', name: 'Items', slug: 'items' },
      { id: 'services', name: 'Services', slug: 'services' }
    ];
    return of(categories);
  }
}

describe('LandlordMarketplaceComponent', () => {
  let component: LandlordMarketplaceComponent;
  let fixture: ComponentFixture<LandlordMarketplaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandlordMarketplaceComponent],
      providers: [{ provide: MarketplaceService, useClass: MockMarketplaceService }]
    }).compileComponents();

    fixture = TestBed.createComponent(LandlordMarketplaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads listings and filters by category', () => {
    expect(component.filteredListings.length).toBe(2);
    component.categoryControl.setValue('services');
    expect(component.filteredListings.length).toBe(1);
    expect(component.filteredListings[0].category).toBe('services');
  });

  it('sorts listings by price', () => {
    component.sortControl.setValue('price_desc');
    const [firstListing] = component.filteredListings;
    expect(firstListing.price).toBeGreaterThan(2000);
  });
});

