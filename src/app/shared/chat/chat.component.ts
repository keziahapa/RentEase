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
    this.selectedTenantPropertyId = null;
    this.selectedCaretakerPropertyId = null;
    this.isInitialized = false;
    
    // Unsubscribe from all chat subscriptions
    this.chatSubscriptions.forEach(sub => sub.unsubscribe());
    this.chatSubscriptions = [];
    
    this.chatService.disconnect();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    
    // Unsubscribe from all chat subscriptions
    this.chatSubscriptions.forEach(sub => sub.unsubscribe());
    this.chatSubscriptions = [];
    
    this.chatService.disconnect();
    this.isInitialized = false;
  }

  private initializeChatSubscriptions(): void {
    // Subscribe to rooms
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

    // Subscribe to current room
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

    // Subscribe to messages
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

    // Subscribe to connection status
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
    if (this.userUnits.length === 0) {
      this.loadingProperties = true;
      this.tenantService.getTenantUnits().subscribe({
        next: (response: any) => {
          console.log('Tenant units API response:', response);
          
          this.userUnits = this.chatService.extractUnits(response);
          console.log('Extracted tenant units:', this.userUnits);
          
          this.tenantProperties = this.createPropertiesFromUnits(this.userUnits);
          console.log('Created tenant properties:', this.tenantProperties);
          
          this.loadingProperties = false;
          this.processTenantModalOpening();
        },
        error: (error: any) => {
          console.error('Failed to load tenant units:', error);
          this.loadingProperties = false;
          alert('Failed to load your units. Please try again.');
        }
      });
    } else {
      this.processTenantModalOpening();
    }
  }

  private processTenantModalOpening(): void {
    console.log('Processing tenant modal opening:', {
      userUnits: this.userUnits,
      tenantProperties: this.tenantProperties
    });
    
    if (this.userUnits.length === 0) {
      alert('No properties assigned. Please contact your landlord.');
      return;
    }
    
    this.showNewChatModal = true;
    
    if (this.tenantProperties.length === 1) {
      this.selectedTenantPropertyId = this.tenantProperties[0].id;
      this.currentStep = 'SELECT_RECIPIENT';
    } else {
      this.currentStep = 'SELECT_PROPERTY';
    }
  }

  private loadLandlordDataAndOpenModal(): void {
    if (this.userProperties.length === 0) {
      this.loadingProperties = true;
      this.propertyService.getProperties().subscribe({
        next: (response: any) => {
          console.log('Landlord properties API response:', response);
          
          this.userProperties = this.chatService.extractProperties(response);
          console.log('Extracted landlord properties:', this.userProperties);
          
          this.loadingProperties = false;
          this.processLandlordModalOpening();
        },
        error: (error: any) => {
          console.error('Failed to load landlord properties:', error);
          this.loadingProperties = false;
          alert('Failed to load properties. Please try again.');
        }
      });
    } else {
      this.processLandlordModalOpening();
    }
  }

  private processLandlordModalOpening(): void {
    console.log('Processing landlord modal opening:', {
      userProperties: this.userProperties
    });
    
    if (this.userProperties.length === 0) {
      alert('No properties available. Please create a property first.');
      return;
    }
    
    this.showNewChatModal = true;
    this.currentStep = 'SELECT_PROPERTY';
  }

  private loadCaretakerDataAndOpenModal(): void {
    if (this.userProperties.length === 0) {
      this.loadingProperties = true;
      this.caretakerService.getProperties().subscribe({
        next: (response: any) => {
          console.log('Caretaker properties API response:', response);
          
          this.userProperties = this.chatService.extractProperties(response);
          console.log('Extracted caretaker properties:', this.userProperties);
          
          this.loadingProperties = false;
          this.processCaretakerModalOpening();
        },
        error: (error: any) => {
          console.error('Failed to load caretaker properties:', error);
          this.loadingProperties = false;
          alert('Failed to load properties. Please try again.');
        }
      });
    } else {
      this.processCaretakerModalOpening();
    }
  }

  private processCaretakerModalOpening(): void {
    console.log('Processing caretaker modal opening:', {
      userProperties: this.userProperties
    });
    
    if (this.userProperties.length === 0) {
      alert('No properties assigned. Please contact the landlord.');
      return;
    }
    
    this.showNewChatModal = true;
    this.currentStep = 'SELECT_PROPERTY';
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
    this.selectedUnitId = null;
    this.selectedChatType = null;
    this.selectedTenantPropertyId = null;
    this.selectedCaretakerPropertyId = null;
    this.availableUnits = [];
    this.currentStep = 'SELECT_PROPERTY';
  }

  onPropertySelected(event: any): void {
    const propertyId = +event.target.value;
    console.log('Property selected:', propertyId, 'User role:', this.userRole);
    
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

  onRecipientTypeSelected(chatType: string): void {
    console.log('Recipient type selected:', chatType, 'User role:', this.userRole);
    
    this.selectedChatType = chatType as ChatRoomType;
    
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
    if (!this.selectedPropertyId) {
      alert('Please select a property first.');
      return;
    }
    
    this.loadingUnits = true;
    this.propertyService.getPropertyUnits(this.selectedPropertyId.toString()).subscribe({
      next: (response: any) => {
        console.log('Property units API response:', response);
        
        this.availableUnits = this.chatService.extractUnits(response);
        console.log('Extracted units for property:', this.availableUnits);
        
        this.loadingUnits = false;
        
        if (this.availableUnits.length === 0) {
          alert('No units found for this property.');
          this.currentStep = 'SELECT_RECIPIENT';
        }
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
        alert('Failed to load units. Please try again.');
        this.currentStep = 'SELECT_RECIPIENT';
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
        console.log('Caretaker property units API response:', response);
        
        this.availableUnits = this.chatService.extractUnits(response);
        console.log('Extracted units for caretaker property:', this.availableUnits);
        
        this.loadingUnits = false;
        
        if (this.availableUnits.length === 0) {
          alert('No units found for this property.');
          this.currentStep = 'SELECT_RECIPIENT';
        }
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        this.availableUnits = [];
        this.loadingUnits = false;
        alert('Failed to load units. Please try again.');
        this.currentStep = 'SELECT_RECIPIENT';
      }
    });
  }

  onUnitSelected(event: any): void {
    const unitId = +event.target.value;
    console.log('Unit selected:', unitId, 'User role:', this.userRole);
    
    if (this.userRole === 'LANDLORD') {
      this.selectedUnitId = unitId;
    } else if (this.userRole === 'CARETAKER') {
      this.selectedUnitId = unitId;
    }
    
    if (unitId) {
      this.createChatNow();
    }
  }

  createChat(chatType: string): void {
    console.log('Creating chat with type:', chatType, 'User role:', this.userRole);
    
    this.selectedChatType = chatType as ChatRoomType;
    
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

  createChatNow(): void {
    if (!this.selectedChatType) {
      alert('Please select a chat type.');
      return;
    }

    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    console.log('Creating chat with details:', {
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
          if (resourceId) {
            createObservable = this.chatService.createTenantLandlordChat(resourceId);
          }
        }
        break;

      case this.CHAT_TYPES.TENANT_CARETAKER:
        if (this.userRole === 'TENANT') {
          resourceId = this.selectedPropertyId || this.selectedTenantPropertyId;
          if (resourceId) {
            createObservable = this.chatService.createTenantCaretakerChat(resourceId);
          }
        }
        break;

      case this.CHAT_TYPES.LANDLORD_CARETAKER:
        if (this.userRole === 'LANDLORD') {
          resourceId = this.selectedPropertyId;
          if (resourceId) {
            createObservable = this.chatService.createLandlordCaretakerChat(resourceId);
          }
        }
        break;

      case this.CHAT_TYPES.LANDLORD_TENANT:
        if (this.userRole === 'LANDLORD') {
          resourceId = this.selectedUnitId;
          if (resourceId) {
            createObservable = this.chatService.createLandlordTenantChat(resourceId);
          }
        }
        break;

      case this.CHAT_TYPES.CARETAKER_TENANT:
        if (this.userRole === 'CARETAKER') {
          resourceId = this.selectedUnitId;
          if (resourceId) {
            createObservable = this.chatService.createCaretakerTenantChat(resourceId);
          }
        }
        break;
    }

    if (!createObservable) {
      alert(`Unable to create chat. This chat type (${this.selectedChatType}) is not available for your role (${this.userRole}).`);
      return;
    }

    this.loadingRooms = true;
    
    createObservable.subscribe({
      next: (response: any) => {
        this.loadingRooms = false;
        console.log('Chat creation response:', response);
        
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
          alert('Failed to send file. Please try again.');
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

    // Load messages for the selected room
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
      console.log(`${this.userRole} data response:`, response);
      
      this.processUserData(response, this.userRole);
      this.loadingProperties = false;
    });
  }

  private processUserData(response: any, userRole: string): void {
    switch(userRole) {
      case 'TENANT':
        this.userUnits = this.chatService.extractUnits(response);
        this.tenantProperties = this.createPropertiesFromUnits(this.userUnits);
        console.log('Tenant units loaded:', this.userUnits.length);
        console.log('Tenant properties extracted:', this.tenantProperties.length);
        break;
      case 'LANDLORD':
      case 'CARETAKER':
        this.userProperties = this.chatService.extractProperties(response);
        console.log(`${userRole} properties loaded:`, this.userProperties.length);
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
    return this.caretakerService.getProperties().pipe(
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