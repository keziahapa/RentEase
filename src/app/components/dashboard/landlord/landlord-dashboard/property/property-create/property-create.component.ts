import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { PropertyService } from '../../../../../../services/property.service';

@Component({
  selector: 'app-property-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './property-create.component.html',
  styleUrls: ['./property-create.component.scss']
})
export class PropertyCreateComponent implements OnInit {
  propertyForm: FormGroup;
  isSubmitting = false;

  propertyTypes = [
    { value: 'APARTMENT', label: 'Apartment' },
    { value: 'HOUSE', label: 'Single House' },
    { value: 'COMMERCIAL', label: 'Commercial Building' },
    { value: 'CONDO', label: 'Condominium' },
    { value: 'TOWNHOUSE', label: 'Townhouse' },
    { value: 'MIXED', label: 'Mixed Use' }
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router,
    private propertyService: PropertyService,
    public dialogRef: MatDialogRef<PropertyCreateComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.propertyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      location: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      propertyType: ['', Validators.required],
      totalUnits: [1, [Validators.required, Validators.min(1), Validators.max(500)]],
      description: ['', [Validators.maxLength(1000)]]
    });
  }

  ngOnInit() {
    // Initialization code if needed
  }

  onCreateProperty(): void {
    this.propertyForm.markAllAsTouched();

    if (!this.propertyForm.valid) {
      this.snackBar.open('Please fill in all required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmitting = true;

    const propertyData = {
      name: this.propertyForm.value.name.trim(),
      location: this.propertyForm.value.location.trim(),
      propertyType: this.propertyForm.value.propertyType,
      totalUnits: Number(this.propertyForm.value.totalUnits),
      description: this.propertyForm.value.description?.trim() || '',
      units: [] 
    };

    this.propertyService.createProperty(propertyData).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        
        if (response.success || response.property || response.id) {
          this.snackBar.open('Property created successfully!', 'Close', { duration: 3000 });
          
          // Close dialog and return success
          this.dialogRef.close('success');
        } else {
          this.snackBar.open(response.message || 'Failed to create property', 'Close', { duration: 3000 });
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.handlePropertyCreationError(error);
      }
    });
  }

  onCancel(): void {
    // Close dialog without any action
    this.dialogRef.close('cancelled');
  }

  private handlePropertyCreationError(error: any): void {
    if (error.status === 401) {
      this.snackBar.open('Not authorized. Please log in again.', 'Close', { duration: 3000 });
    } else if (error.status === 400) {
      this.snackBar.open(error.error?.message || 'Invalid property data. Please check your inputs.', 'Close', { duration: 4000 });
    } else if (error.status === 409) {
      this.snackBar.open('A property with this name already exists at this location.', 'Close', { duration: 4000 });
    } else if (error.status === 500) {
      this.snackBar.open('Server error. Please try again later.', 'Close', { duration: 3000 });
    } else if (error.status === 0) {
      this.snackBar.open('Network error. Please check your connection.', 'Close', { duration: 3000 });
    } else {
      this.snackBar.open(error.message || 'Failed to create property. Please try again.', 'Close', { duration: 3000 });
    }
  }

  hasFormErrors(): boolean {
    return this.propertyForm.invalid && this.propertyForm.touched;
  }

  get formControls() {
    return this.propertyForm.controls;
  }

  getControlValueLength(controlName: string): number {
    const value = this.propertyForm.get(controlName)?.value;
    return typeof value === 'string' ? value.length : 0;
  }
}