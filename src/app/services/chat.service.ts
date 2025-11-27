import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map, timeout, finalize } from 'rxjs/operators';
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
    this.initializeService();
  }

  private initializeService(): void {
    console.log('=== CHAT SERVICE INITIALIZATION ===');
    console.log('Initial Auth Status:', this.authService.isAuthenticated());

    if (this.authService.isAuthenticated()) {
      this.initializeWebSocketConnection();
      this.loadRooms();
    }

    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      console.log('Auth Status Changed:', isAuthenticated);
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
    if (!this.authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    let cleanToken = token;
    if (token.startsWith('Bearer ')) {
      cleanToken = token.substring(7);
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${cleanToken}`,
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
      console.log('=== INITIALIZING WEB SOCKET CONNECTION ===');
      
      if (typeof window === 'undefined') {
        console.log('Window undefined - skipping WebSocket initialization');
        return;
      }

      if (!this.authService.isAuthenticated()) {
        console.log('User not authenticated - skipping WebSocket initialization');
        return;
      }

      if (this.stompClient) {
        console.log('Deactivating existing STOMP client');
        this.stompClient.deactivate();
      }
      
      console.log('Creating new SockJS connection to:', this.wsUrl);
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
            console.log('STOMP Debug:', str);
          }
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('=== WEB SOCKET CONNECTED ===');
        console.log('STOMP Frame:', frame);
        this.connectedSubject.next(true);
        this.connectionAttempts = 0;
        
        // Subscribe to user-specific queues
        const userMessagesSubscription = this.stompClient!.subscribe('/user/queue/messages', (message: IMessage) => {
          console.log('Received message on /user/queue/messages:', message.body);
          this.handleIncomingMessage(JSON.parse(message.body));
        });

        const userDeletedSubscription = this.stompClient!.subscribe('/user/queue/messages/deleted', (message: IMessage) => {
          console.log('Received deletion on /user/queue/messages/deleted:', message.body);
          this.handleMessageDeleted(JSON.parse(message.body));
        });

        this.roomSubscriptions.set('/user/queue/messages', userMessagesSubscription);
        this.roomSubscriptions.set('/user/queue/messages/deleted', userDeletedSubscription);

        // Subscribe to current room if exists
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          console.log('Subscribing to current room:', currentRoom.id);
          this.subscribeToRoom(currentRoom.id);
        }

        console.log('WebSocket subscriptions active:', this.roomSubscriptions.size);
        this.loadRooms();
      };

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP Error:', frame);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onWebSocketError = (event) => {
        console.error('WebSocket Error:', event);
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onDisconnect = (frame) => {
        console.log('WebSocket Disconnected:', frame);
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      console.log('Activating STOMP client...');
      this.stompClient.activate();
    } catch (error) {
      console.error('Error initializing WebSocket connection:', error);
      this.connectedSubject.next(false);
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      this.connectionAttempts++;
      console.log(`Attempting reconnection ${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS}`);
      
      setTimeout(() => {
        if (this.authService.isAuthenticated()) {
          this.initializeWebSocketConnection();
        }
      }, this.RECONNECT_DELAY * this.connectionAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleIncomingMessage(messageData: any): void {
    console.log('=== HANDLE INCOMING MESSAGE ===');
    console.log('Raw message data:', messageData);
    
    try {
      if (!messageData.chatRoomId) {
        console.error('No chatRoomId in message:', messageData);
        return;
      }
      
      const message: Message = {
        id: Number(messageData.id || messageData.messageId || Date.now()),
        content: messageData.content || messageData.message || '',
        senderId: Number(messageData.senderId || messageData.sender?.id || this.getCurrentUserId()),
        senderName: messageData.senderName || messageData.sender?.name || messageData.sender?.fullName || 'Unknown User',
        senderEmail: messageData.senderEmail || messageData.sender?.email || '',
        chatRoomId: Number(messageData.chatRoomId || messageData.roomId),
        sentAt: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        timestamp: new Date(messageData.sentAt || messageData.timestamp || messageData.createdAt || Date.now()),
        messageType: messageData.messageType || 'TEXT',
        status: messageData.status || 'SENT',
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete || false
      };
      
      console.log('Processed message:', message);
      this.addMessage(message);
      
      if (this.currentRoomSubject.value?.id === message.chatRoomId) {
        console.log('Marking message as read for room:', message.chatRoomId);
        this.markMessageAsRead(message.chatRoomId, message.id);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error, messageData);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    console.log('=== HANDLE MESSAGE DELETION ===');
    console.log('Deletion data:', deletionData);
    
    try {
      if (deletionData.messageId) {
        console.log('Removing message:', deletionData.messageId);
        this.removeMessage(Number(deletionData.messageId));
      } else if (deletionData.messageIds) {
        console.log('Removing multiple messages:', deletionData.messageIds);
        deletionData.messageIds.forEach((messageId: number) => {
          this.removeMessage(Number(messageId));
        });
      }
    } catch (error) {
      console.error('Error handling message deletion:', error, deletionData);
    }
  }

  private addMessage(message: Message): void {
    console.log('=== ADDING MESSAGE ===');
    console.log('Message to add:', message);
    
    const currentMessages = this.messagesSubject.value;
    const messageExists = currentMessages.some(m => m.id === message.id);
    
    if (!messageExists) {
      const updatedMessages = [...currentMessages, message].sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      console.log('Messages after adding:', updatedMessages.length);
      this.messagesSubject.next(updatedMessages);
      
      if (message.chatRoomId) {
        console.log('Updating room last message for room:', message.chatRoomId);
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
    } else {
      console.log('Message already exists, skipping:', message.id);
    }
  }

  private removeMessage(messageId: number): void {
    console.log('=== REMOVING MESSAGE ===');
    console.log('Message ID to remove:', messageId);
    
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    console.log('Messages after removal:', updatedMessages.length);
    this.messagesSubject.next(updatedMessages);
  }

  private updateRoomLastMessage(roomId: number, message: Message): void {
    console.log('=== UPDATING ROOM LAST MESSAGE ===');
    console.log('Room ID:', roomId, 'Message:', message.content);
    
    const currentRooms = this.roomsSubject.value;
    const updatedRooms = currentRooms.map(room => {
      if (room.id === roomId) {
        const isCurrentRoom = this.currentRoomSubject.value?.id === roomId;
        const updatedRoom = { 
          ...room, 
          lastMessage: message,
          updatedAt: new Date(),
          unreadCount: isCurrentRoom ? 0 : (room.unreadCount || 0) + 1
        };
        console.log('Updated room:', updatedRoom);
        return updatedRoom;
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

    console.log('Processed room:', processedRoom);
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
      status: messageData.status || 'SENT',
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
      canDelete: messageData.canDelete || false
    };
    
    console.log('Processed message:', message);
    return message;
  }

  private processParticipants(participants: any[]): Participant[] {
    if (!participants || !Array.isArray(participants)) {
      return [];
    }

    const processed = participants.map((participant: any) => {
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

    console.log('Processed participants:', processed);
    return processed;
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.unsubscribeFromRoom(roomId);

      const topic = `/topic/chat/${roomId}`;
      try {
        console.log('Subscribing to room topic:', topic);
        const subscription = this.stompClient!.subscribe(topic, (message: IMessage) => {
          console.log('Received message on room topic:', message.body);
          this.handleIncomingMessage(JSON.parse(message.body));
        });
        this.roomSubscriptions.set(topic, subscription);
        console.log('Room subscription added:', topic);
      } catch (error) {
        console.error('Error subscribing to room:', error);
      }
    } else {
      console.log('STOMP client not connected, cannot subscribe to room');
    }
  }

  private unsubscribeFromRoom(roomId: number): void {
    const topic = `/topic/chat/${roomId}`;
    const subscription = this.roomSubscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.roomSubscriptions.delete(topic);
      console.log('Unsubscribed from room:', topic);
    }
  }

  private markMessageAsRead(roomId: number, messageId: number): void {
    if (!this.authService.isAuthenticated()) {
      console.log('Not authenticated, skipping mark as read');
      return;
    }

    console.log('Marking message as read - Room:', roomId, 'Message:', messageId);
    
    this.http.post<ApiResponse>(
      `${this.apiUrl}/rooms/${roomId}/mark-read`,
      { messageId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error marking message as read:', error);
        return of(null);
      })
    ).subscribe(response => {
      console.log('Mark as read response:', response);
    });
  }

  loadRooms(): void {
    if (!this.authService.isAuthenticated()) {
      console.log('Not authenticated, skipping room load');
      return;
    }

    console.log('Loading rooms...');
    
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      map(response => {
        console.log('Rooms API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading rooms:', error);
        return of([]);
      })
    ).subscribe(rooms => {
      console.log('Raw rooms data:', rooms);
      const processedRooms = rooms.map(room => this.processRoomData(room));
      console.log('Processed rooms:', processedRooms);
      this.roomsSubject.next(processedRooms);
    });
  }

  getMessages(roomId: number): void {
    if (!this.authService.isAuthenticated()) {
      console.log('Not authenticated, skipping messages load');
      return;
    }

    console.log('Loading messages for room:', roomId);
    
    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      map(response => {
        console.log('Messages API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading messages:', error);
        return of([]);
      })
    ).subscribe(messages => {
      console.log('Raw messages data:', messages);
      const processedMessages = messages.map(msg => this.processMessageData(msg))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      console.log('Processed messages:', processedMessages);
      this.messagesSubject.next(processedMessages);
      
      this.subscribeToRoom(roomId);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    console.log('=== SEND MESSAGE DEBUG ===');
    console.log('Content:', content);
    console.log('Room ID:', roomId);
    console.log('Authenticated:', this.authService.isAuthenticated());
    console.log('WebSocket Connected:', this.stompClient?.connected);
    console.log('STOMP Client exists:', !!this.stompClient);

    if (!this.authService.isAuthenticated()) {
      console.error('User not authenticated');
      return throwError(() => new Error('User not authenticated'));
    }

    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId
    };

    console.log('Message Request:', messageRequest);

    // Try WebSocket first
    if (this.stompClient && this.stompClient.connected) {
      try {
        console.log('Sending via WebSocket to /app/chat.sendMessage');
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageRequest),
          headers: {
            'Authorization': `Bearer ${this.getWsToken()}`
          }
        });
        console.log('Message sent via WebSocket');
        
        // Create optimistic message
        const optimisticMessage: Message = {
          id: Date.now(), // Temporary ID
          content: content,
          senderId: this.getCurrentUserId(),
          senderName: 'You',
          senderEmail: '',
          chatRoomId: roomId,
          sentAt: new Date(),
          timestamp: new Date(),
          messageType: 'TEXT',
          status: 'SENDING',
          canDelete: false
        };
        this.addMessage(optimisticMessage);
        
        return of({ success: true, message: 'Message sent via WebSocket' } as ApiResponse);
      } catch (error) {
        console.error('Error publishing message via WebSocket:', error);
      }
    } else {
      console.log('WebSocket not available, falling back to HTTP');
    }

    // Fallback to HTTP
    console.log('Sending via HTTP POST to:', `${this.apiUrl}/messages`);
    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(response => {
        console.log('HTTP RESPONSE:', response);
        if (response.success && response.data) {
          console.log('Processing response data:', response.data);
          this.handleIncomingMessage(response.data);
        }
      }),
      catchError(error => {
        console.error('HTTP Error sending message:', error);
        console.error('Error details:', error.error);
        return this.handleApiError(error);
      })
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    console.log('Deleting message:', messageId);
    
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(() => {
        console.log('Message deleted successfully:', messageId);
        this.removeMessage(messageId);
      }),
      catchError(error => {
        console.error('Error deleting message:', error);
        return this.handleApiError(error);
      })
    );
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('Creating tenant-landlord chat for property:', propertyId);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/landlord/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        console.log('Create chat response:', response);
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
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('Creating tenant-caretaker chat for property:', propertyId);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/caretaker/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        console.log('Create chat response:', response);
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
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('Creating landlord-caretaker chat for property:', propertyId);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/caretaker/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        console.log('Create chat response:', response);
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
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('Creating landlord-tenant chat for unit:', unitId);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        console.log('Create chat response:', response);
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
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    console.log('Creating caretaker-tenant chat for unit:', unitId);
    
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/caretaker/tenant/${unitId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        console.log('Create chat response:', response);
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
    );
  }

  selectRoom(room: ChatRoom | null): void {
    console.log('Selecting room:', room);
    this.currentRoomSubject.next(room);
    this.messagesSubject.next([]);
    
    if (room?.id) {
      console.log('Loading messages for selected room:', room.id);
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
    } else {
      console.log('No room selected or room has no ID');
    }
  }

  private markRoomAsRead(roomId: number): void {
    console.log('Marking room as read:', roomId);
    
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
      console.log('No user ID found');
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
    const isMine = message.senderId === currentUserId;
    console.log('Checking if message is mine:', message.id, 'Current User:', currentUserId, 'Sender:', message.senderId, 'Is Mine:', isMine);
    return isMine;
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

  // Debug methods
  checkConnectionStatus(): void {
    console.log('=== CONNECTION STATUS ===');
    console.log('Auth Status:', this.authService.isAuthenticated());
    console.log('WebSocket Connected:', this.connectedSubject.value);
    console.log('STOMP Client:', this.stompClient);
    console.log('STOMP Connected:', this.stompClient?.connected);
    console.log('Current Room:', this.currentRoomSubject.value);
    console.log('Room Subscriptions:', this.roomSubscriptions.size);
    console.log('Current Messages:', this.messagesSubject.value.length);
    console.log('Current Rooms:', this.roomsSubject.value.length);
  }

  testSendMessage(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom) {
      console.log('=== TEST SEND MESSAGE ===');
      this.sendMessage('Test message ' + new Date().toISOString(), currentRoom.id).subscribe({
        next: (response) => console.log('Test send success:', response),
        error: (error) => console.error('Test send error:', error)
      });
    } else {
      console.log('No current room selected for test');
    }
  }

  disconnect(): void {
    console.log('Disconnecting chat service...');
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
    console.log('Manual reconnection requested');
    this.disconnect();
    setTimeout(() => {
      if (this.authService.isAuthenticated()) {
        this.initializeWebSocketConnection();
        this.loadRooms();
      }
    }, 1000);
  }

  canAccessChat(): boolean {
    const canAccess = this.authService.isAuthenticated() && !!this.authService.getToken();
    console.log('Can access chat:', canAccess);
    return canAccess;
  }

  clearLocalData(): void {
    console.log('Clearing local chat data');
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
    this.roomSubscriptions.clear();
  }
}