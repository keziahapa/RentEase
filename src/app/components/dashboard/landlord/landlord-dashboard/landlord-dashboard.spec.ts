import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LandlordDashboardComponent } from './landlord-dashboard';
import { AuthService } from '../../../../services/auth.service';
import { PropertyService } from '../../../../services/property.service';

class MockAuthService {
  getCurrentUser() {
    return { fullName: 'Landlord User', email: 'landlord@example.com', role: 'LANDLORD' };
  }

  getToken() {
    return 'mock-token';
  }
}

class MockPropertyService {
  getProperties() {
    return of({ success: true, data: [] });
  }

  getLandlordDashboardData() {
    return of({ success: true, data: {} });
  }
}

describe('LandlordDashboard', () => {
  let component: LandlordDashboardComponent;
  let fixture: ComponentFixture<LandlordDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandlordDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: MockAuthService },
        { provide: PropertyService, useClass: MockPropertyService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LandlordDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
