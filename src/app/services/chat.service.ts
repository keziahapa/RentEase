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
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private initializeWebSocketConnection(): void {
    try {
      const socket = new SockJS('https://rentease-3-sfgx.onrender.com/ws');
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        debug: (str) => console.log('STOMP: ' + str),
        reconnectDelay: 5000,
        connectHeaders: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      });

      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket Connected');
        this.connectedSubject.next(true);
        
        // Subscribe to user queue
        const userId = this.authService.getCurrentUser()?.id;
        if (userId) {
          const userIdNum = Number(userId);
          this.stompClient.subscribe(`/user/${userIdNum}/queue/messages`, (message: IMessage) => {
            this.handleIncomingMessage(JSON.parse(message.body));
          });

          this.stompClient.subscribe(`/user/${userIdNum}/queue/messages/deleted`, (message: IMessage) => {
            this.handleMessageDeleted(JSON.parse(message.body));
          });
        }

        // Subscribe to current room if exists
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom?.id) {
          this.subscribeToRoom(currentRoom.id);
        }
      };

      this.stompClient.onStompError = (frame) => {
        console.error('STOMP Error:', frame);
        this.connectedSubject.next(false);
      };

      this.stompClient.activate();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.connectedSubject.next(false);
    }
  }

  private handleIncomingMessage(messageData: any): void {
    try {
      const message: Message = {
        id: Number(messageData.id),
        content: messageData.content || '',
        senderId: Number(messageData.senderId),
        senderName: messageData.senderName,
        senderEmail: messageData.senderEmail,
        chatRoomId: Number(messageData.chatRoomId),
        sentAt: new Date(messageData.sentAt),
        timestamp: new Date(messageData.sentAt),
        messageType: messageData.messageType || 'TEXT',
        status: messageData.status || 'SENT',
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize ? Number(messageData.fileSize) : undefined,
        canDelete: messageData.canDelete
      };
      this.addMessage(message);
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private handleMessageDeleted(deletionData: any): void {
    if (deletionData.messageId) {
      this.removeMessage(Number(deletionData.messageId));
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
        return { ...room, lastMessage: message };
      }
      return room;
    });
    this.roomsSubject.next(updatedRooms);
  }

  private subscribeToRoom(roomId: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.subscribe(`/topic/chat/${roomId}`, (message: IMessage) => {
        this.handleIncomingMessage(JSON.parse(message.body));
      });

      this.stompClient.subscribe(`/topic/chat/${roomId}/deleted`, (message: IMessage) => {
        this.handleMessageDeleted(JSON.parse(message.body));
      });
    }
  }

  // Public API Methods
  loadRooms(): void {
    this.http.get<ApiResponse<ChatRoom[]>>(`${this.apiUrl}/rooms`, { headers: this.getHeaders() })
      .pipe(
        map(response => response.data || []),
        catchError(error => {
          console.error('Error loading rooms:', error);
          return of([]);
        })
      )
      .subscribe(rooms => {
        // Ensure all rooms have required properties
        const processedRooms = rooms.map(room => ({
          id: Number(room.id) || 0,
          name: room.name || 'Unknown Chat',
          type: room.type || '',
          propertyId: Number(room.propertyId) || 0,
          propertyName: room.propertyName || '',
          participants: room.participants || [],
          lastMessage: room.lastMessage,
          unreadCount: Number(room.unreadCount) || 0,
          isGroup: room.isGroup || false,
          createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
          updatedAt: room.updatedAt ? new Date(room.updatedAt) : new Date()
        }));
        this.roomsSubject.next(processedRooms);
      });
  }

  getMessages(roomId: number): void {
    this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/rooms/${roomId}/messages`, { headers: this.getHeaders() })
      .pipe(
        map(response => response.data || []),
        catchError(error => {
          console.error('Error loading messages:', error);
          return of([]);
        })
      )
      .subscribe(messages => {
        const processedMessages = messages.map(msg => ({
          id: Number(msg.id),
          content: msg.content || '',
          senderId: Number(msg.senderId),
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
          chatRoomId: Number(msg.chatRoomId),
          sentAt: new Date(msg.sentAt),
          timestamp: new Date(msg.sentAt),
          messageType: msg.messageType || 'TEXT',
          status: msg.status || 'SENT',
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize ? Number(msg.fileSize) : undefined,
          canDelete: msg.canDelete
        }));
        this.messagesSubject.next(processedMessages);
      });
  }

  sendMessage(content: string, roomId: number): Observable<ApiResponse> {
    const messageRequest: SendMessageRequest = {
      content: content,
      chatRoomId: roomId
    };

    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(messageRequest)
      });
    }

    return this.http.post<ApiResponse>(`${this.apiUrl}/messages`, messageRequest, { headers: this.getHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error sending message:', error);
          return throwError(() => error);
        })
      );
  }

  deleteMessage(messageId: number): Observable<ApiResponse> {
    if (this.stompClient && this.stompClient.connected) {
      const deleteRequest = { messageId: messageId };
      this.stompClient.publish({
        destination: '/app/chat.deleteMessage',
        body: JSON.stringify(deleteRequest)
      });
    }

    return this.http.delete<ApiResponse>(`${this.apiUrl}/messages/${messageId}`, { headers: this.getHeaders() })
      .pipe(
        tap(() => {
          this.removeMessage(messageId);
        }),
        catchError(error => {
          console.error('Error deleting message:', error);
          return throwError(() => error);
        })
      );
  }

  createTenantLandlordChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-landlord/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          this.roomsSubject.next([...currentRooms, response.data]);
        }
      }),
      catchError(error => {
        console.error('Error creating tenant-landlord chat:', error);
        return throwError(() => error);
      })
    );
  }

  createTenantCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/tenant-caretaker/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          this.roomsSubject.next([...currentRooms, response.data]);
        }
      }),
      catchError(error => {
        console.error('Error creating tenant-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  createLandlordCaretakerChat(propertyId: number): Observable<ApiResponse<ChatRoom>> {
    return this.http.post<ApiResponse<ChatRoom>>(
      `${this.apiUrl}/rooms/landlord-caretaker/${propertyId}`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRooms = this.roomsSubject.value;
          this.roomsSubject.next([...currentRooms, response.data]);
        }
      }),
      catchError(error => {
        console.error('Error creating landlord-caretaker chat:', error);
        return throwError(() => error);
      })
    );
  }

  selectRoom(room: ChatRoom | null): void {
    this.currentRoomSubject.next(room);
    this.messagesSubject.next([]);
    
    if (room?.id) {
      this.getMessages(room.id);
    }
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  formatMessageTime(timestamp: Date): string {
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
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }

  getCurrentUserId(): number {
    const user = this.authService.getCurrentUser();
    return user?.id ? Number(user.id) : 0;
  }

  isMyMessage(message: Message): boolean {
    return message.senderId === this.getCurrentUserId();
  }
}