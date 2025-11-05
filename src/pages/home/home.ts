import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { NavbarComponent } from '../../../src/app/shared/navbar/navbar.component'; 
import { FooterComponent } from '../../../src/app/shared/footer/footer.component'; 

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    RouterModule,
    NavbarComponent,
    FooterComponent
  ]
})
export class HomeComponent implements OnInit, OnDestroy {
  private isBrowser: boolean;

  isNavScrolled: boolean = false;
  isMobileMenuOpen: boolean = false;
  showUninvitedMessage: boolean = false;
  activeMenu: string = 'home';

  currentSlide = 0;
  totalSlides = 0;
  autoSlideInterval: any;

  // Service carousel properties for seamless infinite loop
  currentServiceSlide = 0;
  serviceAutoSlideInterval: any;
  isServiceTransitioning = false;

  currentYear: number = new Date().getFullYear();

  slides = [
    {
      title: 'Secure & Transparent Rental Management',
      description: 'Eliminate rental fraud and connect landlords, tenants, and caretakers securely with Kenya\'s most trusted digital property management platform.',
      image: '/images/slide1.jpg'
    },
    {
      title: 'Secure Deposits',
      description: 'Protect your rental deposits with our escrow system and eliminate deposit fraud with transparent, automated processes.',
      image: '/images/slide2.jpg'
    },
    {
      title: 'All-in-One Rental Management',
      description: 'Manage properties, tenants, leases, and payments with ease — all in one powerful platform.',
      image: '/images/slide3.jpg'
    }
  ];

  stats = [
    { current: '24/7', suffix: '', label: 'Platform Availability' },
    { current: '100', suffix: '%', label: 'Secure & Encrypted' }
  ];

  services = [
    {
      id: 'secure-deposits',
      icon: 'account_balance_wallet',
      title: 'Secure Deposit Management',
      description: 'Eliminate deposit fraud with our blockchain-based escrow system that ensures complete transparency and security for all parties involved in rental agreements.',
      backgroundImage: '/images/deposit-management.jpeg',
      badge: 'Most Popular'
    },
    {
      id: 'communication-hub',
      icon: 'forum',
      title: 'Integrated Communication Hub',
      description: 'Centralized communication platform connecting landlords, tenants, and caretakers with real-time messaging, notifications, and document sharing capabilities.',
      backgroundImage: '/images/communication-hub.jpeg'
    },
    {
      id: 'community-marketplace',
      icon: 'store',
      title: 'Community Marketplace',
      description: 'Local marketplace where tenants can buy, sell, and exchange items within their residential communities with secure in-app transactions and local delivery.',
      backgroundImage: '/images/marketplace.jpeg',
      badge: 'New'
    },
    {
      id: 'digital-documents',
      icon: 'description',
      title: 'Digital Document Management',
      description: 'Comprehensive digital storage and management system for rental records, receipts, lease documents, and all property-related documentation with secure cloud backup.',
      backgroundImage: '/images/document-management.jpeg'
    },
    {
      id: 'verified-vacancy',
      icon: 'verified',
      title: 'Verified Vacancy System',
      description: 'Digital move-out notices system visible to both landlords and caretakers to prevent occupancy fraud and ensure transparent vacancy verification processes.',
      backgroundImage: '/images/vacancy-system.jpeg'
    },
    {
      id: 'rating-review',
      icon: 'star_rate',
      title: 'Rating & Review System',
      description: 'Comprehensive rating and review platform where tenants can rate landlords and caretakers for enhanced accountability, transparency, and service quality improvement.',
      backgroundImage: '/images/rating-system.jpeg'
    }
  ];

  benefits = [
    {
      icon: 'shield',
      iconColor: '#3b82f6',
      title: 'Advanced Security & Fraud Prevention',
      description: 'Bank-level encryption, multi-factor authentication, and advanced verification systems protect against rental fraud and ensure secure transactions for all users.'
    },
    {
      icon: 'speed',
      iconColor: '#10b981',
      title: 'Fast Processing & Automation',
      description: 'Quick verification processes, instant notifications, automated workflows, and streamlined operations reduce administrative overhead and accelerate all transactions.'
    },
    {
      icon: 'support_agent',
      iconColor: '#f59e0b',
      title: '24/7 Professional Support',
      description: 'Round-the-clock dedicated customer success team available to assist with platform navigation, technical issues, and property management guidance.'
    },
    {
      icon: 'analytics',
      iconColor: '#8b5cf6',
      title: 'Market Insights & Analytics',
      description: 'Access comprehensive reporting, real-time market data, performance metrics, and detailed analytics to make informed rental decisions and optimize property management.'
    },
    {
      icon: 'devices',
      iconColor: '#06b6d4',
      title: 'Cross-Platform Accessibility',
      description: 'Responsive web application and mobile apps ensure seamless access across all devices, operating systems, and screen sizes for maximum convenience.'
    },
    {
      icon: 'gavel',
      iconColor: '#dc2626',
      title: 'Legal Compliance & Protection',
      description: 'Full adherence to Kenyan property laws and regulations with built-in compliance monitoring, legal document templates, and regulatory reporting features.'
    }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private matIconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.matIconRegistry.addSvgIcon('facebook', this.sanitizer.bypassSecurityTrustResourceUrl('icons/facebook.svg'));
      this.matIconRegistry.addSvgIcon('twitter', this.sanitizer.bypassSecurityTrustResourceUrl('icons/twitter.svg'));
      this.matIconRegistry.addSvgIcon('instagram', this.sanitizer.bypassSecurityTrustResourceUrl('icons/instagram.svg'));
    }

    this.totalSlides = this.slides.length;
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      this.setupScrollAnimations();
      this.startHeroCarousel();
      this.startServiceCarousel();
      this.updateSlideClasses();
    }, 100);
  }

  ngOnDestroy(): void {
    this.stopHeroCarousel();
    this.stopServiceCarousel();
  }

  setActiveMenu(menu: string) {
    this.activeMenu = menu;
    this.isMobileMenuOpen = false;
  }

  
  startHeroCarousel(): void {
    this.autoSlideInterval = setInterval(() => {
      this.nextSlide();
    }, 6000);
  }

  stopHeroCarousel(): void {
    if (this.autoSlideInterval) clearInterval(this.autoSlideInterval);
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
    this.updateSlideClasses();
  }

  prevSlide(): void {
    this.currentSlide = this.currentSlide === 0 ? this.totalSlides - 1 : this.currentSlide - 1;
    this.updateSlideClasses();
  }

  goToSlide(index: number): void {
    this.currentSlide = index;
    this.updateSlideClasses();
    this.stopHeroCarousel();
    this.startHeroCarousel();
  }

  private updateSlideClasses(): void {
    if (!this.isBrowser) return;
    setTimeout(() => {
      const slides = document.querySelectorAll('.carousel-slide');
      slides.forEach((slide, index) => {
        const slideElement = slide as HTMLElement;
        slideElement.classList.remove('active', 'prev');

        if (index === this.currentSlide) {
          slideElement.classList.add('active');
        } else if (index < this.currentSlide) {
          slideElement.classList.add('prev');
        }
      });
    }, 0);
  }

  onCarouselMouseEnter(): void {
    this.stopHeroCarousel();
  }

  onCarouselMouseLeave(): void {
    this.startHeroCarousel();
  }

  // Service Carousel Methods - Seamless Infinite Loop
  startServiceCarousel(): void {
    this.serviceAutoSlideInterval = setInterval(() => {
      this.nextServiceSlide();
    }, 5000);
  }

  stopServiceCarousel(): void {
    if (this.serviceAutoSlideInterval) {
      clearInterval(this.serviceAutoSlideInterval);
    }
  }

  nextServiceSlide(): void {
    if (this.isServiceTransitioning) return;
    
    this.isServiceTransitioning = true;
    
    // Move to next slide with transition
    this.currentServiceSlide = 1;

    // After transition completes, reset to position 0 instantly
    setTimeout(() => {
      this.currentServiceSlide = 0;
      this.isServiceTransitioning = false;
    }, 850);
  }

  prevServiceSlide(): void {
    if (this.isServiceTransitioning) return;
    
    this.isServiceTransitioning = true;
    
    // Jump to position 2 instantly, then animate to position 1
    this.currentServiceSlide = 2;
    
    setTimeout(() => {
      this.currentServiceSlide = 1;
      setTimeout(() => {
        this.isServiceTransitioning = false;
      }, 850);
    }, 50);
  }

  goToServiceSlide(slideIndex: number): void {
    if (this.isServiceTransitioning) return;
    
    this.isServiceTransitioning = true;
    this.currentServiceSlide = slideIndex;
    
    setTimeout(() => {
      this.isServiceTransitioning = false;
    }, 850);
    
    this.resetServiceAutoSlide();
  }

  resetServiceAutoSlide(): void {
    this.stopServiceCarousel();
    this.startServiceCarousel();
  }

  getServiceCarouselTransform(): string {
    // The container width is 100% of viewport (max 1200px)
    // Each slide should show exactly 3 cards
    // Card width = (container width / 3) - gap adjustment
    const offset = this.currentServiceSlide * 100;
    return `translateX(-${offset}%)`;
  }

  getServiceCarouselClass(): string {
    // Only add transition class when actually transitioning between positions
    if (this.isServiceTransitioning && 
        ((this.currentServiceSlide === 1) || 
         (this.currentServiceSlide === 2 && this.isServiceTransitioning))) {
      return 'transitioning';
    }
    return '';
  }

  // Get services for the carousel
  getFirstThreeServices() {
    return this.services.slice(0, 3);
  }

  getLastThreeServices() {
    return this.services.slice(3, 6);
  }

  onServiceCardClick(serviceId: string): void {
    this.router.navigate(['/services', serviceId]);
  }

  onServiceCarouselMouseEnter(): void {
    this.stopServiceCarousel();
  }

  onServiceCarouselMouseLeave(): void {
    this.startServiceCarousel();
  }

  // Navigation Methods
  scrollToSection(sectionId: string): void {
    if (!this.isBrowser) return;
    const element = document.getElementById(sectionId);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  navigateToFeatures(): void {
    this.scrollToSection('services');
  }

  navigateToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  navigateToAbout(): void {
    this.router.navigate(['/about']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/registration']);
  }

  navigateToLanding() {
    this.showUninvitedMessage = false;
    this.router.navigate(['/home']);
  }

  contactLandlord() {
    this.router.navigate(['/contact']);
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!this.isBrowser) return;
    this.isNavScrolled = window.scrollY > 50;
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  private setupScrollAnimations(): void {
    if (!this.isBrowser) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.style.opacity = '1';
            target.style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    setTimeout(() => {
      const animateElements = document.querySelectorAll('.stat-item, .service-card, .benefit-item');
      animateElements.forEach(el => {
        const target = el as HTMLElement;
        target.style.opacity = '0';
        target.style.transform = 'translateY(30px)';
        target.style.transition = 'all 0.6s ease';
        observer.observe(target);
      });
    }, 500);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.prevSlide();
    else if (event.key === 'ArrowRight') this.nextSlide();
    else if (event.key === 'Escape' && this.isMobileMenuOpen) this.isMobileMenuOpen = false;
  }

  onGetStartedClick(role: string, invitationToken?: string) {
    if (role === 'tenant' || role === 'caretaker') {
      if (!invitationToken || !this.isValidInvitation(invitationToken)) {
        this.showUninvitedMessage = true;
        return;
      } else {
        this.router.navigate(['/register'], { queryParams: { token: invitationToken } });
      }
    } else {
      this.router.navigate(['/register'], { queryParams: { role } });
    }
  }

  isValidInvitation(token: string): boolean {
    return false;
  }
}