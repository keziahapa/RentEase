import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  ChatRoom,
  ChatMessage,
  CreateMessageRequest,
  BatchDeleteRequest,
  ChatHealth,
  ChatRoomResponse,
  ChatMessageResponse,
  SingleChatRoomResponse,
  ChatHealthResponse,
  BasicResponse,
  ApiResponse
} from './chat.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Chat service temporarily unavailable';
    
    if (error.status === 401) {
      errorMessage = 'Please check your authentication';
    } else if (error.status === 404) {
      errorMessage = 'Chat feature not available yet';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    console.warn('Chat service error:', errorMessage);
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

 

  getChatRooms(): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.apiUrl}/rooms`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getRoomMessages(chatRoomId: number): Observable<ChatMessageResponse> {
    return this.http.get<ChatMessageResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/messages`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  createTenantLandlordRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  createTenantCaretakerRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  createLandlordCaretakerRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  markRoomAsRead(chatRoomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/mark-read`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  markRoomAsDelivered(chatRoomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/mark-delivered`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Message Management

  sendMessage(messageData: CreateMessageRequest): Observable<ApiResponse<ChatMessage>> {
    return this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  deleteMessage(messageId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  deleteMessagesBatch(request: BatchDeleteRequest): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages/batch-delete`,
      request.messageIds,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // System Health

  checkHealth(): Observable<ChatHealthResponse> {
    return this.http.get<ChatHealthResponse>(`${this.apiUrl}/health`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Utility Methods

  generateRoomDisplayName(room: ChatRoom, currentUserId: number): string {
    if (room.name) return room.name;

    const otherParticipants = room.participants.filter(p => p.id !== currentUserId);
    
    if (otherParticipants.length === 1) {
      return otherParticipants[0].name;
    }

    return otherParticipants.map(p => p.name.split(' ')[0]).join(', ');
  }

  isUserInRoom(room: ChatRoom, userId: number): boolean {
    return room.participants.some(participant => participant.id === userId);
  }

  getOtherParticipants(room: ChatRoom, currentUserId: number): any[] {
    return room.participants.filter(participant => participant.id !== currentUserId);
  }

  sortRoomsByLastMessage(rooms: ChatRoom[]): ChatRoom[] {
    return rooms.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : new Date(a.updatedAt).getTime();
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : new Date(b.updatedAt).getTime();
      return timeB - timeA;
    });
  }

  // Helper method to get current user ID from AuthService
  getCurrentUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id ? parseInt(currentUser.id, 10) : 0;
  }
}