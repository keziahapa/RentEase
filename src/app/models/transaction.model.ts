export interface Transaction {
  id: string;
  type: 'commission' | 'deposit' | 'payment';
  amount: number;
  business: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  currency?: string;
  description?: string;
  from?: any;
  to?: any;
  paymentMethod?: any;
  reference?: string;
  fees?: number;
  netAmount?: number;
}

export interface Dispute {
  id: string;
  type: 'deposit' | 'service' | 'payment';
  parties: string[];
  amount: number;
  status: 'pending' | 'resolved' | 'escalated';
  createdDate: string;
  title?: string;
  description?: string;
  priority?: string;
  currency?: string;
  resolvedDate?: string;
  resolution?: string;
}