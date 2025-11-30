import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { CaretakerService } from '../../services/caretaker.service';
import { TenantService } from '../../services/tenant.service';
import { Message, ChatRoom, Property, Unit, ChatRoomType, ApiResponse, Participant } from '../../services/chat.interface';
import { Observable, of, Subscription } from 'rxjs';
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
  imports: [CommonModule, FormsModule, MatIconModule],
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
    
    if (this.userRole === 'TENANT' && this.userUnits.length === 0) {
      alert('No units assigned to you. Please contact your landlord.');
      return;
    }
    
    if (this.userRole === 'LANDLORD' && this.userProperties.length === 0) {
      alert('No properties available. Please create a property first.');
      return;
    }
    
    if (this.userRole === 'CARETAKER' && this.userProperties.length === 0) {
      alert('No properties assigned. Please contact the landlord.');
      return;
    }


    if (this.userRole === 'LANDLORD') {
      this.currentStep = 'SELECT_PROPERTY';
    } else {
      this.currentStep = 'SELECT_RECIPIENT';
    }
    
    this.showNewChatModal = true;
  }

  private resetModalState(): void {
    this.selectedPropertyId = null;
    this.selectedUnitId = null;
    this.selectedChatType = null;
    this.availableUnits = [];
    this.currentStep = 'SELECT_PROPERTY';
  }


  onPropertySelected(event: any): void {
    this.selectedPropertyId = +event.target.value; 
    this.selectedUnitId = null;
    this.currentStep = 'SELECT_RECIPIENT';
    
  
    this.loadUnitsForProperty(this.selectedPropertyId);
  }

  private loadUnitsForProperty(propertyId: number): void {
    this.loadingUnits = true;
    
    // Convert to string to avoid type errors
    const propertyIdString = propertyId.toString();
    
    this.propertyService.getPropertyUnits(propertyIdString).subscribe({
      next: (response: any) => {
        this.availableUnits = this.extractUnits(response);
        this.loadingUnits = false;
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
        
        let errorMessage = 'Failed to load units for this property. ';
        if (error.status === 404) {
          errorMessage += 'Property not found.';
        } else if (error.status === 403) {
          errorMessage += 'You do not have permission to view units for this property.';
        } else {
          errorMessage += 'Please try again.';
        }
        
        alert(errorMessage);
      }
    });
  }


  onRecipientTypeSelected(chatType: ChatRoomType): void {
    this.selectedChatType = chatType;
    

    if (this.userRole === 'LANDLORD' && chatType === this.CHAT_TYPES.LANDLORD_TENANT) {
      this.currentStep = 'SELECT_UNIT';
    } else {
    
      this.createChatNow();
    }
  }

 
  onUnitSelected(event: any): void {
    const unitId = event.target.value;
    this.selectedUnitId = unitId ? +unitId : null; 
    if (this.selectedUnitId) {
      this.createChatNow();
    }
  }

  private createChatNow(): void {
    if (!this.selectedChatType) return;

    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

   
    switch (this.selectedChatType) {
      case this.CHAT_TYPES.TENANT_LANDLORD:
        resourceId = this.userUnits.length > 0 ? this.userUnits[0].propertyId : null;
        createObservable = resourceId ? this.chatService.createTenantLandlordChat(resourceId) : null;
        break;

      case this.CHAT_TYPES.TENANT_CARETAKER:
        resourceId = this.userUnits.length > 0 ? this.userUnits[0].propertyId : null;
        createObservable = resourceId ? this.chatService.createTenantCaretakerChat(resourceId) : null;
        break;

      case this.CHAT_TYPES.LANDLORD_CARETAKER:
        resourceId = this.selectedPropertyId;
        createObservable = resourceId ? this.chatService.createLandlordCaretakerChat(resourceId) : null;
        break;

      case this.CHAT_TYPES.LANDLORD_TENANT:
        resourceId = this.selectedUnitId;
        createObservable = resourceId ? this.chatService.createLandlordTenantChat(resourceId) : null;
        break;

      case this.CHAT_TYPES.CARETAKER_TENANT:
        resourceId = this.userProperties.length > 0 ? this.userProperties[0].id : null;
        createObservable = resourceId ? this.chatService.createCaretakerTenantChat(resourceId) : null;
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
        } else {
          errorMessage += error.error?.message || error.message || 'Please try again.';
        }
        
        alert(errorMessage);
      }
    });
  }

 
  createChat(chatType: ChatRoomType): void {
    this.selectedChatType = chatType;
    this.createChatNow();
  }

  getPropertyName(propertyId: number): string {
    const property = this.userProperties.find(p => p.id === propertyId);
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

  // ===== CHAT UI METHODS =====

  isMyMessage(message: Message): boolean {
    return this.chatService.isMyMessage(message);
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

  getParticipantCount(room: ChatRoom): number {
    return room?.participants?.length || 0;
  }

  canDelete(message: Message): boolean {
    return this.chatService.isMyMessage(message) || (message?.canDelete ?? false);
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
        dataObservable = this.tenantService.getTenantUnits().pipe(
          catchError((error: any) => {
            console.error('Error loading tenant units:', error);
            if (error.status === 401 && !this.authService.isTenant()) {
              return of([]);
            }
            return of([]);
          })
        );
        break;
      case 'LANDLORD':
        dataObservable = this.propertyService.getProperties().pipe(
          catchError((error: any) => {
            console.error('Error loading properties:', error);
            return of([]);
          })
        );
        break;
      case 'CARETAKER':
        dataObservable = this.caretakerService.getProperties().pipe(
          catchError((error: any) => {
            console.error('Error loading caretaker properties:', error);
            return of([]);
          })
        );
        break;
      default:
        this.loadingProperties = false;
        return;
    }

    dataObservable.subscribe((response: any) => {
      this.processUserData(response, this.userRole);
      this.loadingProperties = false;
      
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
        break;
      case 'LANDLORD':
      case 'CARETAKER':
        this.userProperties = this.extractProperties(response);
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
        const units = Array.isArray(response?.data) ? response.data : [];
        if (units.length > 0) {
          const primaryUnit = units[0];
          return {
            unitNumber: primaryUnit.unitNumber || primaryUnit.unit?.unitNumber,
            propertyId: primaryUnit.propertyId || primaryUnit.property?.id,
            propertyName: primaryUnit.propertyName || primaryUnit.property?.name,
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
        if (properties && properties.length > 0) {
          const primaryProperty = properties[0];
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
        if (properties && properties.length > 0) {
          const primaryProperty = properties[0];
          return {
            propertyId: primaryProperty.id,
            propertyName: primaryProperty.name,
            managedProperties: properties.length
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
    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        id: item.property?.id || item.id,
        name: item.property?.name || item.name || 'Unnamed Property',
        address: item.property?.address || item.location || item.address || 'No address'
      })).filter((property: Property) => property.id);
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data.map((item: any) => ({
        id: item.property?.id || item.id,
        name: item.property?.name || item.name || 'Unnamed Property',
        address: item.property?.address || item.location || item.address || 'No address'
      })).filter((property: Property) => property.id);
    }
    return [];
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
        address: extendedUnit.propertyAddress || 'No address'
      });
    }
  });
  
  return Array.from(uniqueProperties.values());
}

  private extractUnits(response: any): Unit[] {
    if (!response) return [];
    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        id: item.unit?.id || item.id,
        unitNumber: item.unit?.unitNumber || item.unitNumber,
        unitType: item.unit?.unitType || item.unitType,
        propertyId: item.property?.id || item.propertyId,
        tenantName: item.tenant?.name || item.tenantName,
        rentAmount: item.rentAmount
      })).filter((unit: Unit) => unit.id);
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data.map((item: any) => ({
        id: item.unit?.id || item.id,
        unitNumber: item.unit?.unitNumber || item.unitNumber,
        unitType: item.unit?.unitType || item.unitType,
        propertyId: item.property?.id || item.propertyId,
        tenantName: item.tenant?.name || item.tenantName,
        rentAmount: item.rentAmount
      })).filter((unit: Unit) => unit.id);
    }
    return [];
  }

  private formatRole(role: string | undefined): string {
    if (!role) return 'User';
    const roleMap: { [key: string]: string } = {
      'TENANT': 'Tenant',
      'LANDLORD': 'Landlord',
      'CARETAKER': 'Caretaker'
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