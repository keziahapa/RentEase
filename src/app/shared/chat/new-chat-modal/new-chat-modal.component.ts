import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

export interface NewChatModalData {
  currentUserId: number;
  userRole: string;
}

@Component({
  selector: 'app-new-chat-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './new-chat-modal.component.html',
  styleUrls: ['./new-chat-modal.component.scss']
})
export class NewChatModalComponent {
 
  public dialogRef = inject(MatDialogRef<NewChatModalComponent>);
  public data = inject<NewChatModalData>(MAT_DIALOG_DATA);

  participantId: string = '';
  participantType: string = 'TENANT_LANDLORD';
  propertyId: number | null = null;

  onCancel(): void {
    this.dialogRef.close();
  }

  onStartChat(): void {
    if (this.isFormValid()) {
      const result = {
        participantId: this.participantId.trim(),
        participantType: this.participantType,
        propertyId: this.propertyId
      };
      this.dialogRef.close(result);
    }
  }

  isFormValid(): boolean {
    return !!this.participantId.trim() && !!this.participantType;
  }
}