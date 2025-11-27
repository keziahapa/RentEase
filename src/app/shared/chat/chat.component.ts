import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { CaretakerService } from '../../services/caretaker.service';
import { TenantService } from '../../services/tenant.service';
import { Message, ChatRoom, Property, Unit, ChatRoomType, ApiResponse, Participant } from '../../services/chat.interface';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

  // Enhanced chat context
  currentChatInfo: EnrichedChatInfo | null = null;
  participantDataCache = new Map<number, any>();

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
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '✨', '💫', '⭐', '🌟', '✴️', '🎊', '🎉', '🎈', '🎁', '🏆'
  ];

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private propertyService: PropertyService,
    private caretakerService: CaretakerService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.userRole = this.authService.getCurrentUser()?.role?.toUpperCase() || '';
    
    this.loadUserDataAutomatically();
    this.initializeSubscriptions();
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  private initializeSubscriptions(): void {
    this.chatService.rooms$.subscribe((rooms: ChatRoom[]) => {
      this.rooms = rooms ?? [];
      this.loadingRooms = false;
      
      // Enrich rooms with participant data
      this.rooms.forEach(room => this.enrichRoomParticipants(room));
    });

    this.chatService.currentRoom$.subscribe((room: ChatRoom | null) => {
      this.currentRoom = room;
      if (room) {
        this.enrichRoomParticipants(room);
        this.updateCurrentChatInfo();
      } else {
        this.currentChatInfo = null;
      }
    });

    this.chatService.messages$.subscribe((messages: Message[]) => {
      const oldLength = this.messages.length;
      this.messages = messages ?? [];
      
      if (this.messages.length > oldLength) {
        this.shouldScrollToBottom = true;
      }
    });

    this.chatService.connected$.subscribe((connected: boolean) => {
      this.isConnected = connected;
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

    dataObservable.pipe(
      catchError((error) => {
        console.error('Error loading user data:', error);
        return of([]);
      })
    ).subscribe((response: any) => {
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

  // ========== PARTICIPANT DATA ENRICHMENT ==========
  
  private enrichRoomParticipants(room: ChatRoom): void {
    if (!room.participants || room.participants.length === 0) return;

    room.participants.forEach(participant => {
      if (!this.participantDataCache.has(participant.id)) {
        this.fetchParticipantData(participant).subscribe(enrichedData => {
          this.participantDataCache.set(participant.id, enrichedData);
          Object.assign(participant, enrichedData);
          
          // Update chat info if this is the current room
          if (this.currentRoom?.id === room.id) {
            this.updateCurrentChatInfo();
          }
        });
      } else {
        // Use cached data
        Object.assign(participant, this.participantDataCache.get(participant.id));
      }
    });
  }

  private fetchParticipantData(participant: Participant): Observable<any> {
    const role = participant.role?.toUpperCase();
    const currentUserId = this.chatService.getCurrentUserId();

    // Skip current user
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
    // Try to get tenant units data
    return this.tenantService.getTenantUnits().pipe(
      map(response => {
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
      map(properties => {
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
      map(properties => {
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

  // ========== ENHANCED CHAT DISPLAY ==========

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
        title: 'Tenants', 
        subtitle: 'Property Residents',
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
      'landlord-tenant': 'Tenants',
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

  // ========== CHAT CREATION WITH NEW ENDPOINT ==========

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
    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    // Determine resource ID based on chat type and user role
    if (chatType === this.CHAT_TYPES.CARETAKER_TENANT) {
      // For caretaker-tenant, we need a unit ID
      // You might want to show a unit selector here
      if (this.userUnits.length > 0) {
        resourceId = this.userUnits[0].id;
      } else {
        alert('No units available for chat creation.');
        return;
      }
      
      createObservable = this.createCaretakerTenantChat(resourceId);
    } else if (this.userRole === 'TENANT') {
      resourceId = this.userUnits.length > 0 ? this.userUnits[0].id : null;
    } else {
      resourceId = this.userProperties.length > 0 ? this.userProperties[0].id : null;
    }

    if (!resourceId) {
      alert('No available resource found for chat creation.');
      return;
    }

    if (!createObservable) {
      switch (chatType) {
        case this.CHAT_TYPES.TENANT_LANDLORD:
          createObservable = this.chatService.createTenantLandlordChat(resourceId);
          break;
        case this.CHAT_TYPES.TENANT_CARETAKER:
          createObservable = this.chatService.createTenantCaretakerChat(resourceId);
          break;
        case this.CHAT_TYPES.LANDLORD_CARETAKER:
          createObservable = this.chatService.createLandlordCaretakerChat(resourceId);
          break;
        case this.CHAT_TYPES.LANDLORD_TENANT:
          createObservable = this.chatService.createLandlordTenantChat(resourceId);
          break;
        default:
          alert('Invalid chat type selected.');
          return;
      }
    }

    this.loadingRooms = true;
    
    createObservable.subscribe({
      next: (response: any) => {
        this.loadingRooms = false;
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.selectRoom(response.data);
        } else {
          alert('Failed to create chat: ' + (response?.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        this.loadingRooms = false;
        alert('Failed to create chat: ' + (error.error?.message || error.message));
      }
    });
  }

  private createCaretakerTenantChat(unitId: number): Observable<ApiResponse<ChatRoom>> {
    // New endpoint for caretaker-tenant chat
    return this.chatService.http.post<ApiResponse<ChatRoom>>(
      `${this.chatService['apiUrl']}/caretaker/tenant/${unitId}`,
      {},
      { headers: this.chatService['getHeaders']() }
    ).pipe(
      catchError(error => {
        console.error('Error creating caretaker-tenant chat:', error);
        throw error;
      })
    );
  }

  // ========== UTILITY METHODS ==========

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

  private formatRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'TENANT': 'Tenant',
      'LANDLORD': 'Landlord',
      'CARETAKER': 'Caretaker'
    };
    return roleMap[role] || role;
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
  }

  selectRoom(room: ChatRoom): void {
    this.chatService.selectRoom(room);
    this.shouldScrollToBottom = true;
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.currentRoom) {
      const messageToSend = this.newMessage.trim();
      this.newMessage = '';
      this.hideEmojiPicker();
      
      this.chatService.sendMessage(messageToSend, this.currentRoom.id).subscribe({
        next: () => {
          this.shouldScrollToBottom = true;
        },
        error: (error: any) => {
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

  // Helper method to check if caretaker can create tenant chat
  canCreateCaretakerTenantChat(): boolean {
    return this.userRole === 'CARETAKER' && this.userUnits.length > 0;
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
}