// chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  ChatRoom,
  ChatMessage,
  CreateMessageRequest,
  BatchDeleteRequest,
  ChatRoomResponse,
  ChatMessageResponse,
  SingleChatRoomResponse,
  BasicResponse,
  ApiResponse
} from './chat.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';
  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();
  
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<{userId: number, name: string}[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();

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

  // Get all chat rooms for current user
  getChatRooms(): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.apiUrl}/rooms`, {
      headers: this.createHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get messages for specific chat room
  getRoomMessages(chatRoomId: number): Observable<ChatMessageResponse> {
    return this.http.get<ChatMessageResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/messages`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.messagesSubject.next(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Get chat room by property and participant type
  getChatRoomByPropertyAndType(propertyId: number, participantType: string): Observable<SingleChatRoomResponse> {
    return this.http.get<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/property/${propertyId}/type/${participantType}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Create or get existing chat room
  createTenantLandlordRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.currentRoomSubject.next(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createTenantCaretakerRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.currentRoomSubject.next(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createLandlordCaretakerRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.currentRoomSubject.next(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Real-time messaging
  sendMessage(messageData: CreateMessageRequest): Observable<ApiResponse<ChatMessage>> {
    return this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, response.data]);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Mark messages as read
  markRoomAsRead(chatRoomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/mark-read`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  markMessagesAsDelivered(chatRoomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${chatRoomId}/mark-delivered`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Delete functionality
  deleteMessage(messageId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
          this.messagesSubject.next(updatedMessages);
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteMessagesBatch(messageIds: number[]): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages/batch-delete`,
      { messageIds },
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.filter(msg => !messageIds.includes(msg.id));
          this.messagesSubject.next(updatedMessages);
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteChatRoom(roomId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Get real user data for participants
  getChatParticipants(roomId: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/rooms/${roomId}/participants`,
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Get chat room details with real property data
  getChatRoomWithDetails(roomId: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/rooms/${roomId}/details`,
      { headers: this.createHeaders() }
    ).pipe(
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

  getCurrentUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id ? parseInt(currentUser.id, 10) : 0;
  }

  // Real-time connection methods
  connectToChat(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/connect`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  disconnectFromChat(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/disconnect`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Typing indicators
  startTyping(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/typing-start`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  stopTyping(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/typing-stop`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Set current room
  setCurrentRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    if (room) {
      this.markRoomAsRead(room.id).subscribe();
    }
  }

  // Add message to current room (for real-time updates)
  addMessageToCurrentRoom(message: ChatMessage): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  // Update typing users
  updateTypingUsers(users: {userId: number, name: string}[]): void {
    this.typingUsersSubject.next(users);
  }
}