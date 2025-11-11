import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../../services/auth.service';
import { PropertyService } from '../../../../services/property.service';

@Component({
  selector: 'app-landlord-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    RouterOutlet
  ],
  templateUrl: './landlord-dashboard.component.html',
  styleUrls: ['./landlord-dashboard.component.scss']
})
export class LandlordDashboardComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'dashboard';

  currentUser: any = null;
  userDisplayName: string = 'User';
  userRole: string = 'Landlord';
  profileImage: string | null = null;

  dashboardData: any = null;
  isLoadingDashboard: boolean = false;
  dashboardError: string | null = null;

  unreadNotificationsCount: number = 0;
  unreadMessagesCount: number = 0;
  unreadMoveOutCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  greeting: string = '';
  currentTime: string = '';

  private router = inject(Router);
  private authService = inject(AuthService);
  private propertyService = inject(PropertyService);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    try {
      this.loadUserData();
      this.loadDashboardData();
      this.loadNotifications();
      this.updateGreeting();
      
      setInterval(() => {
        this.updateGreeting();
      }, 60000);

      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.updateCurrentSectionFromRoute(event.urlAfterRedirects);
        this.loadProfileImage();
      });

      this.updateCurrentSectionFromRoute(this.router.url);
      this.setupProfileUpdateListener();
    } catch (error) {
      console.error('Error initializing landlord dashboard:', error);
    }
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
    const firstName = this.userDisplayName.split(' ')[0] || 'User';
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
                             'User';
        
        this.userRole = this.formatUserRole(this.currentUser.role);
        this.loadProfileImage();
      } else {
        this.userDisplayName = 'User';
        this.userRole = 'Landlord';
        this.profileImage = this.generateInitialAvatar('User');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      this.userDisplayName = 'User';
      this.userRole = 'Landlord';
    }
  }

  loadDashboardData(): void {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    this.propertyService.getProperties().subscribe({
      next: (propertiesResponse: any) => {
        try {
          if (propertiesResponse?.success && propertiesResponse.data) {
            this.processDashboardData(propertiesResponse.data);
          } else {
            this.dashboardError = 'Failed to load property data';
            this.dashboardData = this.getDefaultDashboardData();
          }
        } catch (error) {
          console.error('Error processing dashboard data:', error);
          this.dashboardError = 'Error processing data';
          this.dashboardData = this.getDefaultDashboardData();
        }
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.dashboardData = this.getDefaultDashboardData();
        this.isLoadingDashboard = false;
        console.error('Dashboard data error:', error);
      }
    });
  }

  private getDefaultDashboardData(): any {
    return {
      totalProperties: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      occupancyRate: 0,
      monthlyRevenue: 0,
      rentCollectionRate: 0,
      openMaintenance: 0,
      activeTenants: 0,
      pendingMoveOutNotices: 0,
      upcomingMoveOuts: 0
    };
  }

  private processDashboardData(properties: any[]): void {
    const totalProperties = properties?.length || 0;
    let totalUnits = 0;
    let occupiedUnits = 0;
    let vacantUnits = 0;
    let monthlyRevenue = 0;
    let openMaintenance = 0;

    if (properties && Array.isArray(properties)) {
      properties.forEach(property => {
        if (property.units && Array.isArray(property.units)) {
          totalUnits += property.units.length;
          
          property.units.forEach((unit: any) => {
            if (unit.status === 'occupied') {
              occupiedUnits++;
              monthlyRevenue += unit.rentAmount || 0;
            } else if (unit.status === 'vacant') {
              vacantUnits++;
            } else if (unit.status === 'maintenance') {
              openMaintenance++;
            }
          });
        }
      });
    }

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const rentCollectionRate = monthlyRevenue > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    this.dashboardData = {
      totalProperties,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      monthlyRevenue,
      rentCollectionRate,
      openMaintenance,
      activeTenants: occupiedUnits,
      pendingMoveOutNotices: 0,
      upcomingMoveOuts: 0
    };

    this.loadMoveOutData();
  }

  private loadMoveOutData(): void {
    this.propertyService.getLandlordMoveOutNotices(1, 10, 'PENDING').subscribe({
      next: (response: any) => {
        if (response.success) {
          const pendingNotices = Array.isArray(response.data) ? response.data.length : 0;
          this.dashboardData.pendingMoveOutNotices = pendingNotices;
          this.unreadMoveOutCount = pendingNotices;
        }
      },
      error: (error) => {
        console.error('Error loading move-out data:', error);
      }
    });
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    setTimeout(() => {
      this.unreadNotificationsCount = 3;
      this.unreadMessagesCount = 2;
      this.isLoadingNotifications = false;
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard']).catch(() => {
      console.warn('Notifications route not available');
    });
  }

  viewMoveOutNotices(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/move-out-notices']).catch(() => {
      this.router.navigate(['/landlord-dashboard']);
    });
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/profile/view']).catch(() => {
      this.router.navigate(['/landlord-dashboard']);
    });
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/profile/edit']).catch(() => {
      this.router.navigate(['/landlord-dashboard/profile/view']);
    });
  }

  navigateToChat(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/chat']).catch(() => {
      console.warn('Chat route not available, redirecting to dashboard');
      this.router.navigate(['/landlord-dashboard']);
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
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner',
      'ADMIN': 'Administrator'
    };
    
    return roleMap[role?.toString()] || role?.toString() || 'User';
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
      'dashboard': ['/landlord-dashboard'],
      'properties': ['/landlord-dashboard/property'],
      'tenants': ['/landlord-dashboard/tenants'],
      'financials': ['/landlord-dashboard/financials'],
      'maintenance': ['/landlord-dashboard/maintenance'],
      'messages': ['/landlord-dashboard/messages'],
      'chat': ['/landlord-dashboard/chat'],
      'marketplace': ['/landlord-dashboard/marketplace'],
      'move-out': ['/landlord-dashboard/move-out-notices'],
      'profile': ['/landlord-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route).catch(() => {
        console.warn(`Route ${section} not available, redirecting to dashboard`);
        this.router.navigate(['/landlord-dashboard']);
      });
    } else {
      this.router.navigate(['/landlord-dashboard']);
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (!url) {
      this.currentSection = 'dashboard';
      return;
    }

    if (url.includes('/profile/view') || url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url === '/landlord-dashboard' || url === '/landlord-dashboard/') {
      this.currentSection = 'dashboard';
    } else if (url.includes('/property')) {
      this.currentSection = 'properties';
    } else if (url.includes('/tenants')) {
      this.currentSection = 'tenants';
    } else if (url.includes('/financials')) {
      this.currentSection = 'financials';
    } else if (url.includes('/maintenance')) {
      this.currentSection = 'maintenance';
    } else if (url.includes('/messages')) {
      this.currentSection = 'messages';
    } else if (url.includes('/chat')) {
      this.currentSection = 'chat';
    } else if (url.includes('/marketplace')) {
      this.currentSection = 'marketplace';
    } else if (url.includes('/move-out-notices')) {
      this.currentSection = 'move-out';
    } else {
      this.currentSection = 'dashboard';
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
    this.loadDashboardData();
    this.loadNotifications();
  }

  onLogoError(event: any): void {
    console.error('Logo failed to load:', event);
    this.profileImage = this.generateInitialAvatar(this.userDisplayName);
  }

  hasPendingMoveOuts(): boolean {
    return this.unreadMoveOutCount > 0;
  }
}