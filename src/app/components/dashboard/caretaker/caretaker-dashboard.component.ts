import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { CaretakerService, Property, Unit } from '../../../services/caretaker.service';
import { ProfilePictureService, UserProfile } from '../../../services/profile-picture.service';
import { AuthService } from '../../../services/auth.service';
import { ProfilePictureComponent } from '../../../shared/components/profile-picture/profile-picture.component';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export interface Stats {
  pendingMaintenance: number;
  scheduledInspections: number;
  activeDepositCases: number;
  completedJobs: number;
  responseRate: number;
  tenantSatisfaction: number;
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

export interface Activity {
  id: string;
  type: 'maintenance' | 'inspection' | 'deposit' | 'message';
  title: string;
  details: string;
  time: string;
  propertyId?: number;
  unitId?: number;
}

@Component({
  selector: 'app-caretaker-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    ProfilePictureComponent
  ],
  templateUrl: './caretaker-dashboard.component.html',
  styleUrls: ['./caretaker-dashboard.component.scss']
})
export class CaretakerDashboardComponent implements OnInit {
  isSidebarOpen = true;
  isMobile = false;
  isMobileMenuOpen = false;
  userProfile: UserProfile | null = null;
  userRole: 'caretaker' | 'tenant' | 'landlord' | 'admin' | 'business' | 'user' = 'caretaker';
  loading: boolean = true;
  
  properties: Property[] = [];
  units: any = []; // Changed to any to handle both array and object responses
  recentActivities: Activity[] = [];

  navItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard', route: '/caretaker-dashboard/overview' },
    { id: 'maintenance', label: 'Maintenance', icon: 'build', route: '/caretaker-dashboard/maintenance' },
    { id: 'inspections', label: 'Inspections', icon: 'home', route: '/caretaker-dashboard/inspections' },
    { id: 'deposits', label: 'Deposits', icon: 'account_balance', route: '/caretaker-dashboard/deposits' },
    { id: 'properties', label: 'Properties', icon: 'apartment', route: '/caretaker-dashboard/properties' },
    { id: 'messages', label: 'Messages', icon: 'chat', route: '/caretaker-dashboard/messages' },
    { id: 'reports', label: 'Reports', icon: 'assessment', route: '/caretaker-dashboard/reports' },
    { id: 'profile', label: 'Profile', icon: 'person', route: '/caretaker-dashboard/profile' }
  ];

  stats: Stats = {
    pendingMaintenance: 0,
    scheduledInspections: 0,
    activeDepositCases: 0,
    completedJobs: 0,
    responseRate: 0,
    tenantSatisfaction: 0,
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0
  };

  quickActions: QuickAction[] = [
    { 
      id: 'newMaintenance', 
      title: 'New Maintenance', 
      description: 'Create maintenance request', 
      icon: 'add_task', 
      color: '#007bff', 
      route: '/caretaker-dashboard/maintenance'
    },
    { 
      id: 'scheduleInspection', 
      title: 'Schedule Inspection', 
      description: 'Schedule property inspection', 
      icon: 'calendar_today', 
      color: '#28a745', 
      route: '/caretaker-dashboard/inspections'
    },
    { 
      id: 'processDeposit', 
      title: 'Process Deposit', 
      description: 'Handle deposit release', 
      icon: 'payments', 
      color: '#ff6b35', 
      route: '/caretaker-dashboard/deposits'
    },
    { 
      id: 'contactTenant', 
      title: 'Contact Tenant', 
      description: 'Message tenant', 
      icon: 'message', 
      color: '#6f42c1', 
      route: '/caretaker-dashboard/messages'
    }
  ];

  constructor(
    private caretakerService: CaretakerService,
    private profilePictureService: ProfilePictureService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.checkMobileView();
    this.loadDashboardData();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkMobileView();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    Promise.all([
      this.loadProperties(),
      this.loadUnits()
    ]).then(() => {
      this.calculateStatistics();
      this.generateRecentActivities();
      this.loading = false;
    }).catch(error => {
      console.error('Error loading dashboard data:', error);
      this.calculateStatistics();
      this.generateRecentActivities();
      this.loading = false;
    });
  }

  loadProperties(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.caretakerService.getProperties().subscribe({
        next: (response) => {
          // Handle both array response and object with data property
          if (Array.isArray(response)) {
            this.properties = response;
          } else if (response && Array.isArray((response as any).data)) {
            this.properties = (response as any).data;
          } else {
            this.properties = [];
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading properties:', error);
          this.properties = [];
          resolve();
        }
      });
    });
  }

  loadUnits(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.caretakerService.getAllUnits().subscribe({
        next: (response) => {
          // Handle both array response and object with data property
          if (Array.isArray(response)) {
            this.units = response;
          } else if (response && Array.isArray((response as any).data)) {
            this.units = (response as any).data;
          } else {
            this.units = [];
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading units:', error);
          this.units = [];
          resolve();
        }
      });
    });
  }

  calculateStatistics(): void {
    // Handle properties data structure
    const propertiesArray = Array.isArray(this.properties) ? this.properties : 
                           (this.properties && Array.isArray((this.properties as any).data)) ? 
                           (this.properties as any).data : [];
    
    // Handle units data structure
    const unitsArray = Array.isArray(this.units) ? this.units : 
                      (this.units && Array.isArray((this.units as any).data)) ? 
                      (this.units as any).data : [];
    
    this.stats.totalProperties = propertiesArray.length;
    this.stats.totalUnits = unitsArray.length;
    this.stats.occupiedUnits = unitsArray.filter((unit: Unit) => unit.isOccupied).length;
    this.stats.vacantUnits = this.stats.totalUnits - this.stats.occupiedUnits;
    
    // Mock data for other stats
    this.stats.pendingMaintenance = 5;
    this.stats.scheduledInspections = 3;
    this.stats.completedJobs = 12;
    this.stats.responseRate = 92;
    this.stats.tenantSatisfaction = 4.5;
  }

  generateRecentActivities(): void {
    this.recentActivities = [
      {
        id: '1',
        type: 'maintenance',
        title: 'Maintenance Request Submitted',
        details: 'Kitchen sink leakage - Unit 4B',
        time: '2 hours ago'
      },
      {
        id: '2',
        type: 'inspection',
        title: 'Inspection Completed',
        details: 'Routine check - Block A',
        time: '5 hours ago'
      },
      {
        id: '3',
        type: 'maintenance',
        title: 'Maintenance Completed',
        details: 'AC repair - Unit 2A',
        time: '1 day ago'
      }
    ];
  }

  checkMobileView(): void {
    this.isMobile = window.innerWidth <= 768;
    if (!this.isMobile) {
      this.isMobileMenuOpen = false;
      this.isSidebarOpen = true;
    } else {
      this.isSidebarOpen = false;
    }
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    } else {
      this.isSidebarOpen = !this.isSidebarOpen;
    }
  }

  closeMobileMenu(): void {
    if (this.isMobile) {
      this.isMobileMenuOpen = false;
    }
  }

  loadUserProfile(): void {
    this.profilePictureService.getCurrentUserProfile().subscribe({
      next: (profile) => {
        this.userProfile = profile;
        this.determineActualUserRole();
      },
      error: (error) => {
        console.error('Failed to load user profile:', error);
        this.determineActualUserRole();
        this.userProfile = {
          id: 'unknown',
          fullName: this.getRoleDisplay(),
          email: '',
          role: this.userRole,
          verified: false,
          emailVerified: false
        };
      }
    });
  }

  private determineActualUserRole(): void {
    if (this.authService.isTenant()) {
      this.userRole = 'tenant';
    } else if (this.authService.isCaretaker()) {
      this.userRole = 'caretaker';
    } else if (this.authService.isLandlord()) {
      this.userRole = 'landlord';
    } else if (this.authService.isBusiness()) {
      this.userRole = 'business';
    } else if (this.authService.isAdmin()) {
      this.userRole = 'admin';
    } else {
      this.userRole = 'caretaker';
    }

    if (this.userProfile) {
      this.userProfile = {
        ...this.userProfile,
        role: this.userRole
      };
    }
  }

  getRoleDisplay(): string {
    const roleMap: { [key: string]: string } = {
      'landlord': 'Landlord',
      'tenant': 'Tenant',
      'caretaker': 'Caretaker',
      'admin': 'Administrator',
      'business': 'Business',
      'user': 'User'
    };
    return roleMap[this.userRole] || 'Caretaker';
  }

  getRoleColor(): string {
    const colorMap: { [key: string]: string } = {
      'landlord': '#ff6b35',
      'tenant': '#4CAF50',
      'caretaker': '#2196F3',
      'admin': '#9C27B0',
      'business': '#FF9800',
      'user': '#666'
    };
    return colorMap[this.userRole] || '#2196F3';
  }

  onPictureUpdated(imageUrl: string): void {
    if (this.userProfile) {
      this.userProfile.profilePicture = imageUrl;
    }
  }

  onPictureDeleted(): void {
    if (this.userProfile) {
      this.userProfile.profilePicture = undefined;
    }
  }

  refreshData(): void {
    this.loadDashboardData();
    this.loadUserProfile();
  }

  logout(): void {
    this.caretakerService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Logout error:', error);
        this.router.navigate(['/login']);
      }
    });
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-KE');
  }

  formatCurrency(amount: number): string {
    return `KSH ${amount.toLocaleString('en-KE')}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}