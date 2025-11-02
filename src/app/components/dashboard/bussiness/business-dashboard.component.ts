// business-dashboard.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { BusinessService } from '../../../services/business.service';

@Component({
  selector: 'app-business-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    RouterOutlet
  ],
  templateUrl: './business-dashboard.component.html',
  styleUrls: ['./business-dashboard.component.scss']
})
export class BusinessDashboardComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'dashboard';

  currentUser: any = null;
  userDisplayName: string = 'Business Owner';
  userRole: string = 'Business';
  profileImage: string | null = null;

  dashboardData: any = null;
  isLoadingDashboard: boolean = false;
  dashboardError: string | null = null;

  unreadNotificationsCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  greeting: string = '';
  currentTime: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private businessService: BusinessService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
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
    this.setupClickOutsideListener();
  }

  ngOnDestroy(): void {
    if (this.profileUpdateListener) {
      window.removeEventListener('profileImageUpdated', this.profileUpdateListener);
    }
    document.removeEventListener('click', this.handleClickOutside.bind(this));
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
    const firstName = this.userDisplayName.split(' ')[0];
    return `${this.greeting}, ${firstName}! 👋`;
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

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUser();
    
    if (this.currentUser) {
      this.userDisplayName = this.currentUser.businessName || 
                           this.currentUser.fullName || 
                           this.currentUser.email?.split('@')[0] || 
                           'Business Owner';
      
      this.userRole = this.formatUserRole(this.currentUser.role);
      this.loadProfileImage();
    } else {
      this.userDisplayName = 'Business Owner';
      this.userRole = 'Business';
      this.profileImage = this.generateInitialAvatar('Business');
    }
  }

  loadDashboardData(): void {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    this.businessService.getBusinessDashboardData().subscribe({
      next: (businessData: any) => {
        if (businessData.success && businessData.data) {
          this.processDashboardData(businessData.data);
        } else {
          this.dashboardError = 'Failed to load business data';
        }
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        console.error('Business dashboard data error:', error);
      }
    });
  }

  private processDashboardData(businessData: any): void {
    this.dashboardData = {
      totalAds: businessData.totalAds || 0,
      activeAds: businessData.activeAds || 0,
      pendingAds: businessData.pendingAds || 0,
      totalSpent: businessData.totalSpent || 0,
      totalClicks: businessData.totalClicks || 0,
      approvalRate: businessData.approvalRate || '0%',
      businessName: businessData.businessName || 'Your Business',
      registrationStatus: businessData.registrationStatus || 'Verified'
    };
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    setTimeout(() => {
      this.unreadNotificationsCount = 2; // Mock data
      this.isLoadingNotifications = false;
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/business-dashboard/notifications']);
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/business-dashboard/profile/view']);
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/business-dashboard/profile/edit']);
  }

  private loadProfileImage(): void {
    const savedImage = localStorage.getItem('businessProfileImage');
    if (savedImage) {
      this.profileImage = this.addCacheBuster(savedImage);
    } else if (this.currentUser?.logo) {
      this.profileImage = this.addCacheBuster(this.currentUser.logo);
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
      'BUSINESS': 'Business Owner',
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'ADMIN': 'Administrator'
    };
    
    return roleMap[role.toString()] || role.toString();
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
      'dashboard': ['/business-dashboard'],
      'ads': ['/business-dashboard/ads'],
      'create-ad': ['/business-dashboard/ads/create'],
      'analytics': ['/business-dashboard/analytics'],
      'billing': ['/business-dashboard/billing'],
      'documents': ['/business-dashboard/documents'],
      'messages': ['/business-dashboard/messages'],
      'profile': ['/business-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    } else {
      this.router.navigate(['/business-dashboard']);
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (url.includes('/profile/view') || url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url === '/business-dashboard' || url === '/business-dashboard/') {
      this.currentSection = 'dashboard';
    } else if (url.includes('/ads/create')) {
      this.currentSection = 'create-ad';
    } else if (url.includes('/ads')) {
      this.currentSection = 'ads';
    } else if (url.includes('/analytics')) {
      this.currentSection = 'analytics';
    } else if (url.includes('/billing')) {
      this.currentSection = 'billing';
    } else if (url.includes('/documents')) {
      this.currentSection = 'documents';
    } else if (url.includes('/messages')) {
      this.currentSection = 'messages';
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
        
        localStorage.removeItem('businessProfileImage');
        sessionStorage.clear();
        
        this.router.navigate(['/business-login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.isLoggingOut = false;
        
        localStorage.removeItem('businessProfileImage');
        sessionStorage.clear();
        this.router.navigate(['/business-login']);
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
  }
}
