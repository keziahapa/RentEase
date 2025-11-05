import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Property } from '../../../../../../models/property.model';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { SearchParams } from '../../../../../../services/admin-interfaces';

@Component({
  selector: 'app-properties-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './properties-view.component.html',
  styleUrls: ['./properties-view.component.scss']
})
export class PropertiesViewComponent {
  private readonly adminDataService = inject(AdminDataService);
  private readonly snackBar = inject(MatSnackBar);

  @Input() properties: Property[] = [];
  @Input() totalProperties: number = 0;
  @Input() occupiedPropertiesCount: number = 0;
  @Input() vacantPropertiesCount: number = 0;
  
  @Output() viewPropertyDetails = new EventEmitter<Property>();
  @Output() editProperty = new EventEmitter<Property>();

  displayedColumns: string[] = [
    'propertyInfo', 
    'landlordInfo', 
    'caretakerInfo', 
    'tenantsInfo', 
    'status', 
    'actions'
  ];
  exportState: Record<'csv' | 'pdf', boolean> = { csv: false, pdf: false };

  getPropertyStatusClass(status: string): string {
    const statusMap: any = {
      'occupied': 'status-occupied',
      'vacant': 'status-vacant',
      'maintenance': 'status-maintenance'
    };
    return statusMap[status] || 'status-vacant';
  }

  exportProperties(format: 'csv' | 'pdf'): void {
    if (this.exportState[format]) {
      return;
    }

    this.exportState[format] = true;
    const params = this.buildExportParams();

    this.adminDataService
      .exportReport('properties', format, params)
      .pipe(finalize(() => (this.exportState[format] = false)))
      .subscribe({
        next: (blob) => this.handleExportBlob(blob, `rentease-properties.${format}`),
        error: (error) => {
          const message = error?.message || `Unable to export properties as ${format.toUpperCase()} right now.`;
          this.snackBar.open(message, 'Close', { duration: 4000 });
        }
      });
  }

  private buildExportParams(): SearchParams {
    const params: SearchParams = {};

    if (this.vacantPropertiesCount && this.vacantPropertiesCount === this.totalProperties) {
      params.status = 'VACANT';
    }

    return params;
  }

  private async handleExportBlob(blob: Blob, filename: string): Promise<void> {
    if (blob.type?.includes('text')) {
      const fallbackMessage = await blob.text();
      this.snackBar.open(fallbackMessage || 'Export unavailable. Please retry later.', 'Close', {
        duration: 4000
      });
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${filename}`, 'Close', { duration: 2500 });
  }
}
