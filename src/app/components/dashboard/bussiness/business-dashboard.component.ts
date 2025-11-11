import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { BusinessService } from '../../../services/business.service';

interface DashboardStats {
  totalAds: number;
  activeAds: number;
  pendingAds: number;
  totalSpent: number;
  totalClicks: number;
  totalViews: number;
  approvalRate: string;
  businessName: string;
  registrationStatus: string;
}

interface Advertisement {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'COMPLETED' | 'APPROVED';
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  budget: number;
  spent: number;
  clicks: number;
  views: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  rejectionReason?: string;
}

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
  isVerified: boolean = false;
  isCheckingVerification: boolean = false;

  currentUser: any = null;
  userDisplayName: string = 'Business Owner';
  userRole: string = 'Business';
  profileImage: string | null = null;

  dashboardData: DashboardStats | null = null;
  isLoadingDashboard: boolean = false;
  dashboardError: string | null = null;

  advertisements: Advertisement[] = [];

  unreadNotificationsCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  greeting: string = '';
  currentTime: string = '';

  private router = inject(Router);
  private authService = inject(AuthService);
  private businessService = inject(BusinessService);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    this.loadUserData();
    this.checkBusinessVerification();
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
  }

  ngOnDestroy(): void {
    if (this.profileUpdateListener) {
      window.removeEventListener('profileImageUpdated', this.profileUpdateListener);
    }
  }

  private checkBusinessVerification(): void {
    this.isCheckingVerification = true;
    
    this.businessService.isBusinessVerified().subscribe({
      next: (approved) => {
        this.isVerified = approved;
        this.isCheckingVerification = false;
        
        if (!approved) {
          this.router.navigate(['/business/registration-status']);
        }
      },
      error: (error) => {
        this.isVerified = false;
        this.isCheckingVerification = false;
        this.router.navigate(['/business/registration-status']);
      }
    });
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

    this.businessService.getAdvertisements().subscribe({
      next: (response: any) => {
        let ads: Advertisement[] = [];
        
        if (Array.isArray(response)) {
          ads = response;
        } else if (response?.data && Array.isArray(response.data)) {
          ads = response.data;
        } else if (response?.success && response.data && Array.isArray(response.data)) {
          ads = response.data;
        } else if (response?.advertisements && Array.isArray(response.advertisements)) {
          ads = response.advertisements;
        } else if (response?.content && Array.isArray(response.content)) {
          ads = response.content;
        } else {
          this.dashboardError = 'Unexpected data format received';
          this.setDefaultDashboardData();
          this.isLoadingDashboard = false;
          return;
        }

        this.advertisements = ads;
        this.calculateDashboardStats(ads);
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.setDefaultDashboardData();
        this.isLoadingDashboard = false;
      }
    });
  }

  private calculateDashboardStats(ads: Advertisement[]): void {
    const totalAds = ads.length;
    
    const activeAds = ads.filter(ad => 
      ad.status === 'ACTIVE' || ad.status === 'APPROVED'
    ).length;
    
    const pendingAds = ads.filter(ad => 
      ad.status === 'PENDING'
    ).length;
    
    const totalSpent = ads.reduce((sum, ad) => sum + (this.parseNumber(ad.spent) || 0), 0);
    const totalClicks = ads.reduce((sum, ad) => sum + (this.parseNumber(ad.clicks) || 0), 0);
    const totalViews = ads.reduce((sum, ad) => sum + (this.parseNumber(ad.views) || 0), 0);
    
    const approvedAds = ads.filter(ad => 
      ad.status === 'ACTIVE' || ad.status === 'APPROVED' || ad.status === 'COMPLETED'
    ).length;
    
    const approvalRate = totalAds > 0 ? Math.round((approvedAds / totalAds) * 100) : 0;

    this.dashboardData = {
      totalAds,
      activeAds,
      pendingAds,
      totalSpent,
      totalClicks,
      totalViews,
      approvalRate: `${approvalRate}%`,
      businessName: this.userDisplayName,
      registrationStatus: 'Verified'
    };
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private setDefaultDashboardData(): void {
    this.dashboardData = {
      totalAds: 0,
      activeAds: 0,
      pendingAds: 0,
      totalSpent: 0,
      totalClicks: 0,
      totalViews: 0,
      approvalRate: '0%',
      businessName: this.userDisplayName,
      registrationStatus: 'Verified'
    };
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    setTimeout(() => {
      const pendingAdsCount = this.advertisements.filter(ad => 
        ad.status === 'PENDING'
      ).length;
      
      this.unreadNotificationsCount = pendingAdsCount;
      this.isLoadingNotifications = false;
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/business-dashboard/ads'], { 
      queryParams: { status: 'PENDING' } 
    });
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/business-dashboard/profile']);
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
    
    return roleMap[role?.toString()] || role?.toString() || 'Business';
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
      'analytics': ['/business-dashboard/analytics'],
      'billing': ['/business-dashboard/billing'],
      'documents': ['/business-dashboard/documents'],
      'messages': ['/business-dashboard/messages'],
      'profile': ['/business-dashboard/profile']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    } else {
      this.router.navigate(['/business-dashboard']);
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (url.includes('/profile')) {
      this.currentSection = 'profile';
    } else if (url === '/business-dashboard' || url === '/business-dashboard/') {
      this.currentSection = 'dashboard';
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
        this.isLoggingOut = false;
        localStorage.removeItem('businessProfileImage');
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isLoggingOut = false;
        localStorage.removeItem('businessProfileImage');
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
    this.profileImage = this.generateInitialAvatar(this.userDisplayName);
  }

  getTotalAds(): number {
    return this.dashboardData?.totalAds || 0;
  }

  getActiveAds(): number {
    return this.dashboardData?.activeAds || 0;
  }

  getPendingAds(): number {
    return this.dashboardData?.pendingAds || 0;
  }

  getTotalSpent(): number {
    return this.dashboardData?.totalSpent || 0;
  }

  getTotalClicks(): number {
    return this.dashboardData?.totalClicks || 0;
  }

  getTotalViews(): number {
    return this.dashboardData?.totalViews || 0;
  }

  getApprovalRate(): string {
    return this.dashboardData?.approvalRate || '0%';
  }
}