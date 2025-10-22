import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PropertyService } from '../../../../../services/property.service';
import { AuthService } from '../../../../../services/auth.service';
import { Subscription } from 'rxjs';

interface DashboardData {
  totalProperties: number;
  occupancyRate: number;
  monthlyRevenue: number;
  rentCollectionRate: number;
  openMaintenance: number;
}

@Component({
  selector: 'app-landlord-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './landlord-dashboard-home.component.html',
  styleUrls: ['./landlord-dashboard-home.component.scss']
})
export class LandlordDashboardHomeComponent implements OnInit, OnDestroy {
  dashboardData: DashboardData = {
    totalProperties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    rentCollectionRate: 0,
    openMaintenance: 0
  };

  isLoadingDashboard = true;
  dashboardError = '';
  private subscriptions = new Subscription();

  constructor(
    private propertyService: PropertyService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDashboardData() {
    this.isLoadingDashboard = true;
    this.dashboardError = '';

    const propertiesSub = this.propertyService.getProperties().subscribe({
      next: (response: any) => {
        let properties: any[] = [];
        
        if (Array.isArray(response)) {
          properties = response;
        } else if (response?.data && Array.isArray(response.data)) {
          properties = response.data;
        } else if (response?.properties && Array.isArray(response.properties)) {
          properties = response.properties;
        } else if (response?.content && Array.isArray(response.content)) {
          properties = response.content;
        } else if (response?.success && Array.isArray(response.data)) {
          properties = response.data;
        } else {
          properties = [];
        }

        this.processDashboardData(properties);
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.isLoadingDashboard = false;
        this.dashboardError = error?.message || 'Failed to load dashboard data';
        this.snackBar.open(this.dashboardError, 'Close', { duration: 5000 });
        
        if (error.status === 401) {
          setTimeout(() => {
            this.authService.logout().subscribe();
            this.router.navigate(['/login']);
          }, 2000);
        }
      }
    });

    this.subscriptions.add(propertiesSub);
  }

  private processDashboardData(properties: any[]): void {
    const totalProperties = properties.length;
    let totalUnits = 0;
    let occupiedUnits = 0;
    let monthlyRevenue = 0;
    let openMaintenance = 0;

    properties.forEach(property => {
      if (property.units && Array.isArray(property.units)) {
        totalUnits += property.units.length;
        
        property.units.forEach((unit: any) => {
          if (unit.status === 'occupied') {
            occupiedUnits++;
            monthlyRevenue += unit.rentAmount || 0;
          } else if (unit.status === 'maintenance') {
            openMaintenance++;
          }
        });
      }
    });

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const rentCollectionRate = monthlyRevenue > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    this.dashboardData = {
      totalProperties,
      occupancyRate,
      monthlyRevenue,
      rentCollectionRate,
      openMaintenance
    };
  }

  navigateToSection(section: string) {
    const routeMap: { [key: string]: string[] } = {
      'properties': ['/landlord-dashboard/property'],
      'tenants': ['/landlord-dashboard/tenants'],
      'financials': ['/landlord-dashboard/financials'],
      'maintenance': ['/landlord-dashboard/maintenance']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    }
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.snackBar.open('Refreshing dashboard...', 'Close', { duration: 2000 });
  }
}