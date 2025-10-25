import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../../services/auth.service';
import { AdminService } from '../../../../services/admin.service';
import { AdminOverviewComponent } from './components/admin-overview/admin-overview.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatMenuModule,
    RouterOutlet,
    AdminOverviewComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'overview';

  currentUser: any = null;
  userDisplayName: string = 'Admin';
  userRole: string = 'Administrator';
  profileImage: string | null = null;

  dashboardData: any = null;
  isLoadingDashboard: boolean = false;
  dashboardError: string | null = null;

  unreadNotificationsCount: number = 3;
  unreadMessagesCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  greeting: string = '';
  currentTime: string = '';

  constructor(
    public router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    console.log('🔄 AdminDashboardComponent ngOnInit started');
    
   
    this.createTemporaryAdminUser();
    
    this.loadDashboardData();
    this.loadNotifications();
    this.updateGreeting();
    
    setInterval(() => {
      this.updateGreeting();
    }, 60000);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      console.log(' Navigation ended:', event.urlAfterRedirects);
      this.updateCurrentSectionFromRoute(event.urlAfterRedirects);
      this.loadProfileImage();
    });

    this.updateCurrentSectionFromRoute(this.router.url);
    this.setupProfileUpdateListener();
    this.setupClickOutsideListener();
    
    console.log('AdminDashboardComponent fully initialized');
  }

  ngOnDestroy(): void {
    if (this.profileUpdateListener) {
      window.removeEventListener('profileImageUpdated', this.profileUpdateListener);
    }
    document.removeEventListener('click', this.handleClickOutside.bind(this));
  }

  private createTemporaryAdminUser(): void {
    console.warn('TEMPORARY: Creating mock admin user for development');
    
  
    this.currentUser = {
      id: 'temp-admin-1',
      email: 'admin@rentease.com',
      fullName: 'System Administrator',
      role: 'ADMIN',
      status: 'active',
      verified: true,
      emailVerified: true,
      phoneNumber: '+254700000000',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

   
    this.userDisplayName = this.currentUser.fullName;
    this.userRole = 'Administrator';
    this.profileImage = this.generateInitialAvatar(this.userDisplayName);

   
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userData', JSON.stringify(this.currentUser));
      sessionStorage.setItem('authToken', 'temp-admin-token-' + Date.now());
      localStorage.setItem('adminProfileImage', this.profileImage);
    }

    console.log(' Temporary admin user created:', this.currentUser);
  }

  private updateGreeting(): void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    this.currentTime = `${hours}:${minutes}`;
    
    if (hours < 12) {
      this.greeting = 'Good morning';
    } else if (hours < 18) {
      this.greeting = 'Good afternoon';
    } else {
      this.greeting = 'Good evening';
    }
  }

  getGreetingMessage(): string {
    return `${this.greeting}, Admin! 👋`;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    if (this.isProfileMenuOpen) {
      const target = event.target as HTMLElement;
      const profileSection = document.querySelector('.profile-section');
      
      if (profileSection && !profileSection.contains(target)) {
        this.closeProfileMenu();
      }
    }

    if (this.isMobileMenuOpen) {
      const target = event.target as HTMLElement;
      const sidebar = document.querySelector('.sidebar');
      const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
      
      if (sidebar && !sidebar.contains(target) && 
          mobileMenuBtn && !mobileMenuBtn.contains(target) &&
          target.classList.contains('mobile-menu-overlay')) {
        this.closeMobileMenu();
      }
    }
  }

  private setupClickOutsideListener(): void {
    document.addEventListener('click', this.handleClickOutside.bind(this));
  }

  private setupProfileUpdateListener(): void {
    this.profileUpdateListener = () => {
      this.loadProfileImage();
    };
    
    window.addEventListener('profileImageUpdated', this.profileUpdateListener);
  }

  loadDashboardData(): void {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    this.adminService.getDashboardStats().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.dashboardData = response.data;
          console.log(' Dashboard data loaded:', this.dashboardData);
        } else {
          this.dashboardError = 'Failed to load dashboard data';
          console.error(' Dashboard error:', this.dashboardError);
        }
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        console.error('Dashboard data error:', error);
        
      
        this.createMockDashboardData();
      }
    });
  }

  private createMockDashboardData(): void {
    console.warn('🚧 TEMPORARY: Creating mock dashboard data');
    this.dashboardData = {
      totalUsers: 1250,
      totalProperties: 89,
      activeBusinesses: 45,
      monthlyRevenue: 4250000,
      commissionRevenue: 425000,
      pendingApprovals: 12,
      activeDisputes: 8,
      userGrowth: 12.5,
      revenueGrowth: 18.3,
      propertiesGrowth: 8.7,
      totalLandlords: 56,
      totalTenants: 980,
      totalCaretakers: 24,
      totalAdmins: 5,
      platformEarnings: 1250000,
      systemHealth: 'excellent'
    };
    this.isLoadingDashboard = false;
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    setTimeout(() => {
      this.unreadNotificationsCount = 3;
      this.unreadMessagesCount = 0;
      this.isLoadingNotifications = false;
      console.log(' Notifications loaded');
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    console.log(' Navigating to notifications');
    this.router.navigate(['/admin-dashboard/notifications']);
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    console.log(' Navigating to profile view');
    this.router.navigate(['/admin-dashboard/profile/view']);
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    console.log(' Navigating to profile edit');
    this.router.navigate(['/admin-dashboard/profile/edit']);
  }

  private loadProfileImage(): void {
    const savedImage = localStorage.getItem('adminProfileImage');
    if (savedImage) {
      this.profileImage = this.addCacheBuster(savedImage);
    } else if (this.currentUser?.avatar) {
      this.profileImage = this.addCacheBuster(this.currentUser.avatar);
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
    
    const colors = ['#1e40af', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  }

  private formatUserRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'ADMIN': 'Administrator',
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner'
    };
    
    return roleMap[role.toString()] || role.toString();
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
    if (this.isProfileMenuOpen) {
      this.isMobileMenuOpen = false;
    }
    console.log(' Profile menu toggled:', this.isProfileMenuOpen);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (this.isMobileMenuOpen) {
      this.isProfileMenuOpen = false;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    console.log('Mobile menu toggled:', this.isMobileMenuOpen);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  navigateToSection(section: string): void {
    this.currentSection = section;
    this.isMobileMenuOpen = false;
    this.isProfileMenuOpen = false;
    document.body.style.overflow = '';

    const routeMap: { [key: string]: string[] } = {
      'overview': ['/admin-dashboard'],
      'users': ['/admin-dashboard/users'],
      'properties': ['/admin-dashboard/properties'],
      'businesses': ['/admin-dashboard/businesses'],
      'disputes': ['/admin-dashboard/disputes'],
      'transactions': ['/admin-dashboard/transactions'],
      'reports': ['/admin-dashboard/reports'],
      'settings': ['/admin-dashboard/settings'],
      'profile': ['/admin-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      console.log(' Navigating to section:', section, route);
      this.router.navigate(route);
    } else {
      this.router.navigate(['/admin-dashboard']);
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (url.includes('/profile/view') || url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url === '/admin-dashboard' || url === '/admin-dashboard/') {
      this.currentSection = 'overview';
    } else if (url.includes('/users')) {
      this.currentSection = 'users';
    } else if (url.includes('/properties')) {
      this.currentSection = 'properties';
    } else if (url.includes('/businesses')) {
      this.currentSection = 'businesses';
    } else if (url.includes('/disputes')) {
      this.currentSection = 'disputes';
    } else if (url.includes('/transactions')) {
      this.currentSection = 'transactions';
    } else if (url.includes('/reports')) {
      this.currentSection = 'reports';
    } else if (url.includes('/settings')) {
      this.currentSection = 'settings';
    } else {
      this.currentSection = 'overview';
    }
    console.log('Current section updated:', this.currentSection);
  }

  isNavActive(section: string): boolean {
    return this.currentSection === section;
  }

  logout(): void {
    if (this.isLoggingOut) return;

    const confirmed = confirm('Are you sure you want to logout?');
    if (!confirmed) return;

    this.isLoggingOut = true;
    this.closeProfileMenu();
    this.closeMobileMenu();

    console.log(' Admin logout initiated');
    
    
    this.isLoggingOut = false;
    localStorage.removeItem('adminProfileImage');
    sessionStorage.clear();
    this.router.navigate(['/']);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    if (window.innerWidth > 768 && this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  refreshDashboard(): void {
    console.log(' Refreshing dashboard data');
    this.loadDashboardData();
    this.loadNotifications();
  }

  onLogoError(event: any): void {
    console.error(' Logo failed to load:', event);
  }

  isOverviewPage(): boolean {
    return this.router.url === '/admin-dashboard' || this.router.url === '/admin-dashboard/';
  }
}