// create-move-out-notice-dialog.component.ts
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Component as NgComponent, Inject } from '@angular/core';

class CreateMoveOutNoticeDialogComponentClass {
  noticeForm!: FormGroup;
  minDate: Date;
  isSubmitting = false;

  moveOutReasons = [
    { value: 'RELOCATION', label: 'Relocation' },
    { value: 'JOB_CHANGE', label: 'Job Change' },
    { value: 'FINANCIAL', label: 'Financial Reasons' },
    { value: 'PERSONAL', label: 'Personal Reasons' },
    { value: 'PROPERTY_ISSUES', label: 'Property Issues' },
    { value: 'LEASE_END', label: 'Lease End' },
    { value: 'OTHER', label: 'Other' }
  ];

constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateMoveOutNoticeDialogComponentClass>,
    @Inject(MAT_DIALOG_DATA) public data: any
) {
    this.minDate = new Date();
    this.minDate.setDate(this.minDate.getDate() + 1);
    this.initializeForm();
}

  private initializeForm(): void {
    this.noticeForm = this.fb.group({
      propertyId: [this.data?.propertyId || 1, Validators.required],
      unitId: [this.data?.unitId || null],
      moveOutDate: ['', Validators.required],
      reason: ['', Validators.required],
      notes: ['', [Validators.maxLength(500)]]
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.noticeForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formValue = this.noticeForm.value;
      const noticeData = {
        ...formValue,
        moveOutDate: this.formatDate(formValue.moveOutDate)
      };

      this.dialogRef.close(noticeData);
    } else {
      Object.keys(this.noticeForm.controls).forEach(key => {
        this.noticeForm.get(key)?.markAsTouched();
      });
    }
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const CreateMoveOutNoticeDialogComponent = NgComponent({
  selector: 'app-create-move-out-notice-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './create-move-out-notice-dialog.component.html',
  styleUrls: ['./create-move-out-notice-dialog.component.scss']
})(CreateMoveOutNoticeDialogComponentClass);