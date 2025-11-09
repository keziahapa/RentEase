// src/app/services/error-handler.interface.ts
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
  SUCCESS = 'success' // Added success type
}

export interface AppError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: string;
  action?: ErrorAction;
  dismissible: boolean;
  autoHide?: number;
}

export interface ErrorAction {
  label: string;
  handler: () => void;
}