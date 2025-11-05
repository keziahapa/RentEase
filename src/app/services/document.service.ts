import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export enum DocumentCategory {
  LEGAL = 'Legal',
  FINANCIAL = 'Financial',
  MAINTENANCE = 'Maintenance',
  INSPECTION = 'Inspection',
  INSURANCE = 'Insurance',
  IDENTITY = 'Identity',
  CORRESPONDENCE = 'Correspondence',
  OTHER = 'Other'
}

export enum DocumentType {
  LEASE_AGREEMENT = 'lease_agreement',
  ADDENDUM = 'addendum',
  RECEIPT = 'receipt',
  INVOICE = 'invoice',
  INSPECTION_REPORT = 'inspection_report',
  MAINTENANCE_REPORT = 'maintenance_report',
  INSURANCE_POLICY = 'insurance_policy',
  ID_COPY = 'id_copy',
  BANK_STATEMENT = 'bank_statement',
  EMPLOYMENT_LETTER = 'employment_letter',
  REFERENCE_LETTER = 'reference_letter',
  PHOTO = 'photo',
  OTHER = 'other'
}

export enum DocumentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected'
}

export interface TenantDocument {
  id: string;
  name: string;
  originalName: string;
  category: DocumentCategory;
  type: DocumentType;
  url: string;
  size: string;
  mimeType: string;
  uploadedBy: string;
  uploadedDate: string;
  description?: string;
  tags: string[];
  isPublic: boolean;
  expiryDate?: string;
  version: number;
  status: DocumentStatus;
  downloadCount: number;
  lastAccessed?: string;
}

export interface UploadDocumentPayload {
  file: File;
  category: DocumentCategory;
  type: DocumentType;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateDocumentMetadataPayload {
  name?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  status?: DocumentStatus;
  expiryDate?: string | null;
}

export interface DocumentAuditEvent {
  id: string;
  documentId: string;
  action: string;
  performedBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Temporary document management provider. This isolates mocked data until the backend exposes the
 * required document endpoints. See docs/api-gaps.md.
 */
@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly documentsUrl = `${environment.apiUrl}/documents`;
  private readonly auditLogUrl = `${this.documentsUrl}/audit-log`;

  private fallbackDocuments: TenantDocument[] = [
    {
      id: '1',
      name: 'Lease Agreement - 2024',
      originalName: 'lease_agreement_2024.pdf',
      category: DocumentCategory.LEGAL,
      type: DocumentType.LEASE_AGREEMENT,
      url: '/assets/documents/lease_agreement_2024.pdf',
      size: '2.4 MB',
      mimeType: 'application/pdf',
      uploadedBy: 'Sarah Johnson (Landlord)',
      uploadedDate: 'Jan 15, 2024',
      description: 'Main lease agreement for the property at 123 Main Street',
      tags: ['lease', 'contract', '2024'],
      isPublic: false,
      version: 1,
      status: DocumentStatus.ACTIVE,
      downloadCount: 5,
      lastAccessed: 'Feb 10, 2024'
    },
    {
      id: '2',
      name: 'Security Deposit Receipt',
      originalName: 'deposit_receipt_001.pdf',
      category: DocumentCategory.FINANCIAL,
      type: DocumentType.RECEIPT,
      url: '/assets/documents/deposit_receipt.pdf',
      size: '856 KB',
      mimeType: 'application/pdf',
      uploadedBy: 'Property Management',
      uploadedDate: 'Jan 15, 2024',
      description: 'Receipt for security deposit payment',
      tags: ['deposit', 'receipt', 'payment'],
      isPublic: false,
      version: 1,
      status: DocumentStatus.ACTIVE,
      downloadCount: 3,
      lastAccessed: 'Jan 20, 2024'
    },
    {
      id: '3',
      name: 'Move-in Inspection Report',
      originalName: 'inspection_report_movein.pdf',
      category: DocumentCategory.INSPECTION,
      type: DocumentType.INSPECTION_REPORT,
      url: '/assets/documents/inspection_report.pdf',
      size: '1.2 MB',
      mimeType: 'application/pdf',
      uploadedBy: 'David Kamau (Inspector)',
      uploadedDate: 'Feb 1, 2024',
      description: 'Property condition report at move-in',
      tags: ['inspection', 'move-in', 'condition'],
      isPublic: false,
      version: 1,
      status: DocumentStatus.ACTIVE,
      downloadCount: 2,
      lastAccessed: 'Feb 5, 2024'
    },
    {
      id: '4',
      name: 'Property Insurance Policy',
      originalName: 'insurance_policy_2024.pdf',
      category: DocumentCategory.INSURANCE,
      type: DocumentType.INSURANCE_POLICY,
      url: '/assets/documents/insurance_policy.pdf',
      size: '950 KB',
      mimeType: 'application/pdf',
      uploadedBy: 'Insurance Company',
      uploadedDate: 'Jan 20, 2024',
      description: 'Property insurance coverage details',
      tags: ['insurance', 'policy', 'coverage'],
      isPublic: false,
      expiryDate: 'Jan 20, 2025',
      version: 1,
      status: DocumentStatus.ACTIVE,
      downloadCount: 1,
      lastAccessed: 'Jan 25, 2024'
    },
    {
      id: '5',
      name: 'Rent Payment - February 2024',
      originalName: 'rent_receipt_feb_2024.pdf',
      category: DocumentCategory.FINANCIAL,
      type: DocumentType.RECEIPT,
      url: '/assets/documents/rent_receipt_feb.pdf',
      size: '420 KB',
      mimeType: 'application/pdf',
      uploadedBy: 'Payment System',
      uploadedDate: 'Feb 15, 2024',
      description: 'Monthly rent payment receipt',
      tags: ['rent', 'receipt', 'february'],
      isPublic: false,
      version: 1,
      status: DocumentStatus.ACTIVE,
      downloadCount: 1
    },
    {
      id: '6',
      name: 'Maintenance Request Photos',
      originalName: 'maintenance_photos.zip',
      category: DocumentCategory.MAINTENANCE,
      type: DocumentType.PHOTO,
      url: '/assets/documents/maintenance_photos.zip',
      size: '3.1 MB',
      mimeType: 'application/zip',
      uploadedBy: 'Tenant Upload',
      uploadedDate: 'Feb 12, 2024',
      description: 'Supporting photos for maintenance request #1234',
      tags: ['maintenance', 'photos', 'evidence'],
      isPublic: false,
      version: 1,
      status: DocumentStatus.PENDING_REVIEW,
      downloadCount: 0
    }
  ];

  private documentsCache: TenantDocument[] = this.cloneDocuments(this.fallbackDocuments);

  getTenantDocuments(): Observable<TenantDocument[]> {
    return this.http
      .get<TenantDocument[] | { data?: TenantDocument[] } | { documents?: TenantDocument[] }>(this.documentsUrl)
      .pipe(
        map(response => this.normalizeDocuments(this.extractDocuments(response))),
        tap(documents => this.setDocuments(documents)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load documents', error);
          return of(this.getDocumentsSnapshot());
        })
      );
  }

  uploadDocument(payload: UploadDocumentPayload): Observable<TenantDocument> {
    const formData = this.buildUploadFormData(payload);

    return this.http
      .post<TenantDocument | { data?: TenantDocument }>(this.documentsUrl, formData)
      .pipe(
        map(response => {
          const document = this.unwrapDocument(response);
          if (!document) {
            throw new Error('Empty document response');
          }
          return this.normalizeDocument(document);
        }),
        tap(document => this.cacheDocument(document)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('upload document', error);
          const fallbackDocument = this.createLocalDocument(payload);
          this.cacheDocument(fallbackDocument);
          return of(fallbackDocument);
        })
      );
  }

  deleteDocument(documentId: string): Observable<boolean> {
    const endpoint = `${this.documentsUrl}/${documentId}`;

    return this.http.delete<void>(endpoint).pipe(
      tap(() => this.removeDocumentFromCache(documentId)),
      map(() => true),
      catchError(error => {
        if (!this.shouldFallback(error, { allowNotFound: true })) {
          return throwError(() => error);
        }
        this.logFallback(`delete document ${documentId}`, error);
        const fallbackRemoved = this.removeDocumentFromCache(documentId);
        return fallbackRemoved ? of(true) : of(false);
      })
    );
  }

  markDocumentAccessed(documentId: string): Observable<void> {
    const endpoint = `${this.documentsUrl}/${documentId}/audit-log`;
    const payload = { action: 'download' };

    return this.http.post<void | { data?: unknown }>(endpoint, payload).pipe(
      tap(() => this.incrementDocumentAccess(documentId)),
      map(() => void 0),
      catchError(error => {
        if (!this.shouldFallback(error)) {
          return throwError(() => error);
        }
        this.logFallback(`mark document ${documentId} accessed`, error);
        this.incrementDocumentAccess(documentId);
        return of(void 0);
      })
    );
  }

  updateDocumentMetadata(documentId: string, updates: UpdateDocumentMetadataPayload): Observable<TenantDocument> {
    const endpoint = `${this.documentsUrl}/${documentId}`;

    return this.http
      .patch<TenantDocument | { data?: TenantDocument }>(endpoint, updates)
      .pipe(
        map(response => {
          const document = this.unwrapDocument(response);
          if (!document) {
            throw new Error('Empty document response');
          }
          return this.normalizeDocument(document);
        }),
        tap(document => this.replaceDocumentInCache(document)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback(`update document metadata ${documentId}`, error);
          const fallbackDocument = this.applyLocalMetadataUpdate(documentId, updates);
          return fallbackDocument
            ? of(fallbackDocument)
            : of(this.createErrorDocumentPlaceholder(documentId));
        })
      );
  }

  getDocumentAuditLog(documentId?: string): Observable<DocumentAuditEvent[]> {
    const params = documentId ? { documentId } : undefined;
    return this.http
      .get<DocumentAuditEvent[] | { data?: DocumentAuditEvent[]; items?: DocumentAuditEvent[] }>(this.auditLogUrl, {
        params: params as any
      })
      .pipe(
        map(response => this.extractAuditEvents(response)),
        catchError(error => {
          if (!this.shouldFallback(error)) {
            return throwError(() => error);
          }
          this.logFallback('load document audit log', error);
          return of([]);
        })
      );
  }

  private formatFileSize(sizeInBytes: number): string {
    if (!sizeInBytes) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private buildUploadFormData(payload: UploadDocumentPayload): FormData {
    const formData = new FormData();
    formData.append('file', payload.file, payload.file.name);
    formData.append('category', payload.category);
    formData.append('type', payload.type);
    if (payload.description) {
      formData.append('description', payload.description);
    }
    if (payload.tags?.length) {
      payload.tags.forEach(tag => formData.append('tags', tag));
    }
    formData.append('isPublic', String(payload.isPublic ?? false));
    return formData;
  }

  private normalizeDocuments(documents: TenantDocument[]): TenantDocument[] {
    return documents.map(doc => this.normalizeDocument(doc));
  }

  private normalizeDocument(input: Partial<TenantDocument> & Record<string, any>): TenantDocument {
    const uploadedDate = this.normalizeDateString(input.uploadedDate);
    const lastAccessed = this.normalizeDateString(input.lastAccessed);
    const expiryDate = this.normalizeDateString(input.expiryDate);

    return {
      id: input.id ?? `doc-${Date.now()}`,
      name: input.name ?? input.originalName ?? input['fileName'] ?? 'Untitled Document',
      originalName: input.originalName ?? input.name ?? 'document',
      category: input.category ?? DocumentCategory.OTHER,
      type: input.type ?? DocumentType.OTHER,
      url: input.url ?? input['downloadUrl'] ?? '',
      size: this.normalizeSize(input.size),
      mimeType: input.mimeType ?? input['contentType'] ?? 'application/octet-stream',
      uploadedBy: input.uploadedBy ?? 'Unknown',
      uploadedDate: uploadedDate ?? this.formatDisplayDate(new Date()),
      description: input.description,
      tags: Array.isArray(input.tags) ? [...input.tags] : [],
      isPublic: Boolean(input.isPublic),
      expiryDate,
      version: input.version ?? 1,
      status: input.status ?? DocumentStatus.ACTIVE,
      downloadCount: input.downloadCount ?? 0,
      lastAccessed: lastAccessed ?? undefined
    };
  }

  private createLocalDocument(payload: UploadDocumentPayload): TenantDocument {
    return {
      id: `tmp-${Date.now()}`,
      name: payload.file.name,
      originalName: payload.file.name,
      category: payload.category,
      type: payload.type,
      url: typeof URL !== 'undefined' ? URL.createObjectURL(payload.file) : '',
      size: this.formatFileSize(payload.file.size),
      mimeType: payload.file.type || 'application/octet-stream',
      uploadedBy: 'You',
      uploadedDate: this.formatDisplayDate(new Date()),
      description: payload.description,
      tags: payload.tags ?? [],
      isPublic: payload.isPublic ?? false,
      version: 1,
      status: DocumentStatus.PENDING_REVIEW,
      downloadCount: 0,
      lastAccessed: undefined
    };
  }

  private cacheDocument(document: TenantDocument): void {
    this.documentsCache = [document, ...this.documentsCache.filter(existing => existing.id !== document.id)];
  }

  private replaceDocumentInCache(document: TenantDocument): void {
    const index = this.documentsCache.findIndex(existing => existing.id === document.id);
    if (index === -1) {
      this.cacheDocument(document);
      return;
    }
    const updated = [...this.documentsCache];
    updated[index] = document;
    this.documentsCache = updated;
  }

  private removeDocumentFromCache(documentId: string): boolean {
    const initialLength = this.documentsCache.length;
    this.documentsCache = this.documentsCache.filter(doc => doc.id !== documentId);
    return this.documentsCache.length !== initialLength;
  }

  private incrementDocumentAccess(documentId: string): void {
    const index = this.documentsCache.findIndex(doc => doc.id === documentId);
    if (index === -1) {
      return;
    }
    const updated = { ...this.documentsCache[index] };
    updated.downloadCount = (updated.downloadCount ?? 0) + 1;
    updated.lastAccessed = this.formatDisplayDate(new Date());
    this.replaceDocumentInCache(updated);
  }

  private applyLocalMetadataUpdate(documentId: string, updates: UpdateDocumentMetadataPayload): TenantDocument | null {
    const index = this.documentsCache.findIndex(doc => doc.id === documentId);
    if (index === -1) {
      return null;
    }
    const updated: TenantDocument = {
      ...this.documentsCache[index],
      ...updates,
      expiryDate: updates.expiryDate ?? this.documentsCache[index].expiryDate
    };
    this.replaceDocumentInCache(updated);
    return updated;
  }

  private createErrorDocumentPlaceholder(documentId: string): TenantDocument {
    return this.normalizeDocument({
      id: documentId,
      name: 'Unknown Document',
      category: DocumentCategory.OTHER,
      type: DocumentType.OTHER,
      url: '',
      size: '0 B',
      mimeType: 'application/octet-stream',
      uploadedBy: 'Unknown',
      uploadedDate: this.formatDisplayDate(new Date()),
      tags: []
    });
  }

  private setDocuments(documents: TenantDocument[]): void {
    this.documentsCache = this.cloneDocuments(documents);
  }

  private getDocumentsSnapshot(): TenantDocument[] {
    return this.cloneDocuments(this.documentsCache);
  }

  private cloneDocuments(documents: TenantDocument[]): TenantDocument[] {
    return documents.map(doc => ({ ...doc, tags: [...doc.tags] }));
  }

  private normalizeSize(size: string | number | undefined | null): string {
    if (typeof size === 'number') {
      return this.formatFileSize(size);
    }
    if (typeof size === 'string' && size.trim().length > 0) {
      return size;
    }
    return '0 B';
  }

  private normalizeDateString(value: string | Date | undefined, humanize = true): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return humanize ? undefined : (value as string);
    }
    return humanize ? this.formatDisplayDate(date) : date.toISOString().split('T')[0];
  }

  private extractDocuments(response: unknown): TenantDocument[] {
    if (Array.isArray(response)) {
      return response as TenantDocument[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).documents ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as TenantDocument[];
      }
    }
    return this.getDocumentsSnapshot();
  }

  private unwrapDocument(response: TenantDocument | { data?: TenantDocument } | null | undefined): TenantDocument | null {
    if (!response) {
      return null;
    }
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data?: TenantDocument }).data ?? null;
    }
    return response as TenantDocument;
  }

  private extractAuditEvents(response: unknown): DocumentAuditEvent[] {
    if (Array.isArray(response)) {
      return response as DocumentAuditEvent[];
    }
    if (response && typeof response === 'object') {
      const data = (response as any).data ?? (response as any).items;
      if (Array.isArray(data)) {
        return data as DocumentAuditEvent[];
      }
    }
    return [];
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[DocumentService] Falling back to local data for ${context}`, error);
  }

  private shouldFallback(error: unknown, options: { allowNotFound?: boolean } = {}): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return true;
    }

    if (error.status === 0 || error.status >= 500) {
      return true;
    }

    if (options.allowNotFound && error.status === 404) {
      return true;
    }

    return false;
  }
}
