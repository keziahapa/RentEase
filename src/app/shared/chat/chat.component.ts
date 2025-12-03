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
  shouldScrollToBottom = false;

  currentChatInfo: EnrichedChatInfo | null = null;

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

  selectedPropertyId: number | null = null;
  selectedCaretakerPropertyId: number | null = null;

  private router = inject(Router);

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private propertyService: PropertyService,
    private caretakerService: CaretakerService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
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
      },
      error: (error: any) => {
        console.error('Error in rooms subscription:', error);
        this.loadingRooms = false;
      }
    });

    this.chatService.currentRoom$.subscribe({
      next: (room: ChatRoom | null) => {
        this.currentRoom = room;
        if (room) {
          this.updateCurrentChatInfo();
        } else {
          this.currentChatInfo = null;
        }
      },
      error: (error: any) => {
        console.error('Error in currentRoom subscription:', error);
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
    });
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

  openNewChatModal(): void {
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
    
    this.showNewChatModal = true;
  }

  createChat(chatType: ChatRoomType): void {
    if (!this.canCreateChatType(chatType)) {
      alert(`You don't have permission to create ${chatType} chats`);
      return;
    }

    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    console.log(`Creating ${chatType} chat for user role: ${this.userRole}`);

    switch (chatType) {
      case this.CHAT_TYPES.TENANT_LANDLORD:
        if (this.userRole !== 'TENANT') {
          alert('Only tenants can create landlord chats.');
          return;
        }
        
        if (this.userUnits.length === 0) {
          alert('No units found. Please contact your landlord.');
          return;
        }
        
        resourceId = this.userUnits[0].propertyId;
        if (!resourceId) {
          alert('Unable to determine your property. Please contact support.');
          return;
        }
        
        console.log(`Tenant creating landlord chat with propertyId: ${resourceId}`);
        createObservable = this.chatService.createTenantLandlordChat(resourceId);
        break;
        
      case this.CHAT_TYPES.TENANT_CARETAKER:
        if (this.userRole !== 'TENANT') {
          alert('Only tenants can create caretaker chats.');
          return;
        }
        
        if (this.userUnits.length === 0) {
          alert('No units found. Please contact your landlord.');
          return;
        }
        
        resourceId = this.userUnits[0].propertyId;
        if (!resourceId) {
          alert('Unable to determine your property. Please contact support.');
          return;
        }
        
        console.log(`Tenant creating caretaker chat with propertyId: ${resourceId}`);
        createObservable = this.chatService.createTenantCaretakerChat(resourceId);
        break;
        
      case this.CHAT_TYPES.LANDLORD_CARETAKER:
        if (this.userRole !== 'LANDLORD') {
          alert('Only landlords can create caretaker chats.');
          return;
        }
        
        if (this.userProperties.length === 0) {
          alert('No properties available. Please create a property first.');
          return;
        }
        
        resourceId = this.userProperties[0].id;
        console.log(`Landlord creating caretaker chat with propertyId: ${resourceId}`);
        createObservable = this.chatService.createLandlordCaretakerChat(resourceId);
        break;
        
      case this.CHAT_TYPES.LANDLORD_TENANT:
        if (this.userRole !== 'LANDLORD') {
          alert('Only landlords can create tenant chats.');
          return;
        }
        
        if (this.userProperties.length === 0) {
          alert('No properties available. Please create a property first.');
          return;
        }
        
        const landlordPropertyId = this.userProperties[0].id;
        this.loadUnitsForProperty(landlordPropertyId, (unitId: number) => {
          console.log(`Landlord creating tenant chat with unitId: ${unitId}`);
          this.chatService.createLandlordTenantChat(unitId).subscribe({
            next: (response: any) => this.handleChatCreationResponse(response, chatType),
            error: (error: any) => this.handleChatCreationError(error, chatType)
          });
        });
        return;
        
      case this.CHAT_TYPES.CARETAKER_TENANT:
        if (this.userRole !== 'CARETAKER') {
          alert('Only caretakers can create tenant chats.');
          return;
        }
        
        if (this.userProperties.length === 0) {
          alert('No properties assigned. Please contact the landlord.');
          return;
        }
        
        const caretakerPropertyId = this.userProperties[0].id;
        this.loadUnitsForProperty(caretakerPropertyId, (unitId: number) => {
          console.log(`Caretaker creating tenant chat with unitId: ${unitId}`);
          this.chatService.createCaretakerTenantChat(unitId).subscribe({
            next: (response: any) => this.handleChatCreationResponse(response, chatType),
            error: (error: any) => this.handleChatCreationError(error, chatType)
          });
        });
        return;
        
      default:
        alert('Invalid chat type selected.');
        return;
    }

    if (createObservable) {
      this.loadingRooms = true;
      createObservable.subscribe({
        next: (response: any) => this.handleChatCreationResponse(response, chatType),
        error: (error: any) => this.handleChatCreationError(error, chatType)
      });
    }
  }

  private loadUnitsForProperty(propertyId: number, callback: (unitId: number) => void): void {
    this.propertyService.getPropertyUnits(propertyId.toString()).subscribe({
      next: (unitsResponse: any) => {
        const units = this.extractUnits(unitsResponse);
        if (units.length === 0) {
          alert('No units found for this property.');
          return;
        }
        
        const unitId = units[0].id;
        callback(unitId);
      },
      error: (error: any) => {
        alert('Failed to load units for this property.');
        console.error('Error loading units:', error);
      }
    });
  }

  private handleChatCreationResponse(response: any, chatType: string): void {
    this.loadingRooms = false;
    console.log('Chat creation response:', response);
    
    if (response?.success && response.data) {
      this.closeNewChatModal();
      this.selectRoom(response.data);
      alert('Chat created successfully!');
    } else {
      const errorMsg = response?.message || 'Unknown error occurred';
      alert(`Failed to create ${chatType} chat: ${errorMsg}`);
    }
  }

  private handleChatCreationError(error: any, chatType: string): void {
    this.loadingRooms = false;
    console.error(`Chat creation error for ${chatType}:`, error);
    
    let errorMessage = `Failed to create ${chatType} chat. `;
    
    if (error.status === 400) {
      errorMessage += 'The resource might not exist or you may not have permission.';
    } else if (error.status === 404) {
      errorMessage += 'The requested resource was not found.';
    } else if (error.status === 403) {
      errorMessage += 'You do not have permission to create this chat.';
    } else if (error.status === 409) {
      errorMessage += 'Chat already exists.';
    } else {
      errorMessage += error.error?.message || error.message || 'Please try again.';
    }
    
    alert(errorMessage);
  }

  private canCreateChatType(chatType: ChatRoomType): boolean {    
    switch(chatType) {
      case this.CHAT_TYPES.TENANT_LANDLORD:
      case this.CHAT_TYPES.TENANT_CARETAKER:
        return this.userRole === 'TENANT';
      
      case this.CHAT_TYPES.LANDLORD_CARETAKER:
      case this.CHAT_TYPES.LANDLORD_TENANT:
        return this.userRole === 'LANDLORD';
      
      case this.CHAT_TYPES.CARETAKER_TENANT:
        return this.userRole === 'CARETAKER';
      
      default:
        return false;
    }
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
  }

  selectRoom(room: ChatRoom): void {
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin();
      return;
    }

    if (!room || !room.id) {
      return;
    }

    this.chatService.selectRoom(room);
    this.shouldScrollToBottom = true;
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

  trackByRoomId(index: number, room: ChatRoom): number {
    return room?.id ?? index;
  }

  trackByMessageId(index: number, message: Message): number {
    return message?.id ?? index;
  }

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

  getRoomName(room: ChatRoom): string {
    if (!room) return 'Chat';
    
    const currentUser = this.authService.getCurrentUser();
    const otherParticipants = room.participants?.filter(p => p.id !== currentUser?.id) || [];
    
    if (otherParticipants.length === 1) {
      return otherParticipants[0].name || otherParticipants[0].email || 'User';
    }
    
    if (otherParticipants.length > 1) {
      return `${otherParticipants.length} participants`;
    }
    
    return 'Chat';
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
    const units = this.extractUnits(response);
    const propertyMap = new Map<number, Property>();
    units.forEach(unit => {
      if (unit.propertyId && !propertyMap.has(unit.propertyId)) {
        propertyMap.set(unit.propertyId, {
          id: unit.propertyId,
          name: unit['propertyName'] || `Property ${unit.propertyId}`,
          address: 'Address not available'
        });
      }
    });
    return Array.from(propertyMap.values());
  }

  private extractUnits(response: any): Unit[] {
    if (!response) return [];
    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        id: item.unit?.id || item.id,
        unitNumber: item.unit?.unitNumber || item.unitNumber || 'N/A',
        unitType: item.unit?.unitType || item.unitType || 'UNKNOWN',
        rentAmount: item.unit?.rentAmount || item.rentAmount || 0,
        propertyId: item.property?.id || item.propertyId,
        propertyName: item.property?.name || item.propertyName
      } as any)).filter((unit: Unit) => unit.id);
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data.map((item: any) => ({
        id: item.unit?.id || item.id,
        unitNumber: item.unit?.unitNumber || item.unitNumber || 'N/A',
        unitType: item.unit?.unitType || item.unitType || 'UNKNOWN',
        rentAmount: item.unit?.rentAmount || item.rentAmount || 0,
        propertyId: item.property?.id || item.propertyId,
        propertyName: item.property?.name || item.propertyName
      } as any)).filter((unit: Unit) => unit.id);
    }
    return [];
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
    
    let title = participant.name || 'User';
    let subtitle = '';
    let description = '';

    switch(role) {
      case 'TENANT':
        subtitle = 'Tenant';
        if (participant.unitNumber) {
          subtitle = `Unit ${participant.unitNumber}`;
          description = 'Property Resident';
        }
        break;
      case 'LANDLORD':
        subtitle = 'Property Owner';
        description = 'Property Owner';
        break;
      case 'CARETAKER':
        title = 'Property Caretaker';
        subtitle = 'Maintenance & Support';
        description = 'Property Caretaker';
        break;
    }

    return { title, subtitle, description };
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

  private formatRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'TENANT': 'Tenant',
      'LANDLORD': 'Landlord',
      'CARETAKER': 'Caretaker'
    };
    return roleMap[role] || role;
  }

  private redirectToLogin(): void {
    this.rooms = [];
    this.currentRoom = null;
    this.messages = [];
    this.userProperties = [];
    this.userUnits = [];
    this.isInitialized = false;
    this.router.navigate(['/login']);
  }

  private scrollToBottom(): void {
    if (!this.shouldScrollToBottom) return;
    try {
      if (this.messagesContainer?.nativeElement) {
        const container = this.messagesContainer.nativeElement;
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
          this.shouldScrollToBottom = false;
        }, 50);
      }
    } catch (err) {
      console.error('Error scrolling:', err);
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  onPropertySelectedForChat(event: any): void {
    const value = event.target.value;
    if (value) {
      this.selectedPropertyId = parseInt(value, 10);
    } else {
      this.selectedPropertyId = null;
    }
  }
}