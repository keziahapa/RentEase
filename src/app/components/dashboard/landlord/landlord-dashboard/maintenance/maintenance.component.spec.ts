import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { LandlordMaintenanceComponent } from './maintenance.component';
import {
  MaintenanceService,
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority
} from '../../../../../services/maintenance.service';

class MockMaintenanceService {
  private readonly subject = new Subject<MaintenanceRequest[]>();
  maintenanceRequestsChanges$ = this.subject.asObservable();

  emit(requests: MaintenanceRequest[]): void {
    this.subject.next(requests);
  }

  getLandlordMaintenanceRequests() {
    return of([]);
  }
}

describe('LandlordMaintenanceComponent', () => {
  let component: LandlordMaintenanceComponent;
  let fixture: ComponentFixture<LandlordMaintenanceComponent>;
  let maintenanceService: MockMaintenanceService;

  const sampleRequests: MaintenanceRequest[] = [
    {
      id: 'req-1',
      title: 'Fix leaking sink',
      category: null as any,
      priority: MaintenancePriority.HIGH,
      description: 'Kitchen sink leaking under the cabinet',
      status: MaintenanceStatus.IN_PROGRESS,
      urgencyLevel: null as any,
      location: 'Unit B-4',
      dateSubmitted: '2024-02-18',
      tenantName: 'Amina Njoroge',
      propertyName: 'Greenwood Gardens'
    },
    {
      id: 'req-2',
      title: 'Replace stair light',
      category: null as any,
      priority: MaintenancePriority.LOW,
      description: 'Staircase light flickers occasionally',
      status: MaintenanceStatus.SUBMITTED,
      urgencyLevel: null as any,
      location: 'Block C common area',
      dateSubmitted: '2024-02-19',
      tenantName: 'Brian Kamau',
      propertyName: 'Skyview Towers'
    }
  ];

  beforeEach(async () => {
    maintenanceService = new MockMaintenanceService();

    await TestBed.configureTestingModule({
      imports: [LandlordMaintenanceComponent],
      providers: [{ provide: MaintenanceService, useValue: maintenanceService }]
    }).compileComponents();

    fixture = TestBed.createComponent(LandlordMaintenanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('filters maintenance requests by status', () => {
    maintenanceService.emit(sampleRequests);
    fixture.detectChanges();

    expect(component.filteredRequests.length).toBe(2);

    component.statusControl.setValue(MaintenanceStatus.IN_PROGRESS);
    fixture.detectChanges();

    expect(component.filteredRequests.length).toBe(1);
    expect(component.filteredRequests[0].id).toBe('req-1');
  });

  it('computes summary metrics', () => {
    maintenanceService.emit(sampleRequests);
    fixture.detectChanges();

    expect(component.summary.open).toBeGreaterThan(0);
  });
});

