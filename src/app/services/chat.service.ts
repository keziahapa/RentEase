import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  ChatRoom,
  ChatMessage,
  CreateMessageRequest,
  CreateRoomRequest,
  BatchDeleteRequest,
  ChatRoomResponse,
  ChatMessageResponse,
  SingleChatRoomResponse,
  SingleMessageResponse,
  BasicResponse,
  ApiResponse,
  User,
  TypingIndicator,
  MarkReadRequest,
  ChatSearchCriteria,
  ChatStats,
  PaginatedResponse
} from './chat.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';
  
  // Behavior Subjects for state management
  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();
  
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private chatRoomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public chatRooms$ = this.chatRoomsSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<{userId: number, name: string}[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeChat();
  }

  private initializeChat(): void {
    this.loadInitialChatRooms();
  }

  private loadInitialChatRooms(): void {
    this.getChatRooms().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.updateUnreadCount(response.data);
        }
      },
      error: (error) => console.warn('Failed to load initial chat rooms:', error)
    });
  }

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('No authentication token available for chat service');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Chat Service Error:', error);
    
    let errorMessage = 'Chat service temporarily unavailable. Please try again later.';
    
    if (error.status === 0) {
      errorMessage = 'Unable to connect to chat service. Please check your internet connection.';
    } else if (error.status === 401) {
      errorMessage = 'Please log in to use chat features';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to access this chat';
    } else if (error.status === 404) {
      errorMessage = 'Chat feature not available';
    } else if (error.status >= 500) {
      errorMessage = 'Chat service is currently experiencing issues. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  // ===== ROOM MANAGEMENT =====
  getChatRooms(): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.apiUrl}/rooms`, {
      headers: this.createHeaders()
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.chatRoomsSubject.next(response.data);
          this.updateUnreadCount(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  getRoomDetails(roomId: number): Observable<SingleChatRoomResponse> {
    return this.http.get<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/${roomId}`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  createRoom(roomData: CreateRoomRequest): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms`,
      roomData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.chatRoomsSubject.value;
          this.chatRoomsSubject.next([...currentRooms, response.data]);
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
      tap(response => {
        if (response.success) {
          const currentRooms = this.chatRoomsSubject.value;
          const updatedRooms = currentRooms.filter(room => room.id !== roomId);
          this.chatRoomsSubject.next(updatedRooms);
          
          if (this.currentRoomSubject.value?.id === roomId) {
            this.setCurrentRoom(null);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  // ===== MESSAGE MANAGEMENT =====
  getRoomMessages(roomId: number, limit: number = 50, offset: number = 0): Observable<ChatMessageResponse> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.http.get<ChatMessageResponse>(
      `${this.apiUrl}/rooms/${roomId}/messages`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.messagesSubject.next(response.data);
          this.markMessagesAsRead(roomId, response.data.map(msg => msg.id)).subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  sendMessage(messageData: CreateMessageRequest): Observable<SingleMessageResponse> {
    if (!messageData.content.trim()) {
      return throwError(() => ({ message: 'Message content cannot be empty' }));
    }

    return this.http.post<SingleMessageResponse>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, response.data]);
          this.updateRoomLastMessage(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteMessage(messageId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.map(msg => 
            msg.id === messageId ? { ...msg, deleted: true, content: 'This message was deleted' } : msg
          );
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
    ).pipe(catchError(this.handleError));
  }

  clearChat(roomId: number): Observable<BasicResponse> {
    return this.http.delete<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/messages`,
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: BasicResponse) => {
        if (response.success) {
          this.messagesSubject.next([]);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ===== MESSAGE STATUS =====
  markMessagesAsRead(roomId: number, messageIds: number[]): Observable<BasicResponse> {
    const request: MarkReadRequest = { roomId, messageIds };
    
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.map(msg =>
            messageIds.includes(msg.id) ? { ...msg, read: true } : msg
          );
          this.messagesSubject.next(updatedMessages);
          this.updateRoomUnreadCount(roomId, 0);
        }
      }),
      catchError(this.handleError)
    );
  }

  markRoomAsRead(roomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.updateRoomUnreadCount(roomId, 0);
        }
      }),
      catchError(this.handleError)
    );
  }

  markMessagesAsDelivered(roomId: number, messageIds: number[]): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-delivered`,
      { messageIds },
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ===== SPECIALIZED ROOM CREATION =====
  createTenantLandlordRoom(propertyId: number): Observable<SingleChatRoomResponse> {
    return this.http.post<SingleChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.currentRoomSubject.next(response.data);
          const currentRooms = this.chatRoomsSubject.value;
          this.chatRoomsSubject.next([...currentRooms, response.data]);
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
        if (response.success && response.data) {
          this.currentRoomSubject.next(response.data);
          const currentRooms = this.chatRoomsSubject.value;
          this.chatRoomsSubject.next([...currentRooms, response.data]);
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
        if (response.success && response.data) {
          this.currentRoomSubject.next(response.data);
          const currentRooms = this.chatRoomsSubject.value;
          this.chatRoomsSubject.next([...currentRooms, response.data]);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ===== TYPING INDICATORS =====
  startTyping(roomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/typing-start`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  stopTyping(roomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/typing-stop`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ===== SEARCH AND UTILITIES =====
  searchMessages(criteria: ChatSearchCriteria): Observable<PaginatedResponse<ChatMessage[]>> {
    let params = new HttpParams();
    
    if (criteria.query) params = params.set('query', criteria.query);
    if (criteria.roomId) params = params.set('roomId', criteria.roomId.toString());
    if (criteria.startDate) params = params.set('startDate', criteria.startDate);
    if (criteria.endDate) params = params.set('endDate', criteria.endDate);
    if (criteria.messageType) params = params.set('messageType', criteria.messageType);
    if (criteria.limit) params = params.set('limit', criteria.limit.toString());
    if (criteria.offset) params = params.set('offset', criteria.offset.toString());

    return this.http.get<PaginatedResponse<ChatMessage[]>>(
      `${this.apiUrl}/messages/search`,
      { 
        headers: this.createHeaders(),
        params 
      }
    ).pipe(catchError(this.handleError));
  }

  getChatStats(): Observable<ApiResponse<ChatStats>> {
    return this.http.get<ApiResponse<ChatStats>>(
      `${this.apiUrl}/stats`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ===== STATE MANAGEMENT =====
  setCurrentRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    if (room) {
      this.messagesSubject.next([]);
      this.markRoomAsRead(room.id).subscribe();
    }
  }

  addMessageToCurrentRoom(message: ChatMessage): void {
    const currentMessages = this.messagesSubject.value;
    
    if (!currentMessages.find(msg => msg.id === message.id)) {
      this.messagesSubject.next([...currentMessages, message]);
      this.updateRoomLastMessage(message);
    }
  }

  updateTypingUsers(users: {userId: number, name: string}[]): void {
    this.typingUsersSubject.next(users);
  }

  // ===== UTILITY METHODS =====
  generateRoomDisplayName(room: ChatRoom, currentUserId: number): string {
    if (!room) return 'Unknown Chat';
    
    if (room.name) return room.name;

    const otherParticipants = room.participants?.filter(p => p.id !== currentUserId) || [];
    
    if (otherParticipants.length === 0) return 'You';
    if (otherParticipants.length === 1) {
      return otherParticipants[0].name || 'Unknown User';
    }

    return otherParticipants.map(p => p.name?.split(' ')[0] || 'User').join(', ');
  }

  getOtherParticipants(room: ChatRoom, currentUserId: number): User[] {
    return room?.participants?.filter(participant => participant.id !== currentUserId) || [];
  }

  getCurrentUserId(): number {
    try {
      const currentUser = this.authService.getCurrentUser();
      return currentUser?.id ? parseInt(currentUser.id, 10) : 0;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return 0;
    }
  }

  // ===== PRIVATE HELPERS =====
  private updateRoomLastMessage(message: ChatMessage): void {
    const currentRooms = this.chatRoomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === message.chatRoomId) {
        return { ...room, lastMessage: message };
      }
      return room;
    });
    this.chatRoomsSubject.next(updatedRooms);
  }

  private updateRoomUnreadCount(roomId: number, count: number): void {
    const currentRooms = this.chatRoomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: count };
      }
      return room;
    });
    this.chatRoomsSubject.next(updatedRooms);
    this.updateUnreadCount(updatedRooms);
  }

  private updateUnreadCount(rooms: ChatRoom[]): void {
    const totalUnread = rooms.reduce((total, room) => total + (room.unreadCount || 0), 0);
    this.unreadCountSubject.next(totalUnread);
  }

  checkHealth(): Observable<BasicResponse> {
    return this.http.get<BasicResponse>(
      `${this.apiUrl}/health`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }
}