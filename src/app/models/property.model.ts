// Property Request/Response Interfaces
export interface PropertyCreateRequest {
  name: string;
  location: string;
  propertyType: string;
  totalUnits: number;
  description?: string;
}

export interface PropertyResponse {
  id: string;
  name: string;
  location: string;
  propertyType: string;
  totalUnits: number;
  description?: string;
  status?: string;
  createdDate?: string;
  updatedDate?: string;
  ownerId?: string;
}

// Main Property Interface
export interface Property {
  id: string;
  name: string;
  address: string;
  location: string;
  type: string;
  propertyType: string;
  unitsCount: number;
  totalUnits: number;
  status: 'occupied' | 'vacant' | 'maintenance' | 'active' | 'inactive';
  landlordId: string;
  landlordName: string;
  landlordEmail: string;
  landlordPropertiesCount: number;
  caretakerId?: string;
  caretakerName?: string;
  caretakerEmail?: string;
  caretakerRating?: number;
  tenantsCount: number;
  occupiedUnits?: number;
  monthlyRevenue?: number;
  imageUrl?: string;
  description?: string;
  createdDate?: string;
  updatedDate?: string;
  ownerId?: string;
  tenants: Tenant[];
}

// Supporting Interfaces
export interface PropertyStats {
  totalProperties: number;
  activeProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  monthlyRevenue: number;
  occupancyRate: number;
}

export interface PropertyFilter {
  status?: 'all' | 'active' | 'inactive' | 'occupied' | 'vacant' | 'maintenance';
  propertyType?: string;
  searchTerm?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface Tenant {
  id: string;
  name: string;
  unitNumber: string;
  email: string;
  phone: string;
  rentAmount: number;
  leaseEndDate: string;
  leaseStartDate?: string;
  status?: 'active' | 'pending' | 'terminated';
  depositAmount?: number;
  depositStatus?: 'held' | 'returned' | 'forfeited';
}

// Extended interfaces for different use cases
export interface PropertyWithDetails extends Property {
  financials?: PropertyFinancials;
  maintenanceRequests?: MaintenanceRequest[];
  amenities?: string[];
  images?: string[];
}

export interface PropertyFinancials {
  propertyId: string;
  monthlyRent: number;
  annualRent: number;
  expenses: PropertyExpense[];
  netIncome: number;
  roi: number;
  valuation: number;
  lastValuationDate: string;
}

export interface PropertyExpense {
  id: string;
  category: 'maintenance' | 'utilities' | 'taxes' | 'insurance' | 'management' | 'other';
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
  frequency?: 'monthly' | 'quarterly' | 'annual';
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  unitNumber?: string;
  tenantId: string;
  tenantName: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'cleaning' | 'other';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  assignedName?: string;
  createdAt: string;
  updatedAt: string;
  scheduledDate?: string;
  completedDate?: string;
  cost?: number;
  images?: string[];
}

// Property type enums for better type safety
export enum PropertyStatus {
  OCCUPIED = 'occupied',
  VACANT = 'vacant',
  MAINTENANCE = 'maintenance',
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  COMMERCIAL = 'commercial',
  TOWNHOUSE = 'townhouse',
  LAND = 'land'
}