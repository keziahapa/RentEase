import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import {
  MaintenanceComponent
} from './maintenance.component';
import {
  MaintenanceRequest,
  MaintenanceService,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
  UrgencyLevel
} from '../../../../services/maintenance.service';

class MaintenanceServiceStub {
  private maintenanceStream = new BehaviorSubject<MaintenanceRequest[]>([]);
  private tenantRequestSubject = new Subject<MaintenanceRequest[]>();

  maintenanceRequestsChanges$ = this.maintenanceStream.asObservable();

  getTenantMaintenanceRequests(): Observable<MaintenanceRequest[]> {
    return this.tenantRequestSubject.asObservable();
  }

  submitTenantMaintenanceRequest(): Observable<MaintenanceRequest> {
    const mockRequest: MaintenanceRequest = {
      id: 'mock-1',
      title: 'Test issue',
      category: MaintenanceCategory.CLEANING,
      priority: MaintenancePriority.MEDIUM,
      status: MaintenanceStatus.SUBMITTED,
      description: 'Fixture generated request',
      urgencyLevel: UrgencyLevel.MEDIUM,
      location: 'Unit 1',
      dateSubmitted: new Date().toISOString(),
      tenantName: 'Test Tenant',
      propertyName: 'Property'
    } as MaintenanceRequest;

    this.maintenanceStream.next([mockRequest]);
    return of(mockRequest);
  }

  updateCaretakerMaintenanceRequest(): Observable<MaintenanceRequest> {
    return of({} as MaintenanceRequest);
  }

  emitTenantRequests(requests: MaintenanceRequest[]): void {
    this.maintenanceStream.next(requests);
    this.tenantRequestSubject.next(requests);
    this.tenantRequestSubject.complete();
  }
}

describe('Tenant MaintenanceComponent skeleton states', () => {
  let serviceStub: MaintenanceServiceStub;

  beforeEach(async () => {
    serviceStub = new MaintenanceServiceStub();

    await TestBed.configureTestingModule({
      imports: [MaintenanceComponent],
      providers: [{ provide: MaintenanceService, useValue: serviceStub }]
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(MaintenanceComponent);
    const component = fixture.componentInstance;
    component.collapsedSections = new Set();
    component.animatingSections = new Set();
    fixture.detectChanges();
    return { fixture, component };
  }

  it('shows the skeleton loader while maintenance requests are loading', () => {
    const { fixture, component } = createComponent();

    component.isLoadingRequests = true;
    fixture.detectChanges();

    const skeletonElement = fixture.debugElement.query(By.css('.maintenance-skeleton'));
    expect(skeletonElement).toBeTruthy();
  });

  it('hides the skeleton loader once maintenance requests resolve', () => {
    const { fixture } = createComponent();

    serviceStub.emitTenantRequests([]);
    fixture.detectChanges();

    const skeletonElement = fixture.debugElement.query(By.css('.maintenance-skeleton'));
    expect(skeletonElement).toBeNull();
  });
});
