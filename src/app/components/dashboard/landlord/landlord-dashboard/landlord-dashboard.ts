import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../../services/auth.service';
import { User, UserRole } from '../../../../services/auth-interfaces';

@Component({
  selector: 'app-landlord-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    RouterOutlet,
  ],
  templateUrl: './landlord-dashboard.html',
  styleUrls: ['./landlord-dashboard.scss']
})
export class LandlordDashboardComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isProfileMenuOpen = false;
  currentSection = 'dashboard';
  
  expandedMenus = {
    financials: false,
    properties: false,
    settings: false
  };

  currentUser: User | null = null;
  userDisplayName: string = 'User';
  userRole: string = 'Landlord';
  profileImage: string | null = null;

  // Notification properties - ready for API consumption
  unreadNotificationsCount: number = 0;
  unreadMessagesCount: number = 0;
  isLoadingNotifications: boolean = false;

  // Dashboard stats
  totalProperties = 12;
  activeTenants = 45;
  monthlyRevenue = 'KSh 2.4M';
  vacantUnits = 3;

  recentActivities = [
    {
      icon: 'credit_card',
      color: '#10b981',
      text: 'Rent payment received from John Doe - Apartment 3B',
      time: '2 hours ago'
    },
    {
      icon: 'visibility',
      color: '#3b82f6',
      text: 'New vacancy posted for Apartment 2A',
      time: '4 hours ago'
    },
    {
      icon: 'handyman',
      color: '#ef4444',
      text: 'Maintenance request submitted - Plumbing issue Unit 1C',
      time: '6 hours ago'
    },
    {
      icon: 'description',
      color: '#8b5cf6',
      text: 'New lease agreement signed - Sarah Johnson',
      time: '1 day ago'
    }
  ];

  quickStats = [
    {
      icon: 'shield',
      amount: 'KSh 340K',
      label: 'Protected Deposits'
    },
    {
      icon: 'visibility',
      amount: '3 Pending',
      label: 'Move-out Inspections'
    },
    {
      icon: 'bar_chart',
      amount: '95.5%',
      label: 'Occupancy Rate'
    },
    {
      icon: 'email',
      amount: '8 New',
      label: 'Tenant Messages'
    }
  ];

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadUserData();
    this.loadNotifications();
    
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

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    // Close profile dropdown when clicking outside
    if (this.isProfileMenuOpen) {
      const target = event.target as HTMLElement;
      const profileSection = document.querySelector('.profile-section');
      
      if (profileSection && !profileSection.contains(target)) {
        this.closeProfileMenu();
      }
    }

    // Close mobile menu when clicking outside
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
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'profileImage' || event.key === 'profileUpdated') {
        this.loadProfileImage();
      }
    });
  }

  private loadUserData(): void {
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
  }

  // Notification methods - ready for API integration
  private loadNotifications(): void {
    this.isLoadingNotifications = true;
    
    // TODO: Replace with actual API call
    // Example: this.notificationService.getUnreadCount().subscribe(...)
    
    // Simulate API call delay
    setTimeout(() => {
      // Mock data - replace with actual API response
      this.unreadNotificationsCount = 0; // Set to 0 initially, will be updated by API
      this.unreadMessagesCount = 0; // Set to 0 initially, will be updated by API
      this.isLoadingNotifications = false;
      
      // Uncomment below to test with mock notifications
      // this.unreadNotificationsCount = 3;
      // this.unreadMessagesCount = 2;
    }, 500);
  }

  viewNotifications(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    
    // Navigate to notifications page or open notifications panel
    this.router.navigate(['/landlord-dashboard/notifications']);
    
    // Alternative: You could open a notifications dropdown here
    // this.openNotificationsPanel();
  }

  // Method to refresh notifications (call this when you want to update counts)
  refreshNotifications(): void {
    this.loadNotifications();
  }

  // Method to mark notifications as read (call this when user views notifications)
  markNotificationsAsRead(): void {
    // TODO: Implement API call to mark notifications as read
    // Example: this.notificationService.markAllAsRead().subscribe(...)
    
    this.unreadNotificationsCount = 0;
    this.unreadMessagesCount = 0;
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
    
    const colors = ['#1e40af', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${color}" rx="50"/>
        <text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  }

  private formatUserRole(role: string | UserRole): string {
    const roleMap: { [key: string]: string } = {
      'LANDLORD': 'Landlord',
      'TENANT': 'Tenant',
      'CARETAKER': 'Caretaker',
      'BUSINESS': 'Business Owner',
      'ADMIN': 'Administrator'
    };
    
    return roleMap[role.toString()] || role.toString();
  }

  // Navigation Methods
  viewProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/profile/view']);
  }

  editProfile(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/landlord-dashboard/profile/edit']);
  }

  // Menu Toggle Methods
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

  toggleMenu(menuName: keyof typeof this.expandedMenus): void {
    this.expandedMenus[menuName] = !this.expandedMenus[menuName];
  }

  // Navigation Methods
  navigateToSection(section: string): void {
    this.currentSection = section;
    this.isMobileMenuOpen = false;
    this.isProfileMenuOpen = false;
    document.body.style.overflow = '';

    switch (section) {
      case 'dashboard':
        this.router.navigate(['/landlord-dashboard']);
        break;
      case 'financials':
        this.router.navigate(['/landlord-dashboard/financials']);
        this.expandedMenus.financials = true;
        break;
      case 'invoices':
        this.router.navigate(['/landlord-dashboard/financials/invoices']);
        this.expandedMenus.financials = true;
        break;
      case 'payments':
        this.router.navigate(['/landlord-dashboard/financials/payments']);
        this.expandedMenus.financials = true;
        break;
      case 'expenses':
        this.router.navigate(['/landlord-dashboard/financials/expenses']);
        this.expandedMenus.financials = true;
        break;
      case 'properties':
        this.router.navigate(['/landlord-dashboard/property']);
        this.expandedMenus.properties = true;
        break;
      case 'tenants':
        this.router.navigate(['/landlord-dashboard/tenants']);
        break;
      case 'messages':
        this.router.navigate(['/landlord-dashboard/messages']);
        break;
      case 'documents':
        this.router.navigate(['/landlord-dashboard/documents']);
        break;
      case 'marketplace':
        this.router.navigate(['/landlord-dashboard/marketplace']);
        break;
      case 'reviews':
        this.router.navigate(['/landlord-dashboard/reviews']);
        break;
      case 'reports':
        this.router.navigate(['/landlord-dashboard/reports']);
        break;
      case 'general':
        this.router.navigate(['/landlord-dashboard/settings/general']);
        this.expandedMenus.settings = true;
        break;
      case 'account':
        this.router.navigate(['/landlord-dashboard/settings/account']);
        this.expandedMenus.settings = true;
        break;
      case 'alerts':
        this.router.navigate(['/landlord-dashboard/settings/alerts']);
        this.expandedMenus.settings = true;
        break;
      case 'security':
        this.router.navigate(['/landlord-dashboard/settings/security']);
        this.expandedMenus.settings = true;
        break;
      case 'notifications':
        this.router.navigate(['/landlord-dashboard/notifications']);
        break;
      default:
        this.router.navigate(['/landlord-dashboard']);
        break;
    }
  }

  navigateToTenants(): void {
    this.navigateToSection('tenants');
  }

  // Route Detection
  private updateCurrentSectionFromRoute(url: string): void {
    if (url === '/landlord-dashboard' || url === '/landlord-dashboard/') {
      this.currentSection = 'dashboard';
    } else if (url.includes('/property/create')) {
      this.currentSection = 'properties';
      this.expandedMenus.properties = true;
    } else if (url.includes('/property/units')) {
      this.currentSection = 'units';
      this.expandedMenus.properties = true;
    } else if (url.includes('/property')) {
      this.currentSection = 'properties';
      this.expandedMenus.properties = true;
    } else if (url.includes('/financials/invoices')) {
      this.currentSection = 'invoices';
      this.expandedMenus.financials = true; 
    } else if (url.includes('/financials/payments')) {
      this.currentSection = 'payments';
      this.expandedMenus.financials = true;
    } else if (url.includes('/financials/expenses')) {
      this.currentSection = 'expenses';
      this.expandedMenus.financials = true;
    } else if (url.includes('/financials')) {
      this.currentSection = 'financials';
      this.expandedMenus.financials = true;
    } else if (url.includes('/settings/general')) {
      this.currentSection = 'general';
      this.expandedMenus.settings = true;
    } else if (url.includes('/settings/account')) {
      this.currentSection = 'account';
      this.expandedMenus.settings = true;
    } else if (url.includes('/settings/alerts')) {
      this.currentSection = 'alerts';
      this.expandedMenus.settings = true;
    } else if (url.includes('/settings/security')) {
      this.currentSection = 'security';
      this.expandedMenus.settings = true;
    } else if (url.includes('/profile/view')) {
      this.currentSection = 'profile';
    } else if (url.includes('/profile/edit')) {
      this.currentSection = 'profile';
    } else if (url.includes('/notifications')) {
      this.currentSection = 'notifications';
    } else if (url.includes('/tenants')) {
      this.currentSection = 'tenants';
    } else if (url.includes('/messages')) {
      this.currentSection = 'messages';
    } else if (url.includes('/documents')) {
      this.currentSection = 'documents';
    } else if (url.includes('/marketplace')) {
      this.currentSection = 'marketplace';
    } else if (url.includes('/reviews')) {
      this.currentSection = 'reviews';
    } else if (url.includes('/reports')) {
      this.currentSection = 'reports';
    } else {
      const urlParts = url.split('/');
      this.currentSection = urlParts[urlParts.length - 1] || 'dashboard';
    }
  }

  // Active State Checkers
  isNavActive(section: string): boolean {
    return this.currentSection === section;
  }

  isSubItemActive(subSection: string): boolean {
    return this.currentSection === subSection;
  }

  isParentActive(menuName: 'financials' | 'properties' | 'settings'): boolean {
    const financialSections = ['financials', 'invoices', 'payments', 'expenses'];
    const propertySections = ['properties', 'units', 'utilities', 'maintenance', 'property-grouping'];
    const settingsSections = ['general', 'account', 'alerts', 'security'];
    
    switch(menuName) {
      case 'financials':
        return financialSections.includes(this.currentSection);
      case 'properties':
        return propertySections.includes(this.currentSection) || this.router.url.includes('/property');
      case 'settings':
        return settingsSections.includes(this.currentSection);
      default:
        return false;
    }
  }

  // Logout Method
  logout(): void {
    if (this.isLoggingOut) return;

    const confirmed = confirm('Are you sure you want to logout?');
    if (!confirmed) return;

    this.isLoggingOut = true;
    this.closeProfileMenu();
    this.closeMobileMenu();

    this.authService.logout().subscribe({
      next: (response) => {
        console.log('Logout successful:', response.message);
        this.isLoggingOut = false;
        
        // Clear local storage
        localStorage.removeItem('profileImage');
        sessionStorage.clear();
        
        // Navigate to login page
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.isLoggingOut = false;
        
        // Still try to navigate to login even if API call fails
        localStorage.removeItem('profileImage');
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  // Handle Window Resize (for responsive behavior)
  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    // Close mobile menu on larger screens
    if (window.innerWidth > 768 && this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }
}