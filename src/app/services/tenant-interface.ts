export interface TenantUnit {
  id: number;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
  landlordName: string;
  rentAmount: number;
  depositAmount: number;
  leaseStartDate: string;
  leaseEndDate: string;
  occupancyStatus: string;
  openMaintenanceRequests: number;
  paymentStatus: string;
  daysUntilDue: number;
  nextPaymentDate?: string;
}

export interface TenantData {
  currentRent: number;
  paymentStatus: string;
  daysUntilDue: number;
  openMaintenance: number;
  leaseEndDays: number;
  propertyAddress: string;
  landlordName: string;
  depositAmount: number;
  unitNumber: string;
  propertyName: string;
  nextPaymentDate?: string;
  pendingMoveOutNotices?: number;
  hasActiveMoveOut?: boolean;
  upcomingMoveOutDate?: string;
}

export interface TenantQuickAction {
  icon: string;
  label: string;
  description: string;
  route: string[];
  color: string;
}

export interface TenantActivity {
  type: string;
  message: string;
  time: string;
  icon: string;
}

export interface MoveOutNoticeRequest {
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  notes?: string;
}

export interface MoveOutNotice {
  id: number;
  unitId: number;
  moveOutDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submittedDate: string;
  unitNumber: string;
  propertyName: string;
  notes?: string;
}

export interface MoveOutNoticeResponse {
  data: MoveOutNotice[];
  total: number;
  page: number;
  limit: number;
}