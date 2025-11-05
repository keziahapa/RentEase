import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NavbarComponent } from '../../../src/app/shared/navbar/navbar.component'; 
import { FooterComponent } from '../../../src/app/shared/footer/footer.component'; 

@Component({
  selector: 'app-contact',
  standalone: true,
  templateUrl: './contacts.html',
  styleUrls: ['./contacts.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    NavbarComponent,   
    FooterComponent    
  ]
})
export class ContactComponent implements OnInit {
  private isBrowser: boolean;
  isNavScrolled: boolean = false;
  isMobileMenuOpen: boolean = false;
  currentYear: number = new Date().getFullYear();
  activeMenu: string = 'contacts';

  setActiveMenu(menu: string) {
    this.activeMenu = menu;
    this.isMobileMenuOpen = false;
  }

  contactMethods = [
    {
      icon: 'call',
      title: 'Phone',
      details: '+254 700 000 000',
      description: 'Call us for immediate assistance',
      link: 'tel:+254700000000'
    },
    {
      icon: 'email',
      title: 'Email',
      details: 'info@rentease.co.ke',
      description: 'Send us an email and we\'ll respond within 24 hours',
      link: 'mailto:info@rentease.co.ke'
    },
    {
      icon: 'chat',
      title: 'WhatsApp',
      details: '+254 700 000 000',
      description: 'Chat with us on WhatsApp for quick support',
      link: 'https://wa.me/254700000000'
    },
    {
      icon: 'location_on',
      title: 'Service Area',
      details: 'Nairobi, Mombasa, Kisumu & Major Cities',
      description: 'We serve all major cities across Kenya',
      link: null
    }
  ];

  officeHours = [
    { day: 'Monday - Friday', hours: '8:00 AM - 6:00 PM' },
    { day: 'Saturday', hours: '9:00 AM - 2:00 PM' },
    { day: 'Sunday', hours: 'Emergency Support Only' },
    { day: 'Emergency Support', hours: '24/7 Available' }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      this.setupScrollAnimations();
    }, 100);
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  navigateToFeatures(): void {
    this.router.navigate(['/features']);
  }

  navigateToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  navigateToAbout(): void {
    this.router.navigate(['/about']);
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  onContactSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    console.log('Contact form submitted:', data);

    if (this.isBrowser) {
      alert('Thank you for your message! We will get back to you within 24 hours.');
      form.reset();
    }
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
      const animateElements = document.querySelectorAll(
        '.contact-method-card, .contact-form, .office-hours-card'
      );
      animateElements.forEach(el => {
        const target = el as HTMLElement;
        target.style.opacity = '0';
        target.style.transform = 'translateY(30px)';
        target.style.transition = 'all 0.6s ease';
        observer.observe(target);
      });
    }, 500);
  }
}
