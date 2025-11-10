import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { 
  Message, 
  ChatRoom, 
  SendMessageRequest, 
  BatchDeleteRequest,
  ApiResponse 
} from './chat.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'https://rentease-3-sfgx.onrender.com/api/chat';
  private stompClient!: Client;
  private roomSubscriptions: Map<string, any> = new Map();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private roomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeWebSocketConnection();
    this.loadRooms();
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        console.warn('WebSocket not available in current environment');
        return;
      }

      const socket = new SockJS('https://rentease-3-sfgx.onrender.com/ws');
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        debug: (str) => console.log('STOMP: ' + str),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('✅ WebSocket Connected successfully');
        this.connectedSubject.next(true);
        
        const userId = this.getCurrentUserId();
        if (userId) {
          console.log(`📡 Subscribing to user queues for user ID: ${userId}`);
          
          // Subscribe to user-specific queues
          const userMessagesSubscription = this.stompClient.subscribe(`/user/${userId}/queue/messages`, (message: IMessage) => {
            console.log('📨 Received message via user queue:', message.body);
            this.handleIncomingMessage(JSON.parse(message.body));
          });

          const userDeletedSubscription = this.stompClient.subscribe(`/user/${userId}/queue/messages/deleted`, (message: IMessage) => {
            console.log('🗑️ Received message deletion via user queue:', message.body);
            this.handleMessageDeleted(JSON.parse(message.body));
          });

          // Store subscriptions for cleanup
          this.roomSubscriptions.set(`/user/${userId}/queue/messages`, userMessagesSubscription);
          this.roomSubscriptions.set(`/user/${userId}/queue/messages/deleted`, userDeletedSubscription);
        }

        // Subscribe to rooms update queue
        const roomsSubscription = this.stompClient.subscribe('/user/queue/rooms', (message: IMessage) => {
          console.log('🔄 Received rooms update:', message.body);
          this.handleRoomsUpdate(JSON.parse(message.body));
        });
        this.roomSubscriptions.set('/user/queue/rooms', roomsSubscription);

        // Subscribe to current room if exists
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          console.log(`📡 Subscribing to room: ${currentRoom.id}`);
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('❌ STOMP Error:', frame);
        this.connectedSubject.next(false);
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('❌ WebSocket Error:', event);
        this.connectedSubject.next(false);
      };

      this.stompClient.onDisconnect = (frame) => {
        console.log('🔌 WebSocket Disconnected');
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      console.log('🔄 Activating WebSocket connection...');
      this.stompClient.activate();
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.connectedSubject.next(false);
    }
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      console.log('📝 Processing incoming message:', messageData);
      
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
        status: messageData.status || 'SENT',
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false
      };
      
      this.addMessage(message);
    } catch (error) {
      console.error('❌ Error handling incoming message:', error, messageData);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    console.log('🗑️ Processing message deletion:', deletionData);
    
    if (deletionData.messageId) {
      this.removeMessage(Number(deletionData.messageId));
    } else if (deletionData.messageIds) {
      deletionData.messageIds.forEach((messageId: number) => {
        this.removeMessage(Number(messageId));
      });
    }
  }

  private handleRoomsUpdate(roomsData: any): void {
    try {
      console.log('🔄 Processing rooms update:', roomsData);
      if (roomsData && Array.isArray(roomsData)) {
        const processedRooms = roomsData.map((room: any) => this.processRoomData(room));
        this.roomsSubject.next(processedRooms);
      }
    } catch (error) {
      console.error('❌ Error handling rooms update:', error);
    }
  }

  private addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    const messageExists = currentMessages.some(m => m.id === message.id);
    
    if (!messageExists) {
      const updatedMessages = [...currentMessages, message];
      this.messagesSubject.next(updatedMessages);
      
      if (message.chatRoomId) {
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
      
      console.log('✅ Message added to state:', message);
    } else {
      console.log('⚠️ Message already exists in state:', message.id);
    }
  }

  private removeMessage(messageId: number): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    this.messagesSubject.next(updatedMessages);
    console.log('✅ Message removed from state:', messageId);
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        return { 
          ...room, 
          lastMessage: message,
          updatedAt: new Date()
        };
      }
      return room;
    });
    this.roomsSubject.next(updatedRooms);
  }

  private processRoomData(room: any): ChatRoom {
    return {
      id: Number(room.id) || 0,
      name: room.name || 'Unknown Chat',
      type: room.type || 'DIRECT',
      propertyId: Number(room.propertyId) || 0,
      propertyName: room.propertyName || '',
      participants: room.participants || [],
      lastMessage: room.lastMessage,
      unreadCount: Number(room.unreadCount) || 0,
      isGroup: room.isGroup || false,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      updatedAt: room.updatedAt ? new Date(room.updatedAt) : new Date()
    };
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.unsubscribeFromRoom(roomId);

      console.log(`📡 Subscribing to room topics for room ID: ${roomId}`);
      
      const roomMessagesSubscription = this.stompClient.subscribe(`/topic/chat/${roomId}`, (message: IMessage) => {
        console.log(`📨 Received message for room ${roomId}:`, message.body);
        this.handleIncomingMessage(JSON.parse(message.body));
      });

      const roomDeletedSubscription = this.stompClient.subscribe(`/topic/chat/${roomId}/deleted`, (message: IMessage) => {
        console.log(`🗑️ Received deletion for room ${roomId}:`, message.body);
        this.handleMessageDeleted(JSON.parse(message.body));
      });

      // Store subscriptions for cleanup
      this.roomSubscriptions.set(`/topic/chat/${roomId}`, roomMessagesSubscription);
      this.roomSubscriptions.set(`/topic/chat/${roomId}/deleted`, roomDeletedSubscription);
    } else {
      console.warn('⚠️ Cannot subscribe to room - WebSocket not connected');
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topics = [`/topic/chat/${roomId}`, `/topic/chat/${roomId}/deleted`];
    
    topics.forEach(topic => {
      const subscription = this.roomSubscriptions.get(topic);
      if (subscription) {
        subscription.unsubscribe();
        this.roomSubscriptions.delete(topic);
        console.log(`📡 Unsubscribed from: ${topic}`);
      }
    });
  }

  private unsubscribeFromAllRooms(): void {
    // Unsubscribe only from room topics, keep user queues
    const roomTopics = Array.from(this.roomSubscriptions.keys()).filter(key => 
      key.startsWith('/topic/chat/')
    );
    
    roomTopics.forEach(topic => {
      const subscription = this.roomSubscriptions.get(topic);
      if (subscription) {
        subscription.unsubscribe();
        this.roomSubscriptions.delete(topic);
        console.log(`📡 Unsubscribed from: ${topic}`);
      }
    });
  }

  // Public API Methods
  loadRooms(): void {
    console.log('🔄 Loading chat rooms...');
    
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { headers: this.getHeaders() })
      .pipe(
        map(response => {
          console.log('📋 Rooms API response:', response);
          return response.data || [];
        }),
        catchError(error => {
          console.error('❌ Error loading rooms:', error);
          return of([]);
        })
      )
      .subscribe(rooms => {
        const processedRooms = rooms.map(room => this.processRoomData(room));
        this.roomsSubject.next(processedRooms);
        console.log(`✅ Loaded ${processedRooms.length} rooms`);
      });
  }

  getMessages(roomId: number): void {
    console.log(`🔄 Loading messages for room ${roomId}...`);
    
    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { headers: this.getHeaders() })
      .pipe(
        map(response => {
          console.log(`📨 Messages API response for room ${roomId}:`, response);
          return response.data || [];
        }),
        catchError(error => {
          console.error(`❌ Error loading messages for room ${roomId}:`, error);
          return of([]);
        })
      )
      .subscribe(messages => {
        const processedMessages = messages.map(msg => ({
          id: Number(msg.id),
          content: msg.content || '',
          senderId: Number(msg.senderId),
          senderName: msg.senderName || 'Unknown User',
          senderEmail: msg.senderEmail || '',
          chatRoomId: Number(msg.chatRoomId),
          sentAt: new Date(msg.sentAt),
          timestamp: new Date(msg.sentAt),
          messageType: msg.messageType || 'TEXT',
          status: msg.status || 'SENT',
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize ? Number(msg.fileSize) : undefined,
          canDelete: msg.canDelete || false
        }));
        
        this.messagesSubject.next(processedMessages);
        console.log(`✅ Loaded ${processedMessages.length} messages for room ${roomId}`);
        
        this.subscribeToRoom(roomId);
      });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    console.log(`📤 Sending message to room ${roomId}:`, content);
    
    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId
    };

    if (this.stompClient && this.stompClient.connected) {
      console.log('📡 Sending message via WebSocket');
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(messageRequest),
        headers: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      });
    } else {
      console.warn('⚠️ WebSocket not connected, sending via HTTP only');
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { headers: this.getHeaders() })
      .pipe(
        tap(response => {
          console.log('✅ Message sent successfully:', response);
        }),
        catchError(error => {
          console.error('❌ Error sending message:', error);
          return throwError(() => error);
        })
      );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    console.log(`🗑️ Deleting message ${messageId}`);
    
    if (this.stompClient && this.stompClient.connected) {
      const deleteRequest = { messageId: messageId };
      console.log('📡 Sending delete via WebSocket');
      this.stompClient.publish({
        destination: '/app/chat.deleteMessage',
        body: JSON.stringify(deleteRequest),
        headers: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      });
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { headers: this.getHeaders() })
      .pipe(
        tap(() => {
          this.removeMessage(messageId);
          console.log('✅ Message deleted successfully');
        }),
        catchError(error => {
          console.error('❌ Error deleting message:', error);
          return throwError(() => error);
        })
      );
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log(`💬 Creating tenant-landlord chat for property ${propertyId}`);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          console.log('✅ Tenant-landlord chat created successfully:', newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-landlord chat:', error);
        return throwError(() => error);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log(`💬 Creating tenant-caretaker chat for property ${propertyId}`);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          console.log('✅ Tenant-caretaker chat created successfully:', newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating tenant-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log(`💬 Creating landlord-caretaker chat for property ${propertyId}`);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          console.log('✅ Landlord-caretaker chat created successfully:', newRoom);
        }
      }),
      catchError(error => {
        console.error('❌ Error creating landlord-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  selectRoom(room: ChatRoom | null): void {
    console.log('🎯 Selecting room:', room);
    
    this.currentRoomSubject.next(room);
    this.messagesSubject.next([]);
    
    if (room?.id) {
      this.getMessages(room.id);
    } else {
      this.unsubscribeFromAllRooms();
    }
  }

  formatTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    return timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  formatMessageTime(timestamp: Date): string {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return '';
    }
    
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

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.roomSubscriptions.clear();
    }
  }

  getCurrentUserId(): number {
    const user = this.authService.getCurrentUser();
    const userId = user?.id ? Number(user.id) : 0;
    return userId;
  }

  isMyMessage(message: Message): boolean {
    return message.senderId === this.getCurrentUserId();
  }

  getConnectionStatus(): boolean {
    return this.connectedSubject.value;
  }

  reconnect(): void {
    console.log('🔄 Manual reconnection requested');
    this.disconnect();
    setTimeout(() => {
      this.initializeWebSocketConnection();
    }, 1000);
  }
}