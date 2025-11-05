import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppError, ErrorAction, ErrorSeverity } from './error-handler.interface';


@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  private errorsSubject = new BehaviorSubject<AppError[]>([]);
  public errors$ = this.errorsSubject.asObservable();
  private errorCount = 0;

  showError(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: string,
    action?: ErrorAction,
    autoHide?: number
  ): string {
    const error: AppError = {
      id: `error-${Date.now()}-${this.errorCount++}`,
      message,
      severity,
      timestamp: new Date(),
      context,
      action,
      dismissible: severity !== ErrorSeverity.CRITICAL,
      autoHide
    };

    const currentErrors = this.errorsSubject.value;
    this.errorsSubject.next([...currentErrors, error]);

    if (autoHide) {
      setTimeout(() => this.dismissError(error.id), autoHide);
    }

    return error.id;
  }

  dismissError(errorId: string): void {
    const currentErrors = this.errorsSubject.value;
    this.errorsSubject.next(currentErrors.filter(e => e.id !== errorId));
  }

  clearAll(): void {
    this.errorsSubject.next([]);
  }

  // Convenience methods
  info(message: string, autoHide: number = 3000): string {
    return this.showError(message, ErrorSeverity.INFO, undefined, undefined, autoHide);
  }

  warning(message: string, action?: ErrorAction, autoHide?: number): string {
    return this.showError(message, ErrorSeverity.WARNING, undefined, action, autoHide || 5000);
  }

  error(message: string, context?: string, action?: ErrorAction): string {
    return this.showError(message, ErrorSeverity.ERROR, context, action);
  }

  critical(message: string, context?: string): string {
    return this.showError(message, ErrorSeverity.CRITICAL, context);
  }
}