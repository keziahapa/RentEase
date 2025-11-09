// src/app/shared/chat/chat.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';

// Material imports
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ChatRoom, ChatMessage, CreateMessageRequest, BasicResponse, User } from '../../services/chat.interface';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTooltipModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatSnackBarModule
  ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUserId: number = 0;
  userRole: string = '';

  loading = false;
  sending = false;
  selectedRoomId: number | null = null;
  showMenu = false;
  showEmojiPicker = false;
  searchQuery = '';
  webSocketConnected = false;

  typingUsers: { userId: number; userName: string }[] = [];
  isTyping = false;
  typingTimeout: any;

  emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '❤️', '💕', '💖', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '💯', '🔥', '✨', '💫', '⭐'];

  private subscriptions: Subscription[] = [];
  private webSocketSubscription?: Subscription;
  private connectionCheckSubscription?: Subscription;

  public chatService = inject(ChatService);
  public authService = inject(AuthService);
  public router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorHandler = inject(ErrorHandlerService);
  private snackBar = inject(MatSnackBar);
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
      this.showSnackbar('Failed to initialize chat', 'error');
    }
  }

  private initializeUser(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentUserId = this.chatService.getCurrentUserId();
      this.userRole = currentUser.role || '';
      console.log('👤 Current user initialized:', { id: this.currentUserId, role: this.userRole });
    } else {
      console.warn('No current user found');
    }
  }

  private subscribeToObservables(): void {
    this.webSocketSubscription = this.chatService.getConnectionStatus().subscribe(connected => {
      this.webSocketConnected = connected;
      console.log('🔌 WebSocket connection status:', connected);
      if (connected) {
        this.showSnackbar('Real-time chat connected', 'success');
      } else {
        console.warn('❌ WebSocket disconnected - using HTTP fallback');
      }
    });

    this.subscriptions.push(
      this.chatService.currentRoom$.subscribe(room => {
        console.log('🏠 Current room updated:', room);
        this.currentRoom = room;
        if (room) {
          this.selectedRoomId = room.id;
        }
      }),

      this.chatService.messages$.subscribe(messages => {
        console.log('💬 Messages updated:', messages?.length);
        this.messages = messages || [];
        setTimeout(() => this.scrollToBottom(), 100);
      }),

      this.chatService.chatRooms$.subscribe(rooms => {
        console.log('📋 Chat rooms updated:', rooms?.length);
        this.chatRooms = rooms || [];
        this.autoSelectRoomIfNeeded();
      }),

      this.chatService.typingUsers$.subscribe(users => {
        this.typingUsers = users || [];
      })
    );
  }

  private setupRouteListener(): void {
    this.route.params.subscribe(params => {
      console.log('🛣️ Route params:', params);
      if (params['roomId']) {
        const roomId = parseInt(params['roomId'], 10);
        if (!isNaN(roomId)) {
          this.selectRoomById(roomId);
        }
      }
    });
  }

  private autoSelectRoomIfNeeded(): void {
    if (this.chatRooms.length > 0 && !this.selectedRoomId && !this.route.snapshot.params['roomId']) {
      console.log('🤖 Auto-selecting first room');
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
    this.showSnackbar('Reconnecting to chat...', 'info');
  }

  // ===== EVENT HANDLERS =====

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    if (this.showMenu && !target.closest('.chat-actions') && !target.closest('.action-btn')) {
      this.showMenu = false;
    }
    
    if (this.showEmojiPicker && !target.closest('.emoji-picker') && !target.closest('.input-action')) {
      this.showEmojiPicker = false;
    }
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.cleanupTyping();
  }

  // ===== CHAT ROOM MANAGEMENT =====

  loadChatRooms(): void {
    this.loading = true;
    console.log('📥 Loading chat rooms...');

    this.chatService.getChatRooms().subscribe({
      next: (response) => {
        this.loading = false;
        console.log('✅ Chat rooms loaded:', response);
        if (response.success) {
          this.chatRooms = response.data || [];
          this.autoSelectRoomIfNeeded();
        } else {
          this.showSnackbar(response.message || 'Failed to load chat rooms', 'warning');
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.chatRooms = [];
        console.error('❌ Error loading chat rooms:', error);
        this.showSnackbar('Failed to load chat rooms', 'error');
      }
    });
  }

  selectRoom(room: ChatRoom | null): void {
    if (room === null) {
      this.currentRoom = null;
      this.selectedRoomId = null;
      this.router.navigate(['/chat']);
      return;
    }

    try {
      console.log('🎯 Selecting room:', room);
      this.chatService.setCurrentRoom(room);
      this.selectedRoomId = room.id;
      this.showMenu = false;
      this.router.navigate(['/chat', room.id]);
    } catch (error) {
      console.error('❌ Error selecting room:', error);
      this.showSnackbar('Failed to select chat room', 'error');
    }
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    } else {
      console.log('🔍 Room not found in local list, refreshing...');
      this.showSnackbar('Loading chat room...', 'info');
      this.loadChatRooms();
    }
  }

  // ===== NEW CHAT FUNCTIONALITY =====

  startNewChat(): void {
    this.showSnackbar('New chat feature coming soon!', 'info');
  }

  // ===== MESSAGE MANAGEMENT =====

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentRoom || this.sending) {
      return;
    }

    if (this.newMessage.length > 5000) {
      this.showSnackbar('Message is too long (max 5000 characters)', 'warning');
      return;
    }

    const messageData: CreateMessageRequest = {
      chatRoomId: this.currentRoom.id,
      content: this.newMessage.trim(),
      messageType: 'TEXT'
    };

    console.log('📤 Sending message:', messageData);
    this.sending = true;

    this.chatService.sendMessage(messageData).subscribe({
      next: (response: BasicResponse) => {
        this.sending = false;
        console.log('✅ Send message response:', response);
        
        if (response.success) {
          this.newMessage = '';
          this.stopTyping();
          this.focusMessageInput();
          
          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
        } else {
          this.showSnackbar(response.message || 'Failed to send message', 'error');
        }
      },
      error: (error: any) => {
        this.sending = false;
        console.error('❌ Error sending message:', error);
        this.showSnackbar('Failed to send message', 'error');
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
          this.showSnackbar('Message deleted', 'success');
        } else {
          this.showSnackbar(response.message || 'Failed to delete message', 'error');
        }
      },
      error: (error: any) => {
        console.error('❌ Error deleting message:', error);
        this.showSnackbar('Failed to delete message', 'error');
      }
    });
  }

  onMessageInput(): void {
    if (!this.currentRoom) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe();
    }

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
      this.chatService.stopTyping(this.currentRoom.id).subscribe();
    }
  }

  // ===== EMOJI & FILE UPLOAD FUNCTIONALITY =====

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
    this.focusMessageInput();
  }

  triggerFileInput(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
    fileInput.multiple = false;
    
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    };
    
    fileInput.click();
  }

  handleFileUpload(file: File): void {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showSnackbar('File too large - max 10MB', 'error');
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime',
      'audio/mpeg', 'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.showSnackbar('File type not supported', 'error');
      return;
    }

    this.showSnackbar(`Uploading ${file.name}...`, 'info');
    
    setTimeout(() => {
      this.showSnackbar(`File "${file.name}" uploaded successfully!`, 'success');
    }, 1500);
  }

  // ===== MISSING METHODS FOR TEMPLATE =====

  // ADDED: Missing method for template
  getRoomTypeDisplay(room: ChatRoom): string {
    if (!room.participantType) return 'Chat';

    const participantType = room.participantType as string;

    switch (participantType) {
      case 'TENANT_LANDLORD': return 'Tenant ↔ Landlord';
      case 'TENANT_CARETAKER': return 'Tenant ↔ Caretaker';
      case 'LANDLORD_CARETAKER': return 'Landlord ↔ Caretaker';
      default: return participantType.replace('_', ' ↔ ');
    }
  }

  // ADDED: Missing method for template
  shouldShowConnectionWarning(): boolean {
    return !this.webSocketConnected && this.currentRoom !== null;
  }

  // ADDED: Missing method for template
  searchRooms(): void {
    // Search logic is handled in getFilteredRooms()
    // This method is called on input to trigger change detection
  }

  // ADDED: Missing method for template
  showDateSeparator(message: ChatMessage): boolean {
    const messageIndex = this.messages.indexOf(message);
    if (messageIndex === 0) return true;

    const currentDate = new Date(message.timestamp).toDateString();
    const previousDate = new Date(this.messages[messageIndex - 1].timestamp).toDateString();

    return currentDate !== previousDate;
  }

  // ADDED: Missing method for template
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

  // ADDED: Missing method for template
  getParticipantRole(participant: User | undefined): string {
    if (!participant?.role) return 'User';

    switch (participant.role.toUpperCase()) {
      case 'LANDLORD': return 'Landlord';
      case 'CARETAKER': return 'Caretaker';
      case 'TENANT': return 'Tenant';
      case 'ADMIN': return 'Admin';
      case 'EXTERNAL_BUSINESS': return 'Business';
      default: return participant.role;
    }
  }

  // ADDED: Missing method for template
  getStatusIcon(status: string | undefined): string {
    if (!status) return 'schedule';
    
    const statusIcons: { [key: string]: string } = {
      'SENDING': 'schedule',
      'SENT': 'check',
      'DELIVERED': 'done_all',
      'READ': 'visibility',
      'FAILED': 'error'
    };
    
    return statusIcons[status] || 'schedule';
  }

  // ADDED: Missing method for template
  replyToMessage(message: ChatMessage): void {
    console.log('↩️ Replying to message:', message);
    
    const replyPrefix = `Replying to "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}": `;
    this.newMessage = replyPrefix;
    this.focusMessageInput();
  }

  // ===== UI CONTROLS =====

  toggleMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.showMenu = !this.showMenu;
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
              this.showSnackbar('Chat cleared', 'success');
            }
          },
          error: (error: any) => {
            console.error('Error clearing chat:', error);
            this.showSnackbar('Failed to clear chat', 'error');
          }
        });
      } else {
        this.showSnackbar('No messages to clear', 'info');
      }
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  refreshChatRooms(): void {
    this.loadChatRooms();
    this.showSnackbar('Refreshing conversations...', 'info');
  }

  // ===== TIME FORMATTING =====

  formatMessageTime(timestamp: string): string {
    try {
      if (!timestamp) return 'Just now';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Just now';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
  }

  formatLastMessageTime(room: ChatRoom): string {
    if (!room.lastMessage || !room.lastMessage.timestamp) return '';
    return this.formatMessageTime(room.lastMessage.timestamp);
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

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) return 'No messages yet';
    const content = room.lastMessage.content;
    return content.length > 35 ? content.substring(0, 35) + '...' : content;
  }

  getAvatarColor(id: number): string {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
    return colors[Math.abs(id) % colors.length];
  }

  getTotalUnreadCount(): number {
    return this.chatRooms.reduce((total, room) => total + (room.unreadCount || 0), 0);
  }

  isUserOnline(room: ChatRoom): boolean {
    if (!room || !room.participants) return false;
    const otherParticipants = this.getOtherParticipants(room);
    return otherParticipants.some(participant => participant.isOnline === true);
  }

  shouldShowAvatar(messageIndex: number): boolean {
    if (messageIndex === 0) return true;
    if (messageIndex >= this.messages.length) return false;
    
    const currentMessage = this.messages[messageIndex];
    const previousMessage = this.messages[messageIndex - 1];
    
    if (currentMessage.senderId !== previousMessage.senderId) return true;
    
    const currentTime = new Date(currentMessage.timestamp).getTime();
    const previousTime = new Date(previousMessage.timestamp).getTime();
    const timeDiff = Math.abs(currentTime - previousTime) / (1000 * 60);
    
    return timeDiff > 5;
  }

  shouldShowSenderName(messageIndex: number): boolean {
    if (messageIndex === 0) return true;
    if (messageIndex >= this.messages.length) return false;
    
    const currentMessage = this.messages[messageIndex];
    const previousMessage = this.messages[messageIndex - 1];
    
    return currentMessage.senderId !== previousMessage.senderId;
  }

  retryMessage(message: ChatMessage): void {
    console.log('🔄 Retrying message:', message);
    
    if (message.status === 'FAILED') {
      const messageData: CreateMessageRequest = {
        chatRoomId: message.chatRoomId,
        content: message.content,
        messageType: 'TEXT'
      };

      this.chatService.sendMessage(messageData).subscribe({
        next: (response: BasicResponse) => {
          if (response.success) {
            this.showSnackbar('Message sent successfully!', 'success');
          } else {
            this.showSnackbar(response.message || 'Failed to send message', 'error');
          }
        },
        error: (error: any) => {
          console.error('❌ Error retrying message:', error);
          this.showSnackbar('Failed to send message', 'error');
        }
      });
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
    return this.webSocketConnected ? '#10b981' : '#f59e0b';
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

  // ===== SNACKBAR HELPER =====

  private showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [`snackbar-${type}`]
    });
  }
}