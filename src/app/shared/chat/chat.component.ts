// src/app/components/chat/chat.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';

// Material imports
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ErrorAction } from '../../services/error-handler.interface';
import { ChatRoom, ChatMessage, CreateMessageRequest, BasicResponse, User, CreateChatRoomRequest } from '../../services/chat.interface';
import { ErrorDisplayComponent } from '../error-display.component/error-display.component';
import { NewChatModalComponent } from './new-chat-modal/new-chat-modal.component';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ErrorDisplayComponent,
    MatTooltipModule,
    MatDialogModule
  ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  // Component state
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUserId: number = 0;
  userRole: string = '';
  
  // UI state
  loading = false;
  sending = false;
  selectedRoomId: number | null = null;
  showMenu = false;
  showEmojiPicker = false;
  searchQuery = '';
  webSocketConnected = false;
  
  // Typing indicators
  typingUsers: {userId: number, userName: string}[] = [];
  isTyping = false;
  typingTimeout: any;
  
  // Emojis
  emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '❤️', '💕', '💖', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '💯', '🔥', '✨', '💫', '⭐'];
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  private webSocketSubscription?: Subscription;
  private connectionCheckSubscription?: Subscription;
  
  // Services - Make chatService and router public for template access
  public chatService = inject(ChatService);
  public authService = inject(AuthService);
  public router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorHandler = inject(ErrorHandlerService);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    try {
      this.initializeUser();
      this.loadChatRooms();
      this.subscribeToObservables();
      this.setupRouteListener();
      this.startConnectionHealthCheck();
    } catch (error) {
      console.error('Error initializing chat component:', error);
      this.errorHandler.error('Failed to initialize chat', 'Please refresh the page');
    }
  }

  private initializeUser(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentUserId = this.chatService.getCurrentUserId();
      this.userRole = currentUser.role || '';
    }
  }

  private subscribeToObservables(): void {
    // WebSocket connection status
    this.webSocketSubscription = this.chatService.getConnectionStatus().subscribe(connected => {
      this.webSocketConnected = connected;
      if (connected) {
        console.log('✅ WebSocket connected - real-time messaging enabled');
        this.errorHandler.info('Real-time chat connected', 2000);
      } else {
        console.warn('❌ WebSocket disconnected - using HTTP fallback');
      }
    });

    // Chat room changes
    this.subscriptions.push(
      this.chatService.currentRoom$.subscribe(room => {
        this.currentRoom = room;
        if (room) {
          this.selectedRoomId = room.id;
        }
      }),
      
      this.chatService.messages$.subscribe(messages => {
        this.messages = messages || [];
        setTimeout(() => this.scrollToBottom(), 100);
      }),
      
      this.chatService.chatRooms$.subscribe(rooms => {
        this.chatRooms = rooms || [];
        this.autoSelectRoomIfNeeded();
      }),
      
      // Fixed: Corrected typingUsers$ subscription
      this.chatService.typingUsers$.subscribe(users => {
        this.typingUsers = users || [];
      })
    );
  }

  private setupRouteListener(): void {
    this.route.params.subscribe(params => {
      if (params['roomId']) {
        const roomId = parseInt(params['roomId'], 10);
        if (!isNaN(roomId)) {
          this.selectRoomById(roomId);
        }
      }
    });
  }

  private autoSelectRoomIfNeeded(): void {
    // Auto-select first room if no room is selected and no route parameter
    if (this.chatRooms.length > 0 && !this.selectedRoomId && !this.route.snapshot.params['roomId']) {
      this.selectRoom(this.chatRooms[0]);
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    this.cleanupTyping();
  }

  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketSubscription?.unsubscribe();
    this.connectionCheckSubscription?.unsubscribe();
  }

  private cleanupTyping(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Stop typing when leaving
    if (this.isTyping && this.currentRoom) {
      this.chatService.stopTyping(this.currentRoom.id).subscribe();
    }
  }

  // ===== CONNECTION MANAGEMENT =====

  private startConnectionHealthCheck(): void {
    this.connectionCheckSubscription = timer(0, 30000).subscribe(() => {
      if (!this.webSocketConnected && this.currentRoom) {
        console.log('🔄 Attempting to reconnect WebSocket...');
        this.chatService.reconnectWebSocket();
      }
    });
  }

  reconnectWebSocket(): void {
    this.chatService.reconnectWebSocket();
    this.errorHandler.info('Reconnecting to chat...', 1000);
  }

  // ===== EVENT HANDLERS =====

  @HostListener('document:click', ['$event'])
  handleMenuClickOutside(event: MouseEvent): void {
    if (this.showMenu) {
      const target = event.target as HTMLElement;
      if (!target.closest('.chat-actions') && !target.closest('.action-btn')) {
        this.showMenu = false;
      }
    }
    if (this.showEmojiPicker) {
      const target = event.target as HTMLElement;
      if (!target.closest('.emoji-picker') && !target.closest('.input-action')) {
        this.showEmojiPicker = false;
      }
    }
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.cleanupTyping();
  }

  // ===== CHAT ROOM MANAGEMENT =====

  loadChatRooms(): void {
    this.loading = true;

    this.chatService.getChatRooms().subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.chatRooms = response.data || [];
          this.autoSelectRoomIfNeeded();
        } else {
          this.errorHandler.warning(response.message || 'Failed to load chat rooms');
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.chatRooms = [];
        console.error('Error loading chat rooms:', error);
        
        const retryAction: ErrorAction = {
          label: 'Retry',
          handler: () => this.loadChatRooms()
        };
        
        this.errorHandler.error(
          'Unable to load conversations',
          'Please check your connection',
          retryAction
        );
      }
    });
  }

  selectRoom(room: ChatRoom): void {
    try {
      this.chatService.setCurrentRoom(room);
      this.selectedRoomId = room.id;
      this.showMenu = false;
      this.router.navigate(['/chat', room.id]);
    } catch (error) {
      console.error('Error selecting room:', error);
      this.errorHandler.error('Failed to select chat room');
    }
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    } else {
      // Room not found in current list, try to load it
      this.errorHandler.info('Loading chat room...', 1000);
      this.loadChatRooms();
    }
  }

  // ===== NEW CHAT FUNCTIONALITY =====

  startNewChat(): void {
    const dialogRef = this.dialog.open(NewChatModalComponent, {
      width: '500px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'new-chat-modal',
      data: {
        currentUserId: this.currentUserId,
        userRole: this.userRole
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createNewChatRoom(result);
      }
    });
  }

  private createNewChatRoom(chatData: any): void {
    this.loading = true;

    const request: CreateChatRoomRequest = {
      participantId: chatData.participantId,
      participantType: chatData.participantType,
      propertyId: chatData.propertyId || null
    };

    this.chatService.createChatRoom(request).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          // ✅ FIXED: Use 'info' instead of 'success'
          this.errorHandler.info('New chat started successfully!', 2000);
          
          // Add the new room to the list and select it
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          
          // Refresh the room list to ensure consistency
          setTimeout(() => {
            this.loadChatRooms();
          }, 500);
        } else {
          this.errorHandler.error(response.message || 'Failed to start new chat');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error creating chat room:', error);
        
        let errorMessage = 'Failed to start new chat';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 404) {
          errorMessage = 'User not found';
        } else if (error.status === 409) {
          errorMessage = 'Chat room already exists';
        }

        this.errorHandler.error(errorMessage, 'Please try again');
      }
    });
  }

  // ===== MESSAGE MANAGEMENT =====

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentRoom || this.sending) {
      return;
    }

    if (this.newMessage.length > 5000) {
      this.errorHandler.warning('Message is too long (max 5000 characters)');
      return;
    }

    const messageData: CreateMessageRequest = {
      chatRoomId: this.currentRoom.id,
      content: this.newMessage.trim(),
      messageType: 'TEXT'
    };

    this.sending = true;

    this.chatService.sendMessage(messageData).subscribe({
      next: (response: BasicResponse) => {
        this.sending = false;
        if (response.success) {
          this.newMessage = '';
          this.stopTyping();
          this.focusMessageInput();
          
          // Show success feedback for HTTP fallback
          if (!this.webSocketConnected) {
            this.errorHandler.info('Message sent', 1000);
          }
        }
      },
      error: (error: any) => {
        this.sending = false;
        console.error('Error sending message:', error);
        
        const retryAction: ErrorAction = {
          label: 'Retry',
          handler: () => this.sendMessage()
        };
        
        this.errorHandler.error(
          'Failed to send message',
          'Please check your connection',
          retryAction
        );
      }
    });
  }

  private focusMessageInput(): void {
    if (this.messageInput?.nativeElement) {
      setTimeout(() => {
        this.messageInput.nativeElement.focus();
      }, 0);
    }
  }

  deleteMessage(messageId: number): void {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    this.chatService.deleteMessage(messageId).subscribe({
      next: (response: BasicResponse) => {
        if (response.success) {
          this.errorHandler.info('Message deleted', 2000);
        }
      },
      error: (error: any) => {
        console.error('Error deleting message:', error);
        this.errorHandler.error('Failed to delete message', 'Please try again');
      }
    });
  }

  onMessageInput(): void {
    if (!this.currentRoom) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe({
        error: (error) => console.error('Error starting typing:', error)
      });
    }

    // Reset typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 1000);
  }

  stopTyping(): void {
    if (this.isTyping && this.currentRoom) {
      this.isTyping = false;
      this.chatService.stopTyping(this.currentRoom.id).subscribe({
        error: (error) => console.error('Error stopping typing:', error)
      });
    }
  }

  // ===== UI CONTROLS =====

  toggleMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showMenu = !this.showMenu;
  }

  viewProfile(): void {
    this.showMenu = false;
    this.errorHandler.info('Profile view coming soon!', 2000);
  }

  muteChat(): void {
    this.showMenu = false;
    this.errorHandler.info('Chat muted', 2000);
  }

  clearChat(): void {
    this.showMenu = false;
    
    if (!this.currentRoom) return;
    
    if (confirm('Are you sure you want to clear this chat? This will delete all messages in this conversation.')) {
      const messageIds = this.messages.map(msg => msg.id);
      if (messageIds.length > 0) {
        this.chatService.deleteMessagesBatch(messageIds).subscribe({
          next: (response: BasicResponse) => {
            if (response.success) {
              this.messages = [];
              this.errorHandler.info('Chat cleared', 2000);
            }
          },
          error: (error: any) => {
            console.error('Error clearing chat:', error);
            this.errorHandler.error('Failed to clear chat', 'Please try again');
          }
        });
      } else {
        this.errorHandler.info('No messages to clear', 2000);
      }
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
    this.focusMessageInput();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  triggerFileInput(): void {
    this.errorHandler.info('File upload coming soon!', 2000);
  }

  searchRooms(): void {
    if (this.searchQuery.trim()) {
   
      const filteredRooms = this.chatRooms.filter(room => 
        this.getRoomDisplayName(room).toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        room.propertyName?.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
      
      if (filteredRooms.length === 0) {
        this.errorHandler.info('No conversations found', 2000);
      }
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  refreshChatRooms(): void {
    this.loadChatRooms();
    this.errorHandler.info('Refreshing conversations...', 1000);
  }

  toggleTheme(): void {
    this.errorHandler.info('Theme toggle coming soon!', 2000);
  }

  // ===== UTILITY METHODS =====

  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.generateRoomDisplayName(room, this.currentUserId) || 'Unknown User';
  }

  getOtherParticipants(room: ChatRoom): User[] {
    return this.chatService.getOtherParticipants(room, this.currentUserId) || [];
  }

  isMyMessage(message: ChatMessage): boolean {
    return this.chatService.isMyMessage(message);
  }

  formatMessageTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 168) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
  }

  formatLastMessageTime(room: ChatRoom): string {
    if (!room.lastMessage) return '';
    return this.formatMessageTime(room.lastMessage.timestamp);
  }

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) return 'No messages yet';
    const content = room.lastMessage.content;
    return content.length > 35 ? content.substring(0, 35) + '...' : content;
  }

  scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        setTimeout(() => {
          const container = this.messagesContainer.nativeElement;
          container.scrollTop = container.scrollHeight;
        }, 100);
      }
    } catch (err) {
      console.warn('Could not scroll to bottom:', err);
    }
  }

  getParticipantRole(participant: User): string {
    if (!participant?.role) return 'User';
    
    switch(participant.role.toUpperCase()) {
      case 'LANDLORD': return 'Landlord';
      case 'CARETAKER': return 'Caretaker';
      case 'TENANT': return 'Tenant';
      case 'ADMIN': return 'Admin';
      case 'EXTERNAL_BUSINESS': return 'Business';
      default: return participant.role;
    }
  }

  getRoomTypeDisplay(room: ChatRoom): string {
    if (!room.participantType) return 'Chat';
    
    const participantType = room.participantType as string;
    
    switch(participantType) {
      case 'TENANT_LANDLORD': return 'Tenant ↔ Landlord';
      case 'TENANT_CARETAKER': return 'Tenant ↔ Caretaker';
      case 'LANDLORD_CARETAKER': return 'Landlord ↔ Caretaker';
      default: return participantType.replace('_', ' ↔ ');
    }
  }

  getAvatarColor(id: number): string {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#4facfe',
      '#43e97b', '#fa709a', '#fee140', '#30cfd0',
      '#a8edea', '#fed6e3', '#fbc2eb', '#a6c1ee'
    ];
    return colors[Math.abs(id) % colors.length];
  }

  getTotalUnreadCount(): number {
    return this.chatRooms.reduce((total, room) => total + (room.unreadCount || 0), 0);
  }

  showDateSeparator(message: ChatMessage): boolean {
    const messageIndex = this.messages.indexOf(message);
    if (messageIndex === 0) return true;
    
    const currentDate = new Date(message.timestamp).toDateString();
    const previousDate = new Date(this.messages[messageIndex - 1].timestamp).toDateString();
    
    return currentDate !== previousDate;
  }

  getMessageDate(timestamp: string): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }

  trackByMessageId(index: number, message: ChatMessage): number {
    return message.id;
  }

  trackByRoomId(index: number, room: ChatRoom): number {
    return room.id;
  }

  getConnectionStatusText(): string {
    return this.webSocketConnected ? 'Real-time' : 'Standard';
  }

  getConnectionStatusColor(): string {
    return this.webSocketConnected ? 'var(--success-color)' : 'var(--warning-color)';
  }

  shouldShowConnectionWarning(): boolean {
    return !this.webSocketConnected && this.currentRoom !== null;
  }

  getFilteredRooms(): ChatRoom[] {
    if (!this.searchQuery.trim()) {
      return this.chatRooms;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.chatRooms.filter(room => 
      this.getRoomDisplayName(room).toLowerCase().includes(query) ||
      room.propertyName?.toLowerCase().includes(query) ||
      room.lastMessage?.content.toLowerCase().includes(query)
    );
  }
}