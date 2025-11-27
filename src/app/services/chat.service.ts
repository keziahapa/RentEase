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

  private readonly MESSAGES_STORAGE_KEY = 'chat_messages';
  private readonly ROOMS_STORAGE_KEY = 'chat_rooms';
  private readonly CURRENT_ROOM_STORAGE_KEY = 'chat_current_room';

  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {
    this.initializeService();
  }

  private initializeService(): void {
    this.loadFromLocalStorage();

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
        this.clearLocalStorage();
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
    return throwError(() => new Error('An error occurred. Please try again.'));
  }

  private saveToLocalStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const messages = this.messagesSubject.value;
        const rooms = this.roomsSubject.value;
        const currentRoom = this.currentRoomSubject.value;
        
        localStorage.setItem(this.MESSAGES_STORAGE_KEY, JSON.stringify(messages));
        localStorage.setItem(this.ROOMS_STORAGE_KEY, JSON.stringify(rooms));
        localStorage.setItem(this.CURRENT_ROOM_STORAGE_KEY, JSON.stringify(currentRoom));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedMessages = localStorage.getItem(this.MESSAGES_STORAGE_KEY);
        const savedRooms = localStorage.getItem(this.ROOMS_STORAGE_KEY);
        const savedCurrentRoom = localStorage.getItem(this.CURRENT_ROOM_STORAGE_KEY);
        
        if (savedMessages) {
          const messages: Message[] = JSON.parse(savedMessages).map((msg: any) => ({
            ...msg,
            sentAt: new Date(msg.sentAt),
            timestamp: new Date(msg.timestamp)
          }));
          this.messagesSubject.next(messages);
        }
        
        if (savedRooms) {
          const rooms: ChatRoom[] = JSON.parse(savedRooms).map((room: any) => ({
            ...room,
            createdAt: new Date(room.createdAt),
            updatedAt: new Date(room.updatedAt),
            participants: room.participants?.map((p: any) => ({
              ...p,
              lastSeen: p.lastSeen ? new Date(p.lastSeen) : undefined,
              joinedAt: p.joinedAt ? new Date(p.joinedAt) : undefined
            })) || [],
            lastMessage: room.lastMessage ? {
              ...room.lastMessage,
              sentAt: new Date(room.lastMessage.sentAt),
              timestamp: new Date(room.lastMessage.timestamp)
            } : null
          }));
          this.roomsSubject.next(rooms);
        }

        if (savedCurrentRoom && savedCurrentRoom !== 'null') {
          const currentRoom: ChatRoom = JSON.parse(savedCurrentRoom);
          if (currentRoom) {
            currentRoom.createdAt = new Date(currentRoom.createdAt);
            currentRoom.updatedAt = new Date(currentRoom.updatedAt);
            currentRoom.participants = currentRoom.participants?.map((p: any) => ({
              ...p,
              lastSeen: p.lastSeen ? new Date(p.lastSeen) : undefined,
              joinedAt: p.joinedAt ? new Date(p.joinedAt) : undefined
            })) || [];
            currentRoom.lastMessage = currentRoom.lastMessage ? {
              ...currentRoom.lastMessage,
              sentAt: new Date(currentRoom.lastMessage.sentAt),
              timestamp: new Date(currentRoom.lastMessage.timestamp)
            } : null;
            
            this.currentRoomSubject.next(currentRoom);
          }
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.MESSAGES_STORAGE_KEY);
        localStorage.removeItem(this.ROOMS_STORAGE_KEY);
        localStorage.removeItem(this.CURRENT_ROOM_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  private initializeWebSocketConnection(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      if (!this.authService.isAuthenticated()) {
        return;
      }

      if (this.stompClient) {
        this.stompClient.deactivate();
      }
      
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
        this.connectedSubject.next(true);
        this.connectionAttempts = 0;
        
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
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onWebSocketError = (event) => {
        this.connectedSubject.next(false);
        this.attemptReconnection();
      };

      this.stompClient.onDisconnect = (frame) => {
        this.connectedSubject.next(false);
        this.roomSubscriptions.clear();
      };

      this.stompClient.activate();
    } catch (error) {
      this.connectedSubject.next(false);
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      this.connectionAttempts++;
      
      setTimeout(() => {
        if (this.authService.isAuthenticated()) {
          this.initializeWebSocketConnection();
        }
      }, this.RECONNECT_DELAY * this.connectionAttempts);
    }
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      if (!messageData.chatRoomId) {
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
      this.saveToLocalStorage();
      
      if (message.chatRoomId) {
        this.updateRoomLastMessage(message.chatRoomId, message);
      }
    }
  }

  private removeMessage(messageId: number): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(m => m.id !== messageId);
    this.messagesSubject.next(updatedMessages);
    this.saveToLocalStorage();
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
    this.saveToLocalStorage();
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
    if (!this.authService.isAuthenticated()) {
      return;
    }

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

  loadRooms(): void {
    if (!this.authService.isAuthenticated()) {
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
        return of([]);
      })
    ).subscribe(rooms => {
      const processedRooms = rooms.map(room => this.processRoomData(room));
      this.roomsSubject.next(processedRooms);
      this.saveToLocalStorage();
    });
  }

  getMessages(roomId: number): void {
    if (!this.authService.isAuthenticated()) {
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
        return of([]);
      })
    ).subscribe(messages => {
      const processedMessages = messages.map(msg => this.processMessageData(msg))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.messagesSubject.next(processedMessages);
      this.saveToLocalStorage();
      
      this.subscribeToRoom(roomId);
    });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId,
      messageType: 'TEXT'
    };

    const optimisticMessage: Message = {
      id: Date.now(),
      content: content,
      senderId: this.getCurrentUserId(),
      senderName: 'You',
      senderEmail: '',
      chatRoomId: roomId,
      sentAt: new Date(),
      timestamp: new Date(),
      messageType: 'TEXT',
      status: 'SENDING',
      canDelete: true
    };
    
    this.addMessage(optimisticMessage);

    if (this.stompClient && this.stompClient.connected) {
      try {
        this.stompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageRequest),
          headers: {
            'Authorization': `Bearer ${this.getWsToken()}`,
            'content-type': 'application/json'
          }
        });
        
        return of({ success: true, message: 'Message sent via WebSocket' } as ApiResponse);
        
      } catch (error) {
        console.error('WebSocket publish error:', error);
      }
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          this.handleIncomingMessage(response.data);
        } else {
          this.updateMessageStatus(optimisticMessage.id, { ...optimisticMessage, status: 'FAILED' });
        }
      }),
      catchError(error => {
        this.updateMessageStatus(optimisticMessage.id, { ...optimisticMessage, status: 'FAILED' });
        return this.handleApiError(error);
      })
    );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(10000),
      tap(response => {
        if (response.success) {
          this.removeMessage(messageId);
        }
      }),
      catchError(error => {
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

  private updateMessageStatus(messageId: number, updatedMessage: Message): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => 
      msg.id === messageId ? updatedMessage : msg
    );
    this.messagesSubject.next(updatedMessages);
    this.saveToLocalStorage();
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/landlord/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          this.saveToLocalStorage();
        }
      }),
      catchError(error => {
        return this.handleApiError(error);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/tenant/caretaker/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          this.saveToLocalStorage();
        }
      }),
      catchError(error => {
        return this.handleApiError(error);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/caretaker/${propertyId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          this.saveToLocalStorage();
        }
      }),
      catchError(error => {
        return this.handleApiError(error);
      })
    );
  }

  createLandlordTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/landlord/tenant/${unitId}`,
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          const newRoom = this.processRoomData(response.data);
          this.roomsSubject.next([...currentRooms, newRoom]);
          this.saveToLocalStorage();
        }
      }),
      catchError(error => {
        return this.handleApiError(error);
      })
    );
  }

  createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
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
          this.saveToLocalStorage();
        }
      }),
      catchError(error => {
        return this.handleApiError(error);
      })
    );
  }

  selectRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    this.saveToLocalStorage();
    
    if (room?.id) {
      this.getMessages(room.id);
      this.markRoomAsRead(room.id);
    } else {
      this.messagesSubject.next([]);
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
    this.saveToLocalStorage();
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

  canAccessChat(): boolean {
    return this.authService.isAuthenticated() && !!this.authService.getToken();
  }

  clearLocalData(): void {
    this.messagesSubject.next([]);
    this.roomsSubject.next([]);
    this.currentRoomSubject.next(null);
    this.roomSubscriptions.clear();
    this.clearLocalStorage();
  }
}