import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import {
  MaintenanceService,
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  UrgencyLevel,
  MaintenanceUpdate,
  MaintenanceImage,
  CreateMaintenanceRequestPayload
} from '../../../../services/maintenance.service';
import { SkeletonListComponent } from '../../../../shared/components/skeleton/skeleton-list.component';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    SkeletonListComponent
  ],
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss']
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private maintenanceService = inject(MaintenanceService);
  private subscriptions = new Subscription();

  filteredRequests: MaintenanceRequest[] = [];
  selectedRequest: MaintenanceRequest | null = null;

  @Input() collapsedSections!: Set<string>;
  @Input() animatingSections!: Set<string>;
  
  @Output() backClick = new EventEmitter<void>();
  @Output() sectionToggle = new EventEmitter<string>();

  // Form and state
  maintenanceForm!: FormGroup;
  selectedTab: 'new' | 'active' | 'completed' | 'all' = 'new';
  isSubmitting: boolean = false;
  showImagePreview: boolean = false;
  selectedImages: File[] = [];
  filterStatus: string = '';
  filterCategory: string = '';
  sortBy: 'date' | 'priority' | 'status' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';
  isLoadingRequests = false;
  loadError: string | null = null;

  // Enums for template
  MaintenanceCategory = MaintenanceCategory;
  MaintenancePriority = MaintenancePriority;
  MaintenanceStatus = MaintenanceStatus;
  UrgencyLevel = UrgencyLevel;

  // Category options
  categoryOptions = Object.values(MaintenanceCategory);
  priorityOptions = Object.values(MaintenancePriority);
  maintenanceStatusOptions = Object.values(MaintenanceStatus);
  urgencyLevels = Object.values(UrgencyLevel);

  // Maintenance requests data
  maintenanceRequests: MaintenanceRequest[] = [];
  feedbackDrafts: Record<string, string | undefined> = {};

  // Common maintenance issues for quick selection
  commonIssues = [
    { title: 'Leaky Faucet', category: MaintenanceCategory.PLUMBING, priority: MaintenancePriority.MEDIUM },
    { title: 'Clogged Drain', category: MaintenanceCategory.PLUMBING, priority: MaintenancePriority.MEDIUM },
    { title: 'Light Not Working', category: MaintenanceCategory.ELECTRICAL, priority: MaintenancePriority.LOW },
    { title: 'Power Outlet Not Working', category: MaintenanceCategory.ELECTRICAL, priority: MaintenancePriority.MEDIUM },
    { title: 'AC Not Working', category: MaintenanceCategory.HVAC, priority: MaintenancePriority.HIGH },
    { title: 'Heating Not Working', category: MaintenanceCategory.HVAC, priority: MaintenancePriority.HIGH },
    { title: 'Door Lock Issues', category: MaintenanceCategory.SECURITY, priority: MaintenancePriority.HIGH },
    { title: 'Window Won\'t Close', category: MaintenanceCategory.DOORS_WINDOWS, priority: MaintenancePriority.MEDIUM }
  ];

  ngOnInit(): void {
    this.subscribeToMaintenanceChanges();
    this.initializeForm();
    this.loadMaintenanceRequests();
  }

  viewAttachment(image: MaintenanceImage): void {
    if (image.url) {
      window.open(image.url, '_blank');
    }
  }

  downloadAttachment(image: MaintenanceImage): void {
    if (!image.url) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = image.url;
    anchor.download = image.caption || 'attachment';
    anchor.click();
    anchor.remove();
  }

  private loadMaintenanceRequests(): void {
    this.isLoadingRequests = true;
    this.loadError = null;

    const sub = this.maintenanceService.getTenantMaintenanceRequests().subscribe({
      next: () => {
        this.isLoadingRequests = false;
      },
      error: (error) => {
        this.loadError = error?.message || 'Unable to load maintenance requests.';
        this.isLoadingRequests = false;
      }
    });

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForm(): void {
    this.maintenanceForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', Validators.required],
      priority: [MaintenancePriority.MEDIUM, Validators.required],
      location: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      urgencyLevel: [UrgencyLevel.MEDIUM]
    });
  }

  // Navigation
  goBack(): void {
    this.backClick.emit();
  }

  setActiveTab(tab: 'new' | 'active' | 'completed' | 'all'): void {
    this.selectedTab = tab;
    this.applyFilters();
  }

  // Section management
  isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSections?.has(sectionId) || false;
  }

  isAnimating(sectionId: string): boolean {
    return this.animatingSections?.has(sectionId) || false;
  }

  toggleSection(sectionId: string): void {
    this.sectionToggle.emit(sectionId);
  }

  // Form methods
  selectCommonIssue(issue: any): void {
    this.maintenanceForm.patchValue({
      title: issue.title,
      category: issue.category,
      priority: issue.priority
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedImages = Array.from(input.files);
    }
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
  }

  submitMaintenanceRequest(): void {
    if (this.maintenanceForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    const formData = this.maintenanceForm.value;
    const payload: CreateMaintenanceRequestPayload = {
      title: formData.title.trim(),
      category: formData.category,
      priority: formData.priority,
      description: formData.description.trim(),
      urgencyLevel: formData.urgencyLevel,
      location: formData.location.trim(),
      attachments: this.selectedImages
    };

    const sub = this.maintenanceService.submitTenantMaintenanceRequest(payload).subscribe({
      next: (newRequest: MaintenanceRequest) => {
        this.resetForm();
        this.isSubmitting = false;
        this.setActiveTab('all');
        this.selectedRequest = newRequest;
      },
      error: (error) => {
        this.loadError = error?.message || 'Failed to submit maintenance request.';
        this.isSubmitting = false;
      }
    });

    this.subscriptions.add(sub);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.maintenanceForm.controls).forEach(key => {
      this.maintenanceForm.get(key)?.markAsTouched();
    });
  }

  private resetForm(): void {
    this.maintenanceForm.reset({
      priority: MaintenancePriority.MEDIUM,
      urgencyLevel: UrgencyLevel.MEDIUM
    });
    this.selectedImages = [];
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterCategory = '';
    this.applyFilters();
  }

  // Request actions
  cancelRequest(request: MaintenanceRequest): void {
    if (!confirm(`Are you sure you want to cancel "${request.title}"?`)) {
      return;
    }

    const payload = {
      status: MaintenanceStatus.CANCELLED,
      message: 'Request cancelled by tenant'
    };

    const sub = this.maintenanceService.updateCaretakerMaintenanceRequest(request.id, payload).subscribe({
      error: (error) => {
        this.loadError = error?.message || 'Failed to cancel maintenance request.';
      }
    });

    this.subscriptions.add(sub);
  }

  rateService(request: MaintenanceRequest, rating: number): void {
    const payload = {
      tenantRating: rating,
      message: `Tenant rated the service ${rating} stars`,
      status: request.status
    };

    const sub = this.maintenanceService.updateCaretakerMaintenanceRequest(request.id, payload).subscribe({
      error: (error) => {
        this.loadError = error?.message || 'Failed to submit rating.';
      }
    });

    this.subscriptions.add(sub);
  }

  submitFeedback(request: MaintenanceRequest, feedback: string): void {
    const payload = {
      tenantFeedback: feedback,
      message: `Tenant feedback: ${feedback}`,
      status: request.status
    };

    const sub = this.maintenanceService.updateCaretakerMaintenanceRequest(request.id, payload).subscribe({
      next: () => {
        this.feedbackDrafts[request.id] = '';
      },
      error: (error) => {
        this.loadError = error?.message || 'Failed to submit feedback.';
      }
    });

    this.subscriptions.add(sub);
  }

  // Utility methods
  getStatusClass(status: MaintenanceStatus): string {
    const statusMap = {
      [MaintenanceStatus.SUBMITTED]: 'status-info',
      [MaintenanceStatus.ACKNOWLEDGED]: 'status-info',
      [MaintenanceStatus.IN_PROGRESS]: 'status-warning',
      [MaintenanceStatus.SCHEDULED]: 'status-warning',
      [MaintenanceStatus.PENDING_PARTS]: 'status-warning',
      [MaintenanceStatus.COMPLETED]: 'status-success',
      [MaintenanceStatus.CANCELLED]: 'status-danger',
      [MaintenanceStatus.REJECTED]: 'status-danger'
    };
    return statusMap[status] || 'status-default';
  }

  getPriorityClass(priority: MaintenancePriority): string {
    const priorityMap = {
      [MaintenancePriority.LOW]: 'priority-low',
      [MaintenancePriority.MEDIUM]: 'priority-medium',
      [MaintenancePriority.HIGH]: 'priority-high',
      [MaintenancePriority.URGENT]: 'priority-urgent'
    };
    return priorityMap[priority] || 'priority-default';
  }

  getUrgencyClass(urgency: UrgencyLevel): string {
    const urgencyMap = {
      [UrgencyLevel.LOW]: 'urgency-low',
      [UrgencyLevel.MEDIUM]: 'urgency-medium',
      [UrgencyLevel.HIGH]: 'urgency-high',
      [UrgencyLevel.EMERGENCY]: 'urgency-emergency'
    };
    return urgencyMap[urgency] || 'urgency-default';
  }

  getStatusIcon(status: MaintenanceStatus): string {
    const iconMap = {
      [MaintenanceStatus.SUBMITTED]: 'hourglass_empty',
      [MaintenanceStatus.ACKNOWLEDGED]: 'schedule',
      [MaintenanceStatus.IN_PROGRESS]: 'build',
      [MaintenanceStatus.SCHEDULED]: 'event',
      [MaintenanceStatus.PENDING_PARTS]: 'inventory',
      [MaintenanceStatus.COMPLETED]: 'check_circle',
      [MaintenanceStatus.CANCELLED]: 'cancel',
      [MaintenanceStatus.REJECTED]: 'error'
    };
    return iconMap[status] || 'help';
  }

  getCategoryIcon(category: MaintenanceCategory): string {
    const iconMap = {
      [MaintenanceCategory.PLUMBING]: 'plumbing',
      [MaintenanceCategory.ELECTRICAL]: 'electrical_services',
      [MaintenanceCategory.HVAC]: 'ac_unit',
      [MaintenanceCategory.APPLIANCES]: 'kitchen',
      [MaintenanceCategory.SECURITY]: 'security',
      [MaintenanceCategory.PAINTING]: 'palette',
      [MaintenanceCategory.FLOORING]: 'home',
      [MaintenanceCategory.DOORS_WINDOWS]: 'door_front',
      [MaintenanceCategory.PEST_CONTROL]: 'pest_control',
      [MaintenanceCategory.CLEANING]: 'cleaning_services',
      [MaintenanceCategory.LANDSCAPING]: 'grass',
      [MaintenanceCategory.OTHER]: 'handyman'
    };
    return iconMap[category] || 'build';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getRequestSummaryStats() {
    if (!this.maintenanceRequests.length) {
      return { total: 0, active: 0, completed: 0, urgent: 0 };
    }

    const total = this.maintenanceRequests.length;
    const active = this.maintenanceRequests.filter(req => 
      [MaintenanceStatus.SUBMITTED, MaintenanceStatus.ACKNOWLEDGED, 
       MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.SCHEDULED].includes(req.status)
    ).length;
    const completed = this.maintenanceRequests.filter(req => 
      req.status === MaintenanceStatus.COMPLETED
    ).length;
    const urgent = this.maintenanceRequests.filter(req => 
      req.priority === MaintenancePriority.URGENT
    ).length;

    return { total, active, completed, urgent };
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.maintenanceForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.maintenanceForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['email']) return `Invalid email format`;
    }
    return '';
  }

  // Accessibility
  getAriaLabel(sectionId: string): string {
    const collapsed = this.isSectionCollapsed(sectionId);
    return `${collapsed ? 'Expand' : 'Collapse'} ${sectionId} section`;
  }

  // Track by functions for performance
  trackByRequestId(index: number, request: MaintenanceRequest): string {
    return request.id;
  }

  trackByUpdateId(index: number, update: MaintenanceUpdate): string {
    return update.id;
  }

  trackByImageId(index: number, image: MaintenanceImage): string {
    return image.id;
  }

  onFilterStatusChange(status: string): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  onFilterCategoryChange(category: string): void {
    this.filterCategory = category;
    this.applyFilters();
  }

  onSortFieldChange(field: 'date' | 'priority' | 'status'): void {
    if (this.sortBy !== field) {
      this.sortBy = field;
      this.sortOrder = field === 'date' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
    }
    this.applyFilters();
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.applyFilters();
  }

  isSelected(request: MaintenanceRequest): boolean {
    return this.selectedRequest?.id === request.id;
  }

  toggleRequestDetails(request: MaintenanceRequest): void {
    if (this.selectedRequest?.id === request.id) {
      this.selectedRequest = null;
    } else {
      this.selectedRequest = request;
    }
  }

  closeRequestDetails(): void {
    this.selectedRequest = null;
  }

  getLatestUpdate(request: MaintenanceRequest): MaintenanceUpdate | undefined {
    if (!request.updates?.length) {
      return undefined;
    }
    return request.updates[request.updates.length - 1];
  }

  private subscribeToMaintenanceChanges(): void {
    const sub = this.maintenanceService.maintenanceRequestsChanges$.subscribe(requests => {
      this.maintenanceRequests = requests;
      this.applyFilters();
    });
    this.subscriptions.add(sub);
  }

  private applyFilters(): void {
    let filtered = [...this.maintenanceRequests];

    switch (this.selectedTab) {
      case 'active':
        filtered = filtered.filter(req =>
          [
            MaintenanceStatus.SUBMITTED,
            MaintenanceStatus.ACKNOWLEDGED,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.SCHEDULED,
            MaintenanceStatus.PENDING_PARTS
          ].includes(req.status)
        );
        break;
      case 'completed':
        filtered = filtered.filter(req => req.status === MaintenanceStatus.COMPLETED);
        break;
      case 'all':
      case 'new':
      default:
        break;
    }

    if (this.filterStatus) {
      filtered = filtered.filter(req => req.status === this.filterStatus);
    }

    if (this.filterCategory) {
      filtered = filtered.filter(req => req.category === this.filterCategory);
    }

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortBy) {
        case 'date':
          aValue = new Date(a.dateSubmitted).getTime();
          bValue = new Date(b.dateSubmitted).getTime();
          break;
        case 'priority': {
          const priorityOrder: Record<MaintenancePriority, number> = {
            [MaintenancePriority.URGENT]: 4,
            [MaintenancePriority.HIGH]: 3,
            [MaintenancePriority.MEDIUM]: 2,
            [MaintenancePriority.LOW]: 1
          };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        }
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (aValue < bValue) {
        return this.sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.filteredRequests = filtered;

    if (!filtered.length) {
      this.selectedRequest = null;
      return;
    }

    if (this.selectedRequest) {
      const existing = filtered.find(req => req.id === this.selectedRequest?.id);
      if (existing) {
        this.selectedRequest = existing;
        return;
      }
    }

    this.selectedRequest = filtered[0];
  }
}
