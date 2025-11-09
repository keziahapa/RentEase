import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { EnhancedUser } from '../../../../../../models/user.model';
import { AdminDataService } from '../../../../../../services/admin-data.service';
import { SearchParams } from '../../../../../../services/admin-interfaces';

@Component({
  selector: 'app-users-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './users-view.component.html',
  styleUrls: ['./users-view.component.scss']
})
export class UsersViewComponent {
  private readonly adminDataService = inject(AdminDataService);
  private readonly snackBar = inject(MatSnackBar);

  @Input() filteredUsers: EnhancedUser[] = [];
  @Input() selectedUserType: string = 'all';
  @Input() selectedStatus: string = 'all';
  
  @Output() filterUsers = new EventEmitter<void>();
  @Output() viewUserDetails = new EventEmitter<EnhancedUser>();
  @Output() editUser = new EventEmitter<EnhancedUser>();
  @Output() suspendUser = new EventEmitter<EnhancedUser>();
  @Output() activateUser = new EventEmitter<EnhancedUser>();

  displayedColumns: string[] = ['avatar', 'userInfo', 'properties', 'status', 'actions'];
  exportState: Record<'csv' | 'pdf', boolean> = { csv: false, pdf: false };

  getTotalUsersCount(): number {
    return this.filteredUsers.length;
  }

  getTenantsCount(): number {
    return this.filteredUsers.filter(u => u.type === 'tenant').length;
  }

  getLandlordsCount(): number {
    return this.filteredUsers.filter(u => u.type === 'landlord').length;
  }

  getCaretakersCount(): number {
    return this.filteredUsers.filter(u => u.type === 'caretaker').length;
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getStatusClass(status: string): string {
    const statusMap: any = {
      'active': 'status-active',
      'inactive': 'status-inactive',
      'suspended': 'status-suspended'
    };
    return statusMap[status] || 'status-pending';
  }

  exportUsers(format: 'csv' | 'pdf'): void {
    if (this.exportState[format]) {
      return;
    }

    this.exportState[format] = true;
    const params = this.buildExportParams();

    this.adminDataService
      .exportReport('users', format, params)
      .pipe(finalize(() => (this.exportState[format] = false)))
      .subscribe({
        next: (blob) => this.handleExportBlob(blob, `rentease-users.${format}`),
        error: (error) => {
          const message = error?.message || `Unable to export users as ${format.toUpperCase()} right now.`;
          this.snackBar.open(message, 'Close', { duration: 4000 });
        }
      });
  }
private buildExportParams(): SearchParams {
  const params: SearchParams = {};

  if (this.selectedUserType && this.selectedUserType !== 'all') {
    params['role'] = this.selectedUserType.toUpperCase(); 
  }

  if (this.selectedStatus && this.selectedStatus !== 'all') {
    params['status'] = this.selectedStatus.toUpperCase(); 
  }

  return params;
}

  private async handleExportBlob(blob: Blob, filename: string): Promise<void> {
    if (blob.type?.includes('text')) {
      const fallbackMessage = await blob.text();
      this.snackBar.open(fallbackMessage || 'Export unavailable. Please retry later.', 'Close', {
        duration: 4000
      });
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${filename}`, 'Close', { duration: 2500 });
  }
}
