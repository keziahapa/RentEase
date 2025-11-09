// src/app/services/chat.service.ts - COMPLETE FIXED VERSION
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
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
  User,
  CreateChatRoomResponse,
  MessageStatus
} from './chat.interface';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';
  private readonly wsUrl = 'https://rentease-3-sfgx.onrender.com/ws';
  
  private stompClient: Client | null = null;
  private isConnected = new BehaviorSubject<boolean>(false);
  private connectionStatus$ = this.isConnected.asObservable();

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

  private roomSubscriptions = new Map<number, any>();
  private pendingMessages = new Map<number, ChatMessage>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeWebSocketConnection();
    this.initializeChat();
  }

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
      this.stompClient.subscribe(
        `/user/${userId}/queue/messages`,
        (message: IMessage) => {
          console.log('📨 Received personal message:', message.body);
          this.handleIncomingMessage(JSON.parse(message.body));
        }
      );

      this.stompClient.subscribe(
        `/user/${userId}/queue/messages/deleted`,
        (message: IMessage) => {
          console.log('🗑️ Received delete notification:', message.body);
          this.handleMessageDeleted(JSON.parse(message.body));
        }
      );
    }
  }

  private subscribeToRoom(roomId: number): void {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn('WebSocket not connected, cannot subscribe to room');
      return;
    }

    this.unsubscribeFromRoom(roomId);

    console.log(`🔔 Subscribing to room: ${roomId}`);

    const subscription = this.stompClient.subscribe(
      `/topic/chat/${roomId}`,
      (message: IMessage) => {
        console.log(`📨 Received room message for ${roomId}:`, message.body);
        this.handleIncomingMessage(JSON.parse(message.body));
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

  private handleIncomingMessage(messageData: any): void {
    try {
      const message: ChatMessage = this.createChatMessageFromData(messageData);
      this.addMessageToRoom(message);
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private handleMessageDeleted(response: any): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== response.messageId);
    this.messagesSubject.next(updatedMessages);
  }

  private createChatMessageFromData(messageData: any): ChatMessage {
    return {
      id: messageData.id,
      content: messageData.content,
      messageType: messageData.messageType || 'TEXT',
      senderId: messageData.senderId,
      chatRoomId: messageData.chatRoomId,
      timestamp: new Date(messageData.timestamp || Date.now()).toISOString(),
      read: messageData.read || false,
      status: 'SENT',
      sender: messageData.sender || undefined, // FIX: Ensure undefined instead of null
      senderName: messageData.senderName,
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName
    };
  }

  private addMessageToRoom(message: ChatMessage): void {
    const currentMessages = this.messagesSubject.value;
    
    const messageExists = currentMessages.some(m => m.id === message.id);
    if (!messageExists) {
      const updatedMessages = [...currentMessages, message];
      this.messagesSubject.next(updatedMessages);
      
      this.updateRoomLastMessage(message.chatRoomId, message);
      
      if (message.senderId !== this.getCurrentUserId()) {
        this.incrementRoomUnreadCount(message.chatRoomId);
      }
    }
  }

  sendMessage(messageData: CreateMessageRequest): Observable<BasicResponse> {
    if (!messageData.content.trim()) {
      return throwError(() => ({ message: 'Message content cannot be empty' }));
    }

    const tempMessage = this.createTemporaryMessage(messageData);
    this.addPendingMessage(tempMessage);

    if (this.stompClient && this.stompClient.connected) {
      return this.sendMessageWebSocket(messageData, tempMessage.id);
    } else {
      return this.sendMessageHttp(messageData, tempMessage.id);
    }
  }

  private sendMessageWebSocket(messageData: CreateMessageRequest, tempId: number): Observable<BasicResponse> {
    return new Observable(observer => {
      try {
        const wsMessage = {
          ...messageData,
          tempId: tempId,
          senderId: this.getCurrentUserId(),
          timestamp: new Date().toISOString()
        };

        this.stompClient!.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(wsMessage),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('📤 Message sent via WebSocket:', wsMessage);
        observer.next({ success: true, message: 'Message sent via WebSocket' });
        observer.complete();

      } catch (error) {
        console.error('❌ WebSocket send error:', error);
        this.markMessageAsFailed(tempId);
        observer.error({ message: 'Failed to send message via WebSocket' });
      }
    });
  }

  private sendMessageHttp(messageData: CreateMessageRequest, tempId: number): Observable<BasicResponse> {
    const backendMessageData = {
      chatRoomId: messageData.chatRoomId,
      content: messageData.content,
      messageType: messageData.messageType || 'TEXT'
    };

    return this.http.post<BasicResponse>(
      `${this.apiUrl}/messages`,
      backendMessageData,
      { headers: this.createHeaders() }
    ).pipe(
      tap(response => {
        console.log('📤 HTTP Send response:', response);
        if (response.success) {
          this.markMessageAsSent(tempId);
          setTimeout(() => {
            if (this.currentRoomSubject.value) {
              this.getRoomMessages(this.currentRoomSubject.value.id).subscribe();
            }
          }, 500);
        } else {
          this.markMessageAsFailed(tempId);
        }
      }),
      catchError(error => {
        console.error('❌ HTTP Send error:', error);
        this.markMessageAsFailed(tempId);
        return this.handleError(error);
      })
    );
  }

  private createTemporaryMessage(messageData: CreateMessageRequest): ChatMessage {
    const tempId = Date.now();
    const currentUser = this.getCurrentUserSafe();
    
    return {
      id: tempId,
      content: messageData.content,
      messageType: messageData.messageType || 'TEXT',
      senderId: this.getCurrentUserId(),
      chatRoomId: messageData.chatRoomId,
      timestamp: new Date().toISOString(),
      read: false,
      status: 'SENDING',
      sender: currentUser || undefined, // FIX: Convert null to undefined
      senderName: currentUser?.name
    };
  }

  private addPendingMessage(message: ChatMessage): void {
    this.pendingMessages.set(message.id, message);
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  private markMessageAsSent(tempId: number): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => {
      if (msg.id === tempId) {
        return { ...msg, status: 'SENT' as MessageStatus };
      }
      return msg;
    });
    this.messagesSubject.next(updatedMessages);
    this.pendingMessages.delete(tempId);
  }

  private markMessageAsFailed(tempId: number): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => {
      if (msg.id === tempId) {
        return { ...msg, status: 'FAILED' as MessageStatus };
      }
      return msg;
    });
    this.messagesSubject.next(updatedMessages);
    this.pendingMessages.delete(tempId);
  }

  createTenantLandlordRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createTenantCaretakerRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  createLandlordCaretakerRoom(propertyId: number): Observable<CreateChatRoomResponse> {
    return this.http.post<CreateChatRoomResponse>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      tap((response: CreateChatRoomResponse) => {
        if (response.success && response.data) {
          this.addRoomToChatList(response.data);
        }
      }),
      catchError(this.handleError)
    );
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
    }
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$;
  }

  reconnectWebSocket(): void {
    if (this.stompClient) {
      console.log('🔄 Reconnecting WebSocket...');
      this.stompClient.deactivate().then(() => {
        setTimeout(() => {
          this.initializeWebSocketConnection();
        }, 1000);
      });
    } else {
      this.initializeWebSocketConnection();
    }
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
    } else {
      this.messagesSubject.next([]);
    }
  }

  startTyping(roomId: number): Observable<BasicResponse> {
    return of({ success: true, message: 'Typing started' });
  }

  stopTyping(roomId: number): Observable<BasicResponse> {
    return of({ success: true, message: 'Typing stopped' });
  }

  private initializeChat(): void {
    this.loadInitialChatRooms();
  }

  private loadInitialChatRooms(): void {
    this.getChatRooms().subscribe({
      error: (error) => console.warn('Failed to load initial chat rooms:', error)
    });
  }

  private createHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
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
          const messagesWithProperTimestamps: ChatMessage[] = response.data.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp).toISOString(),
            status: 'SENT' as MessageStatus
          }));
          
          this.messagesSubject.next(messagesWithProperTimestamps);
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
      const currentUser = this.getCurrentUserSafe();
      return currentUser?.id || 0;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return 0;
    }
  }

  private getCurrentUserSafe(): User | undefined { // FIX: Changed return type to undefined
    try {
      const authUser = this.authService.getCurrentUser();
      if (!authUser) return undefined; // FIX: Return undefined instead of null

      const user: User = {
        id: this.extractUserId(authUser),
        name: authUser.fullName || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: authUser.role || 'USER',
        avatar: (authUser as any).avatar,
        isOnline: (authUser as any).isOnline,
        lastSeen: (authUser as any).lastSeen,
        phoneNumber: authUser.phoneNumber,
        profilePicture: (authUser as any).profilePicture
      };

      return user;
    } catch (error) {
      console.error('Error converting user to chat format:', error);
      return undefined; // FIX: Return undefined instead of null
    }
  }

  private extractUserId(authUser: any): number {
    if (typeof authUser.id === 'number') return authUser.id;
    if (typeof authUser.id === 'string') return parseInt(authUser.id, 10);
    if (authUser.userId) return parseInt(authUser.userId, 10);
    return 0;
  }

  isMyMessage(message: ChatMessage): boolean {
    return message.senderId === this.getCurrentUserId();
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
}