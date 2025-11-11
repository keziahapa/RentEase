import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; 

import { InvitationService } from '../../../../../services/invitation.service';
import { 
  InviteDialogData, 
  AvailableUnit, 
  InviteDialogResult
} from '../../../../../services/invitation-interfaces';

@Component({
  selector: 'app-invite-dialog',
  templateUrl: './invite-dialog.component.html',
  styleUrls: ['./invite-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatSnackBarModule 
  ]
})
export class InviteDialogComponent implements OnInit {
  inviteForm: FormGroup;
  loading = false;
  availableUnits: AvailableUnit[] = [];

  private fb = inject(FormBuilder);
  private invitationService = inject(InvitationService);
  private snackBar = inject(MatSnackBar); 
  public dialogRef = inject(MatDialogRef<InviteDialogComponent, InviteDialogResult>);
  public data = inject<InviteDialogData>(MAT_DIALOG_DATA);

  constructor() {
    this.inviteForm = this.fb.group({});
  }

  ngOnInit() {
    this.availableUnits = this.data.availableUnits || [];
    console.log('📋 Available units with IDs:', this.availableUnits.map(u => ({ id: u.id, unitNumber: u.unitNumber })));
    
   
    this.buildForm();
  }

  private buildForm(): void {
    const formConfig: any = {
      email: ['', [Validators.required, Validators.email]]
    };

 
    if (this.data.type === 'tenant' && this.availableUnits.length > 0) {
   
      formConfig.unitId = [this.availableUnits[0].id, Validators.required];
    }

    this.inviteForm = this.fb.group(formConfig);
    console.log(' Form built with controls:', Object.keys(this.inviteForm.controls));
  }

  hasError(controlName: string, errorType: string): boolean {
    const control = this.inviteForm.get(controlName);
    return control ? control.hasError(errorType) && control.touched : false;
  }

  onCancel(): void {
    const result: InviteDialogResult = { 
      success: false, 
      cancelled: true,
      email: ''
    };
    this.dialogRef.close(result);
  }

  onSend(): void {
    if (this.inviteForm.valid) {
      const formData = this.inviteForm.value;
      
      if (this.data.type === 'tenant' && !formData.unitId) {
        this.snackBar.open('Please select a unit', 'Close', { duration: 3000 });
        return;
      }

      this.loading = true;
      console.log('📤 Form data:', formData);
      
      if (this.data.type === 'tenant') {
        this.inviteTenant(formData);
      } else if (this.data.type === 'caretaker') {
        this.inviteCaretaker(formData);
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private inviteTenant(formData: any): void {
    if (!formData.unitId) {
      this.loading = false;
      this.snackBar.open('Unit selection is required', 'Close', { duration: 3000 });
      return;
    }

   
    const tenantData = {
      tenantEmail: formData.email,
      unitId: formData.unitId
    };

    console.log('📤 Sending tenant invitation:', tenantData);

    this.invitationService.inviteTenant(tenantData).subscribe({
      next: (response) => {
        this.loading = false;
        console.log('✅ Tenant invitation response:', response);
        
        const result: InviteDialogResult = {
          success: true,
          email: formData.email,
          unitId: formData.unitId,
          invitationToken: response.invitationToken,
          message: response.message,
          response: response
        };
        this.dialogRef.close(result);
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Tenant invitation error:', error);
        
        const result: InviteDialogResult = {
          success: false,
          email: formData.email,
          unitId: formData.unitId,
          error: error.message,
          status: error.status
        };
        this.dialogRef.close(result);
      }
    });
  }

  private inviteCaretaker(formData: any): void {
    const caretakerData = {
      caretakerEmail: formData.email,
      propertyId: this.data.propertyId
    };

    console.log('📤 Sending caretaker invitation:', caretakerData);

    this.invitationService.inviteCaretaker(caretakerData).subscribe({
      next: (response) => {
        this.loading = false;
        console.log('✅ Caretaker invitation response:', response);
        
        const result: InviteDialogResult = {
          success: true,
          email: formData.email,
          invitationToken: response.invitationToken,
          message: response.message,
          response: response
        };
        this.dialogRef.close(result);
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Caretaker invitation error:', error);
        
        const result: InviteDialogResult = {
          success: false,
          email: formData.email,
          error: error.message,
          status: error.status
        };
        this.dialogRef.close(result);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.inviteForm.controls).forEach(key => {
      this.inviteForm.get(key)?.markAsTouched();
    });
  }

  getUnitTypeDisplay(unitType: string): string {
    const unitTypes: { [key: string]: string } = {
      'studio': 'Studio',
      '1bedroom': '1 Bedroom',
      '2bedroom': '2 Bedrooms',
      '3bedroom': '3 Bedrooms',
      'apartment': 'Apartment',
      'house': 'House',
      'commercial': 'Commercial',
      'office': 'Office'
    };
    return unitTypes[unitType] || unitType;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  showUnitSelection(): boolean {
    return this.data.type === 'tenant' && this.availableUnits.length > 0;
  }

  getDialogTitle(): string {
    return this.data.type === 'tenant' ? 'Invite Tenant' : 'Invite Caretaker';
  }

  getDialogSubtitle(): string {
    if (this.data.propertyName) {
      return this.data.type === 'tenant' 
        ? `Invite a tenant to ${this.data.propertyName}`
        : `Invite a caretaker for ${this.data.propertyName}`;
    }
    return this.data.type === 'tenant' 
      ? 'Invite a tenant to this property'
      : 'Invite a caretaker for this property';
  }
}