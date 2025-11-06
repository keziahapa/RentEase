export interface DashboardData {
  totalProperties: number;
  occupancyRate: number;
  monthlyRevenue: number;
  rentCollectionRate: number;
  openMaintenance: number;
  // Add move-out related dashboard data
  pendingMoveOutNotices: number;
  approvedMoveOutNotices: number;
  upcomingMoveOuts: number;
}

export interface QuickAction {
  icon: string;
  label: string;
  description: string;
  route: string[];
  color: string;
}

export interface RecentActivity {
  type: string;
  message: string;
  time: string;
  icon: string;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  images?: string[];
  createdAt: string;
  updatedAt: string;
  property?: Property;
  unit?: Unit;
  tenant?: User;
}

export interface Payment {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  tenant?: User;
  property?: Property;
  unit?: Unit;
}

export interface RentCollectionStatus {
  totalDue: number;
  collected: number;
  pending: number;
  overdue: number;
  collectionRate: number;
  month: string;
  year: number;
}

export interface UpcomingDeadline {
  id: string;
  type: 'rent_due' | 'maintenance' | 'inspection' | 'lease_expiry' | 'move_out';
  title: string;
  description: string;
  dueDate: string;
  property?: Property;
  unit?: Unit;
  tenant?: User;
  priority: 'low' | 'medium' | 'high';
}

export interface DashboardFullData {
  stats: DashboardStats;
  recentActivities: RecentActivity[];
  maintenanceRequests: MaintenanceRequest[];
  rentCollection: RentCollectionStatus;
  upcomingDeadlines: UpcomingDeadline[];
  quickActions: QuickAction[];
  // Add move-out data
  moveOutNotices?: LandlordMoveOutNotice[];
  moveOutStats?: MoveOutStats;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

export interface RevenueChartData {
  monthly: ChartData;
  yearly: ChartData;
}

export interface OccupancyChartData {
  byProperty: ChartData;
  byType: ChartData;
}

// Widget interfaces
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'stats' | 'chart' | 'list' | 'progress' | 'move_out';
  data: any;
  size: 'small' | 'medium' | 'large';
  position: number;
  isVisible: boolean;
}

// Notification interfaces
export interface DashboardNotification {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success' | 'move_out';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  action?: {
    label: string;
    route: string[];
  };
}

// Filter interfaces
export interface DashboardFilter {
  dateRange?: {
    start: string;
    end: string;
  };
  properties?: string[];
  status?: string[];
  type?: string;
  includeMoveOut?: boolean;
}

// Export interfaces
export interface ExportRequest {
  format: 'csv' | 'pdf' | 'excel';
  dataType: 'properties' | 'tenants' | 'payments' | 'maintenance' | 'reports' | 'move_out';
  filters?: DashboardFilter;
}

export interface ExportResponse {
  success: boolean;
  message: string;
  downloadUrl?: string;
  fileSize?: number;
}

// Dashboard settings
export interface DashboardSettings {
  layout: 'grid' | 'list';
  defaultView: 'overview' | 'financial' | 'properties' | 'move_out';
  visibleWidgets: string[];
  refreshInterval: number;
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year';
}

// API Response interfaces for dashboard
export interface DashboardResponse {
  success: boolean;
  message?: string;
  data?: DashboardFullData;
}

export interface StatsResponse {
  success: boolean;
  message?: string;
  data?: DashboardStats;
}

export interface ActivitiesResponse {
  success: boolean;
  message?: string;
  data?: RecentActivity[];
}

export interface MaintenanceResponse {
  success: boolean;
  message?: string;
  data?: MaintenanceRequest[];
}

export interface PaymentsResponse {
  success: boolean;
  message?: string;
  data?: Payment[];
}

export interface MoveOutNotice {
  id?: number;
  tenantId: number;
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: number;
  notes?: string;
  landlordNotes?: string;
  tenantNotes?: string;
}

export interface TenantMoveOutNotice extends MoveOutNotice {
  property?: {
    name: string;
    address: string;
    landlordName?: string;
  };
  tenant?: {
    fullName: string;
    email: string;
    phone?: string;
  };
  unit?: {
    unitNumber: string;
    unitType: string;
  };
}

export interface LandlordMoveOutNotice extends MoveOutNotice {
  property?: {
    id: number;
    name: string;
    address: string;
  };
  tenant?: {
    id: number;
    fullName: string;
    email: string;
    phone?: string;
    leaseEndDate?: string;
  };
  unit?: {
    id: number;
    unitNumber: string;
    unitType: string;
    rentAmount?: number;
  };
  landlord?: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface MoveOutNoticeResponse {
  success: boolean;
  message?: string;
  data: MoveOutNotice | MoveOutNotice[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TenantMoveOutNoticeResponse {
  success: boolean;
  message?: string;
  data: TenantMoveOutNotice | TenantMoveOutNotice[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface LandlordMoveOutNoticeResponse {
  success: boolean;
  message?: string;
  data: LandlordMoveOutNotice | LandlordMoveOutNotice[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface MoveOutNoticeRequest {
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  notes?: string;
  propertyName?: string;
  unitNumber?: string;
  propertyAddress?: string;
}

export interface MoveOutActionRequest {
  notes?: string;
  landlordNotes?: string;
  followUpDate?: string;
}

export interface MoveOutStats {
  totalNotices: number;
  pendingNotices: number;
  approvedNotices: number;
  rejectedNotices: number;
  cancelledNotices: number;
  upcomingMoveOuts: number;
  averageProcessingTime: number; 
  monthlyTrend: {
    month: string;
    count: number;
  }[];
  reasonBreakdown: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}

export interface MoveOutTimelineEvent {
  id: number;
  noticeId: number;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'UNDER_REVIEW' | 'FOLLOW_UP';
  description: string;
  performedBy: string;
  performedById: number;
  timestamp: string;
  notes?: string;
}

export interface MoveOutFollowUp {
  id: number;
  noticeId: number;
  followUpDate: string;
  type: 'INSPECTION' | 'DOCUMENT_COLLECTION' | 'DEPOSIT_REFUND' | 'FINAL_PAYMENT' | 'OTHER';
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  assignedTo?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoveOutWidgetData {
  pendingCount: number;
  approvedCount: number;
  upcomingCount: number;
  recentNotices: LandlordMoveOutNotice[];
  urgentActions: {
    id: number;
    noticeId: number;
    type: string;
    description: string;
    dueDate: string;
  }[];
}

// Move-Out Filter Options
export interface MoveOutFilter {
  status?: ('PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED')[];
  propertyId?: number[];
  dateRange?: {
    start: string;
    end: string;
  };
  reason?: string[];
  searchTerm?: string;
}

// Move-Out Export Data
export interface MoveOutExportData {
  notices: LandlordMoveOutNotice[];
  statistics: MoveOutStats;
  timeline: {
    [noticeId: number]: MoveOutTimelineEvent[];
  };
}

// Move-Out Notification Types
export interface MoveOutNotification {
  id: number;
  type: 'NEW_NOTICE' | 'APPROVAL_REQUIRED' | 'MOVE_OUT_REMINDER' | 'FOLLOW_UP_REMINDER';
  noticeId: number;
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

// Move-Out Calendar Event
export interface MoveOutCalendarEvent {
  id: number;
  noticeId: number;
  title: string;
  description: string;
  start: string;
  end: string;
  type: 'MOVE_OUT' | 'INSPECTION' | 'FOLLOW_UP';
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  status: string;
  color: string;
}

// Move-Out Report Data
export interface MoveOutReport {
  period: string;
  totalMoveOuts: number;
  approvedMoveOuts: number;
  rejectedMoveOuts: number;
  averageNoticePeriod: number;
  commonReasons: {
    reason: string;
    count: number;
  }[];
  propertyBreakdown: {
    propertyName: string;
    count: number;
  }[];
  monthlyTrend: {
    month: string;
    moveOuts: number;
    approvals: number;
  }[];
}

// Additional Dashboard Stats with Move-Out Data
export interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  maintenanceUnits: number;
  occupancyRate: number;
  monthlyRevenue: number;
  annualRevenue: number;
  pendingRent: number;
  totalTenants: number;
  // Move-out specific stats
  pendingMoveOutNotices: number;
  upcomingMoveOuts: number;
  moveOutRate: number; // percentage of units with move-out notices
  averageVacancyPeriod: number; // days between move-out and new tenant
}

// Property and Unit interfaces
export interface Property {
  id: string;
  name: string;
  location: string;
  propertyType: string;
  totalUnits: number;
  description?: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  units?: Unit[];
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface Unit {
  id: string | number;
  unitNumber: string;
  unitType: string;
  rentAmount: number;
  deposit: number;
  description?: string;
  status?: "occupied" | "vacant" | "maintenance" | "reserved" | "";
  tenant?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  type?: string;
  rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  status?: string;
}

export interface TenantDashboardData {
  currentRent: number;
  paymentStatus: string;
  daysUntilDue: number;
  openMaintenance: number;
  leaseEndDays: number;
  propertyAddress: string;
  landlordName: string;
  depositAmount: number;
  // Add move-out data
  pendingMoveOutNotices: number;
  upcomingMoveOutDate?: string;
  hasActiveMoveOut: boolean;
}