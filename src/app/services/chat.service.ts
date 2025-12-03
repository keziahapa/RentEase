// ============================================================================
// FIXED chat.service.ts - See full code above
// ============================================================================

// ============================================================================
// PART 2: FIXED chat.component.ts - KEY CHANGES
// ============================================================================

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of, forkJoin } from 'rxjs';
import { catchError, tap, map, timeout, switchMap } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { 
  Message, 
  ChatRoom, 
  SendMessageRequest, 
  ApiResponse,
  Participant,
  MessageStatus  
} from './chat.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'https://rentease-4.onrender.com/api/chat';
  private wsUrl = 'https://rentease-4.onrender.com/ws';
  private stompClient: Client | null = null;
  private roomSubscriptions: Map<string, any> = new Map();
  private authService = inject(AuthService);

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private roomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000;

  constructor(private http: HttpClient) {
    this.initializeService();
  }

  private initializeService(): void {
    if (this.authService.isAuthenticated()) {
      this.initializeWebSocketConnection();
      this.loadRooms();
    }

    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        setTimeout(() => {
          if (this.authService.isAuthenticated()) {
            this.initializeWebSocketConnection();
            this.loadRooms();
          }
        }, 1000);
      } else {
        this.disconnect();
        this.clearLocalData();
      }
    });
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  private getWsToken(): string {
    const token = this.authService.getToken();
    if (!token) throw new Error('No authentication token available');
    return token.startsWith('Bearer ') ? token.substring(7) : token;
  }

  private handleApiError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => new Error('An error occurred. Please try again.'));
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined' || !this.authService.isAuthenticated()) return;

      if (this.stompClient) this.stompClient.deactivate();
      
      const socket = new SockJS(this.wsUrl);
      
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: { 'Authorization': `Bearer ${this.getWsToken()}` },
        debug: (str) => {
          if (str.includes('ERROR') || str.includes('CONNECT') || str.includes('DISCONNECT')) {
            console.log('STOMP:', str);
          }
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket connected');
        this.connectedSubject.next(true);
        this.connectionAttempts = 0;
        
        const userMsgs = this.stompClient!.subscribe('/user/queue/messages', (msg: IMessage) => {
          this.handleIncomingMessage(JSON.parse(msg.body));
        });
        const userDeleted = this.stompClient!.subscribe('/user/queue/messages/deleted', (msg: IMessage) => {
          this.handleMessageDeleted(JSON.parse(msg.body));
        });
        
        this.roomSubscriptions.set('/user/queue/messages', userMsgs);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeleted);

        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) this.subscribeToRoom(currentRoom.id);
      };

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP error:', frame);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onDisconnect = () => {
        console.log('WebSocket disconnected');
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.connectedSubject.next(false);
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      this.connectionAttempts++;
      console.log(`Reconnecting (${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS})...`);
      setTimeout(() => {
        if (this.authService.isAuthenticated()) this.initializeWebSocketConnection();
      }, this.RECONNECT_DELAY * this.connectionAttempts);
    }
  }

  // ✅ FIXED: Better name extraction from incoming messages
  private handleIncomingMessage(messageData: any): void {
    try {
      if (!messageData.chatRoomId && !messageData.roomId) {
        console.warn('Message without chatRoomId:', messageData);
        return;
      }
      
      const message: Message = {
        id: Number(messageData.id || messageData.messageId || Date.now()),
        content: messageData.content || messageData.message || '',
        senderId: Number(messageData.senderId || messageData.sender?.id || 0),
        
        // ✅ FIXED: Check ALL possible name fields
        senderName: messageData.senderName || 
                    messageData.sender?.name || 
                    messageData.sender?.fullName || 
                    messageData.sender?.username ||
                    messageData.senderFullName ||
                    messageData.name ||
                    'Unknown User',
                    
        senderEmail: messageData.senderEmail || messageData.sender?.email || '',
        chatRoomId: Number(messageData.chatRoomId || messageData.roomId),
        sentAt: new Date(messageData.sentAt || messageData.timestamp || Date.now()),
        timestamp: new Date(messageData.sentAt || messageData.timestamp || Date.now()),
        messageType: messageData.messageType || 'TEXT',
        status: (messageData.status || 'SENT') as MessageStatus,
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false
      };
      
      this.addMessage(message);
      
      if (this.currentRoomSubject.value?.id === message.chatRoomId) {
        this.markMessageAsRead(message.chatRoomId, message.id);
      }
    } catch (error) {
      console.error('Error handling message:', error, messageData);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    try {
      if (deletionData.messageId) {
        this.removeMessage(Number(deletionData.messageId));
      } else if (deletionData.messageIds) {
        deletionData.messageIds.forEach((id: number) => this.removeMessage(Number(id)));
      }
    } catch (error) {
      console.error('Error handling deletion:', error);
    }
  }

  private addMessage(message: Message): void {
    const current = this.messagesSubject.value;
    if (!current.some(m => m.id === message.id)) {
      const updated = [...current, message].sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      this.messagesSubject.next(updated);
      if (message.chatRoomId) this.updateRoomLastMessage(message.chatRoomId, message);
    }
  }

  private removeMessage(messageId: number): void {
    const current = this.messagesSubject.value;
    this.messagesSubject.next(current.filter(m => m.id !== messageId));
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
    const current = this.roomsSubject.value;
    const updated = current.map(room => {
      if (room.id === roomId) {
        const isCurrentRoom = this.currentRoomSubject.value?.id === roomId;
        return { 
          ...room, 
          lastMessage: message,
          updatedAt: new Date(),
          unreadCount: isCurrentRoom ? 0 : (room.unreadCount || 0) + 1
        };
      }
      return room;
    });
    this.roomsSubject.next(updated);
  }

  // ✅ FIXED: Better participant name extraction
  private processParticipants(participants: any[]): Participant[] {
    if (!participants || !Array.isArray(participants)) return [];

    return participants.map((p: any) => ({
      id: Number(p.id || p.userId),
      userId: Number(p.userId || p.id),
      
      // ✅ FIXED: Check ALL possible name fields
      name: p.name || p.fullName || p.username || p.displayName || 
            p.firstName || p.user?.name || p.user?.fullName || 'Unknown User',
      fullName: p.fullName || p.name || p.username || '',
      
      email: p.email || p.user?.email || '',
      role: p.role || 'USER',
      avatar: p.avatar || p.profilePicture,
      profilePicture: p.profilePicture || p.avatar,
      isOnline: p.isOnline || false,
      lastSeen: p.lastSeen ? new Date(p.lastSeen) : undefined,
      phoneNumber: p.phoneNumber,
      joinedAt: p.joinedAt ? new Date(p.joinedAt) : undefined,
      isAdmin: p.isAdmin || false,
      unitNumber: p.unitNumber || p.unit?.unitNumber,
      propertyId: p.propertyId || p.unit?.propertyId,
      unit: p.unit
    }));
  }

  private processRoomData(room: any): ChatRoom {
    return {
      id: Number(room.id) || 0,
      name: room.name || room.propertyName || 'Unknown Chat',
      type: room.type || 'DIRECT',
      propertyId: room.propertyId ? Number(room.propertyId) : undefined,
      propertyName: room.propertyName || '',
      unitId: room.unitId ? Number(room.unitId) : undefined,
      unitNumber: room.unitNumber || '',
      participants: this.processParticipants(room.participants || room.users || []),
      lastMessage: room.lastMessage ? this.processMessageData(room.lastMessage) : null,
      unreadCount: Number(room.unreadCount) || 0,
      isGroup: room.isGroup || false,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      updatedAt: room.updatedAt ? new Date(room.updatedAt) : new Date()
    };
  }

  // ✅ FIXED: Better message name extraction
  private processMessageData(msgData: any): Message {
    return {
      id: Number(msgData.id),
      content: msgData.content || '',
      senderId: Number(msgData.senderId),
      
      // ✅ FIXED: Check ALL possible name fields
      senderName: msgData.senderName || 
                  msgData.sender?.name || 
                  msgData.sender?.fullName ||
                  msgData.name ||
                  'Unknown User',
                  
      senderEmail: msgData.senderEmail || msgData.sender?.email || '',
      chatRoomId: Number(msgData.chatRoomId),
      sentAt: new Date(msgData.sentAt),
      timestamp: new Date(msgData.sentAt),
      messageType: msgData.messageType || 'TEXT',
      status: (msgData.status || 'SENT') as MessageStatus,
      fileUrl: msgData.fileUrl,
      fileName: msgData.fileName,
      fileSize: msgData.fileSize ? Number(msgData.fileSize) : undefined,
      canDelete: msgData.canDelete || false
    };
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient?.connected) {
      this.unsubscribeFromRoom(roomId);
      const topic = `/topic/chat/${roomId}`;
      try {
        const sub = this.stompClient.subscribe(topic, (msg: IMessage) => {
          this.handleIncomingMessage(JSON.parse(msg.body));
        });
        this.roomSubscriptions.set(topic, sub);
      } catch (error) {
        console.error('Error subscribing:', error);
      }
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const sub = this.roomSubscriptions.get(topic);
    if (sub) {
      sub.unsubscribe();
      this.roomSubscriptions.delete(topic);
    }
  }

  private markMessageAsRead(roomId: number, messageId: number): void {
    if (!this.authService.isAuthenticated()) return;
    this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of(null))).subscribe();
  }

  loadRooms(): void {
    if (!this.authService.isAuthenticated()) return;
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(res => res?.success && Array.isArray(res.data) ? res.data : []),
      catchError(() => of([]))
    ).subscribe(rooms => {
      this.roomsSubject.next(rooms.map(r => this.processRoomData(r)));
    });
  }

  getMessages(roomId: number): void {
    if (!this.authService.isAuthenticated()) return;
    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(res => res?.success && Array.isArray(res.data) ? res.data : []),
      catchError(() => of([]))
    ).subscribe(msgs => {
      const processed = msgs.map(m => this.processMessageData(m))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.messagesSubject.next(processed);
      this.subscribeToRoom(roomId);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('Not authenticated'));
    }

    const request: SendMessageRequest = {
      content,
      chatRoomId: roomId,
      messageType: 'TEXT'
    };

    if (this.stompClient?.connected) {
      try {
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(request),
          headers: {
            'Authorization': `Bearer ${this.getWsToken()}`,
            'content-type': 'application/json'
          }
        });
      } catch (error) {
        console.error('WebSocket publish error:', error);
      }
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, request, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) this.handleIncomingMessage(res.data);
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('Not authenticated'));
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(res => {
        if (res.success) this.removeMessage(messageId);
      }),
      catchError(error => {
        let msg = 'Failed to delete message.';
        if (error.status === 404) msg = 'Message not found.';
        else if (error.status === 403) msg = 'No permission.';
        return throwError(() => new Error(msg));
      })
    );
  }

  // ✅ FIXED: All chat creation methods remain the same - they work correctly
  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/landlord/${propertyId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) {
          const rooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(res.data);
          if (!rooms.some(r => r.id === newRoom.id)) {
            this.roomsSubject.next([...rooms, newRoom]);
          }
        }
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/caretaker/${propertyId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) {
          const rooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(res.data);
          if (!rooms.some(r => r.id === newRoom.id)) {
            this.roomsSubject.next([...rooms, newRoom]);
          }
        }
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/caretaker/${propertyId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) {
          const rooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(res.data);
          if (!rooms.some(r => r.id === newRoom.id)) {
            this.roomsSubject.next([...rooms, newRoom]);
          }
        }
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) {
          const rooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(res.data);
          if (!rooms.some(r => r.id === newRoom.id)) {
            this.roomsSubject.next([...rooms, newRoom]);
          }
        }
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/caretaker/tenant/${unitId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(res => {
        if (res.success && res.data) {
          const rooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(res.data);
          if (!rooms.some(r => r.id === newRoom.id)) {
            this.roomsSubject.next([...rooms, newRoom]);
          }
        }
      }),
      catchError(this.handleApiError.bind(this))
    );
  }

  selectRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    if (room?.id) {
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
    } else {
      this.messagesSubject.next([]);
    }
  }

  private markRoomAsRead(roomId: number): void {
    const rooms = this.roomsSubject.value;
    this.roomsSubject.next(rooms.map(r => 
      r.id === roomId ? { ...r, unreadCount: 0 } : r
    ));
  }

  getCurrentUserId(): number {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return 0;
    return typeof user.id === 'number' ? user.id : parseInt(user.id, 10) || 0;
  }

  isMyMessage(message: Message): boolean {
    return message.senderId === this.getCurrentUserId();
  }

  formatTime(timestamp: Date): string {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return '';
    }
  }

  formatMessageTime(timestamp: Date): string {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) return '';
    try {
      const now = new Date();
      const msgTime = new Date(timestamp);
      const diffHours = (now.getTime() - msgTime.getTime()) / (1000 * 60 * 60);
      
      if (diffHours < 24) {
        return msgTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } else if (diffHours < 168) {
        return msgTime.toLocaleDateString('en-US', { 
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else {
        return msgTime.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {
      return '';
    }
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.roomSubscriptions.clear();
    }
    this.connectedSubject.next(false);
    this.connectionAttempts = 0;
  }

  getConnectionStatus(): boolean {
    return this.connectedSubject.value;
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      if (this.authService.isAuthenticated()) {
        this.initializeWebSocketConnection();
        this.loadRooms();
      }
    }, 1000);
  }

  clearLocalData(): void {
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
    this.roomSubscriptions.clear();
  }
}

function Injectable(arg0: { providedIn: string; }): (target: typeof ChatService, context: ClassDecoratorContext<typeof ChatService>) => void | typeof ChatService {
  throw new Error('Function not implemented.');
}
