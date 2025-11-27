// chat.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of, timer } from 'rxjs';
import { catchError, tap, map, retryWhen, delayWhen, take, switchMap, timeout } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { 
  Message, 
  ChatRoom, 
  SendMessageRequest, 
  ApiResponse,
  Participant  
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
    // Initialize only if authenticated
    if (this.authService.isAuthenticated()) {
      this.initializeWebSocketConnection();
      this.loadRooms();
    }

    // Listen for authentication changes
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.reconnect();
      } else {
        this.disconnect();
      }
    });
  }

  private getHeaders(): HttpHeaders {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    let authHeader = token;
    if (!token.startsWith('Bearer ')) {
      authHeader = `Bearer ${token}`;
    }
    
    return new HttpHeaders({
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    });
  }

  private handleApiError(error: any): Observable<never> {
    console.error('API Error:', error);

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          console.error('Authentication failed - Token expired or invalid');
          // Attempt token refresh
          this.authService.refreshToken().subscribe({
            next: (refreshed) => {
              if (refreshed) {
                console.log('Token refreshed successfully, retrying operation');
                // Retry the original operation after refresh
                this.reconnect();
              } else {
                console.error('Token refresh failed, redirecting to login');
                this.authService.logoutSync();
              }
            },
            error: (refreshError) => {
              console.error('Token refresh error:', refreshError);
              this.authService.logoutSync();
            }
          });
          return throwError(() => new Error('Authentication failed. Please login again.'));

        case 403:
          console.error('Access forbidden');
          return throwError(() => new Error('You do not have permission to perform this action.'));

        case 404:
          console.error('Resource not found');
          return throwError(() => new Error('The requested resource was not found.'));

        case 500:
          console.error('Server error');
          return throwError(() => new Error('Server error. Please try again later.'));

        default:
          console.error('HTTP error:', error.status, error.message);
          return throwError(() => new Error('An unexpected error occurred. Please try again.'));
      }
    }
    
    console.error('Network error:', error);
    return throwError(() => new Error('Network error. Please check your connection.'));
  }

  private retryWithBackoff(maxRetries: number, delay: number) {
    return (source: Observable<any>) =>
      source.pipe(
        retryWhen(errors =>
          errors.pipe(
            delayWhen((error, retryCount) => {
              if (retryCount >= maxRetries) {
                throw error;
              }
              const backoffDelay = delay * Math.pow(2, retryCount);
              console.log(`Retry ${retryCount + 1}/${maxRetries} after ${backoffDelay}ms`);
              return timer(backoffDelay);
            }),
            take(maxRetries)
          )
        )
      );
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      if (!this.authService.isAuthenticated()) {
        console.warn('User not authenticated, skipping WebSocket connection');
        return;
      }

      const token = this.authService.getToken();
      if (!token) {
        console.error('No token available for WebSocket connection');
        return;
      }

      console.log('Initializing WebSocket connection...');
      
      const socket = new SockJS(this.wsUrl);
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectHeaders: {
          'Authorization': `Bearer ${token}`
        },
        debug: (str) => {
          // Only log important debug messages
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
          this.handleIncomingMessage(JSON.parse(message.body));
        });

        const userDeletedSubscription = this.stompClient!.subscribe('/user/queue/messages/deleted', (message: IMessage) => {
          this.handleMessageDeleted(JSON.parse(message.body));
        });

        this.roomSubscriptions.set('/user/queue/messages', userMessagesSubscription);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeletedSubscription);

        // Subscribe to current room if available
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          this.subscribeToRoom(currentRoom.id);
        }

        // Reload rooms to ensure data is fresh
        this.loadRooms();
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
      
      if (this.currentRoomSubject.value?.id === message.chatRoomId) {
        this.markMessageAsRead(message.chatRoomId, message.id);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error, messageData);
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
    const processedRoom: ChatRoom = {
      id: Number(room.id) || 0,
      name: room.name || 'Unknown Chat',
      type: room.type || 'DIRECT',
      propertyId: Number(room.propertyId) || 0,
      propertyName: room.propertyName || '',
      unitId: Number(room.unitId) || undefined,
      unitNumber: room.unitNumber || '',
      participants: this.processParticipants(room.participants || room.users || []),
      lastMessage: room.lastMessage ? this.processMessageData(room.lastMessage) : null,
      unreadCount: Number(room.unreadCount) || 0,
      isGroup: room.isGroup || false,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      updatedAt: room.updatedAt ? new Date(room.updatedAt) : new Date()
    };

    this.enrichRoomWithTenantData(processedRoom);
    
    return processedRoom;
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

      if (processedParticipant.role === 'TENANT' && !processedParticipant.unitNumber) {
        this.enrichTenantWithUnitData(processedParticipant);
      }

      return processedParticipant;
    });
  }

  private enrichTenantWithUnitData(participant: Participant): void {
    if (participant.id === this.getCurrentUserId()) {
      this.tenantService.getTenantUnits().subscribe({
        next: (response) => {
          const units = Array.isArray(response?.data) ? response.data : [];
          if (units.length > 0) {
            const primaryUnit = units[0];
            participant.unitNumber = primaryUnit.unitNumber || 'N/A';
            participant.propertyId = primaryUnit.propertyId;
          }
        },
        error: (error) => {
          console.error('Error enriching tenant data:', error);
        }
      });
    }
  }

  private enrichRoomWithTenantData(room: ChatRoom): void {
    if (room.type === 'landlord-tenant' || room.type === 'tenant-landlord' || room.type === 'caretaker-tenant') {
      room.participants.forEach(participant => {
        if (participant.role === 'TENANT' && !participant.unitNumber) {
          this.enrichTenantWithUnitData(participant);
        }
      });
    }
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
      } catch (error) {
        console.error('Error subscribing to room:', error);
      }
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const subscription = this.roomSubscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.roomSubscriptions.delete(topic);
    }
  }

  private markMessageAsRead(roomId: number, messageId: number): void {
    if (!this.authService.isAuthenticated()) return;

    this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error marking message as read:', error);
        return of(null);
      })
    ).subscribe();
  }

  // MARK: - Public API Methods

  loadRooms(): void {
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated, skipping room load');
      return;
    }

    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading rooms:', error);
        return this.handleApiError(error);
      })
    ).subscribe(rooms => {
      const processedRooms = rooms.map(room => this.processRoomData(room));
      this.roomsSubject.next(processedRooms);
    });
  }

  getMessages(roomId: number): void {
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated, skipping message load');
      return;
    }

    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      map(response => {
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading messages:', error);
        return this.handleApiError(error);
      })
    ).subscribe(messages => {
      const processedMessages = messages.map(msg => this.processMessageData(msg))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.messagesSubject.next(processedMessages);
      
      this.subscribeToRoom(roomId);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId
    };

    // Try to send via WebSocket first if connected
    if (this.stompClient && this.stompClient.connected) {
      try {
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageRequest),
          headers: {
            'Authorization': `Bearer ${this.authService.getToken()}`
          }
        });
      } catch (error) {
        console.error('Error publishing message via WebSocket:', error);
      }
    }

    // Always send via HTTP as fallback
    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          this.handleIncomingMessage(response.data);
        }
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        return this.handleApiError(error);
      })
    );
  }

  // MISSING METHOD: deleteMessage
  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Try to notify via WebSocket first
    if (this.stompClient && this.stompClient.connected) {
      const deleteRequest = { messageId: messageId };
      this.stompClient.publish({
        destination: '/app/chat.deleteMessage',
        body: JSON.stringify(deleteRequest),
        headers: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      });
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(() => {
        console.log('Message deleted:', messageId);
        this.removeMessage(messageId);
      }),
      catchError(error => {
        console.error('Error deleting message:', error);
        return this.handleApiError(error);
      })
    );
  }

  // MISSING METHOD: deleteMultipleMessages
  deleteMultipleMessages(messageIds: number[]): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages/batch-delete`, messageIds, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(() => {
        console.log('Messages deleted:', messageIds);
        messageIds.forEach(messageId => this.removeMessage(messageId));
      }),
      catchError(error => {
        console.error('Error deleting multiple messages:', error);
        return this.handleApiError(error);
      })
    );
  }

  // MISSING METHOD: markMessageAsDelivered
  markMessageAsDelivered(roomId: number, messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-delivered`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      catchError(error => {
        console.error('Error marking message as delivered:', error);
        return this.handleApiError(error);
      })
    );
  }

  // Enhanced chat creation methods with pre-flight auth check
  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.withAuthCheck(() => 
      this.http.post<ApiResponse<ChatRoom>>(
        `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`, 
        {}, 
        { headers: this.getHeaders() }
      ).pipe(
        timeout(10000),
        tap(response => {
          if (response.success && response.data) {
            const currentRooms = this.roomsSubject.value;
            const newRoom = this.processRoomData(response.data);
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }),
        catchError(error => {
          console.error('Error creating tenant-landlord chat:', error);
          return this.handleApiError(error);
        })
      )
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.withAuthCheck(() => 
      this.http.post<ApiResponse<ChatRoom>>(
        `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`, 
        {}, 
        { headers: this.getHeaders() }
      ).pipe(
        timeout(10000),
        tap(response => {
          if (response.success && response.data) {
            const currentRooms = this.roomsSubject.value;
            const newRoom = this.processRoomData(response.data);
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }),
        catchError(error => {
          console.error('Error creating tenant-caretaker chat:', error);
          return this.handleApiError(error);
        })
      )
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.withAuthCheck(() => 
      this.http.post<ApiResponse<ChatRoom>>(
        `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`, 
        {}, 
        { headers: this.getHeaders() }
      ).pipe(
        timeout(10000),
        tap(response => {
          if (response.success && response.data) {
            const currentRooms = this.roomsSubject.value;
            const newRoom = this.processRoomData(response.data);
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }),
        catchError(error => {
          console.error('Error creating landlord-caretaker chat:', error);
          return this.handleApiError(error);
        })
      )
    );
  }

  createLandlordTenantChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.withAuthCheck(() => 
      this.http.post<ApiResponse<ChatRoom>>(
        `${this.apiUrl}/rooms/landlord-tenant/${propertyId}`, 
        {}, 
        { headers: this.getHeaders() }
      ).pipe(
        timeout(10000),
        tap(response => {
          if (response.success && response.data) {
            const currentRooms = this.roomsSubject.value;
            const newRoom = this.processRoomData(response.data);
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }),
        catchError(error => {
          console.error('Error creating landlord-tenant chat:', error);
          return this.handleApiError(error);
        })
      )
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    return this.withAuthCheck(() => 
      this.http.post<ApiResponse<ChatRoom>>(
        `${this.apiUrl}/caretaker/tenant/${unitId}`, 
        {}, 
        { headers: this.getHeaders() }
      ).pipe(
        timeout(10000),
        tap(response => {
          if (response.success && response.data) {
            const currentRooms = this.roomsSubject.value;
            const newRoom = this.processRoomData(response.data);
            this.roomsSubject.next([...currentRooms, newRoom]);
          }
        }),
        catchError(error => {
          console.error('Error creating caretaker-tenant chat:', error);
          return this.handleApiError(error);
        })
      )
    );
  }

  // Helper method to ensure authentication before making requests
  private withAuthCheck<T>(requestFn: () => Observable<T>): Observable<T> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Check if token is about to expire
    if (this.authService.isTokenAboutToExpire()) {
      console.log('Token about to expire, refreshing before request...');
      return this.authService.refreshToken().pipe(
        switchMap(success => {
          if (success) {
            return requestFn();
          } else {
            return throwError(() => new Error('Authentication failed'));
          }
        })
      );
    }

    return requestFn();
  }

  selectRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    this.messagesSubject.next([]);
    
    if (room?.id) {
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
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
    const user = this.authService.getCurrentUser();
    
    if (!user?.id) {
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

  // Utility method to check if user can access chat features
  canAccessChat(): boolean {
    return this.authService.isAuthenticated() && !!this.authService.getToken();
  }

  // Method to clear all local data
  clearLocalData(): void {
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
    this.roomSubscriptions.clear();
  }
}