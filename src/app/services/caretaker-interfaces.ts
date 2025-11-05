
export interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalUnits: number;
  occupiedUnits: number;
  maintenanceRequests: number;
  units?: Unit[];
  imageUrl?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: number;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  rentAmount: number;
  isOccupied: boolean;
  tenantName?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  status: 'available' | 'occupied' | 'maintenance';
  propertyId: number;
  unitType?: string;       
  description?: string;     
  deposit?: number;         
  images?: string[];        
}

export interface MoveOutNotice {
  id: number;
  tenantName: string;
  unitNumber: string;
  propertyName: string;
  moveOutDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  submittedDate: string;
  inspectionDate?: string;
  depositStatus?: 'pending' | 'refunded' | 'deducted';
}

export interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  pendingMaintenance: number;
  pendingMoveOuts: number;
}

export interface CreateUnitRequest {
  unitNumber: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  rentAmount: number;
  description?: string;
  unitType?: string;       
  deposit?: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: string;
}