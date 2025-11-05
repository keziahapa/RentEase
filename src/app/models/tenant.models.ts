export interface TimelineEvent {
  title: string;
  date: string;
  description?: string;
  completed: boolean;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface Activity {
  id: number;
  type: string;
  title: string;
  description: string;
  icon: string;
  time: string;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  dateSubmitted: string;
}

export interface Conversation {
  id: string;
  name: string;
  avatarText: string;
  lastMessage: string;
  time: string;
}

export interface Message {
  recipient: string;
  subject: string;
  content: string;
}

export interface MarketplaceItem {
  title: string;
  description: string;
  price: number;
  location: string;
  seller: string;
}

export interface Review {
  reviewer: string;
  date: string;
  rating: number;
  content: string;
}

export interface TenantInfo {
  propertyName: string;
  landlordName: string;
  unitNumber: string;
  rentAmount: number;
  depositAmount: number;
  propertyAddress: string;
  leaseStartDate: string;
  leaseEndDate: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  method: string;
  reference: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url: string;
}