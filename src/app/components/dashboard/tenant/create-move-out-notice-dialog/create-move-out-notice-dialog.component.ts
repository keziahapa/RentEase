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
import { MatSnackBar } from '@angular/material/snack-bar';
import { Component, Inject, OnInit } from '@angular/core';
import { TenantService } from '../../../../services/tenant.service';

export interface MoveOutNoticeRequest {
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  notes?: string;
  // ✅ Include display fields for property information
  propertyName?: string;
  unitNumber?: string;
  propertyAddress?: string;
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
    private tenantService: TenantService,
    private snackBar: MatSnackBar
  ) {
    // Set minimum date to tomorrow
    this.minDate = new Date();
    this.minDate.setDate(this.minDate.getDate() + 1);
    
    // Set maximum date to 1 year from now
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1);
  }

  ngOnInit(): void {
    console.log('🔍 MoveOut Dialog Initialized');
    this.loadCurrentPropertyData();
  }

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
            propertyId: primaryUnit.propertyId || primaryUnit.id || 1,
            unitId: primaryUnit.unitId || primaryUnit.id || null
          };
          
          this.initializeForm();
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
    this.initializeForm();
  }

  private initializeForm(): void {
    this.noticeForm = this.fb.group({
      propertyId: [this.currentProperty.propertyId, Validators.required],
      unitId: [this.currentProperty.unitId || null],
      moveOutDate: [null, [Validators.required]],
      reason: ['', Validators.required],
      notes: ['', [Validators.maxLength(1000)]]
    });

    console.log('📝 Form initialized with values:', this.noticeForm.value);
    console.log('✅ Form valid after init:', this.noticeForm.valid);
    console.log('🏠 Current property data:', this.currentProperty);
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  onSubmit(): void {
    console.log('🔘 Submit clicked - Form valid:', this.noticeForm.valid, 'Terms accepted:', this.termsAccepted);
    
    // Double submission protection
    if (this.isSubmitting) {
      console.warn('⚠️ Submission already in progress, ignoring duplicate click');
      return;
    }
    
    // Mark all fields as touched to show errors
    this.markFormGroupTouched();
    
    if (this.noticeForm.valid && this.termsAccepted) {
      this.isSubmitting = true;
      
      const formValue = this.noticeForm.value;
      
      // ✅ INCLUDE COMPLETE PROPERTY AND UNIT DATA
      const noticeData: MoveOutNoticeRequest = {
        ...formValue,
        moveOutDate: this.formatDate(formValue.moveOutDate),
        // ✅ Ensure propertyId and unitId come from the loaded data
        propertyId: this.currentProperty.propertyId,
        unitId: this.currentProperty.unitId,
        // ✅ Include property display information
        propertyName: this.currentProperty.name,
        unitNumber: this.currentProperty.unitNumber,
        propertyAddress: this.currentProperty.address
      };

      console.log('📤 Submitting move-out notice with complete data:', noticeData);
      console.log('🏠 Current property info:', this.currentProperty);

      this.tenantService.submitMoveOutNotice(noticeData).subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          console.log('📥 Move-out notice response:', response);
          
          if (response.success) {
            this.snackBar.open('Move-out notice submitted successfully!', 'Close', { 
              duration: 5000,
              panelClass: ['success-snackbar']
            });
            
            // ✅ RETURN COMPLETE DATA INCLUDING PROPERTY INFO
            this.dialogRef.close({ 
              success: true, 
              data: noticeData, // This now includes property/unit data
              response: response.data
            });
          } else {
            this.snackBar.open(response.message || 'Failed to submit move-out notice', 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('❌ Error submitting move-out notice:', error);
          
          if (error.status === 401 || error.sessionExpired) {
            this.snackBar.open('Session expired. Please login again.', 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            this.dialogRef.close({ success: false, sessionExpired: true });
          } else {
            this.snackBar.open('Failed to submit move-out notice. Please try again.', 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        }
      });
    } else {
      console.log('❌ Form validation failed');
      console.log('📊 Form valid:', this.noticeForm.valid);
      console.log('📝 Terms accepted:', this.termsAccepted);
      
      if (!this.termsAccepted) {
        this.snackBar.open('Please accept the terms and conditions', 'Close', { 
          duration: 3000,
          panelClass: ['warning-snackbar']
        });
      }
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.noticeForm.controls).forEach(key => {
      const control = this.noticeForm.get(key);
      control?.markAsTouched();
    });
  }

  private formatDate(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper methods for template
  getMoveOutDateError(): string {
    const control = this.noticeForm.get('moveOutDate');
    if (control?.hasError('required') && control.touched) {
      return 'Move-out date is required';
    }
    return '';
  }

  getReasonError(): string {
    const control = this.noticeForm.get('reason');
    if (control?.hasError('required') && control.touched) {
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
    console.log('📝 Terms accepted:', checked);
  }

  getReasonDisplayName(reasonValue: string): string {
    const reason = this.moveOutReasons.find(r => r.value === reasonValue);
    return reason ? reason.label : reasonValue;
  }


  getPropertyDisplay(): string {
    if (!this.currentProperty) return 'Loading...';
    return `${this.currentProperty.name} - ${this.currentProperty.unitNumber}`;
  }

  getAddressDisplay(): string {
    return this.currentProperty?.address || 'Address not available';
  }

  ngOnDestroy(): void {
    console.log('🔍 MoveOut Dialog Destroyed');
  }
}