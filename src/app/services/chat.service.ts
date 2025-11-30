import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map, timeout } from 'rxjs/operators';
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
import { TenantService } from './tenant.service';

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

  private eatTimeZone = 'Africa/Nairobi';
  private eatLocale = 'en-KE';

  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {
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
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  private getWsToken(): string {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    if (token.startsWith('Bearer ')) {
      return token.substring(7);
    }
    return token;
  }

  private handleApiError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => new Error('An error occurred. Please try again.'));
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      if (!this.authService.isAuthenticated()) {
        console.log('❌ User not authenticated, skipping WebSocket connection');
        return;
      }

      if (this.stompClient) {
        console.log('🔄 Cleaning up existing WebSocket connection');
        this.stompClient.deactivate();
      }
      
      console.log('🚀 Initializing WebSocket connection...');
      const socket = new SockJS(this.wsUrl);
      
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${this.getWsToken()}`
        },
        debug: (str) => {
          if (str.includes('ERROR') || str.includes('CONNECT') || str.includes('DISCONNECT')) {
            console.log('STOMP:', str);
          }
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('✅ WebSocket connected successfully');
        this.connectedSubject.next(true);
        this.connectionAttempts = 0;
        
        // Subscribe to user-specific queues
        const userMessagesSubscription = this.stompClient!.subscribe('/user/queue/messages', (message: IMessage) => {
          console.log('📨 Received message via user queue');
          this.handleIncomingMessage(JSON.parse(message.body));
        });

        const userDeletedSubscription = this.stompClient!.subscribe('/user/queue/messages/deleted', (message: IMessage) => {
          console.log('🗑️ Received deletion notification');
          this.handleMessageDeleted(JSON.parse(message.body));
        });

        this.roomSubscriptions.set('/user/queue/messages', userMessagesSubscription);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeletedSubscription);

        // Subscribe to current room if available
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          console.log('📡 Subscribing to current room:', currentRoom.id);
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('❌ STOMP error:', frame);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('❌ WebSocket error:', event);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onDisconnect = (frame) => {
        console.log('🔌 WebSocket disconnected');
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('❌ Error initializing WebSocket:', error);
      this.connectedSubject.next(false);
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      this.connectionAttempts++;
      console.log(`🔄 Attempting reconnection (${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS})...`);
      
      setTimeout(() => {
        if (this.authService.isAuthenticated()) {
          this.initializeWebSocketConnection();
        }
      }, this.RECONNECT_DELAY * this.connectionAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      console.log('📥 Processing incoming message:', messageData);
      
      if (!messageData.chatRoomId && !messageData.roomId) {
        console.warn('⚠️ Message without chatRoomId, ignoring:', messageData);
        return;
      }
      
      const message: Message = {
        id: Number(messageData.id || messageData.messageId || Date.now()),
        content: messageData.content || messageData.message || '',
        senderId: Number(messageData.senderId || messageData.sender?.id || 0),
        senderName: messageData.senderName || messageData.sender?.name || messageData.sender?.fullName || 'Unknown User',
        senderEmail: messageData.senderEmail || messageData.sender?.email || '',
        chatRoomId: Number(messageData.chatRoomId || messageData.roomId),
        sentAt: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        timestamp: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        messageType: messageData.messageType || 'TEXT',
        status: (messageData.status || 'SENT') as MessageStatus,
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false
      };
      
      console.log('✅ Message processed successfully:', message);
      this.addMessage(message);
      
      // Mark as read if it's the current room
      if (this.currentRoomSubject.value?.id === message.chatRoomId) {
        this.markMessageAsRead(message.chatRoomId, message.id);
      }
    } catch (error) {
      console.error('❌ Error handling incoming message:', error, messageData);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    try {
      console.log('🗑️ Processing message deletion:', deletionData);
      
      if (deletionData.messageId) {
        this.removeMessage(Number(deletionData.messageId));
      } else if (deletionData.messageIds) {
        deletionData.messageIds.forEach((messageId: number) => {
          this.removeMessage(Number(messageId));
        });
      }
    } catch (error) {
      console.error('❌ Error handling message deletion:', error, deletionData);
    }
  }

  private addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    const messageExists = currentMessages.some(m => m.id === message.id);
    
    if (!messageExists) {
      console.log('➕ Adding new message to list');
      const updatedMessages = [...currentMessages, message].sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      this.messagesSubject.next(updatedMessages);
      
      // Update room's last message
      if (message.chatRoomId) {
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
    } else {
      console.log('ℹ️ Message already exists, skipping');
    }
  }

  private removeMessage(messageId: number): void {
    console.log('🗑️ Removing message:', messageId);
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    this.messagesSubject.next(updatedMessages);
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
    console.log('🔄 Updating room last message for room:', roomId);
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
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
    this.roomsSubject.next(updatedRooms);
  }

  private processRoomData(room: any): ChatRoom {
    const processedRoom: ChatRoom = {
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

    return processedRoom;
  }

  private processMessageData(messageData: any): Message {
    const message: Message = {
      id: Number(messageData.id),
      content: messageData.content || '',
      senderId: Number(messageData.senderId),
      senderName: messageData.senderName || 'Unknown User',
      senderEmail: messageData.senderEmail || '',
      chatRoomId: Number(messageData.chatRoomId),
      sentAt: new Date(messageData.sentAt),
      timestamp: new Date(messageData.sentAt),
      messageType: messageData.messageType || 'TEXT',
      status: (messageData.status || 'SENT') as MessageStatus,
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
      canDelete: messageData.canDelete || false
    };
    
    return message;
  }

  private processParticipants(participants: any[]): Participant[] {
    if (!participants || !Array.isArray(participants)) {
      return [];
    }

    return participants.map((participant: any) => {
      const processedParticipant: Participant = {
        id: Number(participant.id || participant.userId),
        userId: Number(participant.userId || participant.id),
        name: participant.name || participant.fullName || 'Unknown User',
        fullName: participant.fullName || participant.name,
        email: participant.email || '',
        role: participant.role || 'USER',
        avatar: participant.avatar,
        profilePicture: participant.profilePicture,
        isOnline: participant.isOnline || false,
        lastSeen: participant.lastSeen ? new Date(participant.lastSeen) : undefined,
        phoneNumber: participant.phoneNumber,
        joinedAt: participant.joinedAt ? new Date(participant.joinedAt) : undefined,
        isAdmin: participant.isAdmin || false,
        unitNumber: participant.unitNumber || participant.unit?.unitNumber,
        propertyId: participant.propertyId || participant.unit?.propertyId,
        unit: participant.unit
      };

      return processedParticipant;
    });
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.unsubscribeFromRoom(roomId);

      const topic = `/topic/chat/${roomId}`;
      try {
        console.log('📡 Subscribing to room topic:', topic);
        const subscription = this.stompClient!.subscribe(topic, (message: IMessage) => {
          console.log('📨 Received message from room topic');
          this.handleIncomingMessage(JSON.parse(message.body));
        });
        this.roomSubscriptions.set(topic, subscription);
        console.log('✅ Successfully subscribed to room:', roomId);
      } catch (error) {
        console.error('❌ Error subscribing to room:', error);
      }
    } else {
      console.warn('⚠️ Cannot subscribe to room - WebSocket not connected');
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const subscription = this.roomSubscriptions.get(topic);
    if (subscription) {
      console.log('📡 Unsubscribing from room:', roomId);
      subscription.unsubscribe();
      this.roomSubscriptions.delete(topic);
    }
  }

  private markMessageAsRead(roomId: number, messageId: number): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('❌ Error marking message as read:', error);
        return of(null);
      })
    ).subscribe();
  }

  loadRooms(): void {
    if (!this.authService.isAuthenticated()) {
      console.log('❌ User not authenticated, skipping room load');
      return;
    }

    console.log('📥 Loading chat rooms...');
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('❌ Error loading rooms:', error);
        return of([]);
      })
    ).subscribe(rooms => {
      console.log(`✅ Loaded ${rooms.length} chat rooms`);
      
      // Remove duplicates based on room ID
      const uniqueRooms = Array.from(
        new Map(rooms.map(room => [room.id, room])).values()
      );
      
      const processedRooms = uniqueRooms.map(room => this.processRoomData(room));
      this.roomsSubject.next(processedRooms);
    });
  }

  getMessages(roomId: number): void {
    if (!this.authService.isAuthenticated()) {
      console.log('❌ User not authenticated, skipping message load');
      return;
    }

    console.log('📥 Loading messages for room:', roomId);
    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('❌ Error loading messages:', error);
        return of([]);
      })
    ).subscribe(messages => {
      console.log(`✅ Loaded ${messages.length} messages for room ${roomId}`);
      const processedMessages = messages.map(msg => this.processMessageData(msg))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.messagesSubject.next(processedMessages);
      
      // Subscribe to room for real-time updates
      this.subscribeToRoom(roomId);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    console.log('📤 Sending message to room:', roomId);
    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId,
      messageType: 'TEXT'
    };

    // Send via WebSocket if connected
    if (this.stompClient && this.stompClient.connected) {
      try {
        console.log('📡 Publishing message via WebSocket');
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageRequest),
          headers: {
            'Authorization': `Bearer ${this.getWsToken()}`,
            'content-type': 'application/json'
          }
        });
        console.log('✅ Message published via WebSocket');
      } catch (error) {
        console.error('❌ WebSocket publish error:', error);
      }
    }

    // Always send via HTTP as fallback
    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Message sent successfully via HTTP');
          this.handleIncomingMessage(response.data);
        }
      }),
      catchError(error => {
        console.error('❌ Error sending message:', error);
        return this.handleApiError(error);
      })
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    console.log('🗑️ Deleting message:', messageId);
    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(15000),
      tap(response => {
        if (response.success) {
          console.log('✅ Message deleted successfully');
          this.removeMessage(messageId);
        }
      }),
      catchError(error => {
        console.error('❌ Error deleting message:', error);
        let errorMessage = 'Failed to delete message.';
        if (error.status === 404) {
          errorMessage = 'Message not found or already deleted.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to delete this message.';
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // ✅ CORRECTED API ENDPOINTS - MATCHING YOUR BACKEND
  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating tenant-landlord chat for property:', propertyId);
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/landlord/${propertyId}`, // ✅ CORRECT
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Tenant-landlord chat created successfully');
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          
          // Check if room already exists to avoid duplicates
          const roomExists = currentRooms.some(r => r.id === newRoom.id);
          if (!roomExists) {
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-landlord chat:', error);
        return this.handleApiError(error);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating tenant-caretaker chat for property:', propertyId);
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/caretaker/${propertyId}`, // ✅ CORRECT
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Tenant-caretaker chat created successfully');
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          
          const roomExists = currentRooms.some(r => r.id === newRoom.id);
          if (!roomExists) {
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-caretaker chat:', error);
        return this.handleApiError(error);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating landlord-caretaker chat for property:', propertyId);
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/caretaker/${propertyId}`, // ✅ CORRECT
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Landlord-caretaker chat created successfully');
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          
          const roomExists = currentRooms.some(r => r.id === newRoom.id);
          if (!roomExists) {
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }
      }),
      catchError(error => {
        console.error('❌ Error creating landlord-caretaker chat:', error);
        return this.handleApiError(error);
      })
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating landlord-tenant chat for unit:', unitId);
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`, // ✅ CORRECT
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Landlord-tenant chat created successfully');
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          
          const roomExists = currentRooms.some(r => r.id === newRoom.id);
          if (!roomExists) {
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }
      }),
      catchError(error => {
        console.error('❌ Error creating landlord-tenant chat:', error);
        return this.handleApiError(error);
      })
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('🔧 Creating caretaker-tenant chat for unit:', unitId);
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/caretaker/tenant/${unitId}`, // ✅ CORRECT
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      tap(response => {
        if (response.success && response.data) {
          console.log('✅ Caretaker-tenant chat created successfully');
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          
          const roomExists = currentRooms.some(r => r.id === newRoom.id);
          if (!roomExists) {
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }
      }),
      catchError(error => {
        console.error('❌ Error creating caretaker-tenant chat:', error);
        return this.handleApiError(error);
      })
    );
  }

  selectRoom(room: ChatRoom | null): void {
    console.log('🎯 Selecting room:', room?.id || 'null');
    this.currentRoomSubject.next(room);
    
    if (room?.id) {
      console.log('📥 Loading messages for selected room');
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
    } else {
      console.log('📭 Clearing messages');
      this.messagesSubject.next([]);
    }
  }

  private markRoomAsRead(roomId: number): void {
    console.log('✅ Marking room as read:', roomId);
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: 0 };
      }
      return room;
    });
    this.roomsSubject.next(updatedRooms);
  }

  getCurrentUserId(): number {
    const user = this.authService.getCurrentUser();
    
    if (!user?.id) {
      console.warn('⚠️ No user ID found');
      return 0;
    }
    
    if (typeof user.id === 'number') {
      return user.id;
    }
    
    if (typeof user.id === 'string') {
      const parsedId = parseInt(user.id, 10);
      return isNaN(parsedId) ? 0 : parsedId;
    }
    
    return 0;
  }

  isMyMessage(message: Message): boolean {
    const currentUserId = this.getCurrentUserId();
    return message.senderId === currentUserId;
  }

  formatTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString(this.eatLocale, { 
        timeZone: this.eatTimeZone,
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
  }

  formatMessageTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
     try {
      const now = new Date();
      const messageTime = new Date(timestamp);
      
      const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return messageTime.toLocaleTimeString(this.eatLocale, { 
          timeZone: this.eatTimeZone,
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } else if (diffInHours < 168) {
        return messageTime.toLocaleDateString(this.eatLocale, { 
          timeZone: this.eatTimeZone,
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else {
        return messageTime.toLocaleDateString(this.eatLocale, { 
          timeZone: this.eatTimeZone,
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (error) {
      const now = new Date();
      const messageTime = new Date(timestamp);
      
      const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return messageTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } else {
        return messageTime.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
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

  canAccessChat(): boolean {
    return this.authService.isAuthenticated() && !!this.authService.getToken();
  }

  clearLocalData(): void {
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
    this.roomSubscriptions.clear();
  }
}