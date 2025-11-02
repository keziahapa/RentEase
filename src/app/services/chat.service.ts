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
  ApiResponse,
  User
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

  // Send message
  sendMessage(messageData: CreateMessageRequest): Observable<ApiResponse<ChatMessage>> {
    console.log('📤 Sending message:', messageData);
    
    return this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Message sent response:', response);
        if (response.success && response.data) {
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, response.data]);
        }
      }),
      catchError(error => {
        console.error('❌ Message send error:', error);
        return this.handleError(error);
      })
    );
  }

  // Delete single message
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

  // Clear all messages in a chat room
  clearChat(roomId: number): Observable<BasicResponse> {
    console.log('🗑️ Clearing chat for room:', roomId);
    
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/messages`,
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: BasicResponse) => {
        console.log('✅ Chat cleared response:', response);
        if (response.success) {
          // Clear messages for the current room
          this.messagesSubject.next([]);
        }
      }),
      catchError(error => {
        console.error('❌ Clear chat error:', error);
        return this.handleError(error);
      })
    );
  }

  // Delete entire chat room
  deleteChatRoom(roomId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}`,
      { headers: this.createHeaders() }
    ).pipe(
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

  // Create chat rooms
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

  // Set current room
  setCurrentRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    if (room) {
      this.messagesSubject.next([]); // Clear messages when switching rooms
      this.markRoomAsRead(room.id).subscribe();
    }
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

  getOtherParticipants(room: ChatRoom, currentUserId: number): User[] {
    return room.participants.filter(participant => participant.id !== currentUserId);
  }

  getCurrentUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id ? parseInt(currentUser.id, 10) : 0;
  }

  // Typing indicators
  startTyping(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/typing-start`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  stopTyping(roomId: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/rooms/${roomId}/typing-stop`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
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