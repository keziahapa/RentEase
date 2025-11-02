
export interface InviteDialogData {
  type: 'tenant' | 'caretaker';
  propertyId: number;
  propertyName?: string;
  availableUnits?: AvailableUnit[];
}

export interface AvailableUnit {
  id: string;
  unitNumber: string;
  unitType: string;
  rentAmount?: number;
  isOccupied?: boolean;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
}


export interface InviteTenantRequest {
  tenantEmail: string;
  propertyId: number;
  unitId?: string;
  unitNumber?: string;
}

export interface InviteCaretakerRequest {
  caretakerEmail: string;
  propertyId: number;
}


export interface InvitationResponse {
  success: boolean;
  message: string;
  data?: any;
  invitationToken?: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface InvitationListResponse {
  success: boolean;
  message: string;
  data?: any[];
}


export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  propertyId?: string;
  propertyName?: string;
  createdAt: string;
  expiresAt: string;
  inviterName?: string;
  inviteeEmail?: string;
  inviteeRole?: string;
}

export interface InvitationDetails {
  id: string;
  invitationToken: string;
  inviteeEmail: string;
  inviteeRole: string;
  inviterName: string;
  propertyName: string;
  propertyId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  role?: string;
  unitNumber?: string;
   invitedBy?: string;
}


export interface AcceptInvitationRequest {
  invitationToken: string;
}

export interface ResendInvitationRequest {
  invitationId: string;
}

export interface CancelInvitationRequest {
  invitationId: string;
}


export interface InviteDialogResult {
  success: boolean;
  email: string;
  invitationToken?: string;
  message?: string;
  response?: any;
  error?: string;
  status?: number;
  unitId?: string;
  cancelled?: boolean;
}