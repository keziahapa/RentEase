// Complete Working Chat Component - All Issues Fixed
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';
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
    CommonModule, FormsModule, MatTooltipModule, MatDialogModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatSnackBarModule
  ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;

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
  selectedFile: File | null = null;
  filePreview: string | null = null;
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
      console.log('👤 User initialized:', { id: this.currentUserId, role: this.userRole });
    }
  }

  private subscribeToObservables(): void {
    this.webSocketSubscription = this.chatService.getConnectionStatus().subscribe(connected => {
      this.webSocketConnected = connected;
      if (connected) this.showSnackbar('Real-time chat connected', 'success');
    });

    this.subscriptions.push(
      this.chatService.currentRoom$.subscribe(room => {
        this.currentRoom = room;
        if (room) this.selectedRoomId = room.id;
      }),
      this.chatService.messages$.subscribe(messages => {
        this.messages = messages || [];
        setTimeout(() => this.scrollToBottom(), 100);
      }),
      this.chatService.chatRooms$.subscribe(rooms => {
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
      if (params['roomId']) {
        const roomId = parseInt(params['roomId'], 10);
        if (!isNaN(roomId)) this.selectRoomById(roomId);
      }
    });
  }

  private autoSelectRoomIfNeeded(): void {
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
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.isTyping && this.currentRoom) {
      this.chatService.stopTyping(this.currentRoom.id).subscribe();
    }
  }

  private startConnectionHealthCheck(): void {
    this.connectionCheckSubscription = timer(0, 30000).subscribe(() => {
      if (!this.webSocketConnected && this.currentRoom) {
        this.chatService.reconnectWebSocket();
      }
    });
  }

  reconnectWebSocket(): void {
    this.chatService.reconnectWebSocket();
    this.showSnackbar('Reconnecting...', 'info');
  }

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

  loadChatRooms(): void {
    this.loading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.chatRooms = response.data || [];
          this.autoSelectRoomIfNeeded();
        }
      },
      error: () => {
        this.loading = false;
        this.showSnackbar('Failed to load chats', 'error');
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
    this.chatService.setCurrentRoom(room);
    this.selectedRoomId = room.id;
    this.router.navigate(['/chat', room.id]);
  }

  selectRoomById(roomId: number): void {
    const room = this.chatRooms.find(r => r.id === roomId);
    if (room) this.selectRoom(room);
    else this.loadChatRooms();
  }

  startNewChat(): void {
    this.showSnackbar('Coming soon!', 'info');
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentRoom || this.sending) return;
    if (this.newMessage.length > 5000) {
      this.showSnackbar('Message too long (max 5000 chars)', 'warning');
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
          this.selectedFile = null;
          this.filePreview = null;
          this.stopTyping();
          this.focusMessageInput();
          setTimeout(() => this.scrollToBottom(), 100);
        } else {
          this.showSnackbar(response.message || 'Failed to send', 'error');
        }
      },
      error: () => {
        this.sending = false;
        this.showSnackbar('Failed to send message', 'error');
      }
    });
  }

  private focusMessageInput(): void {
    if (this.messageInput?.nativeElement) {
      setTimeout(() => this.messageInput.nativeElement.focus(), 0);
    }
  }

  deleteMessage(messageId: number): void {
    if (!confirm('Delete this message?')) return;
    
    this.chatService.deleteMessage(messageId).subscribe({
      next: (response: BasicResponse) => {
        if (response.success) {
          this.showSnackbar('Message deleted', 'success');
        } else {
          this.showSnackbar('Failed to delete', 'error');
        }
      },
      error: () => this.showSnackbar('Failed to delete message', 'error')
    });
  }

  onMessageInput(): void {
    if (!this.currentRoom) return;
    if (!this.isTyping) {
      this.isTyping = true;
      this.chatService.startTyping(this.currentRoom.id).subscribe();
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.stopTyping(), 1000);
  }

  stopTyping(): void {
    if (this.isTyping && this.currentRoom) {
      this.isTyping = false;
      this.chatService.stopTyping(this.currentRoom.id).subscribe();
    }
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
    this.focusMessageInput();
  }

  triggerFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  handleFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.showSnackbar('File too large (max 10MB)', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'audio/mpeg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      this.showSnackbar('File type not supported', 'error');
      return;
    }

    this.selectedFile = file;
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.filePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      this.filePreview = null;
    }

    this.showSnackbar(`File selected: ${file.name}`, 'success');
  }

  clearFileSelection(): void {
    this.selectedFile = null;
    this.filePreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  getRoomTypeDisplay(room: ChatRoom): string {
    const types: any = {
      'TENANT_LANDLORD': 'Tenant ↔ Landlord',
      'TENANT_CARETAKER': 'Tenant ↔ Caretaker',
      'LANDLORD_CARETAKER': 'Landlord ↔ Caretaker'
    };
    return types[room.participantType] || 'Chat';
  }

  shouldShowConnectionWarning(): boolean {
    return !this.webSocketConnected && this.currentRoom !== null;
  }

  searchRooms(): void {
    // Handled by getFilteredRooms()
  }

  showDateSeparator(message: ChatMessage): boolean {
    const idx = this.messages.indexOf(message);
    if (idx === 0) return true;
    const curr = new Date(message.timestamp).toDateString();
    const prev = new Date(this.messages[idx - 1].timestamp).toDateString();
    return curr !== prev;
  }

  getMessageDate(timestamp: string): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  getParticipantRole(participant: User | undefined): string {
    if (!participant?.role) return 'User';
    const roles: any = {
      'LANDLORD': 'Landlord',
      'CARETAKER': 'Caretaker',
      'TENANT': 'Tenant',
      'ADMIN': 'Admin'
    };
    return roles[participant.role.toUpperCase()] || participant.role;
  }

  getStatusIcon(status: string | undefined): string {
    const icons: any = {
      'SENDING': 'schedule',
      'SENT': 'check',
      'DELIVERED': 'done_all',
      'READ': 'visibility',
      'FAILED': 'error'
    };
    return icons[status || ''] || 'schedule';
  }

  replyToMessage(message: ChatMessage): void {
    const prefix = `Reply: "${message.content.substring(0, 30)}..." `;
    this.newMessage = prefix;
    this.focusMessageInput();
  }

  toggleMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  clearChat(): void {
    this.showMenu = false;
    if (!this.currentRoom || !confirm('Clear all messages?')) return;
    const ids = this.messages.map(m => m.id);
    if (ids.length > 0) {
      this.chatService.deleteMessagesBatch(ids).subscribe({
        next: (r: BasicResponse) => {
          if (r.success) {
            this.messages = [];
            this.showSnackbar('Chat cleared', 'success');
          }
        },
        error: () => this.showSnackbar('Failed to clear', 'error')
      });
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
    this.showSnackbar('Refreshing...', 'info');
  }

  formatMessageTime(timestamp: string): string {
    try {
      if (!timestamp) return 'Just now';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Just now';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Just now';
    }
  }

  formatLastMessageTime(room: ChatRoom): string {
    if (!room.lastMessage?.timestamp) return '';
    return this.formatMessageTime(room.lastMessage.timestamp);
  }

  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.generateRoomDisplayName(room, this.currentUserId) || 'Unknown';
  }

  getOtherParticipants(room: ChatRoom): User[] {
    return this.chatService.getOtherParticipants(room, this.currentUserId) || [];
  }

  isMyMessage(message: ChatMessage): boolean {
    return this.chatService.isMyMessage(message);
  }

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) return 'No messages';
    const content = room.lastMessage.content;
    return content.length > 35 ? content.substring(0, 35) + '...' : content;
  }

  getAvatarColor(id: number): string {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
    return colors[Math.abs(id) % colors.length];
  }

  getTotalUnreadCount(): number {
    return this.chatRooms.reduce((t, r) => t + (r.unreadCount || 0), 0);
  }

  isUserOnline(room: ChatRoom): boolean {
    return this.getOtherParticipants(room).some(p => p.isOnline);
  }

  shouldShowAvatar(idx: number): boolean {
    if (idx === 0) return true;
    return this.messages[idx].senderId !== this.messages[idx - 1].senderId;
  }

  shouldShowSenderName(idx: number): boolean {
    return this.shouldShowAvatar(idx);
  }

  retryMessage(message: ChatMessage): void {
    if (message.status !== 'FAILED') return;
    this.chatService.sendMessage({
      chatRoomId: message.chatRoomId,
      content: message.content,
      messageType: 'TEXT'
    }).subscribe({
      next: (r: BasicResponse) => {
        if (r.success) this.showSnackbar('Message sent!', 'success');
        else this.showSnackbar('Failed to send', 'error');
      },
      error: () => this.showSnackbar('Failed to send', 'error')
    });
  }

  trackByMessageId(i: number, m: ChatMessage): number {
    return m.id;
  }

  trackByRoomId(i: number, r: ChatRoom): number {
    return r.id;
  }

  getConnectionStatusText(): string {
    return this.webSocketConnected ? 'Real-time' : 'Standard';
  }

  getConnectionStatusColor(): string {
    return this.webSocketConnected ? '#10b981' : '#f59e0b';
  }

  getFilteredRooms(): ChatRoom[] {
    if (!this.searchQuery.trim()) return this.chatRooms;
    const q = this.searchQuery.toLowerCase();
    return this.chatRooms.filter(r =>
      this.getRoomDisplayName(r).toLowerCase().includes(q) ||
      r.propertyName?.toLowerCase().includes(q) ||
      r.lastMessage?.content.toLowerCase().includes(q)
    );
  }

  scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        setTimeout(() => {
          const el = this.messagesContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
        }, 100);
      }
    } catch {}
  }

  private showSnackbar(msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: [`snackbar-${type}`] });
  }
}