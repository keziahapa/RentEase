export interface DashboardStats {
  rentStatus: RentStatus;
  nextPaymentDate: Date;
  amountDue: number;
  depositAmount: number;
  unreadMessages: number;
  activeMaintenanceRequests: number;
  leaseExpiryDays: number;
  overdueAmount: number;
  totalPaidThisYear: number;
}

export enum RentStatus {
  PAID = 'paid',
  DUE = 'due',
  OVERDUE = 'overdue',
  PARTIAL = 'partial'
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: Date;
  icon: string;
  color: string;
  actionUrl?: string;
  metadata?: any;
}

export enum ActivityType {
  PAYMENT = 'payment',
  MAINTENANCE = 'maintenance',
  MESSAGE = 'message',
  DOCUMENT = 'document',
  LEASE = 'lease',
  ANNOUNCEMENT = 'announcement'
}
export interface AdminStats {
  totalUsers: number;
  totalLandlords: number;
  totalTenants: number;
  totalCaretakers: number;
  totalProperties: number;
  landlordTenants: number;
  activeBusinesses: number;
  monthlyTransactions: number;
  commissionRevenue: number;
  pendingApprovals: number;
  activeDisputes: number;
  userGrowth: number;
  revenueGrowth: number;
  propertiesGrowth: number;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

export interface Activity {
  id: string;
  type: 'user' | 'property' | 'business' | 'transaction' | 'dispute';
  action: string;
  description: string;
  timestamp: string;
  icon: string;
}

export interface ChartData {
  label: string;
  value: number;
}

export interface Notification {
  id: number;
  message: string;
  unread: boolean;
  type?: string;
  timestamp?: string;
  priority?: string;
}