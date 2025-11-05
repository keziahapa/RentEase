import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import {
  DocumentService,
  TenantDocument,
  DocumentCategory,
  DocumentType,
  DocumentStatus,
  UploadDocumentPayload
} from '../../../../services/document.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule
  ],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DocumentsComponent implements OnInit, OnDestroy {
  private documentService = inject(DocumentService);
  private subscriptions = new Subscription();

  @Input() collapsedSections!: Set<string>;
  @Input() animatingSections!: Set<string>;
  
  @Output() backClick = new EventEmitter<void>();
  @Output() sectionToggle = new EventEmitter<string>();

  // Component state
  selectedCategory: string = '';
  searchQuery: string = '';
  viewMode: 'grid' | 'list' = 'grid';
  sortBy: 'name' | 'date' | 'category' | 'size' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';
  isLoading: boolean = false;
  selectedDocuments: Set<string> = new Set();
  showUploadModal: boolean = false;

  // File upload state
  dragOverActive: boolean = false;
  uploadProgress: number = 0;
  uploadingFiles: File[] = [];
  uploadError: string | null = null;
  private uploadEncounteredError = false;
  loadError: string | null = null;
  actionError: string | null = null;

  // Documents data
  documents: TenantDocument[] = [];

  // Category options
  categoryOptions = Object.values(DocumentCategory);

  fileIcons: { [key: string]: string } = {
    'application/pdf': 'picture_as_pdf',
    'application/msword': 'description',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
    'application/vnd.ms-excel': 'table_chart',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'table_chart',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'application/zip': 'folder_zip',
    'default': 'insert_drive_file'
  };

  ngOnInit(): void {
    this.loadDocuments();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Navigation methods
  goBack(): void {
    this.backClick.emit();
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

  // Data loading
  loadDocuments(): void {
    this.isLoading = true;
    this.loadError = null;

    const sub = this.documentService.getTenantDocuments().subscribe({
      next: (docs) => {
        this.documents = docs;
        this.isLoading = false;
        this.loadError = null;
      },
      error: (error) => {
        this.loadError = error?.message || 'Failed to load documents.';
        this.handleError(error, 'load documents');
        this.isLoading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  // Filtering and searching
  get filteredDocuments(): TenantDocument[] {
    let filtered = [...this.documents];

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(doc => doc.category === this.selectedCategory);
    }

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.uploadedDate);
          bValue = new Date(b.uploadedDate);
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'size':
          aValue = this.parseSizeToBytes(a.size);
          bValue = this.parseSizeToBytes(b.size);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  private parseSizeToBytes(size: string): number {
    const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
    const match = size.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB)$/);
    if (match) {
      return parseFloat(match[1]) * units[match[2] as keyof typeof units];
    }
    return 0;
  }

  // Search and filter methods
  clearFilters(): void {
    this.selectedCategory = '';
    this.searchQuery = '';
  }

  onCategoryChange(): void {
    // Category filter is reactive through filteredDocuments getter
  }

  onSearchChange(): void {
    // Search is reactive through filteredDocuments getter
  }

  // View management
  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  setSortBy(sortBy: 'name' | 'date' | 'category' | 'size'): void {
    if (this.sortBy === sortBy) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortOrder = 'desc';
    }
  }

  // Document actions
  downloadDocument(doc: TenantDocument): void {
    const sub = this.documentService.markDocumentAccessed(doc.id).subscribe({
      next: () => {
        doc.downloadCount++;
        doc.lastAccessed = this.formatDisplayDate(new Date());
      },
      error: (error) => {
        this.actionError = error?.message || 'Unable to record document download.';
        this.handleError(error, 'download document');
      }
    });
    this.subscriptions.add(sub);

    // Create download link
    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.originalName;
    link.click();
  }

  previewDocument(doc: TenantDocument): void {
    const sub = this.documentService.markDocumentAccessed(doc.id).subscribe({
      next: () => {
        doc.lastAccessed = this.formatDisplayDate(new Date());
      },
      error: (error) => {
        this.actionError = error?.message || 'Unable to record document preview.';
        this.handleError(error, 'preview document');
      }
    });
    this.subscriptions.add(sub);

    // Open in new tab for preview
    window.open(doc.url, '_blank');
  }

  shareDocument(doc: TenantDocument): void {
    console.log('Sharing document:', doc.name);
    
    if (navigator.share) {
      navigator.share({
        title: doc.name,
        text: doc.description || 'Shared document from RentEase',
        url: doc.url
      });
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(doc.url).then(() => {
        console.log('Document URL copied to clipboard');
        // You could show a toast notification here
      });
    }
  }

  deleteDocument(doc: TenantDocument): void {
    if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      const sub = this.documentService.deleteDocument(doc.id).subscribe({
        next: (deleted) => {
          if (deleted) {
            this.documents = this.documents.filter(d => d.id !== doc.id);
            this.selectedDocuments.delete(doc.id);
          }
        },
        error: (error) => {
          this.actionError = error?.message || 'Failed to delete document.';
          this.handleError(error, 'delete document');
        }
      });
      this.subscriptions.add(sub);
    }
  }

  // Selection methods
  toggleDocumentSelection(docId: string): void {
    if (this.selectedDocuments.has(docId)) {
      this.selectedDocuments.delete(docId);
    } else {
      this.selectedDocuments.add(docId);
    }
  }

  isDocumentSelected(docId: string): boolean {
    return this.selectedDocuments.has(docId);
  }

  selectAllDocuments(): void {
    const filtered = this.filteredDocuments;
    if (this.selectedDocuments.size === filtered.length) {
      this.selectedDocuments.clear();
    } else {
      this.selectedDocuments.clear();
      filtered.forEach(doc => this.selectedDocuments.add(doc.id));
    }
  }

  downloadSelected(): void {
    const selected = this.documents.filter(doc => this.selectedDocuments.has(doc.id));
    selected.forEach(doc => this.downloadDocument(doc));
    this.selectedDocuments.clear();
  }

  deleteSelected(): void {
    const count = this.selectedDocuments.size;
    if (confirm(`Are you sure you want to delete ${count} selected document${count > 1 ? 's' : ''}?`)) {
      const idsToDelete = Array.from(this.selectedDocuments);
      idsToDelete.forEach(id => {
        const sub = this.documentService.deleteDocument(id).subscribe({
          next: (deleted) => {
            if (deleted) {
              this.documents = this.documents.filter(doc => doc.id !== id);
            }
          },
          error: (error) => {
            this.actionError = error?.message || 'Failed to delete selected documents.';
            this.handleError(error, 'delete selected documents');
          }
        });
        this.subscriptions.add(sub);
      });
      this.selectedDocuments.clear();
    }
  }

  // File upload methods
  openUploadModal(): void {
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.uploadingFiles = [];
    this.uploadProgress = 0;
    this.uploadError = null;
    this.uploadEncounteredError = false;
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOverActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOverActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOverActive = false;
    
    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  private handleFiles(files: File[]): void {
    if (!files.length) {
      return;
    }

    this.uploadingFiles = files;
    this.uploadProgress = 0;
    this.uploadError = null;
    this.uploadEncounteredError = false;

    const total = files.length;
    let processed = 0;

    files.forEach(file => {
      const payload: UploadDocumentPayload = {
        file,
        category: DocumentCategory.OTHER,
        type: DocumentType.OTHER,
        tags: [],
        isPublic: false
      };

      const sub = this.documentService.uploadDocument(payload).subscribe({
        next: (newDoc) => {
          this.documents = [newDoc, ...this.documents];
          processed++;
          this.uploadProgress = Math.round((processed / total) * 100);
          if (processed === total && !this.uploadEncounteredError) {
            this.resetUploadState();
          }
        },
        error: (error) => {
          this.uploadError = error?.message || 'Failed to upload document.';
          this.uploadEncounteredError = true;
          processed++;
          this.uploadProgress = Math.round((processed / total) * 100);
          this.handleError(error, 'upload document');
          // keep modal open to show error
        }
      });

      this.subscriptions.add(sub);
    });
  }

  private resetUploadState(): void {
    this.closeUploadModal();
  }

  // CHANGED: Made this method public instead of private
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Utility methods
  getFileIcon(mimeType: string): string {
    return this.fileIcons[mimeType] || this.fileIcons['default'];
  }

  getStatusClass(status: DocumentStatus): string {
    const statusMap = {
      [DocumentStatus.ACTIVE]: 'status-success',
      [DocumentStatus.ARCHIVED]: 'status-info',
      [DocumentStatus.EXPIRED]: 'status-danger',
      [DocumentStatus.PENDING_REVIEW]: 'status-warning',
      [DocumentStatus.REJECTED]: 'status-danger'
    };
    return statusMap[status] || 'status-default';
  }

  getCategoryColor(category: DocumentCategory): string {
    const colorMap = {
      [DocumentCategory.LEGAL]: '#3b82f6',
      [DocumentCategory.FINANCIAL]: '#10b981',
      [DocumentCategory.MAINTENANCE]: '#f59e0b',
      [DocumentCategory.INSPECTION]: '#8b5cf6',
      [DocumentCategory.INSURANCE]: '#ef4444',
      [DocumentCategory.IDENTITY]: '#06b6d4',
      [DocumentCategory.CORRESPONDENCE]: '#84cc16',
      [DocumentCategory.OTHER]: '#64748b'
    };
    return colorMap[category] || '#64748b';
  }

  isExpiringSoon(doc: TenantDocument): boolean {
    if (!doc.expiryDate) return false;
    
    const expiryDate = new Date(doc.expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }

  isExpired(doc: TenantDocument): boolean {
    if (!doc.expiryDate) return false;
    
    const expiryDate = new Date(doc.expiryDate);
    const today = new Date();
    
    return today > expiryDate;
  }

  // Analytics
  getTotalDocuments(): number {
    return this.documents.length;
  }

  getTotalSize(): string {
    const totalBytes = this.documents.reduce((total, doc) => {
      return total + this.parseSizeToBytes(doc.size);
    }, 0);
    
    return this.formatFileSize(totalBytes);
  }

  getDocumentsByCategory(): { category: string, count: number }[] {
    const categoryCount: { [key: string]: number } = {};
    
    this.documents.forEach(doc => {
      categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
    });
    
    return Object.entries(categoryCount).map(([category, count]) => ({
      category,
      count
    }));
  }

  // Error handling
  handleError(error: any, context: string): void {
    console.error(`Error in documents component - ${context}:`, error);
  }

  // Accessibility
  getAriaLabel(sectionId: string): string {
    const collapsed = this.isSectionCollapsed(sectionId);
    return `${collapsed ? 'Expand' : 'Collapse'} ${sectionId} section`;
  }

  // Track by functions for performance
  trackByDocumentId(index: number, doc: TenantDocument): string {
    return doc.id;
  }

  trackByCategoryId(index: number, category: string): string {
    return category;
  }

  private formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  dismissActionError(): void {
    this.actionError = null;
  }
}
