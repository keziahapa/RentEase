import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { skip, take } from 'rxjs/operators';

import { LandlordTenantService, LandlordTenant } from './landlord-tenant.service';
import { PropertyService } from './property.service';

describe('LandlordTenantService', () => {
  let service: LandlordTenantService;
  let propertyService: jasmine.SpyObj<PropertyService>;

  beforeEach(() => {
    propertyService = jasmine.createSpyObj<PropertyService>('PropertyService', ['getProperties', 'getPropertyUnits']);

    TestBed.configureTestingModule({
      providers: [
        LandlordTenantService,
        { provide: PropertyService, useValue: propertyService }
      ]
    });

    service = TestBed.inject(LandlordTenantService);
  });

  it('transforms property units into tenant records and updates summary', done => {
    propertyService.getProperties.and.returnValue(
      of([
        {
          id: 'prop-1',
          name: 'Aurora Heights',
          location: 'Nairobi',
          units: [
            {
              id: 'unit-1',
              unitNumber: 'A-01',
              rentAmount: 45000,
              deposit: 45000,
              status: 'occupied',
              tenant: {
                id: 'tenant-1',
                name: 'Jane Doe',
                email: 'jane.doe@example.com',
                phone: '+254700000000',
                leaseStart: '2023-01-01',
                leaseEnd: '2023-12-31',
                lastPaymentDate: '2024-02-01T10:00:00Z'
              }
            }
          ]
        }
      ] as any)
    );

    service.refreshTenants(true).subscribe({
      next: () => {
        service
          .watchTenants()
          .pipe(skip(1), take(1))
          .subscribe(tenants => {
            const latest = tenants.find(tenant => tenant.id === 'tenant-1') as LandlordTenant;
            expect(latest).toBeTruthy();
            expect(latest.propertyName).toBe('Aurora Heights');
            expect(latest.unitNumber).toBe('A-01');
            expect(latest.status).toBe('active');
            expect(latest.rentAmount).toBe(45000);
          });

        service
          .watchSummary()
          .pipe(skip(1), take(1))
          .subscribe(summary => {
            expect(summary.totalTenants).toBeGreaterThan(0);
            expect(summary.activeLeases).toBeGreaterThan(0);
            done();
          });
      },
      error: done.fail
    });
  });

  it('falls back to cached tenants when API fails', done => {
    propertyService.getProperties.and.returnValue(throwError(() => ({ status: 500, message: 'Server error' })));

    service.refreshTenants(true).subscribe({
      next: tenants => {
        expect(Array.isArray(tenants)).toBeTrue();
        expect(tenants.length).toBeGreaterThan(0);
        done();
      },
      error: done.fail
    });
  });
});
