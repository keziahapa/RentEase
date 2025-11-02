// chat.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';
import { ChatService } from '../../services/chat.service';


import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, CreateMessageRequest } from '../../services/chat.interface';

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
  
  private subscriptions: Subscription[] = [];

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
        this.scrollToBottom();
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

  loadChatRooms(): void {
    this.loading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response) => {
        if (response.success) {
          this.chatRooms = this.chatService.sortRoomsByLastMessage(response.data);
          // Auto-select first room if none selected
          if (this.chatRooms.length > 0 && !this.selectedRoomId) {
            this.selectRoom(this.chatRooms[0]);
          }
        }
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.message;
        this.loading = false;
      }
    });
  }

  loadRoomMessages(roomId: number): void {
    this.chatService.getRoomMessages(roomId).subscribe({
      next: (response) => {
        if (response.success) {
          this.messages = response.data;
          this.markRoomAsRead(roomId);
        }
      },
      error: (error) => {
        this.errorMessage = error.message;
      }
    });
  }

  selectRoom(room: ChatRoom): void {
    this.chatService.setCurrentRoom(room);
    this.selectedRoomId = room.id;
    // Update URL without reloading
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { room: room.id },
      queryParamsHandling: 'merge'
    });
    
    // Mark as read
    this.markRoomAsRead(room.id);
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    }
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentRoom) return;

    const messageData: CreateMessageRequest = {
      chatRoomId: this.currentRoom.id,
      content: this.newMessage.trim(),
      messageType: 'TEXT'
    };

    this.chatService.sendMessage(messageData).subscribe({
      next: (response) => {
        if (response.success) {
          this.newMessage = '';
          this.stopTyping();
          this.messageInput.nativeElement.focus();
        }
      },
      error: (error) => {
        this.errorMessage = error.message;
      }
    });
  }

  onMessageInput(): void {
    if (!this.isTyping && this.currentRoom) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe();
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
      this.chatService.stopTyping(this.currentRoom.id).subscribe();
    }
  }

  markRoomAsRead(roomId: number): void {
    this.chatService.markRoomAsRead(roomId).subscribe();
  }

  deleteMessage(messageId: number): void {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatService.deleteMessage(messageId).subscribe({
        error: (error) => {
          this.errorMessage = error.message;
        }
      });
    }
  }

  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.generateRoomDisplayName(room, this.currentUserId);
  }

  getOtherParticipants(room: ChatRoom): any[] {
    return this.chatService.getOtherParticipants(room, this.currentUserId);
  }

  isMyMessage(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  formatLastMessageTime(room: ChatRoom): string {
    if (!room.lastMessage) return '';
    return this.formatMessageTime(room.lastMessage.timestamp);
  }

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) return 'No messages yet';
    
    const content = room.lastMessage.content;
    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  }

  scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.warn('Could not scroll to bottom:', err);
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  getParticipantRole(participant: any): string {
    switch(participant.role) {
      case 'LANDLORD': return 'Landlord';
      case 'CARETAKER': return 'Caretaker';
      case 'TENANT': return 'Tenant';
      default: return participant.role;
    }
  }

  getRoomTypeDisplay(room: ChatRoom): string {
    switch(room.participantType) {
      case 'TENANT_LANDLORD': return 'Tenant ↔ Landlord';
      case 'TENANT_CARETAKER': return 'Tenant ↔ Caretaker';
      case 'LANDLORD_CARETAKER': return 'Landlord ↔ Caretaker';
      default: return room.participantType;
    }
  }

  // Create new chat rooms based on user role
  createNewChat(propertyId: number, participantType: string): void {
    let observable;
    
    switch(participantType) {
      case 'TENANT_LANDLORD':
        observable = this.chatService.createTenantLandlordRoom(propertyId);
        break;
      case 'TENANT_CARETAKER':
        observable = this.chatService.createTenantCaretakerRoom(propertyId);
        break;
      case 'LANDLORD_CARETAKER':
        observable = this.chatService.createLandlordCaretakerRoom(propertyId);
        break;
      default:
        return;
    }

    observable.subscribe({
      next: (response) => {
        if (response.success) {
          this.loadChatRooms(); // Reload rooms to include new one
          this.selectRoom(response.data);
        }
      },
      error: (error) => {
        this.errorMessage = error.message;
      }
    });
  }
}