import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { LandlordMoveOutNotice } from '../../../../../services/dashboard-interface';


export interface MoveOutActionDialogData {
  title: string;
  action: 'approve' | 'reject';
  notice: LandlordMoveOutNotice;
}

@Component({
  selector: 'app-move-out-action-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './move-out-action-dialog.component.html',
  styleUrls: ['./move-out-action-dialog.component.scss']
})
export class MoveOutActionDialogComponent {
  notes = '';
  public data: MoveOutActionDialogData;

  constructor(
    public dialogRef: MatDialogRef<MoveOutActionDialogComponent>,
  ) {
    this.data = inject(MAT_DIALOG_DATA) as MoveOutActionDialogData;
  }

  onConfirm(): void {
    this.dialogRef.close({ notes: this.notes });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  getReasonDisplay(reason: string): string {
    const reasonMap: Record<string, string> = {
      RELOCATION: 'Relocation',
      JOB_CHANGE: 'Job Change',
      FINANCIAL: 'Financial Reasons',
      PERSONAL: 'Personal Reasons',
      PROPERTY_ISSUES: 'Property Issues',
      LEASE_END: 'Lease End',
      OTHER: 'Other'
    };
    return reasonMap[reason] || reason;
  }
}