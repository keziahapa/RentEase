
export interface BusinessRegistration {
  id: number;
  businessName: string;
  businessRegistrationNumber: string;
  businessLicenseDocumentUrl: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  userEmail: string;
  userFullName: string;
}

export interface BusinessStatusResponse {
  success: boolean;
  message: string;
  data: BusinessRegistration | null;
}

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
    totalViews: number; 
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

export interface AdvertisementAnalytics {
  views: number;
  clicks: number;
  engagement: number;
  ctr: string;
  impressions: number;
}

export interface BusinessAnalytics {
  totalViews: number;
  totalClicks: number;
  averageCTR: string;
  totalSpent: number;
  topPerformingAd: string;
}

export interface BillingRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    fileUrl: string;
    fileName: string;
  };
}

export interface ErrorResponse {
  status: number;
  message: string;
  error?: any;
}