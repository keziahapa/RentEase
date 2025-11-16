
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

interface Invoice {
  id: number;
  tenantName: string;
  unit: string;
  invoiceDate: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

interface Payment {
  id: number;
  tenantName: string;
  unit: string;
  paymentMethod: string;
  amount: number;
  dateReceived: string;
  status: string;
}

interface Expense {
  id: number;
  property: string;
  expenseType: 'Maintenance' | 'Utility' | 'Service';
  amount: number;
  date: string;
  status: 'Paid' | 'Unpaid';
}

Chart.register(...registerables);

@Component({
  selector: 'app-financials',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatIconModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule
  ],
  templateUrl: './financials.html',
  styleUrls: ['./financials.scss']
})
export class FinancialsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('incomeExpenseChart') incomeExpenseChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentTrendsChart') paymentTrendsChart!: ElementRef<HTMLCanvasElement>;

  private incomeChart?: Chart;
  private trendsChart?: Chart;
  private routeSubscription?: Subscription;


  showOverview = true;

  
  invoiceColumns: string[] = ['tenantName', 'unit', 'invoiceDate', 'amount', 'status', 'actions'];
  paymentColumns: string[] = ['tenantName', 'unit', 'paymentMethod', 'amount', 'dateReceived', 'status'];
  expenseColumns: string[] = ['property', 'expenseType', 'amount', 'date', 'status', 'actions'];


  invoices: Invoice[] = [
    { id: 1, tenantName: 'John Smith', unit: 'Unit 101', invoiceDate: '2024-01-01', amount: 1200, status: 'Paid' },
    { id: 2, tenantName: 'Mary Johnson', unit: 'Unit 202', invoiceDate: '2024-01-01', amount: 1500, status: 'Pending' },
    { id: 3, tenantName: 'Bob Wilson', unit: 'Unit 303', invoiceDate: '2023-12-01', amount: 1300, status: 'Overdue' },
    { id: 4, tenantName: 'Sarah Davis', unit: 'Unit 404', invoiceDate: '2024-01-15', amount: 1400, status: 'Paid' },
    { id: 5, tenantName: 'Mike Brown', unit: 'Unit 505', invoiceDate: '2024-01-10', amount: 1600, status: 'Pending' }
  ];

  payments: Payment[] = [
    { id: 1, tenantName: 'John Smith', unit: 'Unit 101', paymentMethod: 'Bank Transfer', amount: 1200, dateReceived: '2024-01-05', status: 'Completed' },
    { id: 2, tenantName: 'Sarah Davis', unit: 'Unit 404', paymentMethod: 'Credit Card', amount: 1400, dateReceived: '2024-01-18', status: 'Completed' },
    { id: 3, tenantName: 'Alice Cooper', unit: 'Unit 201', paymentMethod: 'Cash', amount: 1100, dateReceived: '2024-01-12', status: 'Completed' },
    { id: 4, tenantName: 'David Lee', unit: 'Unit 302', paymentMethod: 'M-Pesa', amount: 1250, dateReceived: '2024-01-20', status: 'Pending' }
  ];

  expenses: Expense[] = [
    { id: 1, property: 'Unit 101', expenseType: 'Maintenance', amount: 300, date: '2024-01-10', status: 'Paid' },
    { id: 2, property: 'Building Common', expenseType: 'Utility', amount: 450, date: '2024-01-15', status: 'Unpaid' },
    { id: 3, property: 'Unit 202', expenseType: 'Service', amount: 200, date: '2024-01-08', status: 'Paid' },
    { id: 4, property: 'Building Common', expenseType: 'Maintenance', amount: 800, date: '2024-01-22', status: 'Unpaid' }
  ];

 
  get monthlyIncome(): number {
    return this.payments
      .filter(p => this.isCurrentMonth(new Date(p.dateReceived)) && p.status === 'Completed')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  get monthlyExpenses(): number {
    return this.expenses
      .filter(e => this.isCurrentMonth(new Date(e.date)) && e.status === 'Paid')
      .reduce((sum, e) => sum + e.amount, 0);
  }

  get netProfit(): number {
    return this.monthlyIncome - this.monthlyExpenses;
  }

  get pendingInvoicesCount(): number {
    return this.invoices.filter(i => i.status === 'Pending').length;
  }

  get overdueInvoicesCount(): number {
    return this.invoices.filter(i => i.status === 'Overdue').length;
  }

  get totalRevenue(): number {
    return this.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  }

  get pendingAmount(): number {
    return this.invoices
      .filter(inv => inv.status === 'Pending')
      .reduce((sum, inv) => sum + inv.amount, 0);
  }

  constructor(private router: Router) {}

  ngOnInit() {
    console.log('Financials component initialized');
    
    
    this.routeSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
      
        this.showOverview = this.isFinancialsOverviewRoute(event.url);
        console.log('Route changed:', event.url, 'Show overview:', this.showOverview);
        
       
        if (this.showOverview) {
          setTimeout(() => this.initializeCharts(), 100);
        } else {
         
          this.destroyCharts();
        }
      });

  
    this.showOverview = this.isFinancialsOverviewRoute(this.router.url);
  }

  ngAfterViewInit() {
   
    if (this.showOverview) {
      setTimeout(() => this.initializeCharts(), 200);
    }
  }

  ngOnDestroy() {
   
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    this.destroyCharts();
  }

  // Helper method to determine if we're on the financials overview route
  private isFinancialsOverviewRoute(url: string): boolean {
    return url === '/landlord-dashboard/financials' || 
           url.endsWith('/financials') ||
           url === '/landlord-dashboard/financials/';
  }

  // Chart initialization methods
  private initializeCharts() {
    this.createIncomeExpenseChart();
    this.createPaymentTrendsChart();
  }

  private destroyCharts() {
    if (this.incomeChart) {
      this.incomeChart.destroy();
      this.incomeChart = undefined;
    }
    if (this.trendsChart) {
      this.trendsChart.destroy();
      this.trendsChart = undefined;
    }
  }

  private createIncomeExpenseChart() {
    if (!this.incomeExpenseChart?.nativeElement) return;
    
    const ctx = this.incomeExpenseChart.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.incomeChart) {
      this.incomeChart.destroy();
    }

    this.incomeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024', 'Jan 2025'],
        datasets: [
          { 
            label: 'Income', 
            data: [4200, 4500, 4300, 4800, 4600, 4900], 
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 1
          },
          { 
            label: 'Expenses', 
            data: [1200, 1400, 1100, 1600, 1300, 1500], 
            backgroundColor: 'rgba(244, 67, 54, 0.8)',
            borderColor: 'rgba(244, 67, 54, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return context.dataset.label + ': $' + (value !== null ? value.toLocaleString() : '0');
              }
            }
          }
        }
      }
    });
  }

  private createPaymentTrendsChart() {
    if (!this.paymentTrendsChart?.nativeElement) return;
    
    const ctx = this.paymentTrendsChart.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.trendsChart) {
      this.trendsChart.destroy();
    }

    this.trendsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Weekly Payments',
          data: [8500, 12300, 9800, 11200],
          borderColor: 'rgba(33, 150, 243, 1)',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(33, 150, 243, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return context.dataset.label + ': $' + (value !== null ? value.toLocaleString() : '0');
              }
            }
          }
        }
      }
    });
  }

  // Helper method to check if date is in current month
  private isCurrentMonth(date: Date): boolean {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  // Action methods for overview tables
  sendReminder(invoice: Invoice) {
    console.log('Sending reminder for invoice:', invoice.id);
    // Implement actual reminder sending logic here
    alert(`Reminder sent to ${invoice.tenantName} for ${invoice.unit}`);
  }

  markAsPaid(invoice: Invoice) {
    const index = this.invoices.findIndex(i => i.id === invoice.id);
    if (index !== -1) {
      this.invoices[index].status = 'Paid';
      console.log(`Invoice ${invoice.id} marked as paid`);
    }
  }

  toggleExpenseStatus(expense: Expense) {
    const index = this.expenses.findIndex(e => e.id === expense.id);
    if (index !== -1) {
      this.expenses[index].status = this.expenses[index].status === 'Paid' ? 'Unpaid' : 'Paid';
      console.log(`Expense ${expense.id} status toggled to:`, this.expenses[index].status);
    }
  }

  // Navigation helper methods
  navigateToInvoices() {
    this.router.navigate(['/landlord-dashboard/financials/invoices']);
  }

  navigateToPayments() {
    this.router.navigate(['/landlord-dashboard/financials/payments']);
  }

  navigateToExpenses() {
    this.router.navigate(['/landlord-dashboard/financials/expenses']);
  }

  navigateToReports() {
    this.router.navigate(['/landlord-dashboard/financials/reports']);
  }

  // Debug method to log current state
  logCurrentState() {
    console.log('Current route:', this.router.url);
    console.log('Show overview:', this.showOverview);
    console.log('Monthly income:', this.monthlyIncome);
    console.log('Monthly expenses:', this.monthlyExpenses);
    console.log('Net profit:', this.netProfit);
  }
}