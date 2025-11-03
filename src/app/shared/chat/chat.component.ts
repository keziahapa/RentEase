import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { User, ChatMessage, ChatRoom, CreateMessageRequest, BatchDeleteRequest } from '../../services/chat.interface';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  // UI State
  isSidebarOpen = true;
  selectedRoom: ChatRoom | null = null;
  newMessage = '';
  isTyping = false;
  showEmojiPicker = false;
  showFilePicker = false;
  isLoading = false;
  searchQuery = '';
  
  // Data
  chatRooms: ChatRoom[] = [];
  messages: ChatMessage[] = [];
  currentUser: User | null = null;

  // Stats
  errorsShown = 0;
  messagesDeleted = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private chatService: ChatService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeCurrentUser();
    this.loadChatRooms();
    this.setupRouteListener();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // === INITIALIZATION ===

  private initializeCurrentUser(): void {
    // In a real app, get from auth service
    this.currentUser = {
      id: 1,
      name: 'You',
      email: 'tenant@example.com',
      role: 'TENANT',
      avatar: 'Y',
      isOnline: true
    };
    this.chatService.setCurrentUser(this.currentUser);
  }

  private setupRouteListener(): void {
    const routeSub = this.route.params.subscribe(params => {
      const roomId = params['roomId'];
      if (roomId) {
        this.selectRoomById(+roomId);
      }
    });
    this.subscriptions.push(routeSub);
  }

  // === DATA LOADING ===

  private loadChatRooms(): void {
    this.isLoading = true;
    const roomsSub = this.chatService.getChatRooms().subscribe({
      next: (rooms) => {
        this.chatRooms = rooms;
        this.isLoading = false;
        
        // Auto-select first room if none selected
        if (rooms.length > 0 && !this.selectedRoom) {
          this.selectRoom(rooms[0]);
        }
      },
      error: (error) => {
        console.error('Error loading chat rooms:', error);
        this.errorsShown++;
        this.isLoading = false;
      }
    });
    this.subscriptions.push(roomsSub);
  }

  private loadRoomMessages(roomId: number): void {
    this.isLoading = true;
    const messagesSub = this.chatService.getRoomMessages(roomId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoading = false;
        
        // Mark messages as read
        this.markMessagesAsRead(roomId, messages);
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.errorsShown++;
        this.isLoading = false;
      }
    });
    this.subscriptions.push(messagesSub);
  }

  // === ROOM MANAGEMENT ===

  selectRoom(room: ChatRoom): void {
    this.selectedRoom = room;
    this.messages = [];
    this.loadRoomMessages(room.id);
    this.updateBrowserUrl(room.id);
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) {
      this.selectRoom(room);
    }
  }

  private updateBrowserUrl(roomId: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { room: roomId },
      queryParamsHandling: 'merge'
    });
  }

  // === MESSAGE MANAGEMENT ===

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedRoom || !this.currentUser) {
      return;
    }

    const messageRequest: CreateMessageRequest = {
      chatRoomId: this.selectedRoom.id,
      content: this.newMessage.trim(),
      messageType: 'TEXT'
    };

    const sendSub = this.chatService.sendMessage(messageRequest).subscribe({
      next: (sentMessage) => {
        this.messages.push(sentMessage);
        this.newMessage = '';
        this.scrollToBottom();
        
        // Update room's last message
        this.updateRoomLastMessage(sentMessage);
      },
      error: (error) => {
        console.error('Error sending message:', error);
        this.errorsShown++;
      }
    });
    this.subscriptions.push(sendSub);
  }

  deleteMessage(messageId: number): void {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    const deleteSub = this.chatService.deleteMessage(messageId).subscribe({
      next: (success) => {
        if (success) {
          const messageIndex = this.messages.findIndex(m => m.id === messageId);
          if (messageIndex > -1) {
            this.messages[messageIndex].deleted = true;
            this.messages[messageIndex].content = 'This message was deleted';
            this.messagesDeleted++;
          }
        }
      },
      error: (error) => {
        console.error('Error deleting message:', error);
        this.errorsShown++;
      }
    });
    this.subscriptions.push(deleteSub);
  }

  deleteSelectedMessages(): void {
    const selectedMessages = this.messages.filter(m => m.selected);
    if (selectedMessages.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedMessages.length} messages?`)) {
      return;
    }

    const deleteRequest: BatchDeleteRequest = {
      messageIds: selectedMessages.map(m => m.id)
    };

    const batchDeleteSub = this.chatService.deleteMessagesBatch(deleteRequest).subscribe({
      next: (success) => {
        if (success) {
          selectedMessages.forEach(message => {
            const messageIndex = this.messages.findIndex(m => m.id === message.id);
            if (messageIndex > -1) {
              this.messages[messageIndex].deleted = true;
              this.messages[messageIndex].content = 'This message was deleted';
            }
          });
          this.messagesDeleted += selectedMessages.length;
        }
      },
      error: (error) => {
        console.error('Error deleting messages:', error);
        this.errorsShown++;
      }
    });
    this.subscriptions.push(batchDeleteSub);
  }

  // === MESSAGE STATUS ===

  private markMessagesAsRead(roomId: number, messages: ChatMessage[]): void {
    const unreadMessages = messages.filter(m => !m.read && m.senderId !== this.currentUser?.id);
    if (unreadMessages.length === 0) return;

    const messageIds = unreadMessages.map(m => m.id);
    const markReadSub = this.chatService.markMessagesAsRead({
      roomId,
      messageIds
    }).subscribe({
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
    this.subscriptions.push(markReadSub);
  }

  // === UI HELPERS ===

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  isCurrentUser(senderId: number): boolean {
    return this.currentUser?.id === senderId;
  }

  getOtherParticipant(room: ChatRoom): User | undefined {
    return room.participants.find(p => p.id !== this.currentUser?.id);
  }

  getAvatarColor(id: number): string {
    const colors = [
      '#0084ff', '#00ba34', '#ff9500', '#ff3b30', '#5856d6',
      '#ff2d55', '#af52de', '#ffcc00', '#34c759', '#007aff'
    ];
    return colors[id % colors.length];
  }

  formatTime(timestamp: string): string {
    // In real app, format timestamp properly
    return timestamp;
  }

  private scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = 
          this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private updateRoomLastMessage(message: ChatMessage): void {
    if (this.selectedRoom) {
      this.selectedRoom.lastMessage = message;
    }
  }

  // === SEARCH ===

  searchRooms(): void {
    if (this.searchQuery.trim()) {
      // Implement search logic using chatService.searchMessages()
      const searchCriteria = {
        query: this.searchQuery,
        limit: 20
      };
      
      const searchSub = this.chatService.searchMessages(searchCriteria).subscribe({
        next: (results) => {
          // Handle search results
          console.log('Search results:', results);
        },
        error: (error) => {
          console.error('Error searching messages:', error);
          this.errorsShown++;
        }
      });
      this.subscriptions.push(searchSub);
    }
  }

  // === KEYBOARD HANDLERS ===

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // === FILE UPLOAD ===

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && this.selectedRoom && this.currentUser) {
      // Create file message request
      const fileMessageRequest: CreateMessageRequest = {
        chatRoomId: this.selectedRoom.id,
        content: file.name, // In real app, upload file and get URL
        messageType: 'FILE'
      };

      const fileSub = this.chatService.sendMessage(fileMessageRequest).subscribe({
        next: (sentMessage) => {
          this.messages.push(sentMessage);
          this.scrollToBottom();
          this.updateRoomLastMessage(sentMessage);
        },
        error: (error) => {
          console.error('Error sending file message:', error);
          this.errorsShown++;
        }
      });
      this.subscriptions.push(fileSub);
    }
  }

  triggerFileInput(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.pdf,.doc,.docx';
    fileInput.onchange = (event) => this.onFileSelected(event);
    fileInput.click();
  }

  // === EMOJI PICKER ===

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
  }

  // === ROOM CREATION ===

  createTenantLandlordRoom(propertyId: number): void {
    const createSub = this.chatService.createTenantLandlordRoom(propertyId).subscribe({
      next: (newRoom) => {
        this.chatRooms.push(newRoom);
        this.selectRoom(newRoom);
      },
      error: (error) => {
        console.error('Error creating room:', error);
        this.errorsShown++;
      }
    });
    this.subscriptions.push(createSub);
  }
}