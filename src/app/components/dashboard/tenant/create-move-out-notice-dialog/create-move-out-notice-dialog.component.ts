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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Component, Inject, OnInit } from '@angular/core';

export interface MoveOutNoticeRequest {
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  notes?: string;
}

@Component({
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
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './create-move-out-notice-dialog.component.html',
  styleUrls: ['./create-move-out-notice-dialog.component.scss']
})
export class CreateMoveOutNoticeDialogComponent implements OnInit {
  noticeForm!: FormGroup;
  minDate: Date;
  maxDate: Date;
  isSubmitting = false;
  termsAccepted = false;

  moveOutReasons = [
    { value: 'RELOCATION', label: 'Relocation to another area' },
    { value: 'JOB_CHANGE', label: 'Job change or transfer' },
    { value: 'FINANCIAL', label: 'Financial reasons' },
    { value: 'PERSONAL', label: 'Personal/family reasons' },
    { value: 'PROPERTY_ISSUES', label: 'Property maintenance issues' },
    { value: 'LEASE_END', label: 'Lease term ending' },
    { value: 'PURCHASED_HOME', label: 'Purchased a home' },
    { value: 'OTHER', label: 'Other reasons' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateMoveOutNoticeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Set minimum date to tomorrow
    this.minDate = new Date();
    this.minDate.setDate(this.minDate.getDate() + 1);
    
    // Set maximum date to 1 year from now
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1);
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.noticeForm = this.fb.group({
      propertyId: [this.data?.propertyId || 1, Validators.required],
      unitId: [this.data?.unitId || null],
      moveOutDate: ['', [Validators.required]],
      reason: ['', Validators.required],
      notes: ['', [Validators.maxLength(1000)]]
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.noticeForm.valid && this.termsAccepted && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formValue = this.noticeForm.value;
      const noticeData: MoveOutNoticeRequest = {
        ...formValue,
        moveOutDate: this.formatDate(formValue.moveOutDate)
      };

      // Simulate API call with timeout
      setTimeout(() => {
        console.log('Submitting move-out notice:', noticeData);
        this.dialogRef.close({ success: true, data: noticeData });
        this.isSubmitting = false;
      }, 1500);
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.noticeForm.controls).forEach(key => {
      const control = this.noticeForm.get(key);
      control?.markAsTouched();
    });
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper methods for template
  getMoveOutDateError(): string {
    const control = this.noticeForm.get('moveOutDate');
    if (control?.hasError('required')) {
      return 'Move-out date is required';
    }
    return '';
  }

  getReasonError(): string {
    const control = this.noticeForm.get('reason');
    if (control?.hasError('required')) {
      return 'Please select a reason for moving out';
    }
    return '';
  }

  getNotesLength(): number {
    return this.noticeForm.get('notes')?.value?.length || 0;
  }

  isFormValid(): boolean {
    return this.noticeForm.valid && this.termsAccepted && !this.isSubmitting;
  }

  onTermsChange(checked: boolean): void {
    this.termsAccepted = checked;
  }
}