import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, Subject, combineLatest } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { RouterModule } from '@angular/router';

import {
  LandlordTenantService,
  LandlordTenant,
  LandlordTenantSummary
} from '../../../../../services/landlord-tenant.service';
import { SkeletonListComponent } from '../../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-landlord-tenants',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTableModule,
    MatTooltipModule,
    RouterModule,
    SkeletonListComponent
  ],
  templateUrl: './tenants.html',
  styleUrls: ['./tenants.scss']
})
export class LandlordTenantsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly subscriptions = new Subscription();

  tenants: LandlordTenant[] = [];
  filteredTenants: LandlordTenant[] = [];
  summary: LandlordTenantSummary | null = null;

  isLoading = false;
  isRefreshing = false;
  errorMessage: string | null = null;

  searchControl = new FormControl<string>('', { nonNullable: true });
  propertyControl = new FormControl<string>('all', { nonNullable: true });
  statusControl = new FormControl<string>('all', { nonNullable: true });

  propertyOptions: Array<{ id: string; name: string }> = [];
  displayedColumns: string[] = ['tenant', 'property', 'lease', 'rent', 'status', 'actions'];

  constructor(private readonly tenantService: LandlordTenantService) {}

  ngOnInit(): void {
    this.tenantService.watchLoading().pipe(takeUntil(this.destroy$)).subscribe(isLoading => {
      this.isLoading = isLoading;
    });

    this.tenantService.watchError().pipe(takeUntil(this.destroy$)).subscribe(error => {
      this.errorMessage = error;
    });

    this.tenantService.watchSummary().pipe(takeUntil(this.destroy$)).subscribe(summary => {
      this.summary = summary;
    });

    const tenantsSub = combineLatest([
      this.tenantService.watchTenants(),
      this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
      this.propertyControl.valueChanges.pipe(startWith(this.propertyControl.value)),
      this.statusControl.valueChanges.pipe(startWith(this.statusControl.value))
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([tenants, searchTerm, propertyFilter, statusFilter]) => {
        this.tenants = tenants;
        this.computePropertyOptions(tenants);
        this.filteredTenants = this.applyFilters(tenants, searchTerm, propertyFilter, statusFilter);
      });

    this.subscriptions.add(tenantsSub);

    this.refreshTenants(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
  }

  refreshTenants(force = false): void {
    this.isRefreshing = true;
    const refreshSub = this.tenantService.refreshTenants(force).subscribe({
      next: () => {
        this.isRefreshing = false;
      },
      error: error => {
        this.isRefreshing = false;
        this.errorMessage = error?.message || 'Unable to refresh tenants right now.';
      }
    });

    this.subscriptions.add(refreshSub);
  }

  clearSearch(): void {
    if (this.searchControl.value) {
      this.searchControl.setValue('');
    }
  }

  hasFiltersApplied(): boolean {
    return this.propertyControl.value !== 'all' || this.statusControl.value !== 'all' || !!this.searchControl.value;
  }

  resetFilters(): void {
    this.searchControl.setValue('');
    this.propertyControl.setValue('all');
    this.statusControl.setValue('all');
  }

  statusChipClass(status: string): string {
    switch (status) {
      case 'overdue':
        return 'status-overdue';
      case 'endingSoon':
        return 'status-ending';
      default:
        return 'status-active';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'overdue':
        return 'Overdue';
      case 'endingSoon':
        return 'Ending soon';
      default:
        return 'Active';
    }
  }

  lastUpdatedMessage(): string | null {
    if (!this.summary?.updatedAt) {
      return null;
    }

    const updatedDate = new Date(this.summary.updatedAt);
    if (Number.isNaN(updatedDate.getTime())) {
      return null;
    }

    return `Last updated ${updatedDate.toLocaleString()}`;
  }

  private applyFilters(
    tenants: LandlordTenant[],
    searchTerm: string,
    propertyFilter: string,
    statusFilter: string
  ): LandlordTenant[] {
    const query = (searchTerm || '').trim().toLowerCase();
    const property = propertyFilter || 'all';
    const status = statusFilter || 'all';

    return tenants.filter(tenant => {
      const matchesSearch =
        !query ||
        tenant.name.toLowerCase().includes(query) ||
        (tenant.email?.toLowerCase().includes(query) ?? false) ||
        (tenant.unitNumber?.toLowerCase().includes(query) ?? false) ||
        (tenant.propertyName?.toLowerCase().includes(query) ?? false);

      const matchesProperty = property === 'all' || tenant.propertyId === property;
      const matchesStatus = status === 'all' || tenant.status === status;

      return matchesSearch && matchesProperty && matchesStatus;
    });
  }

  private computePropertyOptions(tenants: LandlordTenant[]): void {
    const unique = new Map<string, string>();
    tenants.forEach(tenant => {
      if (tenant.propertyId && tenant.propertyName) {
        unique.set(tenant.propertyId, tenant.propertyName);
      }
    });
    this.propertyOptions = Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }
}
