export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  activeBusinesses: number;
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
  businessName?: string;
  businessRegistrationNumber?: string;
  registrationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  licenseDocument?: string;
  contactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface RejectionRequest {
  rejectionReason: string;
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