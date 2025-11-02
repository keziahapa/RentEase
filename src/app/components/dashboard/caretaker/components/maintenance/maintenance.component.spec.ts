import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { MaintenanceComponent } from './maintenance.component';
import {
  MaintenanceRequest,
  MaintenanceService,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
  UrgencyLevel
} from '../../../../../services/maintenance.service';

class CaretakerMaintenanceServiceStub {
  private maintenanceStream = new BehaviorSubject<MaintenanceRequest[]>([]);
  private caretakerRequestSubject = new Subject<MaintenanceRequest[]>();

  maintenanceRequestsChanges$ = this.maintenanceStream.asObservable();

  getCaretakerMaintenanceRequests(): Observable<MaintenanceRequest[]> {
    return this.caretakerRequestSubject.asObservable();
  }

  updateCaretakerMaintenanceRequest(): Observable<MaintenanceRequest> {
    return of({} as MaintenanceRequest);
  }

  emitCaretakerRequests(requests: MaintenanceRequest[]): void {
    this.maintenanceStream.next(requests);
    this.caretakerRequestSubject.next(requests);
    this.caretakerRequestSubject.complete();
  }
}

describe('Caretaker MaintenanceComponent skeleton states', () => {
  let serviceStub: CaretakerMaintenanceServiceStub;

  beforeEach(async () => {
    serviceStub = new CaretakerMaintenanceServiceStub();

    await TestBed.configureTestingModule({
      imports: [MaintenanceComponent],
      providers: [{ provide: MaintenanceService, useValue: serviceStub }]
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(MaintenanceComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('renders the caretaker skeleton list while data is loading', () => {
    const { fixture } = createComponent();

    const component = fixture.componentInstance;
    component.isLoading = true;
    fixture.detectChanges();

    const skeletonElement = fixture.debugElement.query(By.css('.maintenance-skeleton'));
    expect(skeletonElement).toBeTruthy();
  });

  it('removes the skeleton list once caretaker data is available', () => {
    const { fixture } = createComponent();

    const mockRequest: MaintenanceRequest = {
      id: 'req-1',
      title: 'Check leak',
      category: MaintenanceCategory.PLUMBING,
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.SUBMITTED,
      urgencyLevel: UrgencyLevel.HIGH,
      description: 'Caretaker test request',
      location: 'Unit 3',
      dateSubmitted: new Date().toISOString()
    } as MaintenanceRequest;

    serviceStub.emitCaretakerRequests([mockRequest]);
    fixture.detectChanges();

    const skeletonElement = fixture.debugElement.query(By.css('.maintenance-skeleton'));
    expect(skeletonElement).toBeNull();
  });
});
