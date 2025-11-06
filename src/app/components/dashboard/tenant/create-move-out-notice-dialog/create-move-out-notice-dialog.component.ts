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
import { TenantService } from '../../../../services/tenant.service';

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
  isLoadingData = true;

  // 🟢 ADD REAL PROPERTY DATA
  currentProperty: any = null;
  currentUnit: any = null;

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
    @Inject(MAT_DIALOG_DATA) public data: any,
    private tenantService: TenantService // 🟢 ADD SERVICE
  ) {
    // Set minimum date to tomorrow
    this.minDate = new Date();
    this.minDate.setDate(this.minDate.getDate() + 1);
    
    // Set maximum date to 1 year from now
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1);
  }

  ngOnInit(): void {
    this.loadCurrentPropertyData(); // 🟢 LOAD REAL DATA FIRST
  }

  // 🟢 ADD METHOD TO LOAD REAL DATA
  private loadCurrentPropertyData(): void {
    this.isLoadingData = true;
    
    this.tenantService.getTenantUnits().subscribe({
      next: (response: any) => {
        this.isLoadingData = false;
        
        if (response.success && response.data && response.data.length > 0) {
          const primaryUnit = response.data[0];
          this.currentUnit = primaryUnit;
          this.currentProperty = {
            name: primaryUnit.propertyName || 'Unknown Property',
            unitNumber: primaryUnit.unitNumber || 'Unknown Unit',
            address: primaryUnit.propertyAddress || 'Address not available',
            propertyId: primaryUnit.propertyId || 1,
            unitId: primaryUnit.unitId || null
          };
          
          this.initializeForm(); // 🟢 INITIALIZE FORM AFTER DATA LOAD
        } else {
          this.setFallbackData();
        }
      },
      error: (error) => {
        this.isLoadingData = false;
        console.error('Error loading property data:', error);
        this.setFallbackData();
      }
    });
  }

  private setFallbackData(): void {
    this.currentProperty = {
      name: 'Unknown Property',
      unitNumber: 'Unknown Unit',
      address: 'Address not available',
      propertyId: 1,
      unitId: null
    };
    this.initializeForm(); // 🟢 INITIALIZE FORM WITH FALLBACK DATA
  }

  private initializeForm(): void {
    this.noticeForm = this.fb.group({
      propertyId: [this.currentProperty.propertyId, Validators.required],
      unitId: [this.currentProperty.unitId || null],
      moveOutDate: ['', [Validators.required]],
      reason: ['', Validators.required],
      notes: ['', [Validators.maxLength(1000)]]
    });

    // 🟢 DEBUG: Log form status changes
    this.noticeForm.statusChanges.subscribe(status => {
      console.log('Form status:', status);
      console.log('Form valid:', this.noticeForm.valid);
      console.log('Form values:', this.noticeForm.value);
      console.log('Terms accepted:', this.termsAccepted);
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    console.log('Submit clicked - Form valid:', this.noticeForm.valid, 'Terms accepted:', this.termsAccepted);
    
    if (this.noticeForm.valid && this.termsAccepted && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formValue = this.noticeForm.value;
      const noticeData: MoveOutNoticeRequest = {
        ...formValue,
        moveOutDate: this.formatDate(formValue.moveOutDate)
      };

      console.log('Submitting move-out notice:', noticeData);

      // 🟢 USE REAL SERVICE CALL
      this.tenantService.submitMoveOutNotice(noticeData).subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response.success) {
            this.dialogRef.close({ success: true, data: noticeData });
          } else {
            console.error('Failed to submit move-out notice:', response.message);
            // Handle API error
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Error submitting move-out notice:', error);
          // Handle error
        }
      });
    } else {
      console.log('Form validation failed - marking fields as touched');
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
    const isValid = this.noticeForm.valid && this.termsAccepted && !this.isSubmitting;
    console.log('isFormValid check:', {
      formValid: this.noticeForm.valid,
      termsAccepted: this.termsAccepted,
      notSubmitting: !this.isSubmitting,
      finalResult: isValid
    });
    return isValid;
  }

  onTermsChange(checked: boolean): void {
    this.termsAccepted = checked;
    console.log('Terms accepted:', checked);
  }

  // 🟢 ADD METHOD TO CHECK IF DATE IS VALID
  isDateValid(): boolean {
    const dateControl = this.noticeForm.get('moveOutDate');
    return dateControl?.valid && dateControl.value;
  }
}