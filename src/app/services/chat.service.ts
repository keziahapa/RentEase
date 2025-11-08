import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';
import {
  ChatRoom,
  ChatMessage,
  CreateMessageRequest,
  BatchDeleteRequest,
  ChatRoomResponse,
  ChatMessageResponse,
  BasicResponse,
  User as ChatUser,
  CreateChatRoomResponse
} from './chat.interface';

// WebSocket message interfaces
export interface SendMessageRequest {
  chatRoomId: number;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE'; // Made optional
}

export interface DeleteMessageRequest {
  messageId: number;
}

export interface DeleteMessageResponse {
  success: boolean;
  message: string;
  messageId?: number;
  chatRoomId: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';
  private readonly wsUrl = 'https://rentease-3-sfgx.onrender.com/ws';
  
  // WebSocket properties
  private stompClient: Client | null = null;
  private isConnected = new BehaviorSubject<boolean>(false);
  private connectionStatus$ = this.isConnected.asObservable();

  // Existing subjects
  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();
  
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private chatRoomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public chatRooms$ = this.chatRoomsSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<{userId: number; userName: string}[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  // WebSocket subscriptions
  private roomSubscriptions = new Map<number, any>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeWebSocketConnection();
    this.initializeChat();
  }

  // ===== WEBSOCKET METHODS =====

  private initializeWebSocketConnection(): void {
    try {
      const token = this.authService.getToken();
      if (!token) {
        console.warn('No authentication token available for WebSocket');
        return;
      }

      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(this.wsUrl),
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        debug: (str) => {
          console.log('STOMP Debug:', str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = (frame) => {
        console.log('✅ Connected to WebSocket');
        this.isConnected.next(true);
        this.subscribeToUserQueue();
        
        // Subscribe to current room if exists
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom) {
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('❌ STOMP error:', frame);
        this.isConnected.next(false);
      };

      this.stompClient.onDisconnect = () => {
        console.log('🔌 Disconnected from WebSocket');
        this.isConnected.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.onWebSocketClose = () => {
        console.log('🔌 WebSocket connection closed');
        this.isConnected.next(false);
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
      this.isConnected.next(false);
    }
  }

  private subscribeToUserQueue(): void {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn('WebSocket not connected, cannot subscribe to user queue');
      return;
    }

    const userId = this.getCurrentUserId();
    if (userId) {
      // Subscribe to personal messages
      this.stompClient.subscribe(
        `/user/${userId}/queue/messages`,
        (message: IMessage) => {
          console.log('📨 Received personal message:', message.body);
          this.handleIncomingMessage(JSON.parse(message.body));
        }
      );

      // Subscribe to delete notifications
      this.stompClient.subscribe(
        `/user/${userId}/queue/messages/deleted`,
        (message: IMessage) => {
          console.log('🗑️ Received delete notification:', message.body);
          this.handleMessageDeleted(JSON.parse(message.body));
        }
      );

      this.stompClient.subscribe(
        `/user/${userId}/queue/messages/batch-deleted`,
        (message: IMessage) => {
          console.log('🗑️ Received batch delete notification:', message.body);
          this.handleMessagesBatchDeleted(JSON.parse(message.body));
        }
      );
    }
  }

  private subscribeToRoom(roomId: number): void {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn('WebSocket not connected, cannot subscribe to room');
      return;
    }

    // Unsubscribe from previous room subscription
    this.unsubscribeFromRoom(roomId);

    console.log(`🔔 Subscribing to room: ${roomId}`);

    // Subscribe to room topic for new messages
    const subscription = this.stompClient.subscribe(
      `/topic/chat/${roomId}`,
      (message: IMessage) => {
        console.log(`📨 Received room message for ${roomId}:`, message.body);
        this.handleIncomingMessage(JSON.parse(message.body));
      }
    );

    // Subscribe to room delete notifications
    this.stompClient.subscribe(
      `/topic/chat/${roomId}/deleted`,
      (message: IMessage) => {
        console.log(`🗑️ Received room delete for ${roomId}:`, message.body);
        this.handleMessageDeleted(JSON.parse(message.body));
      }
    );

    this.stompClient.subscribe(
      `/topic/chat/${roomId}/batch-deleted`,
      (message: IMessage) => {
        console.log(`🗑️ Received room batch delete for ${roomId}:`, message.body);
        this.handleMessagesBatchDeleted(JSON.parse(message.body));
      }
    );

    this.roomSubscriptions.set(roomId, subscription);
  }

  private unsubscribeFromRoom(roomId: number): void {
    const subscription = this.roomSubscriptions.get(roomId);
    if (subscription) {
      subscription.unsubscribe();
      this.roomSubscriptions.delete(roomId);
      console.log(`🔕 Unsubscribed from room: ${roomId}`);
    }
  }

  private handleIncomingMessage(message: any): void {
    const currentMessages = this.messagesSubject.value;
    
    // Check if message already exists (avoid duplicates)
    const messageExists = currentMessages.some(m => m.id === message.id);
    if (!messageExists) {
      const updatedMessages = [...currentMessages, message];
      this.messagesSubject.next(updatedMessages);
      
      // Update last message in chat rooms
      this.updateRoomLastMessage(message.chatRoomId, message);
      
      // Update unread count if message is not from current user
      if (message.senderId !== this.getCurrentUserId()) {
        this.incrementRoomUnreadCount(message.chatRoomId);
      }
    }
  }

  private handleMessageDeleted(response: DeleteMessageResponse): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== response.messageId);
    this.messagesSubject.next(updatedMessages);
  }

  private handleMessagesBatchDeleted(response: DeleteMessageResponse): void {
    // Refresh messages for the room
    if (this.currentRoomSubject.value) {
      this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
    }
  }

  private updateRoomLastMessage(roomId: number, message: ChatMessage): void {
    const currentRooms = this.chatRoomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, lastMessage: message };
      }
      return room;
    });
    this.chatRoomsSubject.next(updatedRooms);
  }

  private incrementRoomUnreadCount(roomId: number): void {
    const currentRooms = this.chatRoomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: (room.unreadCount || 0) + 1 };
      }
      return room;
    });
    this.chatRoomsSubject.next(updatedRooms);
    this.updateUnreadCount(updatedRooms);
  }

  // ===== WEBSOCKET SEND METHODS =====

  sendMessageWebSocket(messageData: SendMessageRequest): void {
    if (this.stompClient && this.stompClient.connected) {
      console.log('📤 Sending message via WebSocket:', messageData);
      
      // Create message in backend-expected format (no messageType)
      const webSocketMessage = {
        chatRoomId: messageData.chatRoomId,
        content: messageData.content
      };
      
      console.log('📤 Final WebSocket message being sent:', webSocketMessage);
      
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(webSocketMessage),
        headers: {
          'User': this.getCurrentUserEmail(),
          'Content-Type': 'application/json'
        }
      });
    } else {
      console.warn('WebSocket not connected, falling back to HTTP');
      this.sendMessageHttp({
        chatRoomId: messageData.chatRoomId,
        content: messageData.content
      }).subscribe();
    }
  }

  deleteMessageWebSocket(messageId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      const deleteRequest: DeleteMessageRequest = { messageId };
      console.log('🗑️ Sending delete via WebSocket:', deleteRequest);
      this.stompClient.publish({
        destination: '/app/chat.deleteMessage',
        body: JSON.stringify(deleteRequest),
        headers: {
          'User': this.getCurrentUserEmail()
        }
      });
    } else {
      console.warn('WebSocket not connected, falling back to HTTP');
      this.deleteMessageHttp(messageId).subscribe();
    }
  }

  // ===== CREATE CHAT ROOM METHODS =====

  createTenantLandlordRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    console.log('💬 Creating tenant-landlord chat room for property:', propertyId);
    
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          console.log('✅ Tenant-landlord chat room created:', response.data);
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createTenantCaretakerRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    console.log('💬 Creating tenant-caretaker chat room for property:', propertyId);
    
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          console.log('✅ Tenant-caretaker chat room created:', response.data);
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createLandlordCaretakerRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    console.log('💬 Creating landlord-caretaker chat room for property:', propertyId);
    
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          console.log('✅ Landlord-caretaker chat room created:', response.data);
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createChatRoom(propertyId: number, targetRole?: string): Observable<CreateChatRoomResponse> {
    const currentUser = this.getCurrentUserSafe();
    const currentUserRole = currentUser?.role?.toLowerCase();
    
    console.log('💬 Smart chat creation:', { 
      currentUserRole, 
      targetRole, 
      propertyId 
    });

    if (targetRole) {
      switch(targetRole.toLowerCase()) {
        case 'landlord':
          return this.createTenantLandlordRoom(propertyId);
        case 'caretaker':
          return this.createTenantCaretakerRoom(propertyId);
        default:
          return throwError(() => new Error(`Invalid target role: ${targetRole}`));
      }
    }

    switch(currentUserRole) {
      case 'tenant':
        return this.createTenantLandlordRoom(propertyId);
      case 'landlord':
        return this.createLandlordCaretakerRoom(propertyId);
      case 'caretaker':
        return this.createLandlordCaretakerRoom(propertyId);
      default:
        return throwError(() => new Error(`Cannot create chat room for role: ${currentUserRole}`));
    }
  }

  private addRoomToChatList(room: ChatRoom): void {
    const currentRooms = this.chatRoomsSubject.value;
    
    const roomExists = currentRooms.some(r => r.id === room.id);
    if (!roomExists) {
      const updatedRooms = [room, ...currentRooms];
      this.chatRoomsSubject.next(updatedRooms);
      
      if (this.stompClient && this.stompClient.connected) {
        this.subscribeToRoom(room.id);
      }
      
      console.log('✅ Added new room to chat list:', room.id);
    }
  }

  // ===== PUBLIC METHODS =====

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$;
  }

  reconnectWebSocket(): void {
    if (this.stompClient) {
      console.log('🔄 Reconnecting WebSocket...');
      this.stompClient.deactivate().then(() => {
        setTimeout(() => {
          this.stompClient?.activate();
        }, 1000);
      });
    } else {
      this.initializeWebSocketConnection();
    }
  }

  // ===== MESSAGE METHODS =====

  sendMessage(messageData: CreateMessageRequest): Observable<BasicResponse> {
    // Try WebSocket first if connected
    if (this.stompClient && this.stompClient.connected) {
      this.sendMessageWebSocket({
        chatRoomId: messageData.chatRoomId,
        content: messageData.content
      });
      
      return new Observable(observer => {
        observer.next({ success: true, message: 'Message sent via WebSocket' });
        observer.complete();
      });
    }

    // Fallback to HTTP
    return this.sendMessageHttp(messageData);
  }

  private sendMessageHttp(messageData: CreateMessageRequest): Observable<BasicResponse> {
    if (!messageData.content.trim()) {
      return throwError(() => ({ message: 'Message content cannot be empty' }));
    }

    // Remove messageType before sending to backend
    const backendMessageData = {
      chatRoomId: messageData.chatRoomId,
      content: messageData.content
    };

    console.log('📤 Sending HTTP message:', backendMessageData);

    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages`,
      backendMessageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ HTTP message response:', response);
        if (response.success && this.currentRoomSubject.value) {
          this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteMessage(messageId: number): Observable<BasicResponse> {
    if (this.stompClient && this.stompClient.connected) {
      this.deleteMessageWebSocket(messageId);
      
      return new Observable(observer => {
        observer.next({ success: true, message: 'Delete request sent via WebSocket' });
        observer.complete();
      });
    }

    return this.deleteMessageHttp(messageId);
  }

  private deleteMessageHttp(messageId: number): Observable<BasicResponse> {
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

  setCurrentRoom(room: ChatRoom | null): void {
    if (this.currentRoomSubject.value) {
      this.unsubscribeFromRoom(this.currentRoomSubject.value.id);
    }

    this.currentRoomSubject.next(room);
    
    if (room) {
      this.messagesSubject.next([]);
      this.markRoomAsRead(room.id).subscribe();
      
      this.getRoomMessages(room.id).subscribe();
      
      if (this.stompClient && this.stompClient.connected) {
        this.subscribeToRoom(room.id);
      }
    }
  }

  // ===== TYPING METHODS =====

  startTyping(roomId: number): Observable<BasicResponse> {
    const currentUser = this.getCurrentUserSafe();
    if (currentUser) {
      const typingUsers = this.typingUsersSubject.value;
      const updatedUsers = [
        ...typingUsers.filter(u => u.userId !== currentUser.id), 
        { 
          userId: currentUser.id, 
          userName: currentUser.name 
        }
      ];
      this.typingUsersSubject.next(updatedUsers);
    }
    
    return new Observable(observer => {
      observer.next({ success: true, message: 'Typing started' });
      observer.complete();
    });
  }

  stopTyping(roomId: number): Observable<BasicResponse> {
    const currentUser = this.getCurrentUserSafe();
    if (currentUser) {
      const typingUsers = this.typingUsersSubject.value.filter(
        u => u.userId !== currentUser.id
      );
      this.typingUsersSubject.next(typingUsers);
    }
    
    return new Observable(observer => {
      observer.next({ success: true, message: 'Typing stopped' });
      observer.complete();
    });
  }

  // ===== HTTP METHODS =====

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

  getOtherParticipants(room: ChatRoom, currentUserId: number): ChatUser[] {
    return room?.participants?.filter(participant => participant.id !== currentUserId) || [];
  }

  getCurrentUserId(): number {
    try {
      const currentUser = this.getCurrentUserSafe();
      return currentUser?.id || 0;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return 0;
    }
  }

  private getCurrentUserSafe(): ChatUser | null {
    try {
      const authUser = this.authService.getCurrentUser();
      if (!authUser) return null;

      const chatUser: ChatUser = {
        id: this.extractUserId(authUser),
        name: authUser.fullName,
        email: authUser.email,
        role: authUser.role,
        avatar: (authUser as any).avatar,
        isOnline: (authUser as any).isOnline,
        lastSeen: (authUser as any).lastSeen,
        phoneNumber: authUser.phoneNumber,
        profilePicture: (authUser as any).profilePicture
      };

      return chatUser;
    } catch (error) {
      console.error('Error converting user to chat format:', error);
      return null;
    }
  }

  private extractUserId(authUser: any): number {
    if (typeof authUser.id === 'number') return authUser.id;
    if (typeof authUser.id === 'string') return parseInt(authUser.id, 10);
    return 0;
  }

  private getCurrentUserEmail(): string {
    const currentUser = this.getCurrentUserSafe();
    return currentUser?.email || '';
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

  // ===== CLEANUP =====

  ngOnDestroy(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
    this.roomSubscriptions.clear();
  }
}