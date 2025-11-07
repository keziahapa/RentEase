export enum UserRole {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
  CARETAKER = 'CARETAKER',
  BUSINESS = 'BUSINESS',
  ADMIN = 'ADMIN'
}

export type UserRoleType = keyof typeof UserRole;

export interface User {
  id: string | number;  // ✅ Allow both string and number
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole | string;
  avatar?: string;
  emailVerified?: boolean;
  verified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtendedUser extends User {
  bio?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean; // ✅ Used only in frontend, not sent to API
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole | string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: number;
  fullName: string;
  email: string;
  role: UserRole | string;
  verified: boolean;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
  success?: boolean;
  user?: User;
}

export interface RegisterResponse {
  user?: User;
  message: string;
  success: boolean;
  token?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface OtpVerificationRequest {
  email: string;
  otpCode: string;
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface OtpRequest {
  email: string;
  type: 'email_verification' | 'password_reset' | '2fa' | 'phone_verification';
}

export interface OtpVerifyRequest {
  email: string;
  otpCode: string;
  type: 'email_verification' | 'password_reset' | '2fa' | 'phone_verification';
}

export interface OtpResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface VerifyPasswordResetOtpRequest {
  email: string;
  otpCode: string;
}

export interface UpdatePhoneRequest {
  newPhoneNumber: string;
}

export interface UpdatePhoneResponse {
  success: boolean;
  message: string;
  updatedPhoneNumber?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  token?: string;
  user?: User;
}

export interface ApiErrorResponse {
  message: string;
  status: number;
  timestamp?: string;
  path?: string;
  error?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export type AuthenticationStatus = 'authenticated' | 'unauthenticated' | 'pending';

export interface RegistrationFormData {
  role: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export interface RegistrationFieldErrors {
  role: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}