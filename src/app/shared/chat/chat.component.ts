import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
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

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  newMessage = '';
  loading = false;
  errorMessage = '';
  currentUserId: number = 0;
  userRole: string = '';
  
  // Typing indicators
  typingUsers: {userId: number, name: string}[] = [];
  isTyping = false;
  typingTimeout: any;
  
  // UI state
  isSidebarOpen = true;
  selectedRoomId: number | null = null;
  showMenu = false;
  
  private subscriptions: Subscription[] = [];
  private menuClickOutsideListener!: (event: MouseEvent) => void;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
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
        this.messages = messages;
        setTimeout(() => this.scrollToBottom(), 100);
      }),
      
      this.chatService.typingUsers$.subscribe(users => {
        this.typingUsers = users;
      })
    );

    // Check for room ID in route
    this.route.params.subscribe(params => {
      if (params['roomId']) {
        const roomId = parseInt(params['roomId'], 10);
        this.selectRoomById(roomId);
      }
    });

    // Add click outside listener for menu
    this.menuClickOutsideListener = this.handleMenuClickOutside.bind(this);
    document.addEventListener('click', this.menuClickOutsideListener);
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    document.removeEventListener('click', this.menuClickOutsideListener);
  }

  @HostListener('document:click', ['$event'])
  handleMenuClickOutside(event: MouseEvent): void {
    if (this.showMenu) {
      const target = event.target as HTMLElement;
      
      // Check if click is outside menu container, menu trigger, AND chat container
      if (!target.closest('.menu-container') && 
          !target.closest('.menu-trigger') &&
          !target.closest('.chat-container')) {
        this.showMenu = false;
      }
    }
  }

  loadChatRooms(): void {
    this.loading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response: ChatRoomResponse) => {
        if (response.success) {
          this.chatRooms = response.data;
          // Auto-select first room if none selected and no route parameter
          if (this.chatRooms.length > 0 && !this.selectedRoomId && !this.route.snapshot.params['roomId']) {
            this.selectRoom(this.chatRooms[0]);
          }
        }
        this.loading = false;
      },
      error: (error: any) => {
        this.errorMessage = error.message || 'Failed to load chat rooms';
        this.loading = false;
        console.error('Error loading chat rooms:', error);
      }
    });
  }

  loadRoomMessages(roomId: number): void {
    this.chatService.getRoomMessages(roomId).subscribe({
      next: (response: ChatMessageResponse) => {
        if (response.success) {
          this.messages = response.data;
          this.markRoomAsRead(roomId);
        }
      },
      error: (error: any) => {
        this.errorMessage = error.message || 'Failed to load messages';
        console.error('Error loading room messages:', error);
      }
    });
  }

  selectRoom(room: ChatRoom): void {
    this.chatService.setCurrentRoom(room);
    this.selectedRoomId = room.id;
    this.showMenu = false; // Close menu when switching rooms
    
    // Update URL with room ID
    this.router.navigate(['/chat', room.id]);
    
    // Mark as read
    this.markRoomAsRead(room.id);
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    } else {
      // If room not found in current list, reload rooms
      console.log('Room not found in current list, reloading rooms...');
      this.loadChatRooms();
    }
  }

  // Send message function
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentRoom) {
      console.log('❌ Cannot send: No message or room');
      return;
    }

    const messageData: CreateMessageRequest = {
      chatRoomId: this.currentRoom.id,
      content: this.newMessage.trim(),
      messageType: 'TEXT'
    };

    console.log('📤 Sending message:', messageData);

    this.chatService.sendMessage(messageData).subscribe({
      next: (response: ApiResponse<ChatMessage>) => {
        console.log('✅ Message sent successfully:', response);
        this.newMessage = '';
        this.stopTyping();
        // Focus input after sending
        if (this.messageInput?.nativeElement) {
          this.messageInput.nativeElement.focus();
        }
      },
      error: (error: any) => {
        console.error('❌ Error sending message:', error);
        this.errorMessage = error.message || 'Failed to send message';
      }
    });
  }

  // Enter key handling
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onMessageInput(): void {
    if (!this.isTyping && this.currentRoom) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe({
        error: (error) => console.error('Error starting typing:', error)
      });
    }

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set new timeout
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

  deleteMessage(messageId: number): void {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatService.deleteMessage(messageId).subscribe({
        next: (response: BasicResponse) => {
          console.log('✅ Message deleted successfully');
        },
        error: (error: any) => {
          this.errorMessage = error.message || 'Failed to delete message';
          console.error('Error deleting message:', error);
        }
      });
    }
  }

  // Three dots menu functions
  toggleMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showMenu = !this.showMenu;
  }

  viewProfile(): void {
    this.showMenu = false;
    console.log('View profile clicked');
    // Implement view profile logic
    // this.router.navigate(['/profile', userId]);
  }

  muteChat(): void {
    this.showMenu = false;
    console.log('Mute chat clicked');
    // Implement mute chat logic
  }

  clearChat(): void {
    this.showMenu = false;
    
    if (confirm('Are you sure you want to clear this chat? This will delete all messages in this conversation.')) {
      if (this.currentRoom) {
        this.chatService.clearChat(this.currentRoom.id).subscribe({
          next: (response: BasicResponse) => {
            console.log('✅ Chat cleared successfully');
            this.messages = [];
          },
          error: (error: any) => {
            console.error('❌ Error clearing chat:', error);
            this.errorMessage = error.message || 'Failed to clear chat';
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
            console.log('✅ Chat deleted successfully');
            this.currentRoom = null;
            this.selectedRoomId = null;
            this.messages = [];
            this.loadChatRooms(); // Reload rooms list
            this.router.navigate(['/chat']);
          },
          error: (error: any) => {
            console.error('❌ Error deleting chat:', error);
            this.errorMessage = error.message || 'Failed to delete chat';
          }
        });
      }
    }
  }

  markRoomAsRead(roomId: number): void {
    this.chatService.markRoomAsRead(roomId).subscribe({
      error: (error) => console.error('Error marking room as read:', error)
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.generateRoomDisplayName(room, this.currentUserId);
  }

  getOtherParticipants(room: ChatRoom): User[] {
    return this.chatService.getOtherParticipants(room, this.currentUserId);
  }

  isMyMessage(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  formatMessageTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 168) { // 7 days
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
    if (!participant.role) return 'User';
    
    switch(participant.role.toUpperCase()) {
      case 'LANDLORD': return 'Landlord';
      case 'CARETAKER': return 'Caretaker';
      case 'TENANT': return 'Tenant';
      default: return participant.role;
    }
  }

  getRoomTypeDisplay(room: ChatRoom): string {
    if (!room.participantType) return 'Chat';
    
    const participantType = room.participantType as 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER' | string;
    
    switch(participantType) {
      case 'TENANT_LANDLORD': return 'Tenant ↔ Landlord';
      case 'TENANT_CARETAKER': return 'Tenant ↔ Caretaker';
      case 'LANDLORD_CARETAKER': return 'Landlord ↔ Caretaker';
      default: return participantType.replace('_', ' ↔ ');
    }
  }
}