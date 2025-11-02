import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { TenantService } from '../../../../services/tenant.service';
import { CommunicationService } from '../../../../services/communication.service';
import { DashboardOverviewComponent } from '../dashboard-overview/dashboard-overview.component';
import { ChatComponent } from '../../../../shared/chat/chat.component';


@Component({
  selector: 'app-tenant-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    RouterOutlet,
    DashboardOverviewComponent,
    ChatComponent
  ],
  templateUrl: './tenant-dashboard.component.html',
  styleUrls: ['./tenant-dashboard.component.scss']
})
export class TenantDashboardComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'dashboard';

  currentUser: any = null;
  userDisplayName: string = 'Tenant';
  userRole: string = 'Tenant';
  profileImage: string | null = null;

  dashboardData: any = null;
  isLoadingDashboard: boolean = false;
  dashboardError: string | null = null;

  unreadNotificationsCount: number = 0;
  unreadMessagesCount: number = 0;
  isLoadingNotifications: boolean = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;
  private communicationSubscriptions = new Subscription();
  private notificationSummarySubscription: Subscription | null = null;

  greeting: string = '';
  currentTime: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private tenantService: TenantService,
    private dialog: MatDialog,
    private communicationService: CommunicationService
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
    this.notificationSummarySubscription?.unsubscribe();
    this.communicationSubscriptions.unsubscribe();
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
      this.userDisplayName = this.currentUser.fullName || 
                           this.currentUser.email?.split('@')[0] || 
                           'Tenant';
      
      this.userRole = this.formatUserRole(this.currentUser.role);
      this.loadProfileImage();
    } else {
      this.userDisplayName = 'Tenant';
      this.userRole = 'Tenant';
      this.profileImage = this.generateInitialAvatar('Tenant');
    }
  }

  loadDashboardData(): void {
    this.isLoadingDashboard = true;
    this.dashboardError = null;

    this.tenantService.getTenantDashboardData().subscribe({
      next: (tenantData: any) => {
        if (tenantData.success && tenantData.data) {
          this.processDashboardData(tenantData.data);
        } else {
          this.dashboardError = 'Failed to load tenant data';
        }
        this.isLoadingDashboard = false;
      },
      error: (error) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        console.error('Dashboard data error:', error);
      }
    });
  }

  private processDashboardData(tenantData: any): void {
    this.dashboardData = {
      currentRent: tenantData.currentRent || 25000,
      paymentStatus: tenantData.paymentStatus || 'Current',
      daysUntilDue: tenantData.daysUntilDue || 15,
      openMaintenance: tenantData.openMaintenance || 0,
      leaseEndDays: tenantData.leaseEndDays || 120,
      propertyAddress: tenantData.propertyAddress || '123 Main Street, Nairobi',
      landlordName: tenantData.landlordName || 'John Doe',
      depositAmount: tenantData.depositAmount || 50000
    };
  }

  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    this.notificationSummarySubscription?.unsubscribe();

    this.notificationSummarySubscription = this.communicationService.watchNotificationSummary().subscribe({
      next: summary => {
        this.unreadNotificationsCount = summary.unreadNotifications;
        this.unreadMessagesCount = summary.unreadMessages;
        this.isLoadingNotifications = false;
      },
      error: () => {
        this.unreadNotificationsCount = 0;
        this.unreadMessagesCount = 0;
        this.isLoadingNotifications = false;
      }
    });

    if (this.notificationSummarySubscription) {
      this.communicationSubscriptions.add(this.notificationSummarySubscription);
    }
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/notifications']);
  }

  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/profile/view']);
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/profile/edit']);
  }

  navigateToChat(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/chat']);
  }

  private loadProfileImage(): void {
    const savedImage = localStorage.getItem('profileImage');
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
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner',
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
      'dashboard': ['/tenant-dashboard'],
      'rental': ['/tenant-dashboard/rental'],
      'payments': ['/tenant-dashboard/payments'],
      'maintenance': ['/tenant-dashboard/maintenance'],
      'documents': ['/tenant-dashboard/documents'],
      'messages': ['/tenant-dashboard/messages'],
      'chat': ['/tenant-dashboard/chat'],
      'deposit': ['/tenant-dashboard/deposit'],
      'profile': ['/tenant-dashboard/profile/view']
    };

    const route = routeMap[section];
    if (route) {
      this.router.navigate(route);
    } else {
      this.router.navigate(['/tenant-dashboard']);
    }
  }

  private updateCurrentSectionFromRoute(url: string): void {
    if (url.includes('/profile/view') || url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url === '/tenant-dashboard' || url === '/tenant-dashboard/') {
      this.currentSection = 'dashboard';
    } else if (url.includes('/rental')) {
      this.currentSection = 'rental';
    } else if (url.includes('/payments')) {
      this.currentSection = 'payments';
    } else if (url.includes('/maintenance')) {
      this.currentSection = 'maintenance';
    } else if (url.includes('/documents')) {
      this.currentSection = 'documents';
    } else if (url.includes('/messages')) {
      this.currentSection = 'messages';
    } else if (url.includes('/chat')) {
      this.currentSection = 'chat';
    } else if (url.includes('/deposit')) {
      this.currentSection = 'deposit';
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
  }
}