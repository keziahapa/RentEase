import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NavbarComponent } from '../../../src/app/shared/navbar/navbar.component';
import { FooterComponent } from '../../../src/app/shared/footer/footer.component';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrls: ['./about.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule, NavbarComponent, FooterComponent] 
})
export class AboutComponent implements OnInit {
  private isBrowser: boolean;
  isNavScrolled: boolean = false;
  isMobileMenuOpen: boolean = false;
  currentYear: number = new Date().getFullYear();
  activeMenu: string = 'about';

  setActiveMenu(menu: string) {
    this.activeMenu = menu;
    this.isMobileMenuOpen = false;
  }

  teamMembers = [
    {
      name: 'Keziah Apadet',
      role: 'Frontend Developer',
      image: '/images/keziah.jpg',
      bio: 'Passionate about crafting intuitive user experiences and building scalable frontend solutions.',
      linkedin: '#'
    },
    {
      name: 'Hassan',
      role: 'Backend Developer',
      image: '/images/keziah.jpg',
      bio: 'Specialist in backend systems and secure API development, ensuring stability and performance.',
      linkedin: '#'
    }
  ];

  values = [
    {
      icon: 'security',
      title: 'Security First',
      description: 'Every transaction and interaction is secured with enterprise-grade encryption and fraud detection.'
    },
    {
      icon: 'visibility',
      title: 'Transparency',
      description: 'Open communication, clear pricing, and honest dealings with all stakeholders.'
    },
    {
      icon: 'people',
      title: 'Community Focus',
      description: 'Building stronger rental communities through trust, accountability, and mutual respect.'
    },
    {
      icon: 'lightbulb',
      title: 'Innovation',
      description: 'Continuously improving our platform with cutting-edge technology and user feedback.'
    }
  ];

  ourStory = {
    title: 'Our Story',
    description: `RentEase was founded after Keziah and Hassan personally experienced rental fraud. 
    Instead of giving up, the challenge inspired the creation of a platform that protects tenants, landlords, and caretakers from similar experiences.`
  };

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

  navigateToHome(): void { this.router.navigate(['/home']); }
  navigateToFeatures(): void { this.router.navigate(['/features']); }
  navigateToPricing(): void { this.router.navigate(['/pricing']); }
  navigateToContact(): void { this.router.navigate(['/contact']); }
  navigateToLogin(): void { this.router.navigate(['/login']); }

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
      const animateElements = document.querySelectorAll('.team-card, .value-card');
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
