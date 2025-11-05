import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, timer } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
  ChatRoom,
  ChatMessage,
  CreateMessageRequest,
  BatchDeleteRequest,
  ChatRoomResponse,
  ChatMessageResponse,
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

  private chatRoomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public chatRooms$ = this.chatRoomsSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<{userId: number, name: string}[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();


  private pollingInterval = 2000;
  private activePollingSubscriptions: Map<number, any> = new Map();

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


  getRoomMessages(roomId: number): Observable<ChatMessageResponse> {
    return this.http.get<ChatMessageResponse>(
      `${this.apiUrl}/rooms/${roomId}/messages`,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.messagesSubject.next(response.data);
        
          this.markRoomAsRead(roomId).subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  sendMessage(messageData: CreateMessageRequest): Observable<BasicResponse> {
    if (!messageData.content.trim()) {
      return throwError(() => ({ message: 'Message content cannot be empty' }));
    }

    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
         
          if (this.currentRoomSubject.value) {
            this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
          }
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
        if (response.success && this.currentRoomSubject.value) {
      
          this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteMessagesBatch(messageIds: number[]): Observable<BasicResponse> {
    const request: BatchDeleteRequest = { messageIds };
    
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages/batch-delete`,
      request,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && this.currentRoomSubject.value) {
    
          this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
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

  markRoomAsDelivered(roomId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-delivered`,
      {},
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }


  createTenantLandlordRoom(propertyId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
         
          this.getChatRooms().subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  createTenantCaretakerRoom(propertyId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
       
          this.getChatRooms().subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  createLandlordCaretakerRoom(propertyId: number): Observable<BasicResponse> {
    return this.http.post<BasicResponse>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
      
          this.getChatRooms().subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }


  startPolling(roomId: number): void {
  
    this.stopPolling(roomId);

    const pollingSubscription = timer(0, this.pollingInterval).pipe(
      switchMap(() => this.getRoomMessages(roomId))
    ).subscribe({
      error: (error) => console.error('Polling error:', error)
    });

    this.activePollingSubscriptions.set(roomId, pollingSubscription);
  }

  stopPolling(roomId: number): void {
    const subscription = this.activePollingSubscriptions.get(roomId);
    if (subscription) {
      subscription.unsubscribe();
      this.activePollingSubscriptions.delete(roomId);
    }
  }

  stopAllPolling(): void {
    this.activePollingSubscriptions.forEach((subscription, roomId) => {
      subscription.unsubscribe();
    });
    this.activePollingSubscriptions.clear();
  }

  startTyping(roomId: number): Observable<BasicResponse> {
  
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const typingUsers = this.typingUsersSubject.value;
      const updatedUsers = [...typingUsers.filter(u => u.userId !== currentUser.id), 
        { userId: currentUser.id, name: currentUser.name || 'You' }];
      this.typingUsersSubject.next(updatedUsers);
    }
    
    // Return simulated success response
    return new Observable(observer => {
      observer.next({ success: true, message: 'Typing started' });
      observer.complete();
    });
  }

  stopTyping(roomId: number): Observable<BasicResponse> {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const typingUsers = this.typingUsersSubject.value.filter(u => u.userId !== currentUser.id);
      this.typingUsersSubject.next(typingUsers);
    }
    
    // Return simulated success response
    return new Observable(observer => {
      observer.next({ success: true, message: 'Typing stopped' });
      observer.complete();
    });
  }

  // ===== HEALTH CHECK =====
  checkHealth(): Observable<BasicResponse> {
    return this.http.get<BasicResponse>(
      `${this.apiUrl}/health`,
      { headers: this.createHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ===== STATE MANAGEMENT =====
  setCurrentRoom(room: ChatRoom | null): void {
    // Stop polling for previous room
    if (this.currentRoomSubject.value) {
      this.stopPolling(this.currentRoomSubject.value.id);
    }

    this.currentRoomSubject.next(room);
    
    if (room) {
      this.messagesSubject.next([]);
      this.markRoomAsRead(room.id).subscribe();
      // Start polling for new messages
      this.startPolling(room.id);
    }
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

  isMyMessage(message: ChatMessage): boolean {
    return message.senderId === this.getCurrentUserId();
  }

  // ===== PRIVATE HELPERS =====
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

 
  ngOnDestroy(): void {
    this.stopAllPolling();
  }
}