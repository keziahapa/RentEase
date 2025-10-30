import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { InvitationService } from '../../../../../services/invitation.service';
import { InviteDialogData, AvailableUnit } from '../../../../../services/invitation-interfaces';

@Component({
  selector: 'app-invite-dialog',
  templateUrl: './invite-dialog.component.html',
  styleUrls: ['./invite-dialog.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatProgressSpinnerModule
  ]
})
export class InviteDialogComponent implements OnInit {
  inviteForm: FormGroup;
  loading = false;
  availableUnits: AvailableUnit[] = [];

  constructor(
    private fb: FormBuilder,
    private invitationService: InvitationService,
    public dialogRef: MatDialogRef<InviteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InviteDialogData
  ) {
    this.inviteForm = this.createForm();
  }

  ngOnInit() {
    // Use available units passed in data, or empty array
    this.availableUnits = this.data.availableUnits || [];
  }

  createForm(): FormGroup {
    const formConfig: any = {
      email: ['', [Validators.required, Validators.email]]
    };

    if (this.data.type === 'tenant' && this.availableUnits.length > 0) {
      formConfig.unitId = ['', Validators.required];
    }

    return this.fb.group(formConfig);
  }

  hasError(controlName: string, errorType: string): boolean {
    const control = this.inviteForm.get(controlName);
    return control ? control.hasError(errorType) && control.touched : false;
  }

  onCancel(): void {
    this.dialogRef.close({ 
      success: false, 
      cancelled: true 
    });
  }

  onSend(): void {
    if (this.inviteForm.valid) {
      this.loading = true;
      
      const formData = this.inviteForm.value;
      console.log('📤 Form data:', formData);
      
      if (this.data.type === 'tenant') {
        const selectedUnit = this.availableUnits.find(unit => unit.id === formData.unitId);
        
        const tenantData = {
          tenantEmail: formData.email,
          propertyId: this.data.propertyId,
          unitId: formData.unitId,
          unitNumber: selectedUnit?.unitNumber
        };

        console.log('📤 Sending tenant invitation:', tenantData);

        this.invitationService.inviteTenant(tenantData).subscribe({
          next: (response) => {
            this.loading = false;
            console.log('✅ Tenant invitation response:', response);
            this.dialogRef.close({
              success: true,
              email: formData.email, // ✅ Include the email
              unitId: formData.unitId,
              invitationToken: response.invitationToken,
              message: response.message,
              response: response
            });
          },
          error: (error) => {
            this.loading = false;
            console.error('❌ Tenant invitation error:', error);
            this.dialogRef.close({
              success: false,
              email: formData.email, // ✅ Include the email even on error
              unitId: formData.unitId,
              error: error.message,
              status: error.status
            });
          }
        });

      } else if (this.data.type === 'caretaker') {
        const caretakerData = {
          caretakerEmail: formData.email,
          propertyId: this.data.propertyId
        };

        console.log('📤 Sending caretaker invitation:', caretakerData);

        this.invitationService.inviteCaretaker(caretakerData).subscribe({
          next: (response) => {
            this.loading = false;
            console.log('✅ Caretaker invitation response:', response);
            this.dialogRef.close({
              success: true,
              email: formData.email, // ✅ Include the email
              invitationToken: response.invitationToken,
              message: response.message,
              response: response
            });
          },
          error: (error) => {
            this.loading = false;
            console.error('❌ Caretaker invitation error:', error);
            this.dialogRef.close({
              success: false,
              email: formData.email, // ✅ Include the email even on error
              error: error.message,
              status: error.status
            });
          }
        });
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.inviteForm.controls).forEach(key => {
        this.inviteForm.get(key)?.markAsTouched();
      });
    }
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
}