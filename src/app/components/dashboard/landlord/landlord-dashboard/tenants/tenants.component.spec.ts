import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { LandlordTenantsComponent } from './tenants.component';
import {
  LandlordTenant,
  LandlordTenantSummary,
  LandlordTenantService
} from '../../../../../services/landlord-tenant.service';

class MockLandlordTenantService {
  private readonly tenantsSubject = new BehaviorSubject<LandlordTenant[]>([]);
  private readonly summarySubject = new BehaviorSubject<LandlordTenantSummary>({
    totalTenants: 0,
    activeLeases: 0,
    leasesEndingSoon: 0,
    overdueTenants: 0,
    averageMonthlyRent: 0,
    occupancyRate: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    totalUnits: 0,
    updatedAt: new Date().toISOString()
  });
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  watchTenants() {
    return this.tenantsSubject.asObservable();
  }

  watchSummary() {
    return this.summarySubject.asObservable();
  }

  watchLoading() {
    return this.loadingSubject.asObservable();
  }

  watchError() {
    return this.errorSubject.asObservable();
  }

  refreshTenants(): any {
    return of(this.tenantsSubject.value);
  }

  setData(tenants: LandlordTenant[], summary: LandlordTenantSummary): void {
    this.tenantsSubject.next(tenants);
    this.summarySubject.next(summary);
  }

  setError(message: string | null): void {
    this.errorSubject.next(message);
  }
}

describe('LandlordTenantsComponent', () => {
  let component: LandlordTenantsComponent;
  let fixture: ComponentFixture<LandlordTenantsComponent>;
  let mockService: MockLandlordTenantService;

  const sampleTenants: LandlordTenant[] = [
    {
      id: 'tenant-1',
      name: 'Amina Njoroge',
      email: 'amina@example.com',
      phone: '+254700000001',
      propertyId: 'prop-1',
      propertyName: 'Greenwood Apartments',
      propertyLocation: 'Nairobi',
      unitId: 'unit-1',
      unitNumber: 'B-10',
      rentAmount: 52000,
      depositAmount: 52000,
      outstandingBalance: 0,
      leaseStart: '2023-06-01',
      leaseEnd: '2024-06-01',
      lastPaymentDate: '2024-02-01T09:15:00Z',
      status: 'active'
    },
    {
      id: 'tenant-2',
      name: 'Brian Kamau',
      email: 'brian@example.com',
      phone: '+254700000002',
      propertyId: 'prop-2',
      propertyName: 'Skyview Towers',
      propertyLocation: 'Westlands',
      unitId: 'unit-2',
      unitNumber: 'PH-8A',
      rentAmount: 95000,
      depositAmount: 120000,
      outstandingBalance: 18000,
      leaseStart: '2022-11-15',
      leaseEnd: '2024-11-14',
      lastPaymentDate: '2024-01-05T11:30:00Z',
      status: 'overdue'
    }
  ];

  const sampleSummary: LandlordTenantSummary = {
    totalTenants: 2,
    activeLeases: 1,
    leasesEndingSoon: 0,
    overdueTenants: 1,
    averageMonthlyRent: 73500,
    occupancyRate: 80,
    occupiedUnits: 8,
    vacantUnits: 2,
    totalUnits: 10,
    updatedAt: new Date('2024-02-20T08:00:00Z').toISOString()
  };

  beforeEach(async () => {
    mockService = new MockLandlordTenantService();

    await TestBed.configureTestingModule({
      imports: [LandlordTenantsComponent],
      providers: [{ provide: LandlordTenantService, useValue: mockService }]
    }).compileComponents();

    fixture = TestBed.createComponent(LandlordTenantsComponent);
    component = fixture.componentInstance;

    mockService.setData(sampleTenants, sampleSummary);
    fixture.detectChanges();
  });

  it('renders tenant rows with provided data', () => {
    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
    const firstRowText = rows[0].textContent;
    expect(firstRowText).toContain('Amina Njoroge');
    expect(firstRowText).toContain('Greenwood Apartments');
  });

  it('filters tenants by status', () => {
    component.statusControl.setValue('overdue');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Brian Kamau');
  });

  it('resets filters to show all tenants', () => {
    component.propertyControl.setValue('prop-1');
    component.statusControl.setValue('overdue');
    fixture.detectChanges();

    expect(component.hasFiltersApplied()).toBeTrue();
    component.resetFilters();
    fixture.detectChanges();

    expect(component.propertyControl.value).toBe('all');
    expect(component.statusControl.value).toBe('all');
    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
  });
});
