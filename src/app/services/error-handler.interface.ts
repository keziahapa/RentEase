export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
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