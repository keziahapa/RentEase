export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  TENANT = 'tenant',
  LANDLORD = 'landlord',
  CARETAKER = 'caretaker',
  BUSINESS = 'business',
  ADMIN = 'admin',
  PROPERTY_MANAGER = 'property_manager'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export interface Tenant extends User {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyAddress: string;
  landlordId: string;
  landlordName: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  emergencyContact: EmergencyContact;
  documents: TenantDocument[];
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface TenantDocument {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedAt: Date;
  size: number;
}

export enum DocumentType {
  ID_COPY = 'id_copy',
  LEASE_AGREEMENT = 'lease_agreement',
  DEPOSIT_RECEIPT = 'deposit_receipt',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  OTHER = 'other'
}
export interface EnhancedUser {
  id: string;
  name: string;
  email: string;
  type: 'tenant' | 'landlord' | 'caretaker';
  status: 'active' | 'inactive' | 'suspended';
  joinDate: string;
  lastActive?: string;
  rentalProperty?: string;
  landlordName?: string;
  caretakerName?: string;
  rentAmount?: number;
  leaseEndDate?: string;
  propertiesCount?: number;
  tenantsCount?: number;
  caretakersCount?: number;
  totalRevenue?: number;
  companyName?: string;
  managedPropertiesCount?: number;
  landlordsCount?: number;
  activeMaintenance?: number;
  specialization?: string;
  rating?: number;
  verified?: boolean; 
}
