import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { TenantDashboardComponent } from './tenant-dashboard.component';
import { AuthService } from '../../../../services/auth.service';
import { TenantService } from '../../../../services/tenant.service';
import { CommunicationService } from '../../../../services/communication.service';

class MockAuthService {
  getCurrentUser() {
    return { fullName: 'Test Tenant', email: 'tenant@example.com', role: 'TENANT' };
  }

  getToken() {
    return 'mock-token';
  }
}

class MockTenantService {
  getTenantDashboardData() {
    return of({ success: true, data: {} });
  }
}

class MockCommunicationService {
  getNotificationSummary() {
    return of({ unreadNotifications: 0, unreadMessages: 0 });
  }
}

describe('TenantDashboardComponent', () => {
  let component: TenantDashboardComponent;
  let fixture: ComponentFixture<TenantDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: MockAuthService },
        { provide: TenantService, useClass: MockTenantService },
        { provide: CommunicationService, useClass: MockCommunicationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
