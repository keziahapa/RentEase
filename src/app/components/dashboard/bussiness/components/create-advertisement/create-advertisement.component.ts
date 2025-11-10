import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'; // ADD THIS IMPORT
import { BusinessService } from '../../../../../services/business.service';
import { CreateAdvertisementRequest } from '../../../../../services/business-interface';

@Component({
  selector: 'app-create-advertisement',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule // ADD THIS LINE
  ],
  templateUrl: './create-advertisement.component.html',
  styleUrls: ['./create-advertisement.component.scss']
})
export class CreateAdvertisementComponent implements OnInit {
  advertisement: CreateAdvertisementRequest = {
    title: '',
    description: '',
    mediaUrl: '',
    mediaType: 'IMAGE'
  };

  isLoading = false;
  isSubmitting = false;

  constructor(
    private businessService: BusinessService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CreateAdvertisementComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {}

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;

    this.businessService.createAdvertisement(this.advertisement).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          this.snackBar.open('Advertisement created successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.dialogRef.close('success');
        } else {
          this.snackBar.open(response.message || 'Failed to create advertisement', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.snackBar.open(error.message || 'Failed to create advertisement', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  validateForm(): boolean {
    if (!this.advertisement.title.trim()) {
      this.snackBar.open('Please enter a title', 'Close', { duration: 3000 });
      return false;
    }
    if (!this.advertisement.description.trim()) {
      this.snackBar.open('Please enter a description', 'Close', { duration: 3000 });
      return false;
    }
    if (!this.advertisement.mediaUrl.trim()) {
      this.snackBar.open('Please enter a media URL', 'Close', { duration: 3000 });
      return false;
    }
    return true;
  }

  onCancel(): void {
    this.dialogRef.close('cancelled');
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event);
    event.target.style.display = 'none';
  }
}