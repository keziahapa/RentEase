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
  ApiResponse
} from './chat.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'https://rentease-4.onrender.com/api/chat';
  private wsUrl = 'https://rentease-3-sfgx.onrender.com/ws';
  private stompClient: Client | null = null;
  private roomSubscriptions: Map<string, any> = new Map();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private roomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private currentRoomSubject = new BehaviorSubject<ChatRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private eatTimeZone = 'Africa/Nairobi';
  private eatLocale = 'en-KE';

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
      console.warn('No authentication token available');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

 
  markMessageAsDelivered(roomId: number, messageId: number): Observable<ApiResponse> {
    if (!roomId || !messageId) {
      return throwError(() => new Error('Room ID and Message ID are required'));
    }

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-delivered`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        console.log(`Marked message ${messageId} as delivered in room ${roomId}`);
      }),
      catchError(error => {
        console.error('Error marking message as delivered:', error);
        return throwError(() => error);
      })
    );
  }

 
  private markMessageAsRead(roomId: number, messageId: number): void {
    this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        console.log(`Marked message ${messageId} as read in room ${roomId}`);
      },
      error: (error) => console.error('Error marking message as read:', error)
    });
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      if (!messageData.chatRoomId) {
        console.warn('Received message without chatRoomId:', messageData);
        return;
      }
      
      const message: Message = {
        id: Number(messageData.id),
        content: messageData.content || '',
        senderId: Number(messageData.senderId),
        senderName: messageData.senderName || messageData.sender?.name || 'Unknown User',
        senderEmail: messageData.senderEmail || messageData.sender?.email || '',
        chatRoomId: Number(messageData.chatRoomId),
        sentAt: new Date(messageData.sentAt || messageData.timestamp),
        timestamp: new Date(messageData.sentAt || messageData.timestamp),
        messageType: messageData.messageType || 'TEXT',
        status: messageData.status || 'SENT',
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false
      };
      
      this.addMessage(message);
      
      const currentRoom = this.currentRoomSubject.value;
      if (currentRoom?.id === message.chatRoomId) {
       
        this.markMessageAsDelivered(message.chatRoomId, message.id).subscribe();
        
        
        this.markMessageAsRead(message.chatRoomId, message.id);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error, messageData);
    }
  }

  
  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const token = this.authService.getToken();
      if (!token) {
        console.warn('No token available for WebSocket connection');
        return;
      }

      const socket = new SockJS(this.wsUrl);
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket connected successfully');
        this.connectedSubject.next(true);
        
        const userMessagesSubscription = this.stompClient!.subscribe('/user/queue/messages', (message: IMessage) => {
          this.handleIncomingMessage(JSON.parse(message.body));
        });

        const userDeletedSubscription = this.stompClient!.subscribe('/user/queue/messages/deleted', (message: IMessage) => {
          this.handleMessageDeleted(JSON.parse(message.body));
        });

        this.roomSubscriptions.set('/user/queue/messages', userMessagesSubscription);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeletedSubscription);

        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('WebSocket STOMP error:', frame);
        this.connectedSubject.next(false);
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('WebSocket connection error:', event);
        this.connectedSubject.next(false);
      };

      this.stompClient.onDisconnect = (frame) => {
        console.log('WebSocket disconnected');
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.connectedSubject.next(false);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    try {
      if (deletionData.messageId) {
        this.removeMessage(Number(deletionData.messageId));
      } else if (deletionData.messageIds) {
        deletionData.messageIds.forEach((messageId: number) => {
          this.removeMessage(Number(messageId));
        });
      }
    } catch (error) {
      console.error('Error handling message deletion:', error, deletionData);
    }
  }

  private addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    const messageExists = currentMessages.some(m => m.id === message.id);
    
    if (!messageExists) {
      const updatedMessages = [...currentMessages, message].sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      this.messagesSubject.next(updatedMessages);
      
      if (message.chatRoomId) {
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
    }
  }

  private removeMessage(messageId: number): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    this.messagesSubject.next(updatedMessages);
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
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
    return {
      id: Number(room.id) || 0,
      name: room.name || 'Unknown Chat',
      type: room.type || 'DIRECT',
      propertyId: Number(room.propertyId) || 0,
      propertyName: room.propertyName || '',
      participants: this.processParticipants(room.participants || room.users || []),
      lastMessage: room.lastMessage ? this.processMessageData(room.lastMessage) : null,
      unreadCount: Number(room.unreadCount) || 0,
      isGroup: room.isGroup || false,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      updatedAt: room.updatedAt ? new Date(room.updatedAt) : new Date()
    };
  }

  private processMessageData(messageData: any): Message {
    return {
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
  }

  private processParticipants(participants: any[]): any[] {
    if (!participants || !Array.isArray(participants)) {
      return [];
    }

    return participants.map((participant: any) => ({
      id: Number(participant.id || participant.userId),
      name: participant.name || participant.fullName || 'Unknown User',
      email: participant.email || '',
      role: participant.role || 'USER',
      avatar: participant.avatar,
      isOnline: participant.isOnline || false,
      lastSeen: participant.lastSeen,
      phoneNumber: participant.phoneNumber,
      profilePicture: participant.profilePicture,
      fullName: participant.fullName || participant.name
    }));
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.unsubscribeFromRoom(roomId);

      const topic = `/topic/chat/${roomId}`;
      try {
        const subscription = this.stompClient!.subscribe(topic, (message: IMessage) => {
          this.handleIncomingMessage(JSON.parse(message.body));
        });
        this.roomSubscriptions.set(topic, subscription);
        console.log(`Subscribed to room: ${topic}`);
      } catch (error) {
        console.error(`Failed to subscribe to ${topic}:`, error);
      }
    } else {
      console.warn('WebSocket not connected, cannot subscribe to room');
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const subscription = this.roomSubscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.roomSubscriptions.delete(topic);
      console.log(`Unsubscribed from room: ${topic}`);
    }
  }

  loadRooms(): void {
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        console.warn('Invalid rooms response format:', response);
        return [];
      }),
      catchError(error => {
        console.error('Error loading rooms:', error);
        return of([]);
      })
    ).subscribe(rooms => {
      const processedRooms = rooms.map(room => this.processRoomData(room));
      this.roomsSubject.next(processedRooms);
      console.log('Loaded rooms:', processedRooms.length);
    });
  }

  getMessages(roomId: number): void {
    if (!roomId) {
      console.error('Room ID is required to get messages');
      return;
    }

    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        console.warn('Invalid messages response format:', response);
        return [];
      }),
      catchError(error => {
        console.error(`Error loading messages for room ${roomId}:`, error);
        return of([]);
      })
    ).subscribe(messages => {
      const processedMessages = messages.map(msg => this.processMessageData(msg))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.messagesSubject.next(processedMessages);
      
      this.subscribeToRoom(roomId);
      console.log(`Loaded ${processedMessages.length} messages for room ${roomId}`);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!content.trim()) {
      return throwError(() => new Error('Message content cannot be empty'));
    }

    if (!roomId) {
      return throwError(() => new Error('Room ID is required'));
    }

    const messageRequest: SendMessageRequest = {
      content: content.trim(),
      chatRoomId: roomId
    };

    if (this.stompClient && this.stompClient.connected) {
      try {
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageRequest),
          headers: {
            'Authorization': `Bearer ${this.authService.getToken()}`
          }
        });
        console.log('Message sent via WebSocket');
      } catch (error) {
        console.error('WebSocket send error:', error);
      }
    } else {
      console.warn('WebSocket not connected, sending via HTTP only');
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          console.log('Message sent successfully via HTTP');
          this.handleIncomingMessage(response.data);
        } else {
          console.warn('Message send response:', response);
        }
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        return throwError(() => error);
      })
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!messageId) {
      return throwError(() => new Error('Message ID is required'));
    }

    if (this.stompClient && this.stompClient.connected) {
      try {
        const deleteRequest = { messageId: messageId };
        this.stompClient.publish({
          destination: '/app/chat.deleteMessage',
          body: JSON.stringify(deleteRequest),
          headers: {
            'Authorization': `Bearer ${this.authService.getToken()}`
          }
        });
        console.log('Delete request sent via WebSocket');
      } catch (error) {
        console.error('WebSocket delete error:', error);
      }
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(() => {
        this.removeMessage(messageId);
        console.log('Message deleted successfully');
      }),
      catchError(error => {
        console.error('Error deleting message:', error);
        return throwError(() => error);
      })
    );
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    if (!propertyId) {
      return throwError(() => new Error('Property ID is required'));
    }

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
          console.log('Created tenant-landlord chat:', newRoom);
        }
      }),
      catchError(error => {
        console.error('Error creating tenant-landlord chat:', error);
        return throwError(() => error);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    if (!propertyId) {
      return throwError(() => new Error('Property ID is required'));
    }

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
          console.log('Created tenant-caretaker chat:', newRoom);
        }
      }),
      catchError(error => {
        console.error('Error creating tenant-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    if (!propertyId) {
      return throwError(() => new Error('Property ID is required'));
    }

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
          console.log('Created landlord-caretaker chat:', newRoom);
        }
      }),
      catchError(error => {
        console.error('Error creating landlord-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    if (!unitId) {
      return throwError(() => new Error('Unit ID is required'));
    }

    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          console.log('Created landlord-tenant chat:', newRoom);
        }
      }),
      catchError(error => {
        console.error('Error creating landlord-tenant chat:', error);
        return throwError(() => error);
      })
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    if (!unitId) {
      return throwError(() => new Error('Unit ID is required'));
    }

    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/caretaker/tenant/${unitId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          console.log('Created caretaker-tenant chat:', newRoom);
        }
      }),
      catchError(error => {
        console.error('Error creating caretaker-tenant chat:', error);
        return throwError(() => error);
      })
    );
  }

  selectRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    this.messagesSubject.next([]);
    
    if (room?.id) {
      console.log('Selected room:', room.name, room.id);
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
    } else {
      console.log('Deselected room');
    }
  }

  private markRoomAsRead(roomId: number): void {
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
    try {
      const user = this.authService.getCurrentUser();
      
      if (!user?.id) {
        console.warn('No user ID found');
        return 0;
      }
      
      if (typeof user.id === 'number') {
        return user.id;
      }
      
      if (typeof user.id === 'string') {
        const parsedId = parseInt(user.id, 10);
        return isNaN(parsedId) ? 0 : parsedId;
      }
      
      console.warn('Unexpected user ID type:', typeof user.id);
      return 0;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return 0;
    }
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
      date.setHours(date.getHours() + 3);
      
      return date.toLocaleTimeString(this.eatLocale, { 
        timeZone: this.eatTimeZone,
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      const date = new Date(timestamp);
      date.setHours(date.getHours() + 3);
      
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
      messageTime.setHours(messageTime.getHours() + 3);
      
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
      messageTime.setHours(messageTime.getHours() + 3);
      
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
      console.log('Chat service disconnected');
    }
  }

  getConnectionStatus(): boolean {
    return this.connectedSubject.value;
  }

  reconnect(): void {
    console.log('Attempting to reconnect...');
    this.disconnect();
    setTimeout(() => {
      try {
        this.initializeWebSocketConnection();
        this.loadRooms();
        
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom) {
          setTimeout(() => this.subscribeToRoom(currentRoom.id), 1000);
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, 2000);
  }
}