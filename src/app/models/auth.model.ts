import { User } from "./user.model";

export interface LoginRequest {
  phoneNumber: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  otpSent?: boolean;
  userId?: string;
  expiresIn?: number;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: User;
}

export interface PasswordResetRequest {
  phoneNumber: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  otpSent: boolean;
}