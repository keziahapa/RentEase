import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatDividerModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  notificationsForm!: FormGroup;

  isUpdatingPhone = false;
  isUpdatingPassword = false;

  private subscription = new Subscription();
  private readonly notificationStorageKey = 'tenantNotificationPreferences';

  ngOnInit(): void {
    this.initializeForms();
    this.populateUserData();
    this.loadNotificationPreferences();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      fullName: [{ value: '', disabled: true }],
      email: [{ value: '', disabled: true }],
      phoneNumber: ['', [Validators.required, this.phoneValidator]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.notificationsForm = this.fb.group({
      emailUpdates: [true],
      smsReminders: [true],
      maintenanceAlerts: [true],
      communityAnnouncements: [false]
    });
  }

  private populateUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    this.profileForm.patchValue({
      fullName: currentUser.fullName || '',
      email: currentUser.email || '',
      phoneNumber: currentUser.phoneNumber || ''
    });
  }

  private loadNotificationPreferences(): void {
    try {
      const stored = localStorage.getItem(this.notificationStorageKey);
      if (stored) {
        const prefs = JSON.parse(stored);
        this.notificationsForm.patchValue(prefs);
      }
    } catch (error) {
      console.warn('Failed to load notification preferences:', error);
    }
  }

  onUpdatePhone(): void {
    if (this.isUpdatingPhone) {
      return;
    }

    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      this.snackBar.open('Please provide a valid phone number.', 'Close', { duration: 3000 });
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const phoneNumber = this.profileForm.get('phoneNumber')?.value?.trim();
    if (!currentUser || !phoneNumber) {
      return;
    }

    if (phoneNumber === currentUser.phoneNumber) {
      this.snackBar.open('Your phone number is already up to date.', 'Close', { duration: 2500 });
      return;
    }

    this.isUpdatingPhone = true;
    const sub = this.authService.updatePhone(phoneNumber).subscribe({
      next: (response) => {
        if (response?.success !== false) {
          this.snackBar.open('Phone number updated successfully.', 'Close', { duration: 3000 });
        }
        this.isUpdatingPhone = false;
      },
      error: (error) => {
        const message = error?.message || 'Failed to update phone number. Please try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
        this.isUpdatingPhone = false;
      }
    });

    this.subscription.add(sub);
  }

  onUpdatePassword(): void {
    if (this.isUpdatingPassword) {
      return;
    }

    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      this.snackBar.open('Please fix the password form errors before submitting.', 'Close', { duration: 3000 });
      return;
    }

    const { currentPassword, newPassword, confirmNewPassword } = this.passwordForm.value;
    if (newPassword !== confirmNewPassword) {
      this.snackBar.open('New password and confirmation must match.', 'Close', { duration: 3000 });
      return;
    }

    this.isUpdatingPassword = true;
    const sub = this.authService.updatePassword(currentPassword, newPassword, confirmNewPassword).subscribe({
      next: (response) => {
        if (response?.success !== false) {
          this.snackBar.open('Password updated successfully.', 'Close', { duration: 3000 });
          this.passwordForm.reset();
        }
        this.isUpdatingPassword = false;
      },
      error: (error) => {
        const message = error?.message || 'Failed to update password. Please try again.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
        this.isUpdatingPassword = false;
      }
    });

    this.subscription.add(sub);
  }

  onSaveNotificationPreferences(): void {
    const preferences = this.notificationsForm.value;
    try {
      localStorage.setItem(this.notificationStorageKey, JSON.stringify(preferences));
      this.snackBar.open('Notification preferences saved.', 'Close', { duration: 2500 });
    } catch (error) {
      console.warn('Failed to save notification preferences:', error);
      this.snackBar.open('Failed to save preferences. Please try again.', 'Close', { duration: 4000 });
    }
  }

  private phoneValidator(control: AbstractControl) {
    const value = (control.value || '').toString().trim();
    if (!value) {
      return { required: true };
    }

    const normalized = value.replace(/\s+/g, '');
    const phonePattern = /^(\+254|0)[1-9]\d{8}$/;
    return phonePattern.test(normalized) ? null : { invalidPhone: true };
  }
}
