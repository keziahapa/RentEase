import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export enum MaintenanceCategory {
  PLUMBING = 'Plumbing',
  ELECTRICAL = 'Electrical',
  HVAC = 'HVAC',
  APPLIANCES = 'Appliances',
  SECURITY = 'Security',
  PAINTING = 'Painting',
  FLOORING = 'Flooring',
  DOORS_WINDOWS = 'Doors & Windows',
  PEST_CONTROL = 'Pest Control',
  CLEANING = 'Cleaning',
  LANDSCAPING = 'Landscaping',
  OTHER = 'Other'
}

export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum MaintenanceStatus {
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  PENDING_PARTS = 'pending_parts',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected'
}

export enum UrgencyLevel {
  EMERGENCY = 'emergency',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface ServiceProvider {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  specialties: MaintenanceCategory[];
  rating: number;
  verified: boolean;
}

export interface MaintenanceImage {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
}

export interface MaintenanceUpdate {
  id: string;
  message: string;
  status: MaintenanceStatus;
  updatedBy: string;
  updatedByType: 'tenant' | 'landlord' | 'caretaker' | 'service_provider';
  updatedAt: string;
  images?: string[];
  scheduledDate?: string;
  estimatedCost?: number;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  description: string;
  status: MaintenanceStatus;
  urgencyLevel: UrgencyLevel;
  location: string;
  dateSubmitted: string;
  dateCompleted?: string;
  estimatedCost?: number;
  actualCost?: number;
  assignedTo?: ServiceProvider;
  images?: MaintenanceImage[];
  updates?: MaintenanceUpdate[];
  tenantRating?: number;
  tenantFeedback?: string;
  scheduledDate?: string;
  tenantName?: string;
  propertyName?: string;
}

export interface CreateMaintenanceRequestPayload {
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  description: string;
  urgencyLevel: UrgencyLevel;
  location: string;
  attachments?: File[];
}

export interface CaretakerInspection {
  id: string;
  type: 'move-in' | 'move-out' | 'routine';
  property: string;
  tenantName: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  depositAmount: number;
  notes?: string;
  scheduledTime?: string;
}

export interface VacancyEvent {
  id: string;
  property: string;
  unit: string;
  tenantName: string;
  status: 'pending' | 'confirmed' | 'disputed';
  scheduledInspection?: string;
  moveOutDate: string;
  caretakerConfirmed: boolean;
  landlordConfirmed: boolean;
  createdAt: string;
  notes?: string;
}

export interface CaretakerMaintenanceUpdatePayload {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  scheduledDate?: string;
  assignedTo?: ServiceProvider;
  estimatedCost?: number;
  actualCost?: number;
  message?: string;
  updateImages?: string[];
}

/**
 * Placeholder maintenance service that supplies mock data until the backend
 * exposes real maintenance and verified vacancy endpoints (see docs/api-gaps.md).
 */
@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private readonly http = inject(HttpClient);
  private readonly tenantMaintenanceUrl = `${environment.apiUrl}/tenant/maintenance-requests`;
  private readonly caretakerMaintenanceUrl = `${environment.apiUrl}/caretaker/maintenance-requests`;
  private readonly landlordMaintenanceUrl = `${environment.apiUrl}/landlord/maintenance-requests`;
  private readonly caretakerInspectionsUrl = `${environment.apiUrl}/caretaker/inspections`;
  private readonly vacancyEventsUrl = `${environment.apiUrl}/caretaker/vacancies`;
  private readonly maintenanceSummaryUrl = `${environment.apiUrl}/tenant/maintenance-requests/summary`;

  private maintenanceRequests: MaintenanceRequest[] = [];
  private readonly fallbackMaintenanceRequests: MaintenanceRequest[] = [
    {
      id: '1',
      title: 'Kitchen Faucet Leaking',
      category: MaintenanceCategory.PLUMBING,
      priority: MaintenancePriority.HIGH,
      description: 'The kitchen faucet has been leaking for the past few days. Water is dripping constantly even when fully closed. The leak seems to be coming from the base of the faucet.',
      status: MaintenanceStatus.IN_PROGRESS,
      urgencyLevel: UrgencyLevel.HIGH,
      location: 'Kitchen - Main Sink',
      dateSubmitted: '2024-02-10',
      estimatedCost: 150,
      assignedTo: {
        id: '1',
        name: 'Mike Wilson',
        company: 'Quick Fix Plumbing',
        phone: '+254 700 123 456',
        email: 'mike@quickfixplumbing.co.ke',
        specialties: [MaintenanceCategory.PLUMBING],
        rating: 4.8,
        verified: true
      },
      tenantName: 'Amina Njoroge',
      propertyName: 'Greenwood Apartments • Unit B-10',
      images: [
        {
          id: '1',
          url: '/assets/images/faucet-leak.jpg',
          caption: 'Leaking faucet base',
          uploadedAt: '2024-02-10'
        }
      ],
      updates: [
        {
          id: '1',
          message: 'Request received and assigned to Mike Wilson from Quick Fix Plumbing.',
          status: MaintenanceStatus.ACKNOWLEDGED,
          updatedBy: 'Property Manager',
          updatedByType: 'landlord',
          updatedAt: '2024-02-10 10:30 AM'
        },
        {
          id: '2',
          message: 'Technician will arrive tomorrow between 9-11 AM to assess and repair.',
          status: MaintenanceStatus.SCHEDULED,
          updatedBy: 'Mike Wilson',
          updatedByType: 'service_provider',
          updatedAt: '2024-02-10 2:15 PM',
          scheduledDate: '2024-02-11'
        }
      ],
      scheduledDate: '2024-02-11'
    },
    {
      id: '2',
      title: 'Bedroom Light Not Working',
      category: MaintenanceCategory.ELECTRICAL,
      priority: MaintenancePriority.MEDIUM,
      description: 'The main bedroom ceiling light stopped working suddenly. I checked and the bulb is fine. Might be a wiring issue.',
      status: MaintenanceStatus.COMPLETED,
      urgencyLevel: UrgencyLevel.MEDIUM,
      location: 'Master Bedroom',
      dateSubmitted: '2024-01-28',
      dateCompleted: '2024-02-01',
      actualCost: 85,
      assignedTo: {
        id: '2',
        name: 'Lucy Kamau',
        company: 'Bright Spark Electricals',
        phone: '+254 711 987 654',
        email: 'lucy@brightspark.co.ke',
        specialties: [MaintenanceCategory.ELECTRICAL],
        rating: 4.6,
        verified: true
      },
      tenantName: 'James Mwangi',
      propertyName: 'Riverside Heights • Penthouse 12',
      images: [],
      updates: [
        {
          id: '1',
          message: 'Request acknowledged and queued for inspection.',
          status: MaintenanceStatus.ACKNOWLEDGED,
          updatedBy: 'Property Manager',
          updatedByType: 'landlord',
          updatedAt: '2024-01-28 09:00 AM'
        },
        {
          id: '2',
          message: 'Electrician assigned and visit scheduled.',
          status: MaintenanceStatus.SCHEDULED,
          updatedBy: 'Property Manager',
          updatedByType: 'landlord',
          updatedAt: '2024-01-28 11:30 AM',
          scheduledDate: '2024-01-30'
        },
        {
          id: '3',
          message: 'Issue resolved and verified by tenant.',
          status: MaintenanceStatus.COMPLETED,
          updatedBy: 'Lucy Kamau',
          updatedByType: 'service_provider',
          updatedAt: '2024-02-01 04:15 PM'
        }
      ],
      tenantRating: 5,
      tenantFeedback: 'Quick response and professional service!'
    }
  ];

  private caretakerInspections: CaretakerInspection[] = [];
  private readonly fallbackCaretakerInspections: CaretakerInspection[] = [
    {
      id: 'insp-1',
      type: 'move-in',
      property: 'Apartment 4B',
      tenantName: 'John Doe',
      date: '2024-03-05',
      status: 'scheduled',
      depositAmount: 25000,
      scheduledTime: '10:00 AM',
      notes: 'New tenant move-in inspection'
    },
    {
      id: 'insp-2',
      type: 'move-out',
      property: 'Unit 2A',
      tenantName: 'Sarah Smith',
      date: '2024-03-06',
      status: 'scheduled',
      depositAmount: 30000,
      scheduledTime: '2:00 PM',
      notes: 'Final inspection before tenant departure'
    },
    {
      id: 'insp-3',
      type: 'routine',
      property: 'Suite 5C',
      tenantName: 'Mike Johnson',
      date: '2024-03-07',
      status: 'scheduled',
      depositAmount: 0,
      scheduledTime: '11:30 AM',
      notes: 'Quarterly routine maintenance check'
    },
    {
      id: 'insp-4',
      type: 'move-in',
      property: 'Unit 3B',
      tenantName: 'Emily Davis',
      date: '2024-03-04',
      status: 'completed',
      depositAmount: 28000,
      scheduledTime: '9:00 AM',
      notes: 'Completed - minor scratches on walls noted'
    },
    {
      id: 'insp-5',
      type: 'routine',
      property: 'Apartment 1D',
      tenantName: 'Robert Wilson',
      date: '2024-03-08',
      status: 'scheduled',
      depositAmount: 0,
      scheduledTime: '3:30 PM',
      notes: 'Bi-annual safety inspection'
    }
  ];

  private vacancyEvents: VacancyEvent[] = [];
  private readonly fallbackVacancyEvents: VacancyEvent[] = [
    {
      id: 'vac-1',
      property: 'Greenwood Apartments',
      unit: 'B-10',
      tenantName: 'Sarah Smith',
      status: 'pending',
      moveOutDate: '2024-03-15',
      caretakerConfirmed: false,
      landlordConfirmed: true,
      createdAt: '2024-02-20',
      notes: 'Tenant submitted digital move-out notice. Awaiting caretaker confirmation.'
    },
    {
      id: 'vac-2',
      property: 'Greenwood Apartments',
      unit: 'A-02',
      tenantName: 'Michael Otieno',
      status: 'confirmed',
      scheduledInspection: '2024-03-02 10:00',
      moveOutDate: '2024-03-05',
      caretakerConfirmed: true,
      landlordConfirmed: true,
      createdAt: '2024-02-10',
      notes: 'Inspection scheduled and both parties confirmed vacancy.'
    }
  ];

  private maintenanceRequestsSubject = new BehaviorSubject<MaintenanceRequest[]>([]);
  private caretakerInspectionsSubject = new BehaviorSubject<CaretakerInspection[]>([]);
  private vacancyEventsSubject = new BehaviorSubject<VacancyEvent[]>([]);

  readonly maintenanceRequestsChanges$ = this.maintenanceRequestsSubject.asObservable();
  readonly caretakerInspectionsChanges$ = this.caretakerInspectionsSubject.asObservable();
  readonly vacancyEventsChanges$ = this.vacancyEventsSubject.asObservable();

  getTenantMaintenanceRequests(): Observable<MaintenanceRequest[]> {
    return this.http
      .get<MaintenanceRequest[] | { data?: MaintenanceRequest[] }>(this.tenantMaintenanceUrl)
      .pipe(
        map(response => this.extractData(response, this.maintenanceRequests)),
        tap(requests => this.setMaintenanceRequests(requests)),
        catchError(error => {
          this.logFallback('tenant maintenance requests', error);
          const fallback = this.useMaintenanceFallback();
          return of(fallback);
        })
      );
  }

  submitTenantMaintenanceRequest(payload: CreateMaintenanceRequestPayload): Observable<MaintenanceRequest> {
    const formData = this.buildMaintenanceFormData(payload);

    return this.http
      .post<MaintenanceRequest | { data?: MaintenanceRequest }>(this.tenantMaintenanceUrl, formData)
      .pipe(
        map(response => {
          const request = this.unwrapResponse(response);
          if (!request) {
            throw new Error('Empty maintenance request response');
          }
          return request;
        }),
        tap(request => this.cacheMaintenanceRequest(request)),
        catchError(error => {
          this.logFallback('tenant maintenance submission', error);
          const fallbackRequest = this.createLocalMaintenanceRequest(payload);
          this.cacheMaintenanceRequest(fallbackRequest);
          return of(fallbackRequest);
        })
      );
  }

  getCaretakerMaintenanceRequests(): Observable<MaintenanceRequest[]> {
    return this.http
      .get<MaintenanceRequest[] | { data?: MaintenanceRequest[] }>(this.caretakerMaintenanceUrl)
      .pipe(
        map(response => this.extractData(response, this.maintenanceRequests)),
        tap(requests => this.setMaintenanceRequests(requests)),
        catchError(error => {
          this.logFallback('caretaker maintenance requests', error);
          const fallback = this.useMaintenanceFallback();
          return of(fallback);
        })
      );
  }

  getLandlordMaintenanceRequests(): Observable<MaintenanceRequest[]> {
    return this.http
      .get<MaintenanceRequest[] | { data?: MaintenanceRequest[] }>(this.landlordMaintenanceUrl)
      .pipe(
        map(response => this.extractData(response, this.maintenanceRequests)),
        tap(requests => this.setMaintenanceRequests(requests)),
        catchError(error => {
          this.logFallback('landlord maintenance requests', error);
          const fallback = this.useMaintenanceFallback();
          return of(fallback);
        })
      );
  }

  updateCaretakerMaintenanceRequest(requestId: string, updates: CaretakerMaintenanceUpdatePayload): Observable<MaintenanceRequest> {
    const endpoint = `${this.caretakerMaintenanceUrl}/${requestId}`;

    return this.http
      .patch<MaintenanceRequest | { data?: MaintenanceRequest }>(endpoint, updates)
      .pipe(
        map(response => {
          const request = this.unwrapResponse(response);
          if (!request) {
            throw new Error('Empty maintenance request response');
          }
          return request;
        }),
        tap(request => this.cacheMaintenanceRequest(request)),
        catchError(error => {
          this.logFallback(`update caretaker maintenance request ${requestId}`, error);
          const fallbackRequest = this.applyLocalMaintenanceUpdate(requestId, updates);
          return fallbackRequest
            ? of(fallbackRequest)
            : throwError(() => new Error('Maintenance request not found'));
        })
      );
  }

  getCaretakerInspections(): Observable<CaretakerInspection[]> {
    return this.http
      .get<CaretakerInspection[] | { data?: CaretakerInspection[] }>(this.caretakerInspectionsUrl)
      .pipe(
        map(response => this.extractData(response, this.caretakerInspections)),
        tap(inspections => this.setCaretakerInspections(inspections)),
        catchError(error => {
          this.logFallback('caretaker inspections', error);
          const fallback = this.useCaretakerInspectionsFallback();
          return of(fallback);
        })
      );
  }

  completeCaretakerInspection(inspectionId: string): Observable<CaretakerInspection> {
    const endpoint = `${this.caretakerInspectionsUrl}/${inspectionId}`;
    const payload = { status: 'completed' };

    return this.http
      .patch<CaretakerInspection | { data?: CaretakerInspection }>(endpoint, payload)
      .pipe(
        map(response => {
          const inspection = this.unwrapResponse(response);
          if (!inspection) {
            throw new Error('Empty inspection response');
          }
          return inspection;
        }),
        tap(inspection => this.upsertInspection(inspection)),
        catchError(error => {
          this.logFallback(`complete caretaker inspection ${inspectionId}`, error);
          const fallbackInspection = this.markInspectionCompleted(inspectionId);
          return fallbackInspection
            ? of(fallbackInspection)
            : throwError(() => new Error('Inspection not found'));
        })
      );
  }

  getVacancyEvents(): Observable<VacancyEvent[]> {
    return this.http
      .get<VacancyEvent[] | { data?: VacancyEvent[] }>(this.vacancyEventsUrl)
      .pipe(
        map(response => this.extractData(response, this.vacancyEvents)),
        tap(events => this.setVacancyEvents(events)),
        catchError(error => {
          this.logFallback('vacancy events', error);
          const fallback = this.useVacancyEventsFallback();
          return of(fallback);
        })
      );
  }

  getMaintenanceSummary(): Observable<{ open: number; inProgress: number; completed: number }> {
    const fallbackSummary = this.computeMaintenanceSummary(this.maintenanceRequests);

    return this.http
      .get<{ open: number; inProgress: number; completed: number } | { data?: { open: number; inProgress: number; completed: number } }>(
        this.maintenanceSummaryUrl
      )
      .pipe(
        map(response => this.extractData(response, fallbackSummary)),
        catchError(error => {
          this.logFallback('maintenance summary', error);
          const source = this.maintenanceRequests.length
            ? this.maintenanceRequests
            : this.useMaintenanceFallback();
          return of(this.computeMaintenanceSummary(source));
        })
      );
  }

  private buildMaintenanceFormData(payload: CreateMaintenanceRequestPayload): FormData {
    const formData = new FormData();
    formData.append('title', payload.title.trim());
    formData.append('category', payload.category);
    formData.append('priority', payload.priority);
    formData.append('description', payload.description.trim());
    formData.append('urgencyLevel', payload.urgencyLevel);
    formData.append('location', payload.location.trim());

    (payload.attachments ?? []).forEach((file, index) => {
      const filename = file?.name || `attachment-${index + 1}`;
      formData.append('attachments', file, filename);
    });

    return formData;
  }

  private createLocalMaintenanceRequest(payload: CreateMaintenanceRequestPayload): MaintenanceRequest {
    return {
      id: `tmp-${Date.now()}`,
      title: payload.title.trim(),
      category: payload.category,
      priority: payload.priority,
      description: payload.description.trim(),
      status: MaintenanceStatus.SUBMITTED,
      urgencyLevel: payload.urgencyLevel,
      location: payload.location.trim(),
      dateSubmitted: new Date().toISOString().split('T')[0],
      images: this.createAttachmentImages(payload.attachments ?? []),
      updates: [
        {
          id: `upd-${Date.now()}`,
          message: 'Request submitted and awaiting review.',
          status: MaintenanceStatus.SUBMITTED,
          updatedBy: 'You',
          updatedByType: 'tenant',
          updatedAt: new Date().toISOString()
        }
      ],
      tenantName: 'You',
      propertyName: payload.location.trim()
    };
  }

  private createAttachmentImages(files: File[]): MaintenanceImage[] {
    return files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      url: typeof URL !== 'undefined' ? URL.createObjectURL(file) : '',
      caption: file.name,
      uploadedAt: new Date().toISOString()
    }));
  }

  private cacheMaintenanceRequest(request: MaintenanceRequest): void {
    const index = this.maintenanceRequests.findIndex(existing => existing.id === request.id);
    if (index >= 0) {
      const updated = [...this.maintenanceRequests];
      updated[index] = request;
      this.setMaintenanceRequests(updated);
    } else {
      this.setMaintenanceRequests([request, ...this.maintenanceRequests]);
    }
  }

  private upsertInspection(inspection: CaretakerInspection): void {
    const index = this.caretakerInspections.findIndex(existing => existing.id === inspection.id);
    if (index >= 0) {
      const updated = [...this.caretakerInspections];
      updated[index] = inspection;
      this.setCaretakerInspections(updated);
    } else {
      this.setCaretakerInspections([inspection, ...this.caretakerInspections]);
    }
  }

  private markInspectionCompleted(inspectionId: string): CaretakerInspection | null {
    const index = this.caretakerInspections.findIndex(i => i.id === inspectionId);
    if (index === -1) {
      return null;
    }

    const updatedInspection: CaretakerInspection = {
      ...this.caretakerInspections[index],
      status: 'completed',
      notes: this.caretakerInspections[index].notes || 'Inspection completed by caretaker'
    };

    const updated = [...this.caretakerInspections];
    updated[index] = updatedInspection;
    this.setCaretakerInspections(updated);

    return updatedInspection;
  }

  private extractData<T>(response: T | { data?: T }, fallback: T): T {
    if (response && typeof response === 'object' && !Array.isArray(response) && 'data' in response) {
      const data = (response as { data?: T }).data;
      return (data ?? fallback) as T;
    }
    return (response ?? fallback) as T;
  }

  private unwrapResponse<T>(response: T | { data?: T }): T | null {
    if (response && typeof response === 'object' && !Array.isArray(response) && 'data' in response) {
      return ((response as { data?: T }).data ?? null) as T | null;
    }
    return (response ?? null) as T | null;
  }

  private computeMaintenanceSummary(requests: MaintenanceRequest[]): { open: number; inProgress: number; completed: number } {
    if (!requests?.length) {
      return { open: 0, inProgress: 0, completed: 0 };
    }

    const open = requests.filter(r =>
      r.status === MaintenanceStatus.SUBMITTED || r.status === MaintenanceStatus.ACKNOWLEDGED
    ).length;
    const inProgress = requests.filter(r =>
      r.status === MaintenanceStatus.IN_PROGRESS || r.status === MaintenanceStatus.SCHEDULED
    ).length;
    const completed = requests.filter(r => r.status === MaintenanceStatus.COMPLETED).length;

    return { open, inProgress, completed };
  }

  private setMaintenanceRequests(requests: MaintenanceRequest[]): void {
    this.maintenanceRequests = Array.isArray(requests) ? [...requests] : [...this.maintenanceRequests];
    this.maintenanceRequestsSubject.next(this.getMaintenanceRequestsSnapshot());
  }

  private setCaretakerInspections(inspections: CaretakerInspection[]): void {
    this.caretakerInspections = Array.isArray(inspections) ? [...inspections] : [...this.caretakerInspections];
    this.caretakerInspectionsSubject.next(this.getCaretakerInspectionsSnapshot());
  }

  private setVacancyEvents(events: VacancyEvent[]): void {
    this.vacancyEvents = Array.isArray(events) ? [...events] : [...this.vacancyEvents];
    this.vacancyEventsSubject.next(this.getVacancyEventsSnapshot());
  }

  private getMaintenanceRequestsSnapshot(): MaintenanceRequest[] {
    return [...this.maintenanceRequests];
  }

  private getCaretakerInspectionsSnapshot(): CaretakerInspection[] {
    return [...this.caretakerInspections];
  }

  private getVacancyEventsSnapshot(): VacancyEvent[] {
    return [...this.vacancyEvents];
  }

  private useMaintenanceFallback(): MaintenanceRequest[] {
    const fallback = this.cloneMaintenanceRequests(this.fallbackMaintenanceRequests);
    this.setMaintenanceRequests(fallback);
    return fallback;
  }

  private useCaretakerInspectionsFallback(): CaretakerInspection[] {
    const fallback = this.cloneCaretakerInspections(this.fallbackCaretakerInspections);
    this.setCaretakerInspections(fallback);
    return fallback;
  }

  private useVacancyEventsFallback(): VacancyEvent[] {
    const fallback = this.cloneVacancyEvents(this.fallbackVacancyEvents);
    this.setVacancyEvents(fallback);
    return fallback;
  }

  private cloneMaintenanceRequests(requests: MaintenanceRequest[]): MaintenanceRequest[] {
    return requests.map(request => ({
      ...request,
      images: request.images?.map(image => ({ ...image })) ?? [],
      updates: request.updates?.map(update => ({
        ...update,
        images: update.images ? [...update.images] : undefined
      })) ?? []
    }));
  }

  private cloneCaretakerInspections(inspections: CaretakerInspection[]): CaretakerInspection[] {
    return inspections.map(inspection => ({ ...inspection }));
  }

  private cloneVacancyEvents(events: VacancyEvent[]): VacancyEvent[] {
    return events.map(event => ({ ...event }));
  }

  private applyLocalMaintenanceUpdate(requestId: string, updates: CaretakerMaintenanceUpdatePayload): MaintenanceRequest | null {
    const index = this.maintenanceRequests.findIndex(request => request.id === requestId);
    if (index === -1) {
      return null;
    }

    const currentRequest = this.maintenanceRequests[index];
    const updateEntry: MaintenanceUpdate | null = updates.message || updates.status
      ? {
          id: `local-${Date.now()}`,
          message: updates.message || 'Maintenance request updated locally.',
          status: updates.status ?? currentRequest.status,
          updatedBy: 'You',
          updatedByType: 'caretaker',
          updatedAt: new Date().toISOString(),
          images: updates.updateImages
        }
      : null;

    const existingUpdates = currentRequest.updates ?? [];

    const updatedRequest: MaintenanceRequest = {
      ...currentRequest,
      status: updates.status ?? currentRequest.status,
      priority: updates.priority ?? currentRequest.priority,
      scheduledDate: updates.scheduledDate ?? currentRequest.scheduledDate,
      assignedTo: updates.assignedTo ?? currentRequest.assignedTo,
      estimatedCost: updates.estimatedCost ?? currentRequest.estimatedCost,
      actualCost: updates.actualCost ?? currentRequest.actualCost,
      updates: updateEntry ? [...existingUpdates, updateEntry] : existingUpdates
    };

    this.cacheMaintenanceRequest(updatedRequest);
    return updatedRequest;
  }

  private logFallback(context: string, error: unknown): void {
    console.warn(`[MaintenanceService] Falling back to mock data for ${context}`, error);
  }
}
