export interface Business {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  registrationDate: string;
  rating: number;
  totalJobs: number;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  businessType?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  totalRevenue?: number;
  averageJobValue?: number;
  responseTime?: number;
  satisfactionRate?: number;
  verificationStatus?: string;
  lastActive?: string;
  featured?: boolean;
}