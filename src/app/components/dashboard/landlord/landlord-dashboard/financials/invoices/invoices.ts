
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import{ FilterPipe}from '../../../../../../pipes/filter.pipe'
import { MatDividerModule } from '@angular/material/divider';

interface Invoice {
  id: number;
  invoiceNumber: string;
  tenantId: number;
  tenantName: string;
  unit: string;
  property: string;
  invoiceDate: Date;
  dueDate: Date;
  rentAmount: number;
  utilities: number;
  lateFees: number;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partially Paid';
  paidAmount: number;
  balanceAmount: number;
  description: string;
  paymentMethod?: string;
  paidDate?: Date;
  remindersSent: number;
  lastReminderDate?: Date;
}

interface Tenant {
  id: number;
  name: string;
  email: string;
  phone: string;
  unit: string;
  property: string;
  rentAmount: number;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTabsModule,
    FilterPipe ,MatDividerModule
  ],
  templateUrl: './invoices.html',
  styleUrls: ['./invoices.scss']
})
export class InvoicesComponent implements OnInit {
  displayedColumns: string[] = [
    'invoiceNumber', 
    'tenantName', 
    'unit', 
    'invoiceDate', 
    'dueDate', 
    'totalAmount', 
    'paidAmount', 
    'balanceAmount', 
    'status', 
    'actions'
  ];

  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  tenants: Tenant[] = [];
  
  // Filters
  statusFilter = '';
  searchQuery = '';
  selectedTab = 0;

  // Stats
  totalInvoices = 0;
  totalAmount = 0;
  paidAmount = 0;
  overdueAmount = 0;
  pendingAmount = 0;

  // Form
  invoiceForm: FormGroup;
  isCreateMode = false;
  editingInvoice: Invoice | null = null;

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.invoiceForm = this.createInvoiceForm();
  }

  ngOnInit() {
    this.loadSampleData();
    this.calculateStats();
    this.applyFilters();
  }

  createInvoiceForm(): FormGroup {
    return this.fb.group({
      tenantId: ['', Validators.required],
      invoiceDate: [new Date(), Validators.required],
      dueDate: ['', Validators.required],
      rentAmount: ['', [Validators.required, Validators.min(0)]],
      utilities: [0, [Validators.min(0)]],
      lateFees: [0, [Validators.min(0)]],
      description: ['Monthly rent invoice']
    });
  }

  loadSampleData() {
    this.tenants = [
      { id: 1, name: 'John Smith', email: 'john@email.com', phone: '0712345678', unit: 'Unit 101', property: 'Westlands Apartments', rentAmount: 50000 },
      { id: 2, name: 'Mary Johnson', email: 'mary@email.com', phone: '0723456789', unit: 'Unit 202', property: 'Westlands Apartments', rentAmount: 55000 },
      { id: 3, name: 'Bob Wilson', email: 'bob@email.com', phone: '0734567890', unit: 'Unit 303', property: 'Kileleshwa Towers', rentAmount: 45000 },
      { id: 4, name: 'Sarah Davis', email: 'sarah@email.com', phone: '0745678901', unit: 'Unit 404', property: 'Kileleshwa Towers', rentAmount: 48000 },
      { id: 5, name: 'Mike Brown', email: 'mike@email.com', phone: '0756789012', unit: 'Unit 505', property: 'Lavington Suites', rentAmount: 60000 }
    ];

  
    this.invoices = [
      {
        id: 1,
        invoiceNumber: 'INV-2024-001',
        tenantId: 1,
        tenantName: 'John Smith',
        unit: 'Unit 101',
        property: 'Westlands Apartments',
        invoiceDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15'),
        rentAmount: 50000,
        utilities: 5000,
        lateFees: 0,
        totalAmount: 55000,
        status: 'Paid',
        paidAmount: 55000,
        balanceAmount: 0,
        description: 'January 2024 Monthly Rent',
        paymentMethod: 'Bank Transfer',
        paidDate: new Date('2024-01-10'),
        remindersSent: 1,
        lastReminderDate: new Date('2024-01-08')
      },
      {
        id: 2,
        invoiceNumber: 'INV-2024-002',
        tenantId: 2,
        tenantName: 'Mary Johnson',
        unit: 'Unit 202',
        property: 'Westlands Apartments',
        invoiceDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15'),
        rentAmount: 55000,
        utilities: 6000,
        lateFees: 0,
        totalAmount: 61000,
        status: 'Sent',
        paidAmount: 0,
        balanceAmount: 61000,
        description: 'January 2024 Monthly Rent',
        remindersSent: 2,
        lastReminderDate: new Date('2024-01-12')
      },
      {
        id: 3,
        invoiceNumber: 'INV-2024-003',
        tenantId: 3,
        tenantName: 'Bob Wilson',
        unit: 'Unit 303',
        property: 'Kileleshwa Towers',
        invoiceDate: new Date('2023-12-01'),
        dueDate: new Date('2023-12-15'),
        rentAmount: 45000,
        utilities: 4500,
        lateFees: 2250,
        totalAmount: 51750,
        status: 'Overdue',
        paidAmount: 0,
        balanceAmount: 51750,
        description: 'December 2023 Monthly Rent',
        remindersSent: 5,
        lastReminderDate: new Date('2024-01-05')
      },
      {
        id: 4,
        invoiceNumber: 'INV-2024-004',
        tenantId: 4,
        tenantName: 'Sarah Davis',
        unit: 'Unit 404',
        property: 'Kileleshwa Towers',
        invoiceDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15'),
        rentAmount: 48000,
        utilities: 5200,
        lateFees: 0,
        totalAmount: 53200,
        status: 'Partially Paid',
        paidAmount: 30000,
        balanceAmount: 23200,
        description: 'January 2024 Monthly Rent',
        remindersSent: 1,
        lastReminderDate: new Date('2024-01-16')
      },
      {
        id: 5,
        invoiceNumber: 'INV-2024-005',
        tenantId: 5,
        tenantName: 'Mike Brown',
        unit: 'Unit 505',
        property: 'Lavington Suites',
        invoiceDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15'),
        rentAmount: 60000,
        utilities: 7000,
        lateFees: 0,
        totalAmount: 67000,
        status: 'Draft',
        paidAmount: 0,
        balanceAmount: 67000,
        description: 'January 2024 Monthly Rent',
        remindersSent: 0
      }
    ];

    this.filteredInvoices = [...this.invoices];
  }

  calculateStats() {
    this.totalInvoices = this.invoices.length;
    this.totalAmount = this.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    this.paidAmount = this.invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    this.overdueAmount = this.invoices
      .filter(inv => inv.status === 'Overdue')
      .reduce((sum, inv) => sum + inv.balanceAmount, 0);
    this.pendingAmount = this.invoices
      .filter(inv => inv.status === 'Sent' || inv.status === 'Partially Paid')
      .reduce((sum, inv) => sum + inv.balanceAmount, 0);
  }

  applyFilters() {
    let filtered = [...this.invoices];

    // Filter by tab
    switch (this.selectedTab) {
      case 1: // Paid
        filtered = filtered.filter(inv => inv.status === 'Paid');
        break;
      case 2: // Pending
        filtered = filtered.filter(inv => inv.status === 'Sent' || inv.status === 'Partially Paid');
        break;
      case 3: // Overdue
        filtered = filtered.filter(inv => inv.status === 'Overdue');
        break;
      case 4: // Draft
        filtered = filtered.filter(inv => inv.status === 'Draft');
        break;
    }

    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(inv => inv.status === this.statusFilter);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.tenantName.toLowerCase().includes(query) ||
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.unit.toLowerCase().includes(query) ||
        inv.property.toLowerCase().includes(query)
      );
    }

    this.filteredInvoices = filtered;
  }

  onTabChange(index: number) {
    this.selectedTab = index;
    this.applyFilters();
  }

  onSearch() {
    this.applyFilters();
  }

  onStatusFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.statusFilter = '';
    this.searchQuery = '';
    this.selectedTab = 0;
    this.applyFilters();
  }

  openCreateInvoice() {
    this.isCreateMode = true;
    this.editingInvoice = null;
    this.invoiceForm.reset();
    this.invoiceForm.patchValue({
      invoiceDate: new Date(),
      utilities: 0,
      lateFees: 0,
      description: 'Monthly rent invoice'
    });
  }

  closeCreateInvoice() {
    this.isCreateMode = false;
    this.editingInvoice = null;
    this.invoiceForm.reset();
  }

  onTenantChange() {
    const tenantId = this.invoiceForm.get('tenantId')?.value;
    const tenant = this.tenants.find(t => t.id === tenantId);
    if (tenant) {
      this.invoiceForm.patchValue({
        rentAmount: tenant.rentAmount
      });
      
      // Auto-calculate due date (15 days from invoice date)
      const invoiceDate = this.invoiceForm.get('invoiceDate')?.value;
      if (invoiceDate) {
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 15);
        this.invoiceForm.patchValue({ dueDate });
      }
    }
  }

  saveInvoice() {
    if (this.invoiceForm.valid) {
      const formValue = this.invoiceForm.value;
      const tenant = this.tenants.find(t => t.id === formValue.tenantId);
      
      if (!tenant) return;

      const totalAmount = formValue.rentAmount + formValue.utilities + formValue.lateFees;
      
      const newInvoice: Invoice = {
        id: this.invoices.length + 1,
        invoiceNumber: this.generateInvoiceNumber(),
        tenantId: formValue.tenantId,
        tenantName: tenant.name,
        unit: tenant.unit,
        property: tenant.property,
        invoiceDate: formValue.invoiceDate,
        dueDate: formValue.dueDate,
        rentAmount: formValue.rentAmount,
        utilities: formValue.utilities,
        lateFees: formValue.lateFees,
        totalAmount: totalAmount,
        status: 'Draft',
        paidAmount: 0,
        balanceAmount: totalAmount,
        description: formValue.description,
        remindersSent: 0
      };

      this.invoices.push(newInvoice);
      this.calculateStats();
      this.applyFilters();
      this.closeCreateInvoice();
      
      this.snackBar.open('Invoice created successfully!', 'Close', { duration: 3000 });
    }
  }

  generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = this.invoices.length + 1;
    return `INV-${year}-${count.toString().padStart(3, '0')}`;
  }

  sendInvoice(invoice: Invoice) {
    invoice.status = 'Sent';
    this.snackBar.open(`Invoice sent to ${invoice.tenantName}`, 'Close', { duration: 3000 });
    this.applyFilters();
  }

  sendReminder(invoice: Invoice) {
    invoice.remindersSent++;
    invoice.lastReminderDate = new Date();
    this.snackBar.open(`Reminder sent to ${invoice.tenantName}`, 'Close', { duration: 3000 });
  }

  markAsPaid(invoice: Invoice) {
    invoice.status = 'Paid';
    invoice.paidAmount = invoice.totalAmount;
    invoice.balanceAmount = 0;
    invoice.paidDate = new Date();
    invoice.paymentMethod = 'Manual Entry';
    
    this.calculateStats();
    this.applyFilters();
    this.snackBar.open(`Invoice marked as paid for ${invoice.tenantName}`, 'Close', { duration: 3000 });
  }

  editInvoice(invoice: Invoice) {
    this.editingInvoice = invoice;
    this.isCreateMode = true;
    
    this.invoiceForm.patchValue({
      tenantId: invoice.tenantId,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      rentAmount: invoice.rentAmount,
      utilities: invoice.utilities,
      lateFees: invoice.lateFees,
      description: invoice.description
    });
  }

  deleteInvoice(invoice: Invoice) {
    const index = this.invoices.findIndex(inv => inv.id === invoice.id);
    if (index > -1) {
      this.invoices.splice(index, 1);
      this.calculateStats();
      this.applyFilters();
      this.snackBar.open('Invoice deleted successfully!', 'Close', { duration: 3000 });
    }
  }

  downloadInvoice(invoice: Invoice) {
    this.snackBar.open(`Downloading invoice ${invoice.invoiceNumber}`, 'Close', { duration: 3000 });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Paid': return 'success';
      case 'Sent': return 'primary';
      case 'Overdue': return 'warn';
      case 'Partially Paid': return 'accent';
      case 'Draft': return '';
      default: return '';
    }
  }

  isOverdue(invoice: Invoice): boolean {
    return invoice.status === 'Overdue' || 
           (invoice.status !== 'Paid' && new Date() > new Date(invoice.dueDate));
  }

  getDaysOverdue(invoice: Invoice): number {
    if (invoice.status === 'Paid') return 0;
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  bulkSendReminders() {
    const overdueInvoices = this.invoices.filter(inv => this.isOverdue(inv) && inv.status !== 'Paid');
    
    overdueInvoices.forEach(invoice => {
      invoice.remindersSent++;
      invoice.lastReminderDate = new Date();
    });

    this.snackBar.open(`Reminders sent to ${overdueInvoices.length} tenants`, 'Close', { duration: 3000 });
  }

  exportToExcel() {
    this.snackBar.open('Exporting invoices to Excel...', 'Close', { duration: 3000 });
  }

  generateReport() {
    this.snackBar.open('Generating invoice report...', 'Close', { duration: 3000 });
  }
}