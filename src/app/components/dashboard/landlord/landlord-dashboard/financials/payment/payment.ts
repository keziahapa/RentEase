import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';

interface Payment {
  id: number;
  tenantName: string;
  unit: string;
  paymentMethod: string;
  amount: number;
  dateReceived: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded';
  invoiceId?: number;
  referenceNumber: string;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './payment.html',
  styleUrls: ['./payment.scss']
})
export class PaymentComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Table column definitions
  displayedColumns: string[] = ['tenantName', 'unit', 'paymentMethod', 'amount', 'dateReceived', 'status', 'actions'];
  dataSource: MatTableDataSource<Payment>;

  // Filter properties
  statusFilter: string = '';
  dateRangeFilter: { start: Date | null; end: Date | null } = { start: null, end: null };
  searchFilter: string = '';

  // Sample data
  payments: Payment[] = [
    { id: 1, tenantName: 'John Smith', unit: 'Unit 101', paymentMethod: 'Bank Transfer', amount: 1200, dateReceived: '2024-01-05', status: 'Completed', invoiceId: 1001, referenceNumber: 'REF-001' },
    { id: 2, tenantName: 'Sarah Davis', unit: 'Unit 404', paymentMethod: 'Credit Card', amount: 1400, dateReceived: '2024-01-18', status: 'Completed', invoiceId: 1004, referenceNumber: 'REF-002' },
    { id: 3, tenantName: 'Alice Cooper', unit: 'Unit 201', paymentMethod: 'Cash', amount: 1100, dateReceived: '2024-01-12', status: 'Completed', invoiceId: 1005, referenceNumber: 'REF-003' },
    { id: 4, tenantName: 'David Lee', unit: 'Unit 302', paymentMethod: 'M-Pesa', amount: 1250, dateReceived: '2024-01-20', status: 'Pending', invoiceId: 1006, referenceNumber: 'REF-004' },
    { id: 5, tenantName: 'Mike Brown', unit: 'Unit 505', paymentMethod: 'PayPal', amount: 1600, dateReceived: '2024-01-22', status: 'Failed', invoiceId: 1007, referenceNumber: 'REF-005' },
    { id: 6, tenantName: 'Emma Wilson', unit: 'Unit 303', paymentMethod: 'Bank Transfer', amount: 1350, dateReceived: '2023-12-15', status: 'Refunded', invoiceId: 1008, referenceNumber: 'REF-006' },
    { id: 7, tenantName: 'James Taylor', unit: 'Unit 102', paymentMethod: 'Credit Card', amount: 1450, dateReceived: '2024-01-25', status: 'Completed', invoiceId: 1009, referenceNumber: 'REF-007' }
  ];

  // Payment statistics
  totalPayments: number = 0;
  completedPayments: number = 0;
  pendingPayments: number = 0;
  failedPayments: number = 0;

  constructor() {
    // Initialize the data source
    this.dataSource = new MatTableDataSource(this.payments);
    this.calculateStatistics();
  }

  ngOnInit() {
    console.log('Payments component initialized');
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy() {
    console.log('Payments component destroyed');
  }

  // Calculate payment statistics
  private calculateStatistics() {
    this.totalPayments = this.payments.length;
    this.completedPayments = this.payments.filter(p => p.status === 'Completed').length;
    this.pendingPayments = this.payments.filter(p => p.status === 'Pending').length;
    this.failedPayments = this.payments.filter(p => p.status === 'Failed' || p.status === 'Refunded').length;
  }

  // Apply filters to the table
  applyFilter() {
    this.dataSource.data = this.payments.filter(payment => {
      // Status filter
      if (this.statusFilter && payment.status !== this.statusFilter) {
        return false;
      }

      // Date range filter
      if (this.dateRangeFilter.start || this.dateRangeFilter.end) {
        const paymentDate = new Date(payment.dateReceived);
        
        if (this.dateRangeFilter.start && paymentDate < this.dateRangeFilter.start) {
          return false;
        }
        
        if (this.dateRangeFilter.end) {
          const endDate = new Date(this.dateRangeFilter.end);
          endDate.setHours(23, 59, 59, 999); // End of the day
          if (paymentDate > endDate) {
            return false;
          }
        }
      }

      // Search filter
      if (this.searchFilter) {
        const searchLower = this.searchFilter.toLowerCase();
        return (
          payment.tenantName.toLowerCase().includes(searchLower) ||
          payment.unit.toLowerCase().includes(searchLower) ||
          payment.paymentMethod.toLowerCase().includes(searchLower) ||
          payment.referenceNumber.toLowerCase().includes(searchLower) ||
          payment.amount.toString().includes(searchLower)
        );
      }

      return true;
    });

    // Reset pagination to first page
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // Clear all filters
  clearFilters() {
    this.statusFilter = '';
    this.dateRangeFilter = { start: null, end: null };
    this.searchFilter = '';
    this.dataSource.data = this.payments;
    
    // Reset pagination to first page
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // Action methods
  viewPaymentDetails(payment: Payment) {
    console.log('Viewing payment details:', payment.id);
    // Implement payment details view logic
    alert(`Viewing details for payment ${payment.referenceNumber}`);
  }

  processRefund(payment: Payment) {
    if (payment.status === 'Completed') {
      console.log('Processing refund for payment:', payment.id);
      // Implement refund logic
      const index = this.payments.findIndex(p => p.id === payment.id);
      if (index !== -1) {
        this.payments[index].status = 'Refunded';
        this.dataSource.data = [...this.payments]; // Refresh data
        this.calculateStatistics();
        alert(`Refund processed for payment ${payment.referenceNumber}`);
      }
    } else {
      alert('Only completed payments can be refunded.');
    }
  }

  retryFailedPayment(payment: Payment) {
    if (payment.status === 'Failed') {
      console.log('Retrying failed payment:', payment.id);
      // Implement retry logic
      const index = this.payments.findIndex(p => p.id === payment.id);
      if (index !== -1) {
        this.payments[index].status = 'Completed';
        this.dataSource.data = [...this.payments]; // Refresh data
        this.calculateStatistics();
        alert(`Payment ${payment.referenceNumber} successfully processed`);
      }
    } else {
      alert('Only failed payments can be retried.');
    }
  }

  // Export payments data
  exportPayments(format: 'csv' | 'pdf' | 'excel') {
    console.log(`Exporting payments data in ${format} format`);
    // Implement export logic
    alert(`Payments data exported as ${format.toUpperCase()}`);
  }

  // Get total amount of filtered payments
  getTotalAmount(): number {
    return this.dataSource.filteredData.reduce((sum, payment) => sum + payment.amount, 0);
  }

  // Get count of filtered payments
  getFilteredCount(): number {
    return this.dataSource.filteredData.length;
  }
}