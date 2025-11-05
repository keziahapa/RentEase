import { UserRole } from '../../models/user.model';

export const USER_ROLES = [
  { 
    id: UserRole.TENANT, 
    name: 'Tenant', 
    description: '', 
    disabled: false,
    icon: '🏠',
    color: '#10b981'
  },
  { 
    id: UserRole.LANDLORD, 
    name: 'Landlord', 
    description: 'Property Owner', 
    disabled: false,
    icon: '🏢',
    color: '#6366f1'
  },
  { 
    id: UserRole.CARETAKER, 
    name: 'Caretaker', 
    description: 'Property manager', 
    disabled: false,
    icon: '🔧',
    color: '#f59e0b'
  },
  { 
    id: UserRole.BUSINESS, 
    name: 'Business/Service Provider', 
    description: 'Open Registration', 
    disabled: false,
    icon: '💼',
    color: '#8b5cf6'
  },
  { 
    id: UserRole.ADMIN, 
    name: 'Admin', 
    description: 'Company Staff Only', 
    disabled: true,
    icon: '👨‍💼',
    color: '#ef4444'
  }
];

export const PHONE_COUNTRY_CODE = '+254';
export const PHONE_PLACEHOLDER = '7XX XXX XXX';
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

export const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  PHONE: 'Please enter a valid phone number (9 digits)',
  NATIONAL_ID: 'Please enter a valid ID or Passport number (6-15 characters)',
  FULL_NAME: 'Please enter your full name (first and last name)',
  FULL_NAME_TWO_WORDS: 'Please enter both first and last name',
  TERMS: 'You must accept the terms and conditions',
  OTP_INVALID: 'Please enter a valid 6-digit code',
  PASSWORD_STRENGTH: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
  BUSINESS_REGISTRATION: 'Please enter a valid business registration number',
  NETWORK_ERROR: 'Network error. Please check your connection and try again',
  SERVER_ERROR: 'Server error. Please try again later',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access forbidden. Please check your permissions',
  NOT_FOUND: 'The requested resource was not found',
  INVITATION_INVALID: 'Invalid or expired invitation link',
  INVITATION_USED: 'This invitation has already been used',
  PHONE_EXISTS: 'This phone number is already registered',
  EMAIL_EXISTS: 'This email address is already registered',
  OTP_EXPIRED: 'OTP code has expired. Please request a new one',
  OTP_ATTEMPTS_EXCEEDED: 'Too many OTP attempts. Please try again later',
  REGISTRATION_FAILED: 'Registration failed. Please try again',
  LOGIN_FAILED: 'Login failed. Please check your credentials'
};

export const SUCCESS_MESSAGES = {
  REGISTRATION_SUCCESS: 'Registration successful! Please verify your phone number',
  OTP_SENT: 'OTP code sent to your phone number',
  OTP_VERIFIED: 'Phone number verified successfully',
  LOGIN_SUCCESS: 'Login successful! Welcome back',
  PASSWORD_RESET_SENT: 'Password reset instructions sent to your phone',
  PROFILE_UPDATED: 'Profile updated successfully',
  INVITATION_SENT: 'Invitation sent successfully'
};

export const APP_CONFIG = {
  NAME: 'RentEase',
  VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@rentease.app',
  SUPPORT_PHONE: '+254700000000',
  COMPANY_NAME: 'RentEase Technologies Ltd',
  COPYRIGHT_YEAR: new Date().getFullYear(),
  WEBSITE_URL: 'https://rentease.app'
};

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password'
  },
  INVITATIONS: {
    GET_BY_CODE: '/invitations',
    CREATE: '/invitations',
    ACCEPT: '/invitations/accept',
    DECLINE: '/invitations/decline'
  },
  USER: {
    PROFILE: '/user/profile',
    UPDATE_PROFILE: '/user/profile',
    UPLOAD_AVATAR: '/user/avatar',
    CHANGE_PASSWORD: '/user/password'
  }
};

export const VALIDATION_PATTERNS = {
  PHONE: /^[0-9]{9}$/,
  NATIONAL_ID: /^[A-Z0-9]{6,15}$/i,
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  OTP: /^[0-9]{6}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
};

export const LOCAL_STORAGE_KEYS = {
  ACCESS_TOKEN: 'rentease_access_token',
  REFRESH_TOKEN: 'rentease_refresh_token',
  USER_DATA: 'rentease_user_data',
  INVITATION_DATA: 'rentease_invitation_data',
  THEME_PREFERENCE: 'rentease_theme',
  LANGUAGE_PREFERENCE: 'rentease_language'
};