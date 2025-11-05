import {  UserRole } from "./user.model";

export interface RegistrationRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  nationalId: string;
  registrationType: UserRole;
  termsAccepted: boolean;
  invitationCode?: string;
  invitationType?: string;
  
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  userId?: string;
  otpSent?: boolean;
  redirectTo?: string;
}

export interface RegistrationValidationErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  nationalId?: string;
  registrationType?: string;
  termsAccepted?: string;
  general?: string;
}