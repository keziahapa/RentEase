export interface Expense {
  id: number;
  property: string;
  expenseType: 'Maintenance' | 'Utility' | 'Service';
  amount: number;
  date: Date;
  status: 'Paid' | 'Unpaid';
}