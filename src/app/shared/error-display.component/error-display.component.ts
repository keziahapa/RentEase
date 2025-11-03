import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { AppError, ErrorSeverity } from '../../services/error-handler.interface';

@Component({
  selector: 'app-error-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-display.component.html',
  styleUrls: ['./error-display.component.scss']
})
export class ErrorDisplayComponent implements OnInit, OnDestroy {
  errors: AppError[] = [];
  private subscription?: Subscription;

  constructor(private errorHandler: ErrorHandlerService) {}

  ngOnInit(): void {
    this.subscription = this.errorHandler.errors$.subscribe(errors => {
      this.errors = errors;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'check_circle';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'dangerous';
      default:
        return 'info';
    }
  }

  getTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'Information';
      case ErrorSeverity.WARNING:
        return 'Warning';
      case ErrorSeverity.ERROR:
        return 'Error';
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      default:
        return 'Notification';
    }
  }

  getToastClass(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'info';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'critical';
      default:
        return 'info';
    }
  }

  dismiss(errorId: string): void {
    this.errorHandler.dismissError(errorId);
  }

  handleAction(error: AppError): void {
    if (error.action) {
      error.action.handler();
      this.dismiss(error.id);
    }
  }
}