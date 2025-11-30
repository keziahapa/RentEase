import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, NativeDateAdapter, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Component, Inject, OnInit } from '@angular/core';
import { TenantService } from '../../../../services/tenant.service';

export interface MoveOutNoticeRequest {
  propertyId: number;
  unitId?: number;
  moveOutDate: string;
  reason: string;
  notes?: string;
  propertyName?: string;
  unitNumber?: string;
  propertyAddress?: string;
}


export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'MM/DD/YYYY',
  },
  display: {
    dateInput: 'MM/DD/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

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
    MatCheckboxModule,
    MatSnackBarModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-US' },
    { provide: DateAdapter, useClass: NativeDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
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
    // Set date constraints
    const today = new Date();
    
    this.minDate = new Date(today);
    this.minDate.setDate(today.getDate() + 1); 
    this.minDate.setHours(0, 0, 0, 0);
    
    this.maxDate = new Date(today);
    this.maxDate.setFullYear(today.getFullYear() + 1); 
    this.maxDate.setHours(23, 59, 59, 999);

   
    this.initializeForm();
  }

  ngOnInit(): void {
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
          
        
          this.noticeForm.patchValue({
            propertyId: this.currentProperty.propertyId,
            unitId: this.currentProperty.unitId
          });
        } else {
          this.setFallbackData();
        }
      },
      error: (error) => {
        console.error('Error loading tenant units:', error);
        this.isLoadingData = false;
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
  }

  private initializeForm(): void {
    this.noticeForm = this.fb.group({
      propertyId: [this.currentProperty?.propertyId || 1, Validators.required],
      unitId: [this.currentProperty?.unitId || null],
      moveOutDate: [null, [Validators.required]],
      reason: ['', Validators.required],
      notes: ['', [Validators.maxLength(1000)]]
    });
  }

  // Date filter to disable dates outside range
  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    
    const time = date.getTime();
    return time >= this.minDate.getTime() && time <= this.maxDate.getTime();
  }

  onCalendarOpened(): void {
    console.log('Calendar opened for date selection');
  }

  onDateChange(event: any): void {
    console.log('Date selected:', event.value);
  }

  onCancel(): void {
    if (this.noticeForm.dirty) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirm) {
        return;
      }
    }
    
    this.dialogRef.close({ success: false });
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }
    
    this.markFormGroupTouched();
    
    if (this.noticeForm.valid && this.termsAccepted) {
      this.isSubmitting = true;
      
      const formValue = this.noticeForm.value;
      const noticeData: MoveOutNoticeRequest = {
        ...formValue,
        moveOutDate: this.formatDate(formValue.moveOutDate),
        propertyId: this.currentProperty.propertyId,
        unitId: this.currentProperty.unitId,
        propertyName: this.currentProperty.name,
        unitNumber: this.currentProperty.unitNumber,
        propertyAddress: this.currentProperty.address
      };

      console.log('Submitting move-out notice:', noticeData);

    
      setTimeout(() => {
        this.isSubmitting = false;
        
        this.snackBar.open('Move-out notice submitted successfully!', 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        this.dialogRef.close({ 
          success: true, 
          data: noticeData
        });
      }, 2000);
    } else {
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