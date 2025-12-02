import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { CaretakerService } from '../../services/caretaker.service';
import { TenantService } from '../../services/tenant.service';
import { Message, ChatRoom, Property, Unit, ChatRoomType, ApiResponse, Participant } from '../../services/chat.interface';
import { Observable, of, Subscription, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';

interface EnrichedChatInfo {
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatMenuModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;
  
  rooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: Message[] = [];
  newMessage = '';
  isConnected = false;
  showEmojiPicker = false;
  uploadingFiles = false;

  userProperties: Property[] = [];
  userUnits: Unit[] = [];
  userRole: string = '';
  
  showNewChatModal = false;
  loadingProperties = false;
  loadingRooms = false;
  loadingUnits = false;
  shouldScrollToBottom = false;

  currentStep: 'SELECT_PROPERTY' | 'SELECT_RECIPIENT' | 'SELECT_UNIT' = 'SELECT_PROPERTY';
  selectedPropertyId: number | null = null;
  selectedUnitId: number | null = null;
  selectedChatType: ChatRoomType | null = null;
  availableUnits: Unit[] = [];
  
  tenantProperties: Property[] = [];
  selectedTenantPropertyId: number | null = null;
  
  selectedCaretakerPropertyId: number | null = null;

  currentChatInfo: EnrichedChatInfo | null = null;
  participantDataCache = new Map<number, any>();

  private authSubscription?: Subscription;
  private isInitialized = false;

  readonly CHAT_TYPES = {
    TENANT_LANDLORD: 'tenant-landlord' as ChatRoomType,
    TENANT_CARETAKER: 'tenant-caretaker' as ChatRoomType,
    LANDLORD_CARETAKER: 'landlord-caretaker' as ChatRoomType,
    LANDLORD_TENANT: 'landlord-tenant' as ChatRoomType,
    CARETAKER_TENANT: 'caretaker-tenant' as ChatRoomType
  };

  emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '😎',
    '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
    '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '💪',
    '🙏', '✍️', '💅', '🤳', '💃', '🕺', '👯', '🧘', '🛀', '🛌',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✨', '💫', '⭐', '🌟', '✴️', '🎊', '🎉', '🎈', '🎁', '🏆',
    '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉'
  ];

  private router = inject(Router);

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private propertyService: PropertyService,
    private caretakerService: CaretakerService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.setupAuthMonitoring();
    this.initializeComponent();
  }

  private setupAuthMonitoring(): void {
    this.authSubscription = this.authService.isAuthenticated$.subscribe({
      next: (isAuthenticated: boolean) => {
        if (!isAuthenticated && this.isInitialized) {
          this.cleanupOnLogout();
        } else if (isAuthenticated && !this.isInitialized) {
          this.initializeComponent();
        }
      },
      error: (error: any) => {
        console.error('Error in auth subscription:', error);
      }
    });
  }

  private initializeComponent(): void {
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin();
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    this.userRole = currentUser?.role?.toUpperCase() || '';
    
    this.loadUserDataAutomatically();
    this.initializeSubscriptions();
    this.isInitialized = true;
  }

  private cleanupOnLogout(): void {
    this.rooms = [];
    this.currentRoom = null;
    this.messages = [];
    this.userProperties = [];
    this.userUnits = [];
    this.availableUnits = [];
    this.selectedPropertyId = null;
    this.selectedUnitId = null;
    this.selectedChatType = null;
    this.selectedTenantPropertyId = null;
    this.selectedCaretakerPropertyId = null;
    this.isInitialized = false;
    this.chatService.disconnect();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.chatService.disconnect();
    this.isInitialized = false;
  }

  private initializeSubscriptions(): void {
    this.chatService.rooms$.subscribe({
      next: (rooms: ChatRoom[]) => {
        this.rooms = rooms ?? [];
        this.loadingRooms = false;
        this.rooms.forEach(room => this.enrichRoomParticipants(room));
      },
      error: (error: any) => {
        console.error('Error in rooms subscription:', error);
        this.loadingRooms = false;
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.currentRoom$.subscribe({
      next: (room: ChatRoom | null) => {
        this.currentRoom = room;
        if (room) {
          this.enrichRoomParticipants(room);
          this.updateCurrentChatInfo();
        } else {
          this.currentChatInfo = null;
        }
      },
      error: (error: any) => {
        console.error('Error in currentRoom subscription:', error);
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.messages$.subscribe({
      next: (messages: Message[]) => {
        const oldLength = this.messages.length;
        this.messages = messages ?? [];
        
        if (this.messages.length > oldLength) {
          this.shouldScrollToBottom = true;
        }
      },
      error: (error: any) => {
        console.error('Error in messages subscription:', error);
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.connected$.subscribe({
      next: (connected: boolean) => {
        this.isConnected = connected;
      },
      error: (error: any) => {
        console.error('Error in connected subscription:', error);
      }
    });
  }

  openNewChatModal(): void {
    this.resetModalState();
    
    if (this.userRole === 'TENANT') {
      if (this.tenantProperties.length === 0) {
        this.loadTenantProperties();
      }
      
      if (this.tenantProperties.length === 1) {
        this.selectedTenantPropertyId = this.tenantProperties[0].id;
        this.currentStep = 'SELECT_RECIPIENT';
      } else if (this.tenantProperties.length > 1) {
        this.currentStep = 'SELECT_PROPERTY';
      } else {
        alert('No properties assigned. Please contact your landlord.');
        return;
      }
    } else if (this.userRole === 'LANDLORD') {
      if (this.userProperties.length === 0) {
        alert('No properties available. Please create a property first.');
        return;
      }
      this.currentStep = 'SELECT_PROPERTY';
    } else if (this.userRole === 'CARETAKER') {
      if (this.userProperties.length === 0) {
        alert('No properties assigned. Please contact the landlord.');
        return;
      }
      this.currentStep = 'SELECT_PROPERTY';
    }
    
    this.showNewChatModal = true;
  }

  private loadTenantProperties(): void {
    const uniqueProperties = new Map<number, Property>();
    this.userUnits.forEach(unit => {
      if (unit.propertyId && !uniqueProperties.has(unit.propertyId)) {
        uniqueProperties.set(unit.propertyId, {
          id: unit.propertyId,
          name: unit.propertyName || `Property ${unit.propertyId}`,
          address: 'No address'
        });
      }
    });
    this.tenantProperties = Array.from(uniqueProperties.values());
  }

  private resetModalState(): void {
    this.selectedPropertyId = null;
    this.selectedUnitId = null;
    this.selectedChatType = null;
    this.selectedTenantPropertyId = null;
    this.selectedCaretakerPropertyId = null;
    this.availableUnits = [];
    this.currentStep = 'SELECT_PROPERTY';
  }

  onPropertySelected(event: any): void {
    const propertyId = +event.target.value;
    
    if (this.userRole === 'TENANT') {
      this.selectedTenantPropertyId = propertyId;
      this.currentStep = 'SELECT_RECIPIENT';
    } else if (this.userRole === 'LANDLORD') {
      this.selectedPropertyId = propertyId;
      this.currentStep = 'SELECT_RECIPIENT';
    } else if (this.userRole === 'CARETAKER') {
      this.selectedCaretakerPropertyId = propertyId;
      this.currentStep = 'SELECT_RECIPIENT';
    }
  }

  onRecipientTypeSelected(chatType: ChatRoomType): void {
    this.selectedChatType = chatType;
    
    if (this.userRole === 'LANDLORD' && chatType === this.CHAT_TYPES.LANDLORD_TENANT) {
      this.loadUnitsForSelectedProperty();
      this.currentStep = 'SELECT_UNIT';
    } else if (this.userRole === 'CARETAKER' && chatType === this.CHAT_TYPES.CARETAKER_TENANT) {
      this.loadUnitsForCaretakerProperty();
      this.currentStep = 'SELECT_UNIT';
    } else {
      this.createChatNow();
    }
  }

  private loadUnitsForSelectedProperty(): void {
    if (!this.selectedPropertyId) return;
    
    this.loadingUnits = true;
    this.propertyService.getPropertyUnits(this.selectedPropertyId.toString()).subscribe({
      next: (response: any) => {
        this.availableUnits = this.extractUnits(response);
        this.loadingUnits = false;
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
        alert('Failed to load units. Please try again.');
      }
    });
  }

  private loadUnitsForCaretakerProperty(): void {
    const propertyId = this.selectedCaretakerPropertyId || 
                      (this.userProperties.length > 0 ? this.userProperties[0].id : null);
    
    if (!propertyId) {
      alert('Please select a property first.');
      return;
    }
    
    this.loadingUnits = true;
    this.propertyService.getPropertyUnits(propertyId.toString()).subscribe({
      next: (response: any) => {
        this.availableUnits = this.extractUnits(response);
        this.loadingUnits = false;
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
        alert('Failed to load units. Please try again.');
      }
    });
  }

  onUnitSelected(event: any): void {
    const unitId = +event.target.value;
    
    if (this.userRole === 'LANDLORD') {
      this.selectedUnitId = unitId;
    } else if (this.userRole === 'CARETAKER') {
      this.selectedUnitId = unitId;
    }
    
    if (unitId) {
      this.createChatNow();
    }
  }

  createChat(chatType: ChatRoomType): void {
    this.selectedChatType = chatType;
    
    if (this.userRole === 'TENANT') {
      const propertyId = this.selectedTenantPropertyId || 
                        (this.tenantProperties.length === 1 ? this.tenantProperties[0].id : null);
      
      if (!propertyId) {
        alert('No property selected. Please select a property.');
        return;
      }
      
      this.selectedPropertyId = propertyId;
    }
    
    this.createChatNow();
  }

  // FIX: Changed from private to public
  createChatNow(): void {
    if (!this.selectedChatType) return;

    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    console.log('Creating chat with:', {
      userRole: this.userRole,
      chatType: this.selectedChatType,
      selectedPropertyId: this.selectedPropertyId,
      selectedUnitId: this.selectedUnitId,
      selectedTenantPropertyId: this.selectedTenantPropertyId,
      selectedCaretakerPropertyId: this.selectedCaretakerPropertyId
    });

    switch(this.selectedChatType) {
      case this.CHAT_TYPES.TENANT_LANDLORD:
        if (this.userRole === 'TENANT') {
          resourceId = this.selectedPropertyId || this.selectedTenantPropertyId;
          createObservable = resourceId ? this.chatService.createTenantLandlordChat(resourceId) : null;
        }
        break;

      case this.CHAT_TYPES.TENANT_CARETAKER:
        if (this.userRole === 'TENANT') {
          resourceId = this.selectedPropertyId || this.selectedTenantPropertyId;
          createObservable = resourceId ? this.chatService.createTenantCaretakerChat(resourceId) : null;
        }
        break;

      case this.CHAT_TYPES.LANDLORD_CARETAKER:
        if (this.userRole === 'LANDLORD') {
          resourceId = this.selectedPropertyId;
          createObservable = resourceId ? this.chatService.createLandlordCaretakerChat(resourceId) : null;
        }
        break;

      case this.CHAT_TYPES.LANDLORD_TENANT:
        if (this.userRole === 'LANDLORD') {
          resourceId = this.selectedUnitId;
          createObservable = resourceId ? this.chatService.createLandlordTenantChat(resourceId) : null;
        }
        break;

      case this.CHAT_TYPES.CARETAKER_TENANT:
        if (this.userRole === 'CARETAKER') {
          resourceId = this.selectedUnitId;
          createObservable = resourceId ? this.chatService.createCaretakerTenantChat(resourceId) : null;
        }
        break;
    }

    if (!createObservable) {
      alert('Unable to create chat. Please check your selection.');
      return;
    }

    this.loadingRooms = true;
    
    createObservable.subscribe({
      next: (response: any) => {
        this.loadingRooms = false;
        
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.selectRoom(response.data);
          this.resetModalState();
        } else {
          const errorMsg = response?.message || 'Unknown error occurred';
          alert('Failed to create chat: ' + errorMsg);
        }
      },
      error: (error: any) => {
        this.loadingRooms = false;
        console.error('Chat creation error:', error);
        
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
        
        let errorMessage = 'Failed to create chat. ';
        
        if (error.status === 400) {
          errorMessage += 'The resource might not exist or you may not have permission.';
        } else if (error.status === 404) {
          errorMessage += 'The requested resource was not found.';
        } else if (error.status === 403) {
          errorMessage += 'You do not have permission to create this chat.';
        } else if (error.message) {
          errorMessage = error.message;
        } else {
          errorMessage += error.error?.message || 'Please try again.';
        }
        
        alert(errorMessage);
      }
    });
  }

  // FIX: Added refreshRooms method
  refreshRooms(): void {
    this.loadingRooms = true;
    this.chatService.refreshRooms().subscribe({
      next: (rooms: ChatRoom[]) => {
        this.loadingRooms = false;
        this.rooms = rooms ?? [];
        console.log('Chat rooms refreshed successfully');
      },
      error: (error: any) => {
        console.error('Error refreshing rooms:', error);
        this.loadingRooms = false;
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });
  }

  getPropertyName(propertyId: number): string {
    let property: Property | undefined;
    
    if (this.userRole === 'TENANT') {
      property = this.tenantProperties.find(p => p.id === propertyId);
    } else {
      property = this.userProperties.find(p => p.id === propertyId);
    }
    
    return property?.name || `Property ${propertyId}`;
  }

  getUnitDisplay(unitId: number): string {
    const unit = this.availableUnits.find(u => u.id === unitId);
    if (!unit) return 'Unknown Unit';
    return `Unit ${unit.unitNumber}`;
  }

  handleFiles(files: File[]): void {
    if (!this.currentRoom) {
      alert('Please select a chat room first');
      return;
    }

    this.uploadingFiles = true;
    
    files.forEach((file: File) => {
      const fileMessage = `File: ${file.name} (${this.formatFileSize(file.size)})`;
      
      this.chatService.sendMessage(fileMessage, this.currentRoom!.id).subscribe({
        next: () => {
          this.shouldScrollToBottom = true;
        },
        error: (error: any) => {
          console.error('Error sending file:', error);
          if (this.shouldHandleAuthError(error)) {
            this.handleAuthError(error);
          } else {
            alert('Failed to send file. Please try again.');
          }
        },
        complete: () => {
          this.uploadingFiles = false;
        }
      });
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.resetModalState();
  }

  selectRoom(room: ChatRoom): void {
    if (!this.authService.isAuthenticated()) {
      this.handleAuthError({ status: 401 });
      return;
    }

    if (!room || !room.id) {
      return;
    }

    this.currentRoom = room;
    this.messages = [];
    
    this.chatService.selectRoom(room);
    this.shouldScrollToBottom = true;

    setTimeout(() => {
      this.chatService.getMessages(room.id);
    }, 100);
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.currentRoom) {
      const messageToSend = this.newMessage.trim();
      this.newMessage = '';
      this.hideEmojiPicker();
      
      if (!this.authService.isAuthenticated()) {
        this.handleAuthError({ status: 401 });
        this.newMessage = messageToSend;
        return;
      }
      
      this.chatService.sendMessage(messageToSend, this.currentRoom.id).subscribe({
        next: () => {
          this.shouldScrollToBottom = true;
        },
        error: (error: any) => {
          console.error('Error sending message:', error);
          if (this.shouldHandleAuthError(error)) {
            this.handleAuthError(error);
          } else {
            alert('Failed to send message. Please try again.');
          }
          this.newMessage = messageToSend;
        }
      });
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    if (this.currentRoom && confirm('Are you sure you want to clear all messages in this chat?')) {
      this.chatService.clearChat(this.currentRoom.id).subscribe({
        next: () => {
          this.messages = [];
        },
        error: (error: any) => {
          console.error('Error clearing chat:', error);
          alert('Failed to clear chat.');
        }
      });
    }
  }

  deleteMessage(messageId: number): void {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatService.deleteMessage(messageId).subscribe({
        error: (error: any) => {
          console.error('Error deleting message:', error);
          if (this.shouldHandleAuthError(error)) {
            this.handleAuthError(error);
          } else {
            alert('Failed to delete message.');
          }
        }
      });
    }
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  hideEmojiPicker(): void {
    this.showEmojiPicker = false;
  }

  addEmoji(emoji: string): void {
    this.newMessage += emoji;
    this.hideEmojiPicker();
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files?.length > 0 && this.currentRoom) {
      this.handleFiles(Array.from(files));
    }
    event.target.value = '';
  }

  trackByRoomId(index: number, room: ChatRoom): number {
    return room?.id ?? index;
  }

  trackByMessageId(index: number, message: Message): number {
    return message?.id ?? index;
  }

  trackByPropertyId(index: number, property: Property): number {
    return property?.id ?? index;
  }

  trackByUnitId(index: number, unit: Unit): number {
    return unit?.id ?? index;
  }

  isMyMessage(message: Message): boolean {
    return this.chatService.isMyMessage(message);
  }

  getMessageStatusIcon(message: Message): string {
    switch(message.status) {
      case 'READ': return 'done_all';
      case 'DELIVERED': return 'done_all';
      case 'SENT': return 'done';
      case 'FAILED': return 'error';
      default: return 'schedule';
    }
  }

  getMessageStatusClass(message: Message): string {
    return `status-${message.status?.toLowerCase() || 'sent'}`;
  }

  formatTime(timestamp: Date): string {
    return this.chatService.formatTime(timestamp);
  }

  formatMessageTime(timestamp: Date): string {
    return this.chatService.formatMessageTime(timestamp);
  }

  getLastMessageTime(room: ChatRoom): string {
    if (!room?.lastMessage?.sentAt) return '';
    return this.formatTime(room.lastMessage.sentAt);
  }

  getUnreadCount(room: ChatRoom): number {
    return room?.unreadCount || 0;
  }

  goBack(): void {
    this.chatService.selectRoom(null);
  }

  reconnect(): void {
    this.chatService.reconnect();
  }

  getConnectionStatus(): string {
    return this.isConnected ? 'Connected' : 'Disconnected';
  }

  getCurrentPropertyName(): string {
    if (this.userRole === 'TENANT' && this.userUnits.length > 0) {
      const unit = this.userUnits[0];
      return unit['propertyName'] 
        ? `${unit['propertyName']} - Unit ${unit.unitNumber}`
        : `Unit ${unit.unitNumber}`;
    } else if (this.userProperties.length > 0) {
      return this.userProperties[0].name;
    }
    return 'No Property/Unit';
  }

  getChatHeaderInfo(): { title: string, subtitle: string, description: string } {
    if (!this.currentChatInfo) {
      return { title: 'Chat', subtitle: '', description: '' };
    }
    return {
      title: this.currentChatInfo.title,
      subtitle: this.currentChatInfo.subtitle,
      description: this.currentChatInfo.description
    };
  }

  formatChatName(room: ChatRoom): string {
    if (!room) return 'Chat';
    
    const currentUser = this.authService.getCurrentUser();
    const otherParticipants = room.participants?.filter(p => p.id !== currentUser?.id) || [];
    
    if (otherParticipants.length === 1) {
      const participant = otherParticipants[0];
      const cachedData = this.participantDataCache.get(participant.id) || {};
      const role = participant.role?.toUpperCase();
      
      let name = participant.name || participant.fullName || 'User';
      
      if (role === 'TENANT' && cachedData.unitNumber) {
        return `${name} • Unit ${cachedData.unitNumber}`;
      } else if (role === 'CARETAKER') {
        return 'Caretaker';
      } else if (role === 'LANDLORD' && cachedData.propertyName) {
        return `${name} • ${cachedData.propertyName}`;
      }
      
      return name;
    } else if (otherParticipants.length > 1) {
      const names = otherParticipants.map(p => p.name || 'User').join(', ');
      return names.length > 30 ? names.substring(0, 30) + '...' : names;
    }
    
    const roleBasedNames: { [key: string]: string } = {
      'tenant-landlord': 'Landlord',
      'tenant-caretaker': 'Caretaker',
      'landlord-caretaker': 'Caretaker',
      'landlord-tenant': 'Tenant',
      'caretaker-tenant': 'Tenant'
    };
    
    return roleBasedNames[room.type] || 'Chat';
  }

  getMessageSenderInfo(message: Message): string {
    if (this.isMyMessage(message)) {
      return 'You';
    }
    
    if (!this.currentRoom) return message.senderName || 'Unknown';
    
    const participant = this.currentRoom.participants.find(p => p.id === message.senderId);
    if (!participant) return message.senderName || 'Unknown';
    
    const cachedData = this.participantDataCache.get(participant.id) || {};
    const role = participant.role?.toUpperCase();
    const name = participant.name || participant.fullName || message.senderName || 'User';
    
    if (role === 'TENANT' && cachedData.unitNumber) {
      return `${name} (Unit ${cachedData.unitNumber})`;
    } else if (role === 'CARETAKER') {
      return 'Caretaker';
    } else if (role === 'LANDLORD' && cachedData.propertyName) {
      return `${name} (${cachedData.propertyName})`;
    }
    
    return `${name} (${this.formatRole(role)})`;
  }

  private shouldHandleAuthError(error: any): boolean {
    return error?.status === 401 && !this.isRoleBasedUnauthorized(error);
  }

  private isRoleBasedUnauthorized(error: any): boolean {
    if (error?.status === 401 && this.authService.isAuthenticated()) {
      const url = error.url || '';
      
      if (url.includes('/api/tenant/') && !this.authService.isTenant()) {
        return true;
      }
      
      if (url.includes('/api/landlord/') && !this.authService.isLandlord()) {
        return true;
      }
      
      if (url.includes('/api/caretaker/') && !this.authService.isCaretaker()) {
        return true;
      }
    }
    
    return false;
  }

  private loadUserDataAutomatically(): void {
    this.loadingProperties = true;
    
    if (!this.userRole) {
      this.loadingProperties = false;
      return;
    }

    let dataObservable: Observable<any>;

    switch(this.userRole) {
      case 'TENANT':
        dataObservable = this.tenantService.getTenantUnits();
        break;
      case 'LANDLORD':
        dataObservable = this.propertyService.getProperties();
        break;
      case 'CARETAKER':
        dataObservable = this.caretakerService.getProperties();
        break;
      default:
        this.loadingProperties = false;
        return;
    }

    dataObservable.subscribe((response: any) => {
      console.log(`🔍 ${this.userRole} data response:`, response);
      
      this.processUserData(response, this.userRole);
      this.loadingProperties = false;
      
      if (this.userRole === 'TENANT') {
        this.loadTenantProperties();
      }
      
      this.ensureChatConnection();
    });
  }

  private ensureChatConnection(): void {
    if (!this.isConnected) {
      this.chatService.reconnect();
    }
  }

  private processUserData(response: any, userRole: string): void {
    switch(userRole) {
      case 'TENANT':
        this.userUnits = this.extractUnits(response);
        this.userProperties = this.extractPropertiesFromUnits(response);
        console.log('✅ Tenant units loaded:', this.userUnits.length);
        console.log('✅ Tenant properties extracted:', this.userProperties.length);
        break;
      case 'LANDLORD':
      case 'CARETAKER':
        this.userProperties = this.extractProperties(response);
        console.log(`✅ ${userRole} properties loaded:`, this.userProperties.length);
        break;
    }
  }

  private enrichRoomParticipants(room: ChatRoom): void {
    if (!room.participants || room.participants.length === 0) return;

    room.participants.forEach(participant => {
      if (!this.participantDataCache.has(participant.id)) {
        this.fetchParticipantData(participant).subscribe(enrichedData => {
          this.participantDataCache.set(participant.id, enrichedData);
          Object.assign(participant, enrichedData);
          if (this.currentRoom?.id === room.id) {
            this.updateCurrentChatInfo();
          }
        });
      } else {
        Object.assign(participant, this.participantDataCache.get(participant.id));
      }
    });
  }

  private fetchParticipantData(participant: Participant): Observable<any> {
    const role = participant.role?.toUpperCase();
    const currentUserId = this.chatService.getCurrentUserId();

    if (participant.id === currentUserId) {
      return of({});
    }

    switch(role) {
      case 'TENANT':
        return this.fetchTenantData(participant.id);
      case 'LANDLORD':
        return this.fetchLandlordData(participant.id);
      case 'CARETAKER':
        return this.fetchCaretakerData(participant.id);
      default:
        return of({});
    }
  }

  private fetchTenantData(tenantId: number): Observable<any> {
    if (!this.authService.isTenant() && !this.authService.isLandlord()) {
      return of({});
    }
    
    return this.tenantService.getTenantUnits().pipe(
      map((response: any) => {
        const units = this.extractUnits(response);
        if (units.length > 0) {
          const primaryUnit = units[0];
          return {
            unitNumber: primaryUnit.unitNumber,
            propertyId: primaryUnit.propertyId,
            propertyName: primaryUnit.propertyName,
            unitType: primaryUnit.unitType,
            rentAmount: primaryUnit.rentAmount
          };
        }
        return {};
      }),
      catchError(() => of({}))
    );
  }

  private fetchLandlordData(landlordId: number): Observable<any> {
    return this.propertyService.getProperties().pipe(
      map((properties: any) => {
        const extracted = this.extractProperties(properties);
        if (extracted && extracted.length > 0) {
          const primaryProperty = extracted[0];
          return {
            propertyId: primaryProperty.id,
            propertyName: primaryProperty.name,
            propertyAddress: primaryProperty.address || primaryProperty.location
          };
        }
        return {};
      }),
      catchError(() => of({}))
    );
  }

  private fetchCaretakerData(caretakerId: number): Observable<any> {
    return this.caretakerService.getProperties().pipe(
      map((properties: any) => {
        const extracted = this.extractProperties(properties);
        if (extracted && extracted.length > 0) {
          const primaryProperty = extracted[0];
          return {
            propertyId: primaryProperty.id,
            propertyName: primaryProperty.name,
            managedProperties: extracted.length
          };
        }
        return {};
      }),
      catchError(() => of({}))
    );
  }

  private updateCurrentChatInfo(): void {
    if (!this.currentRoom) {
      this.currentChatInfo = null;
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const otherParticipants = this.currentRoom.participants?.filter(p => p.id !== currentUser?.id) || [];

    if (otherParticipants.length === 0) {
      this.currentChatInfo = this.getDefaultChatInfo(this.currentRoom.type);
      return;
    }

    if (otherParticipants.length === 1) {
      this.currentChatInfo = this.getSingleParticipantInfo(otherParticipants[0], this.currentRoom);
    } else {
      this.currentChatInfo = this.getMultipleParticipantsInfo(otherParticipants, this.currentRoom);
    }
  }

  private getSingleParticipantInfo(participant: Participant, room: ChatRoom): EnrichedChatInfo {
    const role = participant.role?.toUpperCase();
    const cachedData = this.participantDataCache.get(participant.id) || {};
    
    let title = participant.name || participant.fullName || 'User';
    let subtitle = '';
    let description = '';
    let badge = '';

    switch(role) {
      case 'TENANT':
        subtitle = 'Tenant';
        if (cachedData.unitNumber) {
          badge = `Unit ${cachedData.unitNumber}`;
          subtitle = badge;
        }
        if (cachedData.propertyName) {
          description = cachedData.propertyName;
        }
        if (badge && description) {
          description = `${badge} • ${description}`;
        }
        break;
      case 'LANDLORD':
        subtitle = 'Property Owner';
        if (cachedData.propertyName) {
          description = cachedData.propertyName;
          badge = 'Owner';
        }
        break;
      case 'CARETAKER':
        title = 'Property Caretaker';
        subtitle = 'Maintenance & Support';
        if (cachedData.propertyName) {
          description = `Managing ${cachedData.propertyName}`;
        }
        if (cachedData.managedProperties > 1) {
          badge = `${cachedData.managedProperties} properties`;
        }
        break;
    }

    return { title, subtitle, description, badge };
  }

  private getMultipleParticipantsInfo(participants: Participant[], room: ChatRoom): EnrichedChatInfo {
    const roles = [...new Set(participants.map(p => this.formatRole(p.role)))].join(', ');
    
    let description = '';
    if (room.propertyName) {
      description = room.propertyName;
    }
    if (room.unitNumber) {
      description = description ? `${description} • Unit ${room.unitNumber}` : `Unit ${room.unitNumber}`;
    }

    return {
      title: `${participants.length} participants`,
      subtitle: roles,
      description,
      badge: `${participants.length}`
    };
  }

  private getDefaultChatInfo(roomType: ChatRoomType): EnrichedChatInfo {
    const infoMap: { [key: string]: EnrichedChatInfo } = {
      'tenant-landlord': { 
        title: 'Landlord', 
        subtitle: 'Property Owner',
        description: 'Property inquiries & requests'
      },
      'tenant-caretaker': { 
        title: 'Caretaker', 
        subtitle: 'Property Maintenance',
        description: 'Maintenance & support'
      },
      'landlord-caretaker': { 
        title: 'Caretaker', 
        subtitle: 'Property Manager',
        description: 'Property management'
      },
      'landlord-tenant': { 
        title: 'Tenant', 
        subtitle: 'Property Resident',
        description: 'Tenant communication'
      },
      'caretaker-tenant': { 
        title: 'Tenant', 
        subtitle: 'Unit Resident',
        description: 'Maintenance communication'
      }
    };

    return infoMap[roomType] || { 
      title: 'Chat', 
      subtitle: '',
      description: ''
    };
  }

  private handleAuthError(error: any): void {
    console.warn('Authentication error detected:', error);
    
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin();
    }
  }

  private redirectToLogin(): void {
    this.cleanupOnLogout();
    this.router.navigate(['/login']);
  }

  private extractProperties(response: any): Property[] {
    if (!response) return [];
    
    console.log('🔍 extractProperties() called with:', response);
    
    let propertiesData: any[] = [];
    
    if (Array.isArray(response)) {
      propertiesData = response;
    } else if (response?.data && Array.isArray(response.data)) {
      propertiesData = response.data;
    } else if (response?.properties && Array.isArray(response.properties)) {
      propertiesData = response.properties;
    } else if (response?.content && Array.isArray(response.content)) {
      propertiesData = response.content;
    } else if (response?.success && response.data && Array.isArray(response.data)) {
      propertiesData = response.data;
    } else if (response?.success && response.properties && Array.isArray(response.properties)) {
      propertiesData = response.properties;
    } else if (response && typeof response === 'object' && !Array.isArray(response)) {
      propertiesData = [response];
    }
    
    console.log('🔍 extractProperties: Extracted data:', propertiesData);
    
    const processedProperties = propertiesData.map((item: any) => {
      const propertyData = item.property || item;
      
      return {
        id: propertyData.id || item.id || 0,
        name: propertyData.name || item.name || `Property ${propertyData.id || item.id}`,
        address: propertyData.address || item.address || item.location || 'No address',
        location: propertyData.location || item.location || item.address || 'No location',
        description: propertyData.description || item.description || '',
        propertyType: propertyData.propertyType || item.propertyType || 'RESIDENTIAL',
        totalUnits: propertyData.totalUnits || item.totalUnits || 0,
        ownerId: propertyData.ownerId || item.ownerId,
        ownerName: propertyData.ownerName || item.ownerName || '',
        imageUrl: propertyData.imageUrl || item.imageUrl,
        amenities: propertyData.amenities || item.amenities || []
      };
    }).filter((property: Property) => property.id);
    
    console.log('✅ extractProperties: Processed properties:', processedProperties);
    return processedProperties;
  }

  private extractPropertiesFromUnits(response: any): Property[] {
    if (!response) return [];
    const units = this.extractUnits(response);
    const uniqueProperties = new Map<number, Property>();
    
    units.forEach(unit => {
      if (unit.propertyId && !uniqueProperties.has(unit.propertyId)) {
        const extendedUnit = unit as Unit & { propertyName?: string; propertyAddress?: string };
        
        uniqueProperties.set(unit.propertyId, {
          id: unit.propertyId,
          name: extendedUnit.propertyName || `Property ${unit.propertyId}`,
          address: extendedUnit.propertyAddress || 'No address',
          location: extendedUnit.propertyAddress || 'No address'
        });
      }
    });
    
    const result = Array.from(uniqueProperties.values());
    console.log('✅ extractPropertiesFromUnits: Extracted properties:', result);
    return result;
  }

  private extractUnits(response: any): Unit[] {
    if (!response) return [];
    
    console.log('🔍 extractUnits() called with:', response);
    
    let unitsData: any[] = [];
    
    if (Array.isArray(response)) {
      unitsData = response;
    } else if (response?.data && Array.isArray(response.data)) {
      unitsData = response.data;
    } else if (response?.units && Array.isArray(response.units)) {
      unitsData = response.units;
    } else if (response?.content && Array.isArray(response.content)) {
      unitsData = response.content;
    } else if (response?.success && response.data && Array.isArray(response.data)) {
      unitsData = response.data;
    } else if (response?.success && response.units && Array.isArray(response.units)) {
      unitsData = response.units;
    } else if (response && typeof response === 'object' && !Array.isArray(response)) {
      unitsData = [response];
    }
    
    console.log('🔍 extractUnits: Extracted data:', unitsData);
    
    const processedUnits = unitsData.map((item: any) => {
      const unitData = item.unit || item;
      
      return {
        id: unitData.id || item.id || 0,
        unitNumber: unitData.unitNumber || item.unitNumber || '',
        unitType: unitData.unitType || item.unitType || '',
        propertyId: unitData.propertyId || item.propertyId || item.property?.id || 0,
        propertyName: unitData.propertyName || item.propertyName || item.property?.name || '',
        tenantName: unitData.tenantName || item.tenantName || item.tenant?.name || '',
        rentAmount: unitData.rentAmount || item.rentAmount || 0,
        status: unitData.status || item.status || 'AVAILABLE',
        bedrooms: unitData.bedrooms || item.bedrooms || 0,
        bathrooms: unitData.bathrooms || item.bathrooms || 0,
        squareFeet: unitData.squareFeet || item.squareFeet || 0,
        tenantId: unitData.tenantId || item.tenantId || item.tenant?.id,
        deposit: unitData.deposit || item.deposit || 0,
        leaseStartDate: unitData.leaseStartDate || item.leaseStartDate,
        leaseEndDate: unitData.leaseEndDate || item.leaseEndDate,
        description: unitData.description || item.description || '',
        amenities: unitData.amenities || item.amenities || [],
        imageUrls: unitData.imageUrls || item.imageUrls || []
      };
    }).filter((unit: Unit) => unit.id && unit.unitNumber);
    
    console.log('✅ extractUnits: Processed units:', processedUnits);
    return processedUnits;
  }

  private formatRole(role: string | undefined): string {
    if (!role) return 'User';
    const roleMap: { [key: string]: string } = {
      'TENANT': 'Tenant',
      'LANDLORD': 'Landlord',
      'CARETAKER': 'Caretaker',
      'ADMIN': 'Administrator',
      'USER': 'User'
    };
    return roleMap[role.toUpperCase()] || role;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
}