import { AuthToken } from "./auth.model";
import { User } from "./user.model";

export interface OTPRequest {
  phoneNumber: string;
  purpose: OTPPurpose;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  otpSent: boolean;
  expiresIn: number;
  attemptsRemaining?: number;
}

export interface OTPVerificationRequest {
  phoneNumber: string;
  otpCode: string;
  purpose: OTPPurpose;
}

export interface OTPVerificationResponse {
  success: boolean;
  message: string;
  isValid: boolean;
  token?: AuthToken;
  user?: User;
  attemptsRemaining?: number;
}

export enum OTPPurpose {
  REGISTRATION = 'registration',
  LOGIN = 'login',
  PASSWORD_RESET = 'password_reset',
  PHONE_VERIFICATION = 'phone_verification'
}