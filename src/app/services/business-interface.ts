
export interface ExternalBusinessRegistration {
  data: {
    businessName: string;
    businessRegistrationNumber: string;
  };
  licenseDocument: string;
}

export interface ExternalBusiness {
  id: number;
  businessName: string;
  businessRegistrationNumber: string;
  licenseDocument?: string;
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  contactEmail?: string;
  phoneNumber?: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
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

export interface CreateAdvertisementRequest {
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
}

export interface BusinessDashboardData {
  totalAds: number;
  activeAds: number;
  pendingAds: number;
  totalSpent: number;
  totalClicks: number;
  approvalRate: string;
  businessName: string;
  registrationStatus: string;
  recentPerformance?: {
    clicks: number;
    views: number;
    conversions: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}