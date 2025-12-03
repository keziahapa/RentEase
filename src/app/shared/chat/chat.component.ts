import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  showTenantSelectionModal = false;
  loadingProperties = false;
  loadingRooms = false;
  loadingUnits = false;
  shouldScrollToBottom = false;

  selectedPropertyId: number | null = null;
  selectedCaretakerPropertyId: number | null = null;
  selectedUnitId: number | null = null;
  selectedChatType: ChatRoomType | null = null;
  availableUnits: Unit[] = [];
  
  tenantProperties: Property[] = [];

  currentChatInfo: EnrichedChatInfo | null = null;
  participantDataCache = new Map<number, any>();

  private authSubscription?: Subscription;
  private chatSubscriptions: Subscription[] = [];
  private isInitialized = false;

  readonly CHAT_TYPES = {
    TENANT_LANDLORD: 'tenant-landlord',
    TENANT_CARETAKER: 'tenant-caretaker',
    LANDLORD_CARETAKER: 'landlord-caretaker',
    LANDLORD_TENANT: 'landlord-tenant',
    CARETAKER_TENANT: 'caretaker-tenant'
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
  private http = inject(HttpClient);

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
    this.initializeChatSubscriptions();
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
    this.selectedCaretakerPropertyId = null;
    this.isInitialized = false;
    
    this.chatSubscriptions.forEach(sub => sub.unsubscribe());
    this.chatSubscriptions = [];
    
    this.chatService.disconnect();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.chatSubscriptions.forEach(sub => sub.unsubscribe());
    this.chatSubscriptions = [];
    
    this.chatService.disconnect();
    this.isInitialized = false;
  }

  private initializeChatSubscriptions(): void {
    const roomsSub = this.chatService.rooms$.subscribe({
      next: (rooms: ChatRoom[]) => {
        this.rooms = rooms ?? [];
        this.loadingRooms = false;
        this.rooms.forEach(room => this.enrichRoomParticipants(room));
      },
      error: (error: any) => {
        console.error('Error in rooms subscription:', error);
        this.loadingRooms = false;
      }
    });
    this.chatSubscriptions.push(roomsSub);

    const currentRoomSub = this.chatService.currentRoom$.subscribe({
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
      }
    });
    this.chatSubscriptions.push(currentRoomSub);

    const messagesSub = this.chatService.messages$.subscribe({
      next: (messages: Message[]) => {
        const oldLength = this.messages.length;
        this.messages = messages ?? [];
        
        if (this.messages.length > oldLength) {
          this.shouldScrollToBottom = true;
        }
      },
      error: (error: any) => {
        console.error('Error in messages subscription:', error);
      }
    });
    this.chatSubscriptions.push(messagesSub);

    const connectedSub = this.chatService.connected$.subscribe({
      next: (connected: boolean) => {
        this.isConnected = connected;
      },
      error: (error: any) => {
        console.error('Error in connected subscription:', error);
      }
    });
    this.chatSubscriptions.push(connectedSub);
  }

  openNewChatModal(): void {
    this.resetModalState();
    
    if (this.userRole === 'TENANT') {
      this.loadTenantDataAndOpenModal();
    } else if (this.userRole === 'LANDLORD') {
      this.loadLandlordDataAndOpenModal();
    } else if (this.userRole === 'CARETAKER') {
      this.loadCaretakerDataAndOpenModal();
    }
  }

  private loadTenantDataAndOpenModal(): void {
    this.loadingProperties = true;
    
    this.tenantService.getTenantUnits().subscribe({
      next: (response: any) => {
        console.log('Tenant units response:', response);
        
        if (response?.success === false) {
          this.loadingProperties = false;
          this.showNewChatModal = true;
          return;
        }
        
        this.userUnits = this.chatService.extractUnits(response);
        console.log('Extracted user units:', this.userUnits);
        
        this.tenantProperties = this.createPropertiesFromUnits(this.userUnits);
        
        this.loadingProperties = false;
        this.showNewChatModal = true;
      },
      error: (error: any) => {
        console.error('Error loading tenant units:', error);
        this.loadingProperties = false;
        this.showNewChatModal = true;
      }
    });
  }

  private loadLandlordDataAndOpenModal(): void {
    this.loadingProperties = true;
    
    this.propertyService.getProperties().subscribe({
      next: (response: any) => {
        console.log('Landlord properties response:', response);
        
        this.userProperties = this.chatService.extractProperties(response);
        console.log('Extracted landlord properties:', this.userProperties);
        
        if (this.userProperties.length === 1) {
          this.selectedPropertyId = this.userProperties[0].id;
        }
        
        this.loadingProperties = false;
        this.showNewChatModal = true;
      },
      error: (error: any) => {
        console.error('Error loading landlord properties:', error);
        this.loadingProperties = false;
        this.showNewChatModal = true;
      }
    });
  }

  private loadCaretakerDataAndOpenModal(): void {
    this.loadingProperties = true;
    
    this.caretakerService.getCaretakerProperties().subscribe({
      next: (response: any) => {
        console.log('Caretaker properties response:', response);
        
        this.userProperties = this.chatService.extractProperties(response);
        console.log('Extracted caretaker properties:', this.userProperties);
        
        if (this.userProperties.length === 1) {
          this.selectedCaretakerPropertyId = this.userProperties[0].id;
        }
        
        this.loadingProperties = false;
        this.showNewChatModal = true;
      },
      error: (error: any) => {
        console.error('Error loading caretaker properties:', error);
        this.loadingProperties = false;
        this.showNewChatModal = true;
      }
    });
  }

  private createPropertiesFromUnits(units: Unit[]): Property[] {
    const propertyMap = new Map<number, Property>();
    
    units.forEach(unit => {
      if (unit.propertyId && !propertyMap.has(unit.propertyId)) {
        propertyMap.set(unit.propertyId, {
          id: unit.propertyId,
          name: unit.propertyName || `Property ${unit.propertyId}`,
          address: '',
          location: unit.propertyName || `Property ${unit.propertyId}`,
          propertyType: 'RESIDENTIAL',
          totalUnits: 0,
          description: '',
          ownerName: '',
          ownerId: unit.propertyId,
          imageUrl: '',
          amenities: []
        });
      }
    });
    
    return Array.from(propertyMap.values());
  }

  private resetModalState(): void {
    this.selectedPropertyId = null;
    this.selectedCaretakerPropertyId = null;
    this.selectedUnitId = null;
    this.selectedChatType = null;
    this.availableUnits = [];
    this.showTenantSelectionModal = false;
  }

  onPropertySelectedForChat(event: any): void {
    const propertyId = +event.target.value;
    console.log('Property selected for chat:', propertyId, 'User role:', this.userRole);
    
    if (this.userRole === 'LANDLORD') {
      this.selectedPropertyId = propertyId;
    } else if (this.userRole === 'CARETAKER') {
      this.selectedCaretakerPropertyId = propertyId;
    }
  }

  openTenantSelectionModal(): void {
    let propertyId: number | null = null;
    
    if (this.userRole === 'LANDLORD') {
      propertyId = this.selectedPropertyId;
    } else if (this.userRole === 'CARETAKER') {
      propertyId = this.selectedCaretakerPropertyId;
    }
    
    if (!propertyId) {
      alert('Please select a property first.');
      return;
    }
    
    this.loadingUnits = true;
    this.showTenantSelectionModal = true;
    
    this.propertyService.getPropertyUnits(propertyId.toString()).subscribe({
      next: (response: any) => {
        console.log('Property units response:', response);
        
        this.availableUnits = this.chatService.extractUnits(response);
        console.log('Available units:', this.availableUnits);
        
        this.loadingUnits = false;
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
      }
    });
  }

  closeTenantSelectionModal(): void {
    this.showTenantSelectionModal = false;
    this.selectedUnitId = null;
    this.availableUnits = [];
  }

  selectUnitForChat(unit: Unit): void {
    this.selectedUnitId = unit.id;
    console.log('Selected unit for chat:', unit);
  }

  createChat(chatType: string): void {
    console.log('🔄 Creating chat:', chatType, 'User role:', this.userRole);
    
    this.selectedChatType = chatType as ChatRoomType;
    this.loadingRooms = true;
    
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;
    let errorMessage = '';
    
    switch(chatType) {
      case this.CHAT_TYPES.TENANT_LANDLORD:
      case this.CHAT_TYPES.TENANT_CARETAKER:
        console.log(`🔍 Creating ${chatType} chat...`);
        
        if (this.userUnits.length === 0) {
          errorMessage = 'No units assigned to you. Please contact your landlord.';
          break;
        }
        
        const tenantUnit = this.userUnits[0];
        const propertyName = tenantUnit.propertyName;
        
        if (!propertyName || propertyName.trim() === '') {
          errorMessage = 'Could not find property information for your unit.';
          break;
        }
        
        console.log(`🔍 Looking up property ID for: "${propertyName}"`);
        
        this.propertyService.getPropertyByName(propertyName).subscribe({
          next: (propertyResponse: any) => {
            if (propertyResponse.success && propertyResponse.data?.id) {
              const propertyId = propertyResponse.data.id;
              console.log(`✅ Found property ID ${propertyId} for "${propertyName}"`);
              
              if (chatType === this.CHAT_TYPES.TENANT_LANDLORD) {
                createObservable = this.chatService.createTenantLandlordChat(propertyId);
              } else {
                createObservable = this.chatService.createTenantCaretakerChat(propertyId);
              }
              
              this.executeChatCreation(createObservable, chatType);
            } else {
              const message = propertyResponse.message || `Property "${propertyName}" not found`;
              console.error('❌ Property not found:', message);
              alert(message);
              this.loadingRooms = false;
            }
          },
          error: (error) => {
            console.error('❌ Error searching for property:', error);
            alert(`Could not find property "${propertyName}". Please contact support.`);
            this.loadingRooms = false;
          }
        });
        
        return;
        
      case this.CHAT_TYPES.LANDLORD_CARETAKER:
        const propertyId = this.selectedPropertyId || 
                          (this.userProperties.length > 0 ? this.userProperties[0].id : null);
        
        if (!propertyId) {
          errorMessage = this.userProperties.length === 0 
            ? 'No properties found. Please create a property first.' 
            : 'Please select a property.';
          break;
        }
        
        createObservable = this.chatService.createLandlordCaretakerChat(propertyId);
        break;
        
      case this.CHAT_TYPES.LANDLORD_TENANT:
        const landlordPropertyId = this.selectedPropertyId || 
                                  (this.userProperties.length > 0 ? this.userProperties[0].id : null);
        
        if (!landlordPropertyId) {
          errorMessage = 'Please select a property first.';
          break;
        }
        
        this.selectedPropertyId = landlordPropertyId;
        this.loadingRooms = false;
        this.openTenantSelectionModal();
        return;
        
      case this.CHAT_TYPES.CARETAKER_TENANT:
        const caretakerPropertyId = this.selectedCaretakerPropertyId || 
                                   (this.userProperties.length > 0 ? this.userProperties[0].id : null);
        
        if (!caretakerPropertyId) {
          errorMessage = 'Please select a property first.';
          break;
        }
        
        this.selectedPropertyId = caretakerPropertyId;
        this.loadingRooms = false;
        this.openTenantSelectionModal();
        return;
        
      default:
        errorMessage = 'Invalid chat type selected.';
        break;
    }
    
    if (errorMessage) {
      console.error('❌ Chat creation error:', errorMessage);
      alert(errorMessage);
      this.loadingRooms = false;
      return;
    }
    
    if (!createObservable) {
      console.error('❌ No observable created for chat type:', chatType);
      alert('Failed to initiate chat creation. Please try again.');
      this.loadingRooms = false;
      return;
    }
    
    this.executeChatCreation(createObservable, chatType);
  }

  private executeChatCreation(createObservable: Observable<ApiResponse<ChatRoom>> | null, chatType: string): void {
    if (!createObservable) {
      this.loadingRooms = false;
      return;
    }
    
    createObservable.subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        console.log('📥 Chat creation response:', response);
        this.loadingRooms = false;
        
        if (response?.success && response.data) {
          console.log('✅ Chat created successfully!');
          this.closeNewChatModal();
          this.selectRoom(response.data);
          
          const chatTypeName = this.getChatTypeDisplayName(chatType);
          alert(`${chatTypeName} chat created successfully!`);
        } else {
          const message = response?.message || 'Unknown error occurred';
          console.error('❌ Chat creation failed:', message);
          alert(`Failed to create chat: ${message}`);
        }
      },
      error: (error: any) => {
        console.error('❌ Chat creation API error:', error);
        this.loadingRooms = false;
        
        let userMessage = 'Failed to create chat. ';
        if (error.status === 404) {
          userMessage += 'Recipient not found.';
        } else if (error.status === 409) {
          userMessage += 'Chat already exists.';
        } else if (error.message) {
          userMessage = error.message;
        }
        
        alert(userMessage);
      }
    });
  }

  createTenantChat(): void {
    if (!this.selectedUnitId) {
      alert('Please select a unit.');
      return;
    }
    
    this.loadingRooms = true;
    
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;
    
    if (this.userRole === 'LANDLORD') {
      console.log(`📤 Creating landlord-tenant chat for unit: ${this.selectedUnitId}`);
      createObservable = this.chatService.createLandlordTenantChat(this.selectedUnitId);
    } else if (this.userRole === 'CARETAKER') {
      console.log(`📤 Creating caretaker-tenant chat for unit: ${this.selectedUnitId}`);
      createObservable = this.chatService.createCaretakerTenantChat(this.selectedUnitId);
    } else {
      alert('Invalid user role for tenant chat.');
      this.loadingRooms = false;
      return;
    }
    
    if (!createObservable) {
      console.error('❌ No observable created for tenant chat');
      alert('Failed to create tenant chat. Please try again.');
      this.loadingRooms = false;
      return;
    }
    
    createObservable.subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        this.loadingRooms = false;
        
        if (response?.success && response.data) {
          console.log('✅ Tenant chat created successfully!');
          this.closeTenantSelectionModal();
          this.closeNewChatModal();
          this.selectRoom(response.data);
          
          alert('Chat with tenant created successfully!');
        } else {
          const message = response?.message || 'Failed to create chat with tenant.';
          console.error('❌ Tenant chat creation failed:', message);
          alert(message);
        }
      },
      error: (error: any) => {
        console.error('❌ Error creating tenant chat:', error);
        this.loadingRooms = false;
        
        let userMessage = 'Failed to create chat with tenant. ';
        if (error.status === 404) {
          userMessage += 'Tenant not found for this unit.';
        } else if (error.status === 409) {
          userMessage += 'Chat already exists with this tenant.';
        } else if (error.message) {
          userMessage = error.message;
        }
        
        alert(userMessage);
      }
    });
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.resetModalState();
  }

  selectRoom(room: ChatRoom): void {
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin();
      return;
    }

    if (!room || !room.id) {
      return;
    }

    this.currentRoom = room;
    this.messages = [];
    
    this.chatService.selectRoom(room);
    this.shouldScrollToBottom = true;

    this.chatService.getMessages(room.id).subscribe({
      next: (messages: Message[]) => {
        console.log(`Loaded ${messages.length} messages for room ${room.id}`);
      },
      error: (error: any) => {
        console.error('Error loading messages:', error);
      }
    });
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.currentRoom) {
      const messageToSend = this.newMessage.trim();
      this.newMessage = '';
      this.hideEmojiPicker();
      
      if (!this.authService.isAuthenticated()) {
        this.redirectToLogin();
        this.newMessage = messageToSend;
        return;
      }
      
      this.chatService.sendMessage(messageToSend, this.currentRoom.id).subscribe({
        next: () => {
          this.shouldScrollToBottom = true;
        },
        error: (error: any) => {
          console.error('Error sending message:', error);
          alert('Failed to send message. Please try again.');
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
          alert('Failed to delete message.');
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
      this.uploadingFiles = true;
      
      Array.from(files).forEach((file: File) => {
        const fileMessage = `File: ${file.name} (${this.formatFileSize(file.size)})`;
        
        this.chatService.sendMessage(fileMessage, this.currentRoom!.id).subscribe({
          next: () => {
            this.shouldScrollToBottom = true;
          },
          error: (error: any) => {
            console.error('Error sending file:', error);
            alert('Failed to send file. Please try again.');
          },
          complete: () => {
            this.uploadingFiles = false;
          }
        });
      });
    }
    event.target.value = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
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
      return unit.propertyName 
        ? `${unit.propertyName} - Unit ${unit.unitNumber}`
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

  getPropertyName(propertyId: number): string {
    const property = this.userProperties.find(p => p.id === propertyId);
    return property?.name || `Property ${propertyId}`;
  }

  getUnitDisplay(unitId: number): string {
    const unit = this.availableUnits.find(u => u.id === unitId);
    if (!unit) return 'Unknown Unit';
    return `Unit ${unit.unitNumber}`;
  }

  private getChatTypeDisplayName(chatType: string): string {
    const displayNames: { [key: string]: string } = {
      [this.CHAT_TYPES.TENANT_LANDLORD]: 'Tenant-Landlord',
      [this.CHAT_TYPES.TENANT_CARETAKER]: 'Tenant-Caretaker',
      [this.CHAT_TYPES.LANDLORD_CARETAKER]: 'Landlord-Caretaker',
      [this.CHAT_TYPES.LANDLORD_TENANT]: 'Landlord-Tenant',
      [this.CHAT_TYPES.CARETAKER_TENANT]: 'Caretaker-Tenant'
    };
    return displayNames[chatType] || chatType;
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
        dataObservable = this.caretakerService.getCaretakerProperties();
        break;
      default:
        this.loadingProperties = false;
        return;
    }

    dataObservable.subscribe((response: any) => {
      console.log(`${this.userRole} data response:`, response);
      
      switch(this.userRole) {
        case 'TENANT':
          this.userUnits = this.chatService.extractUnits(response);
          this.tenantProperties = this.createPropertiesFromUnits(this.userUnits);
          break;
        case 'LANDLORD':
        case 'CARETAKER':
          this.userProperties = this.chatService.extractProperties(response);
          break;
      }
      
      this.loadingProperties = false;
    });
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
    return this.tenantService.getTenantUnits().pipe(
      map((response: any) => {
        const units = this.chatService.extractUnits(response);
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
      map((response: any) => {
        const extracted = this.chatService.extractProperties(response);
        if (extracted && extracted.length > 0) {
          const primaryProperty = extracted[0];
          return {
            propertyId: primaryProperty.id,
            propertyName: primaryProperty.name,
            ownerName: primaryProperty.ownerName || '',
            propertyAddress: primaryProperty.address || primaryProperty.location
          };
        }
        return {};
      }),
      catchError(() => of({}))
    );
  }

  private fetchCaretakerData(caretakerId: number): Observable<any> {
    return this.caretakerService.getCaretakerProperties().pipe(
      map((response: any) => {
        const extracted = this.chatService.extractProperties(response);
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
        if (cachedData.ownerName) {
          title = cachedData.ownerName;
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

  private getDefaultChatInfo(roomType: string): EnrichedChatInfo {
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

  private redirectToLogin(): void {
    this.cleanupOnLogout();
    this.router.navigate(['/login']);
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
      }
    });
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