// ============================================
// FILE: chat.component.ts
// Location: src/app/shared/chat/chat.component.ts
// REPLACE YOUR EXISTING FILE WITH THIS
// ============================================

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ErrorAction } from '../../services/error-handler.interface';

import { 
  ChatRoom, 
  ChatMessage, 
  CreateMessageRequest, 
  BasicResponse,
  ApiResponse,
  ChatRoomResponse,
  ChatMessageResponse,
  User
} from '../../services/chat.interface';
import { ErrorDisplayComponent } from '../error-display.component/error-display.component';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule,ErrorDisplayComponent]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  
  // Data
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUserId: number = 0;
  userRole: string = '';
  
  // UI state
  loading = false;
  sending = false;
  isSidebarOpen = true;
  selectedRoomId: number | null = null;
  showMenu = false;
  showEmojiPicker = false;
  searchQuery = '';
  
  // Typing indicators
  typingUsers: {userId: number, name: string}[] = [];
  isTyping = false;
  typingTimeout: any;
  
  // Emojis
  emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '❤️', '💕', '💖', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '💯', '🔥', '✨', '💫', '⭐'];
  
  private subscriptions: Subscription[] = [];
  
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorHandler = inject(ErrorHandlerService);

  ngOnInit(): void {
    try {
      this.currentUserId = this.chatService.getCurrentUserId();
      this.userRole = this.authService.getCurrentUser()?.role || '';
      this.loadChatRooms();
      
      // Subscribe to real-time updates
      this.subscriptions.push(
        this.chatService.currentRoom$.subscribe(room => {
          this.currentRoom = room;
          if (room) {
            this.selectedRoomId = room.id;
            this.loadRoomMessages(room.id);
          }
        }),
        
        this.chatService.messages$.subscribe(messages => {
          this.messages = messages || [];
          setTimeout(() => this.scrollToBottom(), 100);
        }),
        
        this.chatService.typingUsers$.subscribe(users => {
          this.typingUsers = users || [];
        })
      );

      // Check for room ID in route
      this.route.params.subscribe(params => {
        if (params['roomId']) {
          const roomId = parseInt(params['roomId'], 10);
          if (!isNaN(roomId)) {
            this.selectRoomById(roomId);
          }
        }
      });

    } catch (error) {
      console.error('Error initializing chat component:', error);
      this.errorHandler.error('Failed to initialize chat', 'Please refresh the page');
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  @HostListener('document:click', ['$event'])
  handleMenuClickOutside(event: MouseEvent): void {
    if (this.showMenu) {
      const target = event.target as HTMLElement;
      if (!target.closest('.menu-container') && !target.closest('.menu-trigger')) {
        this.showMenu = false;
      }
    }
    if (this.showEmojiPicker) {
      const target = event.target as HTMLElement;
      if (!target.closest('.emoji-picker') && !target.closest('.input-action-btn')) {
        this.showEmojiPicker = false;
      }
    }
  }

  // ===== DATA LOADING =====

  loadChatRooms(): void {
    this.loading = true;

    this.chatService.getChatRooms().subscribe({
      next: (response: ChatRoomResponse) => {
        if (response.success) {
          this.chatRooms = response.data || [];
          if (this.chatRooms.length > 0 && !this.selectedRoomId && !this.route.snapshot.params['roomId']) {
            this.selectRoom(this.chatRooms[0]);
          }
          this.errorHandler.info('Conversations loaded', 2000);
        } else {
          this.errorHandler.warning(response.message || 'Failed to load chat rooms');
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading chat rooms:', error);
        this.loading = false;
        this.chatRooms = [];
        
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

  loadRoomMessages(roomId: number): void {
    this.chatService.getRoomMessages(roomId).subscribe({
      next: (response: ChatMessageResponse) => {
        if (response.success) {
          this.messages = response.data || [];
          this.markRoomAsRead(roomId);
        } else {
          this.errorHandler.warning(response.message || 'Failed to load messages');
        }
      },
      error: (error: any) => {
        console.error('Error loading room messages:', error);
        this.messages = [];
        this.errorHandler.error('Failed to load messages', 'Please try again');
      }
    });
  }

  // ===== ROOM MANAGEMENT =====

  selectRoom(room: ChatRoom): void {
    try {
      this.chatService.setCurrentRoom(room);
      this.selectedRoomId = room.id;
      this.showMenu = false;
      this.router.navigate(['/chat', room.id]);
      this.markRoomAsRead(room.id);
    } catch (error) {
      console.error('Error selecting room:', error);
      this.errorHandler.error('Failed to select chat room');
    }
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    }
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
      next: (response: ApiResponse<ChatMessage>) => {
        if (response.success && response.data) {
          this.newMessage = '';
          this.stopTyping();
          if (this.messageInput?.nativeElement) {
            this.messageInput.nativeElement.focus();
          }
          this.errorHandler.info('Message sent', 1000);
        }
        this.sending = false;
      },
      error: (error: any) => {
        console.error('Error sending message:', error);
        this.sending = false;
        
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

  // ===== MENU ACTIONS =====

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
    
    if (confirm('Are you sure you want to clear this chat? This will delete all messages in this conversation.')) {
      if (this.currentRoom) {
        this.chatService.clearChat(this.currentRoom.id).subscribe({
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
      }
    }
  }

  deleteChat(): void {
    this.showMenu = false;
    
    if (confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      if (this.currentRoom) {
        this.chatService.deleteChatRoom(this.currentRoom.id).subscribe({
          next: (response: BasicResponse) => {
            if (response.success) {
              this.currentRoom = null;
              this.selectedRoomId = null;
              this.messages = [];
              this.loadChatRooms();
              this.router.navigate(['/chat']);
              this.errorHandler.info('Chat deleted', 2000);
            }
          },
          error: (error: any) => {
            console.error('Error deleting chat:', error);
            this.errorHandler.error('Failed to delete chat', 'Please try again');
          }
        });
      }
    }
  }

  // ===== TYPING INDICATORS =====

  onMessageInput(): void {
    if (!this.isTyping && this.currentRoom) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe({
        error: (error) => console.error('Error starting typing:', error)
      });
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
      this.chatService.stopTyping(this.currentRoom.id).subscribe({
        error: (error) => console.error('Error stopping typing:', error)
      });
    }
  }

  // ===== UTILITIES =====

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
    if (this.messageInput?.nativeElement) {
      this.messageInput.nativeElement.focus();
    }
  }

  triggerFileInput(): void {
    this.errorHandler.info('File upload coming soon!', 2000);
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  searchRooms(): void {
    // Implement search functionality
    if (this.searchQuery.trim()) {
      this.errorHandler.info('Search functionality coming soon!', 2000);
    }
  }

  markRoomAsRead(roomId: number): void {
    this.chatService.markRoomAsRead(roomId).subscribe({
      error: (error) => console.error('Error marking room as read:', error)
    });
  }

  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.generateRoomDisplayName(room, this.currentUserId) || 'Unknown User';
  }

  getOtherParticipants(room: ChatRoom): User[] {
    return this.chatService.getOtherParticipants(room, this.currentUserId) || [];
  }

  isMyMessage(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
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
    return colors[id % colors.length];
  }

  trackByMessageId(index: number, message: ChatMessage): number {
    return message.id;
  }
}