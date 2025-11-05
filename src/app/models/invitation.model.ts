import { UserRole } from "./user.model";

export interface InvitationData {
  id: string;
  code: string;
  type: 'tenant' | 'caretaker';
  propertyId?: string;
  propertyName?: string;
  unitNumber?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  invitedBy: string;
  invitedByName: string;
  invitedByRole: UserRole;
  phoneNumber?: string;
  email?: string;
  status: InvitationStatus;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface CreateInvitationRequest {
  type: 'tenant' | 'caretaker';
  phoneNumber: string;
  email?: string;
  propertyId?: string;
  unitNumber?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  expiresInDays?: number;
}