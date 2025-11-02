export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitNumber: string;
  rentAmount: number;
  leaseStartDate: string;
  leaseEndDate: string;
  status: 'active' | 'inactive' | 'pending';
  emergencyContact?: string;
  emergencyPhone?: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  activeBusinesses: number;
  totalBusinesses: number;
  monthlyRevenue: number;
  commissionRevenue: number;
  pendingApprovals: number;
  activeDisputes: number;
  userGrowth: number;
  revenueGrowth: number;
  propertiesGrowth: number;
  totalLandlords: number;
  totalTenants: number;
  totalCaretakers: number;
  totalAdmins: number;
  platformEarnings: number;
  systemHealth: string;
  monthlyActiveUsers: number;
  totalTransactions: number;
  averageRating: number;
  newUsersToday?: number;
  newPropertiesThisWeek?: number;
  occupancyRate?: number;
  rentCollectionRate?: number;
  maintenanceCompletionRate?: number;
  disputeResolutionRate?: number;
  reportedIssuesThisWeek?: number;
  topPerformingZones?: string[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'TENANT' | 'LANDLORD' | 'CARETAKER' | 'BUSINESS' | 'ADMIN';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  phoneNumber?: string;
  createdAt: string;
  lastLogin?: string;
  verified: boolean;
  emailVerified: boolean;
  profileImage?: string;
  propertiesCount?: number;
  tenantsCount?: number;
  managedPropertiesCount?: number;
  businessName?: string;
  businessCategory?: string;
  rating?: number;
  specialization?: string;
  companyName?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  location: string;
  type: string;
  propertyType: 'apartment' | 'house' | 'commercial' | 'townhouse' | 'condo';
  unitsCount: number;
  totalUnits: number;
  status: 'occupied' | 'vacant' | 'maintenance' | 'unavailable';
  landlordId: string;
  landlordName: string;
  landlordEmail: string;
  landlordPropertiesCount: number;
  caretakerId?: string;
  caretakerName?: string;
  caretakerEmail?: string;
  caretakerRating?: number;
  tenantsCount: number;
  occupiedUnits: number;
  monthlyRevenue: number;
  createdAt: string;
  updatedAt: string;
  amenities?: string[];
  images?: string[];
  description?: string;
  tenants?: Tenant[];
}

export interface Business {
  id: number;
  name: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  registrationDate: string;
  rating: number;
  totalJobs: number;
  ownerName: string;
  ownerEmail: string;
  phoneNumber: string;
  address: string;
  description?: string;
  documents?: string[];
  rejectionReason?: string;
  suspensionReason?: string;
  services?: string[];
  businessHours?: {
    open: string;
    close: string;
    days: string[];
  };
  licenseNumber?: string;
  taxId?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  registrationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  licenseDocument?: string;
  contactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Dispute {
  id: string;
  type: 'payment' | 'service' | 'deposit' | 'maintenance' | 'other';
  title: string;
  description: string;
  parties: string[];
  amount: number;
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  createdDate: string;
  resolvedDate?: string;
  assignedAdmin?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  evidence?: string[];
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'rent' | 'deposit' | 'maintenance' | 'commission' | 'refund' | 'service';
  amount: number;
  business: string;
  date: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference: string;
  payer: string;
  payee: string;
  commissionAmount: number;
  platformFee: number;
  description?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface SystemSettings {
  platformName: string;
  platformCommission: number;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  maxPropertiesPerLandlord: number;
  maxUnitsPerProperty: number;
  currency: string;
  timezone: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoApproveBusinesses: boolean;
  rentReminderDays: number;
  lateFeePercentage: number;
  maxDisputeAmount: number;
  minRentAmount: number;
  maxRentAmount: number;
}

export interface Unit {
  id: string;
  unitNumber: string;
  unitType: string;
  description: string;
  rentAmount: number;
  deposit: number;
  isOccupied: boolean;
  propertyId: string;
  propertyName?: string;
  tenant?: Tenant;
  amenities?: string[];
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  propertyId: string;
  unitId: string;
  tenantId: string;
  tenantName: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  scheduledDate?: string;
  completedDate?: string;
  cost?: number;
  images?: string[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  recipient: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  role?: string;
  type?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: string[];
}

export interface Advertisement {
  id: number;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  businessId: number;
  businessName?: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  clicks?: number;
  views?: number;
}

export interface RejectionRequest {
  rejectionReason: string;
}

export interface ExternalBusiness {
  id: number;
  businessName: string;
  businessRegistrationNumber: string;
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  licenseDocument?: string;
  contactEmail?: string;
  phoneNumber?: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}
