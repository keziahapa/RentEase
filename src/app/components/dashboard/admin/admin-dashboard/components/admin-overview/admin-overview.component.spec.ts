import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { AdminOverviewComponent } from './admin-overview.component';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { ApiResponse, AdminStats } from '../../../../../../services/admin-interfaces';

class AdminDataServiceStub {
  private dashboardSubject = new Subject<ApiResponse<AdminStats>>();

  getDashboardStats() {
    return this.dashboardSubject.asObservable();
  }

  emitDashboard(response: ApiResponse<AdminStats>) {
    this.dashboardSubject.next(response);
    this.dashboardSubject.complete();
  }
}

class RouterStub {
  navigate(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class SnackBarStub {
  open(): void {}
}

class DialogStub {}

describe('AdminOverviewComponent skeleton states', () => {
  let serviceStub: AdminDataServiceStub;

  beforeEach(async () => {
    serviceStub = new AdminDataServiceStub();

    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [
        { provide: AdminDataService, useValue: serviceStub },
        { provide: Router, useClass: RouterStub },
        { provide: MatSnackBar, useClass: SnackBarStub },
        { provide: MatDialog, useClass: DialogStub }
      ]
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(AdminOverviewComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('displays the dashboard skeleton while stats are loading', () => {
    const { fixture } = createComponent();

    const component = fixture.componentInstance;
    component.isLoadingDashboard = true;
    fixture.detectChanges();

    const skeleton = fixture.debugElement.query(By.css('.overview-skeleton'));
    expect(skeleton).toBeTruthy();
  });

  it('hides the dashboard skeleton after stats load', () => {
    const { fixture } = createComponent();

    const stats: AdminStats = {
      totalUsers: 10,
      totalProperties: 5,
      activeBusinesses: 2,
      monthlyRevenue: 1000,
      commissionRevenue: 100,
      pendingApprovals: 1,
      activeDisputes: 0,
      userGrowth: 1,
      revenueGrowth: 1,
      propertiesGrowth: 1,
      totalLandlords: 2,
      totalTenants: 6,
      totalCaretakers: 2,
      totalBusinesses: 2,
      totalAdmins: 1,
      platformEarnings: 200,
      systemHealth: 'operational',
      monthlyActiveUsers: 8,
      totalTransactions: 20,
      averageRating: 4.5,
      newUsersToday: 1,
      newPropertiesThisWeek: 1,
      occupancyRate: 90,
      rentCollectionRate: 95,
      maintenanceCompletionRate: 90,
      disputeResolutionRate: 80,
      reportedIssuesThisWeek: 1,
      topPerformingZones: ['Zone A']
    };

    serviceStub.emitDashboard({ success: true, data: stats });
    fixture.detectChanges();

    const skeleton = fixture.debugElement.query(By.css('.overview-skeleton'));
    expect(skeleton).toBeNull();
  });
});
