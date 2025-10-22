import { User, ExtendedUser, ApiResponse } from './auth-interfaces';

export interface ProfilePictureResponse {
  success: boolean;
  message: string;
  pictureUrl?: string;
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

export interface UnitRequest {
  unitNumber: string;
  unitType: string;
  rentAmount: number;
  deposit: number;
  description?: string;
}

export interface PropertyRequest {
  name: string;
  location: string;
  propertyType: string;
  totalUnits: number;
  description?: string;
  units?: UnitRequest[];
}

export interface PropertyResponse {
  success: boolean;
  message: string;
  property?: Property;
}

export interface UnitResponse {
  success: boolean;
  message: string;
  unit?: Unit;
}

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
}

export interface StatCardConfig {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  route: string[];
  queryParams?: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface SearchResponse<T> extends PaginatedResponse<T> {
  query: string;
  filters?: Record<string, any>;
}

export interface InviteDialogData {
  type: string;
  propertyId: string;
  propertyName: string;
  availableUnits: any[];
}

export interface InviteTenantRequest {
  tenantEmail: string;
  unitId: number;
}

export interface InviteCaretakerRequest {
  caretakerEmail: string;
  propertyId: number;
}

export interface AcceptInvitationRequest {
  invitationToken: string;
}

export interface InvitationResponse {
  success: boolean;
  message: string;
  invitation?: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    propertyId?: string;
    unitId?: string;
  };
}

// Dashboard specific interfaces
export interface DashboardData {
  totalProperties: number;
  occupancyRate: number;
  monthlyRevenue: number;
  rentCollectionRate: number;
  openMaintenance: number;
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
  type: 'rent_due' | 'maintenance' | 'inspection' | 'lease_expiry';
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
  type: 'stats' | 'chart' | 'list' | 'progress';
  data: any;
  size: 'small' | 'medium' | 'large';
  position: number;
  isVisible: boolean;
}

// Notification interfaces
export interface DashboardNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
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
}

// Export interfaces
export interface ExportRequest {
  format: 'csv' | 'pdf' | 'excel';
  dataType: 'properties' | 'tenants' | 'payments' | 'maintenance' | 'reports';
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
  defaultView: 'overview' | 'financial' | 'properties';
  visibleWidgets: string[];
  refreshInterval: number;
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year';
}

// API Response interfaces for dashboard
export interface DashboardResponse extends ApiResponse {
  data?: DashboardFullData;
}

export interface StatsResponse extends ApiResponse {
  data?: DashboardStats;
}

export interface ActivitiesResponse extends ApiResponse {
  data?: RecentActivity[];
}

export interface MaintenanceResponse extends ApiResponse {
  data?: MaintenanceRequest[];
}

export interface PaymentsResponse extends ApiResponse {
  data?: Payment[];
}