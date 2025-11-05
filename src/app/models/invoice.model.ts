export interface Invoice {
  id: number;
  tenantName: string;
  unit: string;
  invoiceDate: Date;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}