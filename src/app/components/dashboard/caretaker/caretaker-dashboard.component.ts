import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { filter } from 'rxjs/operators';
import { CaretakerService, Property, Unit } from '../../../services/caretaker.service';
import { ProfilePictureService, UserProfile } from '../../../services/profile-picture.service';
import { AuthService } from '../../../services/auth.service';
// import { ProfilePictureComponent } from '../../../shared/components/profile-picture/profile-picture.component';

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
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    
  ],
  templateUrl: './caretaker-dashboard.component.html',
  styleUrls: ['./caretaker-dashboard.component.scss']
})
export class CaretakerDashboardComponent implements OnInit {
  isSidebarOpen = true;
  isMobile = false;
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'overview';
  userProfile: UserProfile | null = null;
  userRole: 'caretaker' | 'tenant' | 'landlord' | 'admin' | 'business' | 'user' = 'caretaker';
  loading: boolean = true;
  isLoggingOut: boolean = false;
  
  properties: Property[] = [];
  units: any = [];
  recentActivities: Activity[] = [];

  expandedMenus = {
    financials: false,
    properties: false,
    settings: false
  };

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

  profileImage: string | null = null;
  userDisplayName: string = 'Caretaker';
  private profileUpdateListener: any;

  constructor(
    private caretakerService: CaretakerService,
    private profilePictureService: ProfilePictureService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.checkMobileView();
    this.loadDashboardData();
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateCurrentSectionFromRoute(event.urlAfterRedirects);
    });

    this.updateCurrentSectionFromRoute(this.router.url);
    this.setupProfileUpdateListener();
  }

  ngOnDestroy(): void {
    if (this.profileUpdateListener) {
      window.removeEventListener('profileImageUpdated', this.profileUpdateListener);
    }
  }

  private setupProfileUpdateListener(): void {
    this.profileUpdateListener = () => {
      this.loadProfileImage();
    };
    
    window.addEventListener('profileImageUpdated', this.profileUpdateListener);
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'profileImage' || event.key === 'profileUpdated') {
        this.loadProfileImage();
      }
    });
  }

  private loadUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser) {
      this.userDisplayName = currentUser.fullName || 
                           currentUser.email?.split('@')[0] || 
                           'Caretaker';
      
      this.determineActualUserRole();
      this.loadProfileImage();
    } else {
      this.userDisplayName = 'Caretaker';
      this.userRole = 'caretaker';
      this.profileImage = this.generateInitialAvatar('Caretaker');
    }
  }

  private loadProfileImage(): void {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
      this.profileImage = this.addCacheBuster(savedImage);
    } else {
      this.profileImage = this.generateInitialAvatar(this.userDisplayName);
    }
  }

  private addCacheBuster(imageUrl: string): string {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}t=${Date.now()}`;
  }

  private generateInitialAvatar(name: string): string {
    const names = name.split(' ');
    const initials = names.map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2);
    
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="600">${initials}</text>
      </svg>
    `)}`;
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
    const propertiesArray = Array.isArray(this.properties) ? this.properties : 
                           (this.properties && Array.isArray((this.properties as any).data)) ? 
                           (this.properties as any).data : [];
    
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
    this.stats.activeDepositCases = 2;
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
      },
      {
        id: '4',
        type: 'deposit',
        title: 'Deposit Case Opened',
        details: 'Move-out inspection - Unit 3C',
        time: '2 days ago'
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

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  toggleMenu(menuName: keyof typeof this.expandedMenus): void {
    this.expandedMenus[menuName] = !this.expandedMenus[menuName];
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
    this.profileImage = imageUrl;
  }

  refreshData(): void {
    this.loadDashboardData();
    this.loadUserData();
  }

  logout(): void {
    if (this.isLoggingOut) return;

    const confirmed = confirm('Are you sure you want to logout?');
    if (!confirmed) return;

    this.isLoggingOut = true;
    this.closeProfileMenu();

    this.caretakerService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Logout error:', error);
        this.router.navigate(['/login']);
        this.isLoggingOut = false;
      }
    });
  }

  viewProfile(): void {
    this.router.navigate(['/caretaker-dashboard/profile']);
  }

  editProfile(): void {
    this.isProfileMenuOpen = false;
    this.router.navigate(['/caretaker-dashboard/profile/edit']);
  }

  navigateToSection(section: string): void {
    this.currentSection = section;
    this.isMobileMenuOpen = false;
    this.isProfileMenuOpen = false;

    switch (section) {
      case 'overview':
        this.router.navigate(['/caretaker-dashboard/overview']);
        break;
      case 'maintenance':
        this.router.navigate(['/caretaker-dashboard/maintenance']);
        break;
      case 'inspections':
        this.router.navigate(['/caretaker-dashboard/inspections']);
        break;
      case 'deposits':
        this.router.navigate(['/caretaker-dashboard/deposits']);
        break;
      case 'properties':
        this.router.navigate(['/caretaker-dashboard/properties']);
        break;
      case 'messages':
        this.router.navigate(['/caretaker-dashboard/messages']);
        break;
      case 'reports':
        this.router.navigate(['/caretaker-dashboard/reports']);
        break;
      case 'profile':
        this.router.navigate(['/caretaker-dashboard/profile']);
        break;
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (url.includes('/caretaker-dashboard/overview') || url === '/caretaker-dashboard') {
      this.currentSection = 'overview';
    } else if (url.includes('/maintenance')) {
      this.currentSection = 'maintenance';
    } else if (url.includes('/inspections')) {
      this.currentSection = 'inspections';
    } else if (url.includes('/deposits')) {
      this.currentSection = 'deposits';
    } else if (url.includes('/properties')) {
      this.currentSection = 'properties';
    } else if (url.includes('/messages')) {
      this.currentSection = 'messages';
    } else if (url.includes('/reports')) {
      this.currentSection = 'reports';
    } else if (url.includes('/profile')) {
      this.currentSection = 'profile';
    } else {
      const urlParts = url.split('/');
      this.currentSection = urlParts[urlParts.length - 1] || 'overview';
    }
  }

  isNavActive(section: string): boolean {
    return this.currentSection === section;
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