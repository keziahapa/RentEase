import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { TenantService } from '../../../../services/tenant.service';
import { CommunicationService } from '../../../../services/communication.service';
import { InvitationService } from '../../../../services/invitation.service';
import { DashboardOverviewComponent } from '../dashboard-overview/dashboard-overview.component';
import { ChatComponent } from '../../../../shared/chat/chat.component';
import { RentalComponent } from '../rental/rental.component';

@Component({
  selector: 'app-tenant-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterOutlet,
    DashboardOverviewComponent,
    ChatComponent,
    RentalComponent
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

  pendingInvitation: any = null;
  isProcessingInvitation = false;
  hasPendingInvitationAlert = false;

  private profileUpdateListener: any;
  isLoggingOut: boolean = false;
  private communicationSubscriptions = new Subscription();
  private notificationSummarySubscription: Subscription | null = null;

  private invitationService = inject(InvitationService);
  private snackBar = inject(MatSnackBar);

  constructor(
    private router: Router,
    private authService: AuthService,
    private tenantService: TenantService,
    private dialog: MatDialog,
    private communicationService: CommunicationService
  ) { }

  ngOnInit(): void {
    this.loadUserData();
    this.checkPendingInvitations(); 
    this.loadDashboardData();
    this.loadNotifications();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateCurrentSectionFromRoute(event.urlAfterRedirects);
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

  getGreetingMessage(): string {
    const now = new Date();
    const hours = now.getHours();
    const firstName = this.userDisplayName.split(' ')[0];
    
    let greeting = '';
    if (hours < 12) {
      greeting = 'Good morning';
    } else if (hours < 18) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }
    
    return `${greeting}, ${firstName}! `;
  }

  private checkPendingInvitations(): void {
    try {
      const pendingInvitationStr = localStorage.getItem('pendingInvitation');
      if (pendingInvitationStr) {
        this.pendingInvitation = JSON.parse(pendingInvitationStr);
        
        if (this.pendingInvitation && this.pendingInvitation.status === 'queued') {
          console.log('Tenant Dashboard: Found pending invitation, attempting to process...');
          this.hasPendingInvitationAlert = true;
          this.processPendingInvitation();
        }
      }
    } catch (error) {
      console.error('Error checking pending invitations:', error);
    }
  }

  private processPendingInvitation(): void {
    if (!this.pendingInvitation || this.isProcessingInvitation) return;

    this.isProcessingInvitation = true;
    
    this.snackBar.open('Processing pending invitation...', 'Close', { 
      duration: 3000,
      panelClass: ['info-snackbar']
    });

    this.invitationService.acceptInvitation(this.pendingInvitation.token).subscribe({
      next: (response: any) => {
        this.isProcessingInvitation = false;
        this.hasPendingInvitationAlert = false;
        console.log('Pending invitation accepted successfully:', response);
        
        this.clearPendingInvitation();
        
        this.snackBar.open('Invitation accepted successfully!', 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });

        setTimeout(() => {
          this.loadDashboardData();
        }, 1000);
      },
      error: (error: any) => {
        this.isProcessingInvitation = false;
        console.error('Failed to process pending invitation:', error);
        
        if (this.pendingInvitation) {
          this.pendingInvitation.attemptCount++;
          this.pendingInvitation.lastAttempt = new Date();
          this.pendingInvitation.lastError = error.message;
          
          if (this.pendingInvitation.attemptCount >= this.pendingInvitation.maxRetries) {
            this.snackBar.open('Invitation failed after multiple attempts. Please contact support.', 'Close', { 
              duration: 7000,
              panelClass: ['error-snackbar']
            });
            this.clearPendingInvitation();
          } else {
            localStorage.setItem('pendingInvitation', JSON.stringify(this.pendingInvitation));
            this.snackBar.open('Invitation will retry later', 'Close', { 
              duration: 3000,
              panelClass: ['warning-snackbar']
            });
            
            this.scheduleNextRetry();
          }
        }
      }
    });
  }

  private clearPendingInvitation(): void {
    localStorage.removeItem('pendingInvitation');
    sessionStorage.removeItem('pendingInvitationToken');
    this.pendingInvitation = null;
    this.hasPendingInvitationAlert = false;
  }

  private scheduleNextRetry(): void {
    if (!this.pendingInvitation) return;

    const retryDelay = Math.min(30000, 2000 * Math.pow(2, this.pendingInvitation.attemptCount));
    
    console.log(`Scheduling next retry in ${retryDelay}ms`);
    
    setTimeout(() => {
      if (this.pendingInvitation && this.pendingInvitation.status === 'queued') {
        this.processPendingInvitation();
      }
    }, retryDelay);
  }

  retryPendingInvitation(): void {
    if (this.pendingInvitation && !this.isProcessingInvitation) {
      this.processPendingInvitation();
    }
  }

  clearFailedInvitation(): void {
    this.clearPendingInvitation();
    this.snackBar.open('Pending invitation cleared', 'Close', { duration: 3000 });
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

    // FIXED: Use getTenantUnits() instead of getTenantDashboardData()
    this.tenantService.getTenantUnits().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.processDashboardData(response.data);
        } else {
          this.dashboardError = 'Failed to load tenant data';
          this.processDashboardData([]); // Process empty data
        }
        this.isLoadingDashboard = false;
      },
      error: (error: any) => {
        this.dashboardError = error.message || 'Failed to load dashboard data';
        this.isLoadingDashboard = false;
        console.error('Dashboard data error:', error);
        this.processDashboardData([]); // Process empty data on error
      }
    });
  }

  private processDashboardData(tenantUnits: any[]): void {
    // Use the tenant units data to populate dashboard
    const firstUnit = tenantUnits && tenantUnits.length > 0 ? tenantUnits[0] : null;
    
    this.dashboardData = {
      currentRent: firstUnit?.rentAmount || 0,
      paymentStatus: 'Current', // Default status
      daysUntilDue: 15, // Default value
      openMaintenance: 0, // Default value
      leaseEndDays: firstUnit ? this.calculateLeaseEndDays(firstUnit.leaseEndDate) : 0,
      propertyAddress: firstUnit?.propertyAddress || 'No property assigned',
      landlordName: firstUnit?.landlordName || 'Not assigned',
      depositAmount: firstUnit?.depositAmount || 0,
      units: tenantUnits || [] // Store the actual units data
    };
  }

  private calculateLeaseEndDays(leaseEndDate: string): number {
    if (!leaseEndDate) return 0;
    
    const endDate = new Date(leaseEndDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
      error: (error: any) => {
        this.unreadNotificationsCount = 0;
        this.unreadMessagesCount = 0;
        this.isLoadingNotifications = false;
        console.error('Error loading notifications:', error);
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

  navigateToMoveOutNotices(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/move-out-notices']);
  }

  navigateToRental(): void {
    this.closeProfileMenu();
    this.closeMobileMenu();
    this.router.navigate(['/tenant-dashboard/rental']);
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
      'move-out': ['/tenant-dashboard/move-out-notices'],
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
      error: (error: any) => {
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
    this.checkPendingInvitations(); 
  }

  onLogoError(event: any): void {
    console.error('Logo failed to load:', event);
  }

  getInvitationStatus(): string {
    if (!this.pendingInvitation) return '';
    
    if (this.isProcessingInvitation) {
      return 'Processing invitation...';
    } else if (this.pendingInvitation.attemptCount > 0) {
      return `Retry ${this.pendingInvitation.attemptCount}/${this.pendingInvitation.maxRetries}`;
    } else {
      return 'Pending invitation';
    }
  }

  canRetryInvitation(): boolean {
    return this.pendingInvitation && 
           !this.isProcessingInvitation && 
           this.pendingInvitation.attemptCount < this.pendingInvitation.maxRetries;
  }

  shouldShowInvitationAlert(): boolean {
    return this.hasPendingInvitationAlert && this.pendingInvitation;
  }
}