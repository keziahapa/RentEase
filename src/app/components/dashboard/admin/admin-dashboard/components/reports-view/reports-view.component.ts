import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './reports-view.component.html',
  styleUrls: ['./reports-view.component.scss']
})
export class ReportsViewComponent {
  isExportingPdf = false;
  isExportingCsv = false;
  private readonly defaultReportType = 'platform-analytics';

  constructor(
    private adminDataService: AdminDataService,
    private snackBar: MatSnackBar
  ) {}

  exportPdf(): void {
    this.exportReport('pdf');
  }

  exportExcel(): void {
    this.exportReport('csv');
  }

  onGenerateReport(reportType: string): void {
    this.adminDataService.generateReport(reportType).subscribe({
      next: (response) => {
        const message = response?.message || 'Report queued successfully';
        this.snackBar.open(message, 'Close', { duration: 3000 });
      },
      error: (error) => {
        const message = error?.message || 'Unable to generate report right now.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });
  }

  private exportReport(format: 'pdf' | 'csv'): void {
    if (format === 'pdf') {
      this.isExportingPdf = true;
    } else {
      this.isExportingCsv = true;
    }

    this.adminDataService
      .exportReport(this.defaultReportType, format)
      .pipe(finalize(() => {
        if (format === 'pdf') {
          this.isExportingPdf = false;
        } else {
          this.isExportingCsv = false;
        }
      }))
      .subscribe({
        next: (blob) => this.downloadBlob(blob, `rentease-${this.defaultReportType}.${format === 'pdf' ? 'pdf' : 'csv'}`),
        error: (error) => {
          const message = error?.message || 'Unable to export report right now.';
          this.snackBar.open(message, 'Close', { duration: 4000 });
        }
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${filename}`, 'Close', { duration: 2000 });
  }
}
