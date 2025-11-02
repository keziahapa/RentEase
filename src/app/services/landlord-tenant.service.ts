import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';

import { PropertyService } from './property.service';
import { Property, Unit } from './dashboard-interface';

export type TenantStatus = 'active' | 'endingSoon' | 'overdue';

export interface LandlordTenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  propertyLocation?: string;
  unitId?: string;
  unitNumber?: string;
  rentAmount?: number;
  depositAmount?: number;
  outstandingBalance?: number;
  leaseStart?: string;
  leaseEnd?: string;
  lastPaymentDate?: string;
  status: TenantStatus;
}

export interface LandlordTenantSummary {
  totalTenants: number;
  activeLeases: number;
  leasesEndingSoon: number;
  overdueTenants: number;
  averageMonthlyRent: number;
  occupancyRate: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalUnits: number;
  updatedAt: string;
}

interface TenantsExtractionResult {
  tenants: LandlordTenant[];
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
}

@Injectable({
  providedIn: 'root'
})
export class LandlordTenantService {
  private readonly propertyService = inject(PropertyService);

  private readonly fallbackTenants: LandlordTenant[] = [
    {
      id: 'tenant-1',
      name: 'Amina Njoroge',
      email: 'amina.njoroge@example.com',
      phone: '+254 700 123 456',
      propertyId: 'property-1',
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
      email: 'brian.kamau@example.com',
      phone: '+254 711 987 654',
      propertyId: 'property-2',
      propertyName: 'Skyview Towers',
      propertyLocation: 'Westlands',
      unitId: 'unit-8',
      unitNumber: 'Penthouse 8A',
      rentAmount: 95000,
      depositAmount: 120000,
      outstandingBalance: 18000,
      leaseStart: '2022-11-15',
      leaseEnd: '2024-11-14',
      lastPaymentDate: '2024-01-05T11:30:00Z',
      status: 'overdue'
    },
    {
      id: 'tenant-3',
      name: 'Diana Wambui',
      email: 'diana.wambui@example.com',
      phone: '+254 720 555 010',
      propertyId: 'property-1',
      propertyName: 'Greenwood Apartments',
      propertyLocation: 'Nairobi',
      unitId: 'unit-4',
      unitNumber: 'A-04',
      rentAmount: 48000,
      depositAmount: 48000,
      outstandingBalance: 0,
      leaseStart: '2023-03-01',
      leaseEnd: '2024-04-30',
      lastPaymentDate: '2024-02-03T08:45:00Z',
      status: 'endingSoon'
    }
  ];

  private tenantsCache: LandlordTenant[] = this.cloneTenants(this.fallbackTenants);
  private totalsCache = { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0 };

  private tenantsSubject = new BehaviorSubject<LandlordTenant[]>(this.cloneTenants(this.tenantsCache));
  private summarySubject = new BehaviorSubject<LandlordTenantSummary>(this.computeSummary(this.tenantsCache, this.totalsCache));
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  watchTenants(): Observable<LandlordTenant[]> {
    return this.tenantsSubject.asObservable();
  }

  watchSummary(): Observable<LandlordTenantSummary> {
    return this.summarySubject.asObservable();
  }

  watchLoading(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  watchError(): Observable<string | null> {
    return this.errorSubject.asObservable();
  }

  refreshTenants(force = false): Observable<LandlordTenant[]> {
    if (!force && this.tenantsCache.length > 0) {
      return of(this.cloneTenants(this.tenantsCache));
    }

    return this.loadTenantsFromApi();
  }

  private loadTenantsFromApi(): Observable<LandlordTenant[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let properties$!: Observable<Property[]>;

    try {
      properties$ = this.propertyService.getProperties() as Observable<Property[]>;
    } catch (error) {
      return this.handleFallback('load landlord properties', error);
    }

    return properties$.pipe(
      switchMap(properties => {
        if (!properties || properties.length === 0) {
          this.setTenants([], { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0 });
          return of<LandlordTenant[]>([]);
        }

        const propertyLoaders = properties.map(property => this.extractPropertyTenants(property));

        return forkJoin(propertyLoaders).pipe(
          map(results => {
            const aggregated = results.reduce(
              (acc, result) => {
                acc.tenants.push(...result.tenants);
                acc.totalUnits += result.totalUnits;
                acc.occupiedUnits += result.occupiedUnits;
                acc.vacantUnits += result.vacantUnits;
                return acc;
              },
              { tenants: [] as LandlordTenant[], totalUnits: 0, occupiedUnits: 0, vacantUnits: 0 }
            );

            this.setTenants(aggregated.tenants, {
              totalUnits: aggregated.totalUnits,
              occupiedUnits: aggregated.occupiedUnits,
              vacantUnits: aggregated.vacantUnits
            });

            return this.cloneTenants(aggregated.tenants);
          })
        );
      }),
      catchError(error => this.handleFallback('load landlord tenants', error)),
      finalize(() => this.loadingSubject.next(false))
    );
  }

  private extractPropertyTenants(property: Property | any): Observable<TenantsExtractionResult> {
    const normalizedProperty = this.normalizeProperty(property);
    const propertyUnits = this.normalizeUnits(property?.units);

    if (propertyUnits.length > 0) {
      return of(this.transformUnitsToTenants(propertyUnits, normalizedProperty));
    }

    let units$!: Observable<Unit[]>;
    try {
      units$ = this.propertyService.getPropertyUnits(normalizedProperty.id);
    } catch (error) {
      return this.handleExtractionFallback(`load units for property ${normalizedProperty.id}`, error);
    }

    return units$.pipe(
      map(units => this.transformUnitsToTenants(this.normalizeUnits(units), normalizedProperty)),
      catchError(error => this.handleExtractionFallback(`load units for property ${normalizedProperty.id}`, error))
    );
  }

  private transformUnitsToTenants(units: Unit[], property: { id: string; name: string; location?: string }): TenantsExtractionResult {
    if (!Array.isArray(units) || units.length === 0) {
      return { tenants: [], totalUnits: 0, occupiedUnits: 0, vacantUnits: 0 };
    }

    const tenants: LandlordTenant[] = [];
    let occupiedUnits = 0;
    let vacantUnits = 0;

    units.forEach(unit => {
      const tenantDetails = this.normalizeUnitTenant(unit);
      if (tenantDetails) {
        occupiedUnits += 1;
        tenants.push({
          id: tenantDetails.id,
          name: tenantDetails.name,
          email: tenantDetails.email,
          phone: tenantDetails.phone,
          propertyId: property.id,
          propertyName: property.name,
          propertyLocation: property.location,
          unitId: tenantDetails.unitId ?? this.asString(unit?.id),
          unitNumber:
            tenantDetails.unitNumber ??
            unit?.unitNumber ??
            this.asString((unit as any)?.name ?? (unit as any)?.label ?? ''),
          rentAmount: tenantDetails.rentAmount ?? unit?.rentAmount,
          depositAmount: tenantDetails.depositAmount ?? unit?.deposit,
          outstandingBalance: tenantDetails.outstandingBalance,
          leaseStart: tenantDetails.leaseStart,
          leaseEnd: tenantDetails.leaseEnd,
          lastPaymentDate: tenantDetails.lastPaymentDate,
          status: this.determineTenantStatus(tenantDetails)
        });
      } else {
        vacantUnits += 1;
      }
    });

    return {
      tenants,
      totalUnits: units.length,
      occupiedUnits,
      vacantUnits
    };
  }

  private normalizeUnitTenant(unit: Unit | any): (Partial<LandlordTenant> & { id: string; name: string }) | null {
    const tenant = unit?.tenant ?? unit?.currentTenant ?? unit?.occupant ?? unit?.tenantInfo ?? null;
    if (!tenant) {
      return null;
    }

    const id =
      this.asString(tenant.id) ||
      this.asString(tenant.tenantId) ||
      this.asString(tenant.uuid) ||
      tenant.email ||
      this.asString(unit?.tenantId) ||
      this.asString(unit?.tenantEmail);

    const name =
      tenant.name ||
      [tenant.firstName, tenant.lastName].filter(Boolean).join(' ').trim() ||
      tenant.fullName ||
      tenant.displayName ||
      this.asString(unit?.tenantName);

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      email: tenant.email ?? unit?.tenantEmail,
      phone: tenant.phone ?? tenant.phoneNumber ?? unit?.tenantPhone,
      rentAmount: this.toNumber(unit?.rentAmount ?? unit?.rent ?? tenant.rentAmount ?? tenant.monthlyRent),
      depositAmount: this.toNumber(unit?.deposit ?? tenant.deposit),
      outstandingBalance: this.toNumber(
        unit?.outstandingBalance ?? tenant.outstandingBalance ?? tenant.balance ?? tenant.amountDue ?? 0
      ),
      leaseStart: tenant.leaseStart ?? tenant.leaseStartDate ?? unit?.leaseStart ?? unit?.leaseStartDate,
      leaseEnd: tenant.leaseEnd ?? tenant.leaseEndDate ?? unit?.leaseEnd ?? unit?.leaseEndDate,
      lastPaymentDate: tenant.lastPaymentDate ?? unit?.lastPaymentDate ?? tenant.lastPayment?.date,
      unitId: this.asString(unit?.id),
      unitNumber: unit?.unitNumber ?? unit?.name ?? unit?.label
    };
  }

  private determineTenantStatus(tenant: Partial<LandlordTenant> & { outstandingBalance?: number; leaseEnd?: string }): TenantStatus {
    if ((tenant.outstandingBalance ?? 0) > 0) {
      return 'overdue';
    }

    if (tenant.leaseEnd) {
      const daysRemaining = this.daysBetween(new Date(), new Date(tenant.leaseEnd));
      if (!Number.isNaN(daysRemaining) && daysRemaining <= 45) {
        return 'endingSoon';
      }
    }

    return 'active';
  }

  private normalizeProperty(property: Property | any): { id: string; name: string; location?: string } {
    const id =
      this.asString(property?.id) ||
      this.asString(property?._id) ||
      this.asString(property?.propertyId) ||
      this.asString(property?.uuid) ||
      '';

    const name = property?.name || property?.propertyName || `Property ${id || ''}`.trim();
    const location = property?.location || property?.address || property?.area;

    return { id, name, location };
  }

  private normalizeUnits(units: Unit[] | any): Unit[] {
    if (!Array.isArray(units)) {
      return [];
    }
    return units.filter(unit => !!unit);
  }

  private setTenants(tenants: LandlordTenant[], totals: { totalUnits: number; occupiedUnits: number; vacantUnits: number }): void {
    this.tenantsCache = this.cloneTenants(tenants);
    this.totalsCache = { ...totals };
    this.tenantsSubject.next(this.cloneTenants(tenants));
    this.summarySubject.next(this.computeSummary(tenants, totals));
  }

  private computeSummary(
    tenants: LandlordTenant[],
    totals: { totalUnits: number; occupiedUnits: number; vacantUnits: number }
  ): LandlordTenantSummary {
    const activeLeases = tenants.filter(tenant => tenant.status === 'active').length;
    const leasesEndingSoon = tenants.filter(tenant => tenant.status === 'endingSoon').length;
    const overdueTenants = tenants.filter(tenant => tenant.status === 'overdue').length;
    const averageMonthlyRent =
      tenants.length > 0
        ? Math.round(
            tenants
              .map(tenant => tenant.rentAmount ?? 0)
              .filter(amount => amount > 0)
              .reduce((acc, amount) => acc + amount, 0) / tenants.length
          )
        : 0;

    const totalUnits = totals.totalUnits;
    const occupiedUnits = totals.occupiedUnits;
    const vacancyUnits = totals.vacantUnits;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    return {
      totalTenants: tenants.length,
      activeLeases,
      leasesEndingSoon,
      overdueTenants,
      averageMonthlyRent,
      occupancyRate,
      occupiedUnits,
      vacantUnits: vacancyUnits,
      totalUnits,
      updatedAt: new Date().toISOString()
    };
  }

  private handleFallback(context: string, error: unknown): Observable<LandlordTenant[]> {
    if (!this.shouldFallback(error)) {
      this.loadingSubject.next(false);
      this.errorSubject.next(this.extractErrorMessage(error) ?? 'Failed to load tenants.');
      return throwError(() => error);
    }

    const message = this.extractErrorMessage(error);
    this.logFallback(context, error);
    this.loadingSubject.next(false);
    this.errorSubject.next(message ?? 'Showing cached tenant data.');
    const tenants = this.cloneTenants(this.tenantsCache.length ? this.tenantsCache : this.fallbackTenants);
    const totals =
      this.totalsCache.totalUnits || this.tenantsCache.length
        ? this.totalsCache
        : { totalUnits: tenants.length, occupiedUnits: tenants.length, vacantUnits: 0 };
    this.setTenants(tenants, totals);
    return of(tenants);
  }

  private handleExtractionFallback(context: string, error: unknown): Observable<TenantsExtractionResult> {
    if (!this.shouldFallback(error)) {
      return throwError(() => error);
    }

    this.logFallback(context, error);
    return of({
      tenants: [],
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0
    });
  }

  private cloneTenants(tenants: LandlordTenant[]): LandlordTenant[] {
    return tenants.map(tenant => ({ ...tenant }));
  }

  private shouldFallback(error: unknown): boolean {
    if (!error) {
      return true;
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0 || error.status >= 500 || error.status === 404) {
        return true;
      }
      return false;
    }

    const status = (error as any)?.status;
    if (typeof status === 'number') {
      return status === 0 || status >= 500 || status === 404;
    }

    return true;
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || null;
    }

    if (typeof error === 'object' && error !== null) {
      return (error as any).message ?? null;
    }

    return null;
  }

  private logFallback(context: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`[LandlordTenantService] Falling back for ${context}:`, error);
  }

  private asString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private toNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private daysBetween(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
  }
}
