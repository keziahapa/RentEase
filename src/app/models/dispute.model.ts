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