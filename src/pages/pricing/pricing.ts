import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// ✅ bring in Navbar & Footer
import { NavbarComponent } from '../../../src/app/shared/navbar/navbar.component';
import { FooterComponent } from '../../../src/app/shared/footer/footer.component';

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.html',
  styleUrls: ['./pricing.scss'],
  standalone: true,
  // ✅ register them here
  imports: [
    CommonModule,
    MatIconModule,
    RouterModule,
    NavbarComponent,
    FooterComponent
  ]
})
export class PricingComponent implements OnInit {
  private isBrowser: boolean;
  isNavScrolled: boolean = false;
  isMobileMenuOpen: boolean = false;
  currentYear: number = new Date().getFullYear();
  activeMenu: string = 'pricing';

  setActiveMenu(menu: string) {
    this.activeMenu = menu;
    this.isMobileMenuOpen = false;
  }

  pricingPlans = [
    {
      name: 'Basic',
      price: 'KSH 1,100',
      period: 'per month',
      description: 'Perfect for individual landlords or tenants getting started',
      features: [
        'Basic marketplace access',
        'Digital document storage',
        'Communication platform',
        'Basic support',
        'Mobile app access',
        'Basic property listings'
      ],
      buttonText: 'Get Started',
      popular: false
    },
    {
      name: 'Premium',
      price: 'KSH 1,600',
      period: 'per month',
      description: 'Most popular choice for growing property portfolios',
      features: [
        'All Basic features',
        'Advanced marketplace tools',
        'Priority customer support',
        'Detailed analytics',
        'Custom branding options',
        'Advanced property management',
        'Automated rent reminders',
        'Legal document templates'
      ],
      buttonText: 'Most Popular',
      popular: true
    },
    {
      name: 'Pro',
      price: 'KSH 2,500',
      period: 'per month',
      description: 'Enterprise solution for large property management companies',
      features: [
        'All Premium features',
        'Advanced advertising space',
        'Dedicated account manager',
        'Custom integrations',
        'White-label solutions',
        'API access',
        'Advanced reporting & analytics',
        'Multi-property dashboard',
        'Bulk operations',
        'Priority feature requests'
      ],
      buttonText: 'Contact Sales',
      popular: false
    }
  ];

  faqs = [
    {
      question: 'How does the escrow system work?',
      answer: 'Our escrow system securely holds rental deposits until all parties agree on the move-out inspection. Funds are only released when both landlord and tenant approve the condition assessment, ensuring fair treatment for everyone.',
      expanded: false
    },
    {
      question: 'What is the 2% transaction fee for?',
      answer: 'The 2% fee covers secure payment processing, escrow services, dispute resolution, and platform maintenance. This fee is only charged on deposit transactions and monthly rent payments processed through our platform.',
      expanded: false
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. Your subscription will remain active until the end of your current billing period.',
      expanded: false
    },
    {
      question: 'Is there a setup fee?',
      answer: 'No, there are no setup fees for any of our plans. You only pay the monthly subscription fee and the 2% transaction fee on processed payments.',
      expanded: false
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept M-Pesa, bank transfers, and major credit/debit cards. All payments are processed securely through our encrypted payment gateway.',
      expanded: false
    },
    {
      question: 'Do you offer discounts for annual payments?',
      answer: 'Yes, we offer a 15% discount when you pay annually instead of monthly. Contact our sales team to set up annual billing for your account.',
      expanded: false
    },
    {
      question: 'What happens to my data if I cancel?',
      answer: 'Your data remains accessible for 90 days after cancellation. You can export all your documents, communications, and transaction history during this period. After 90 days, data is permanently deleted for security.',
      expanded: false
    },
    {
      question: 'How does the fraud prevention system work?',
      answer: 'Our fraud prevention includes identity verification, digital vacancy notices, photo documentation, and AI-powered anomaly detection. We also maintain a blacklist of problematic users across our network.',
      expanded: false
    },
    {
      question: 'Is customer support included in all plans?',
      answer: 'Yes, all plans include customer support. Basic plan gets email support within 24 hours, Premium gets priority support, and Pro plans get dedicated account managers with phone support.',
      expanded: false
    },
    {
      question: 'Can I upgrade or downgrade my plan?',
      answer: 'Absolutely! You can change your plan at any time. Upgrades take effect immediately, while downgrades take effect at the next billing cycle. No penalties for plan changes.',
      expanded: false
    }
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

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  navigateToAbout(): void {
    this.router.navigate(['/about']);
  }

  navigateToPricing(): void {
    this.router.navigate(['/pricing']);
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

  toggleFaq(index: number): void {
    this.faqs[index].expanded = !this.faqs[index].expanded;
  }

  selectPlan(plan: any): void {
    if (plan.name === 'Pro') {
      this.navigateToContact();
    } else {
      this.router.navigate(['/registration'], { queryParams: { plan: plan.name.toLowerCase() } });
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
      const animateElements = document.querySelectorAll('.pricing-card, .faq-item');
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
