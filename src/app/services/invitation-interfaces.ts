export interface InviteTenantRequest {
  tenantEmail: string;
  propertyId: string;
  unitId?: string;
  unitNumber?: string;
  rentAmount?: number;
  depositAmount?: number;
  leaseStartDate?: string;
  leaseEndDate?: string;
}

export interface InviteCaretakerRequest {
  caretakerEmail: string;
  propertyId: string;
  responsibilities?: string[];
  accessLevel?: 'basic' | 'full';
}

export interface InvitationResponse {
  success: boolean;
  message: string;
  invitationId?: string;
  invitationToken?: string;
  expiresAt?: string;
}

export interface AvailableUnit {
  id: string;
  unitNumber: string;
  unitType: string;
  rentAmount: number;
  status: 'vacant' | 'occupied';
  propertyId: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'tenant' | 'caretaker';
  propertyId: string;
  propertyName?: string;
  unitId?: string;
  unitNumber?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
  invitationToken?: string;
}

export interface InvitationListResponse {
  success: boolean;
  message: string;
  invitations: Invitation[];
  totalCount: number;
  pendingCount: number;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  user?: any;
  property?: any;
}

export interface InviteDialogData {
  type: 'tenant' | 'caretaker';
  propertyId: string;
  propertyName: string;
  availableUnits?: AvailableUnit[];
  landlordName: string;
}