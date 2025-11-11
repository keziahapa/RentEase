import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
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
import { BusinessManagementComponent } from './components/business-management/business-management.component';
import { AdvertisementManagementComponent } from './components/advertisement-management/advertisement-management.component';

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
    AdminOverviewComponent,
    BusinessManagementComponent,
    AdvertisementManagementComponent,
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

  unreadNotificationsCount: number = 0;
  unreadMessagesCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  greeting: string = '';
  currentTime: string = '';

 
  public authService = inject(AuthService);
  public router = inject(Router); 
  private adminService = inject(AdminService);
  private dialog = inject(MatDialog);


  showOverviewDirectly = false;
  hasRouterContentFlag = false;

  ngOnInit(): void {
    console.log(' Admin Dashboard - Checking authentication...');
    

    this.currentUser = this.authService.getCurrentUser();
    console.log(' Current user:', this.currentUser);
    console.log(' User role:', this.currentUser?.role);
    console.log(' Is admin?', this.authService.isAdmin());
    console.log(' Is authenticated?', this.authService.isAuthenticated());
    
   
    const token = this.authService.getToken();
    console.log(' Token exists?', !!token);
    
    if (token) {
      this.authService.debugToken();
    }

    
    if (!this.authService.isAdmin()) {
      console.error(' ACCESS DENIED: User is not an admin');
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      this.loadUserData();
      this.loadNotifications();
      this.updateGreeting();
      
      setInterval(() => {
        this.updateGreeting();
      }, 60000);

      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        console.log(' Route changed to:', event.url);
        this.updateCurrentSectionFromRoute(event.urlAfterRedirects);
        this.loadProfileImage();
      });

      this.updateCurrentSectionFromRoute(this.router.url);
      this.setupProfileUpdateListener();
    } catch (error) {
      console.error(' Error initializing admin dashboard:', error);
    }
  }

  
  testAdminAccess() {
    console.log('🔧 Testing admin access...');
    
    
    const testAdminUser = {
      id: 1,
      email: 'admin@test.com',
      fullName: 'Test Admin',
      role: 'ADMIN'
    };
    
    localStorage.setItem('userData', JSON.stringify(testAdminUser));
    localStorage.setItem('authToken', 'test-token-' + Date.now());
    
    console.log('🔧 Test admin user set');
    this.loadUserData();
    
   
    this.router.navigate(['/admin-dashboard']).then(() => {
      window.location.reload();
    });
  }

  
  debugStorage() {
    console.log(' Local Storage:', {
      userData: localStorage.getItem('userData'),
      authToken: localStorage.getItem('authToken'),
      userRole: this.authService.getCurrentUser()?.role
    });
  }

  forceShowOverview() {
    console.log(' Forcing overview to show directly');
    this.showOverviewDirectly = true;
    this.currentSection = 'overview';
  }


  hasRouterContent(): boolean {
   
    const outlet = document.querySelector('router-outlet');
    return outlet ? outlet.children.length > 0 : false;
  }

  ngOnDestroy(): void {
    if (this.profileUpdateListener) {
      window.removeEventListener('profileImageUpdated', this.profileUpdateListener);
    }
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
    const firstName = this.userDisplayName.split(' ')[0] || 'Admin';
    return `${this.greeting}, ${firstName}! `;
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
          mobileMenuBtn && !mobileMenuBtn.contains(target)) {
        this.closeMobileMenu();
      }
    }
  }

  private setupProfileUpdateListener(): void {
    this.profileUpdateListener = () => {
      this.loadProfileImage();
    };
    
    window.addEventListener('profileImageUpdated', this.profileUpdateListener);
  }

  private loadUserData(): void {
    try {
      this.currentUser = this.authService.getCurrentUser();
      
      if (this.currentUser) {
        this.userDisplayName = this.currentUser.fullName || 
                             this.currentUser.email?.split('@')[0] || 
                             'Admin';
        
        this.userRole = this.formatUserRole(this.currentUser.role);
        this.loadProfileImage();
      } else {
        console.warn(' No current user found');
        this.userDisplayName = 'Admin';
        this.userRole = 'Administrator';
        this.profileImage = this.generateInitialAvatar('Admin');
      }
    } catch (error) {
      console.error(' Error loading user data:', error);
      this.userDisplayName = 'Admin';
      this.userRole = 'Administrator';
    }
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    setTimeout(() => {
      this.unreadNotificationsCount = 0;
      this.unreadMessagesCount = 0;
      this.isLoadingNotifications = false;
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/admin-dashboard/notifications']).catch(() => {
      console.warn('Notifications route not available');
    });
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/admin-dashboard/profile/view']).catch(() => {
      this.router.navigate(['/admin-dashboard']);
    });
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/admin-dashboard/profile/edit']).catch(() => {
      this.router.navigate(['/admin-dashboard/profile/view']);
    });
  }

  private loadProfileImage(): void {
    try {
      const savedImage = localStorage.getItem('profileImage');
      if (savedImage) {
        this.profileImage = this.addCacheBuster(savedImage);
      } else if (this.currentUser?.avatar) {
        this.profileImage = this.addCacheBuster(this.currentUser.avatar);
      } else {
        this.profileImage = this.generateInitialAvatar(this.userDisplayName);
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
      this.profileImage = this.generateInitialAvatar(this.userDisplayName);
    }
  }

  private addCacheBuster(imageUrl: string): string {
    if (!imageUrl || imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}t=${Date.now()}`;
  }

  private generateInitialAvatar(name: string): string {
    try {
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
    } catch (error) {
      console.error('Error generating avatar:', error);
      return '';
    }
  }

  private formatUserRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'ADMIN': 'Administrator',
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner'
    };
    
    return roleMap[role?.toString()] || role?.toString() || 'Administrator';
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
    if (this.isProfileMenuOpen) {
      this.isMobileMenuOpen = false;
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (this.isMobileMenuOpen) {
      this.isProfileMenuOpen = false;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
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
      'overview': ['/admin-dashboard/overview'], 
      'users': ['/admin-dashboard/users'],
      'properties': ['/admin-dashboard/properties'],
      'businesses': ['/admin-dashboard/businesses'],
      'advertisements': ['/admin-dashboard/advertisements'],
      'disputes': ['/admin-dashboard/disputes'],
      'transactions': ['/admin-dashboard/transactions'],
      'reports': ['/admin-dashboard/reports'],
      'settings': ['/admin-dashboard/settings'],
      'profile': ['/admin-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route).catch(() => {
        console.warn(`Route ${section} not available, redirecting to overview`);
        this.router.navigate(['/admin-dashboard/overview']);
      });
    } else {
      this.router.navigate(['/admin-dashboard/overview']);
    }
  }

  
  private updateCurrentSectionFromRoute(url: string): void {
    if (!url) {
      this.currentSection = 'overview';
      return;
    }

    if (url.includes('/profile/view') || url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url.includes('/overview') || url === '/admin-dashboard' || url === '/admin-dashboard/') {
      this.currentSection = 'overview';
    } else if (url.includes('/users')) {
      this.currentSection = 'users';
    } else if (url.includes('/properties')) {
      this.currentSection = 'properties';
    } else if (url.includes('/businesses')) {
      this.currentSection = 'businesses';
    } else if (url.includes('/advertisements')) {
      this.currentSection = 'advertisements';
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

    this.authService.logout().subscribe({
      next: (response: any) => {
        console.log('Logout successful:', response.message);
        this.isLoggingOut = false;
        
        localStorage.removeItem('profileImage');
        sessionStorage.clear();
        
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.isLoggingOut = false;
        
        localStorage.removeItem('profileImage');
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    if (window.innerWidth > 768 && this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  refreshDashboard(): void {
    this.loadNotifications();
  }

  onLogoError(event: any): void {
    console.error('Logo failed to load:', event);
    this.profileImage = this.generateInitialAvatar(this.userDisplayName);
  }

  
  isOverviewPage(): boolean {
    return this.router.url.includes('/overview') || 
           this.router.url === '/admin-dashboard' || 
           this.router.url === '/admin-dashboard/';
  }
}