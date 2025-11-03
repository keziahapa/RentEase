import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  User, 
  ChatMessage, 
  ChatRoom, 
  CreateMessageRequest, 
  BatchDeleteRequest,
  MarkReadRequest,
  MarkDeliveredRequest,
  ApiResponse,
  ChatSearchCriteria,
  ChatStats
} from './chat.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = '/api/chat'; // Base API URL
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Headers for API requests
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      // Add authorization header if needed
      // 'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  // === ROOM MANAGEMENT ===

  /**
   * Get all chat rooms for current user
   */
  getChatRooms(): Observable<ChatRoom[]> {
    return this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Create tenant-landlord chat room
   */
  createTenantLandlordRoom(propertyId: number): Observable<ChatRoom> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`, 
      {},
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Create tenant-caretaker chat room
   */
  createTenantCaretakerRoom(propertyId: number): Observable<ChatRoom> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`, 
      {},
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Create landlord-caretaker chat room
   */
  createLandlordCaretakerRoom(propertyId: number): Observable<ChatRoom> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`, 
      {},
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // === MESSAGE MANAGEMENT ===

  /**
   * Get messages for a specific chat room
   */
  getRoomMessages(chatRoomId: number, page: number = 1, limit: number = 50): Observable<ChatMessage[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<ChatMessage[]>>(
      `${this.apiUrl}/rooms/${chatRoomId}/messages`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Send a new message
   */
  sendMessage(messageRequest: CreateMessageRequest): Observable<ChatMessage> {
    return this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/messages`,
      messageRequest,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Delete a single message
   */
  deleteMessage(messageId: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Delete multiple messages
   */
  deleteMessagesBatch(deleteRequest: BatchDeleteRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(
      `${this.apiUrl}/messages/batch-delete`,
      deleteRequest,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // === MESSAGE STATUS ===

  /**
   * Mark messages as read
   */
  markMessagesAsRead(markReadRequest: MarkReadRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(
      `${this.apiUrl}/rooms/${markReadRequest.roomId}/mark-read`,
      { messageIds: markReadRequest.messageIds },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Mark messages as delivered
   */
  markMessagesAsDelivered(markDeliveredRequest: MarkDeliveredRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(
      `${this.apiUrl}/rooms/${markDeliveredRequest.roomId}/mark-delivered`,
      { messageIds: markDeliveredRequest.messageIds },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // === UTILITY METHODS ===

  /**
   * Check API health
   */
  checkHealth(): Observable<boolean> {
    return this.http.get<ApiResponse<boolean>>(`${this.apiUrl}/health`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Search messages
   */
  searchMessages(criteria: ChatSearchCriteria): Observable<ChatMessage[]> {
    let params = new HttpParams();
    
    if (criteria.query) params = params.set('query', criteria.query);
    if (criteria.roomId) params = params.set('roomId', criteria.roomId.toString());
    if (criteria.userId) params = params.set('userId', criteria.userId.toString());
    if (criteria.startDate) params = params.set('startDate', criteria.startDate);
    if (criteria.endDate) params = params.set('endDate', criteria.endDate);
    if (criteria.messageType) params = params.set('messageType', criteria.messageType);
    if (criteria.limit) params = params.set('limit', criteria.limit.toString());
    if (criteria.offset) params = params.set('offset', criteria.offset.toString());

    return this.http.get<ApiResponse<ChatMessage[]>>(`${this.apiUrl}/messages/search`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Get chat statistics
   */
  getChatStats(): Observable<ChatStats> {
    return this.http.get<ApiResponse<ChatStats>>(`${this.apiUrl}/stats`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // === ERROR HANDLING ===

  private handleError(error: any) {
    console.error('Chat Service Error:', error);
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.message || error.message || error.statusText;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // === CURRENT USER MANAGEMENT ===

  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}