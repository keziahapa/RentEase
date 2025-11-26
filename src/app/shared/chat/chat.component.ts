import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { CaretakerService } from '../../services/caretaker.service';
import { TenantService } from '../../services/tenant.service';
import { Message, ChatRoom, Property, Unit, ChatRoomType, ApiResponse } from '../../services/chat.interface';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface ChatCreationOption {
  type: ChatRoomType;
  label: string;
  description: string;
  resourceType: 'property' | 'unit';
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule
  ],
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

  // New Chat Modal Properties
  selectedChatType: ChatRoomType | null = null;
  selectedResourceId: number | null = null;
  availableChatOptions: ChatCreationOption[] = [];

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

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private propertyService: PropertyService,
    private caretakerService: CaretakerService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      console.error('User not authenticated');
      return;
    }

    this.userRole = this.authService.getCurrentUser()?.role?.toUpperCase() || '';
    
    this.loadUserDataAutomatically();
    this.initializeSubscriptions();
    this.setupChatOptions();
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  private initializeSubscriptions(): void {
    this.chatService.rooms$.subscribe((rooms: ChatRoom[]) => {
      this.rooms = rooms ?? [];
      this.loadingRooms = false;
    });

    this.chatService.currentRoom$.subscribe((room: ChatRoom | null) => {
      this.currentRoom = room;
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

  private setupChatOptions(): void {
    switch(this.userRole) {
      case 'TENANT':
        this.availableChatOptions = [
          {
            type: 'tenant-landlord',
            label: 'Chat with Landlord',
            description: 'Start a conversation with your property landlord',
            resourceType: 'property'
          },
          {
            type: 'tenant-caretaker',
            label: 'Chat with Caretaker',
            description: 'Contact the property caretaker for maintenance',
            resourceType: 'property'
          }
        ];
        break;

      case 'LANDLORD':
        this.availableChatOptions = [
          {
            type: 'landlord-tenant',
            label: 'Chat with Tenant',
            description: 'Start a conversation with a tenant',
            resourceType: 'unit'
          },
          {
            type: 'landlord-caretaker',
            label: 'Chat with Caretaker',
            description: 'Contact the property caretaker',
            resourceType: 'property'
          }
        ];
        break;

      case 'CARETAKER':
        this.availableChatOptions = [
          {
            type: 'caretaker-tenant',
            label: 'Chat with Tenant',
            description: 'Contact a tenant in the property',
            resourceType: 'unit'
          }
        ];
        break;
    }
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
        // Extract units from properties for landlord
        if (userRole === 'LANDLORD') {
          this.userUnits = this.extractUnitsFromProperties(response);
        }
        break;
    }
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
          name: `Property ${unit.propertyId}`,
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
        propertyId: item.property?.id || item.propertyId
      })).filter((unit: Unit) => unit.id);
    }

    if (response?.data && Array.isArray(response.data)) {
      return response.data.map((item: any) => ({
        id: item.unit?.id || item.id,
        unitNumber: item.unit?.unitNumber || item.unitNumber || 'N/A',
        unitType: item.unit?.unitType || item.unitType || 'UNKNOWN',
        rentAmount: item.unit?.rentAmount || item.rentAmount || 0,
        propertyId: item.property?.id || item.propertyId
      })).filter((unit: Unit) => unit.id);
    }

    return [];
  }

  private extractUnitsFromProperties(response: any): Unit[] {
    const units: Unit[] = [];
    
    if (!response) return units;

    const properties = Array.isArray(response) ? response : (response?.data || []);
    
    properties.forEach((property: any) => {
      if (property.units && Array.isArray(property.units)) {
        property.units.forEach((unit: any) => {
          units.push({
            id: unit.id,
            unitNumber: unit.unitNumber || 'N/A',
            unitType: unit.unitType || 'UNKNOWN',
            rentAmount: unit.rentAmount || 0,
            propertyId: property.id,
            status: unit.status
          });
        });
      }
    });
    
    return units;
  }

  openNewChatModal(): void {
    // Validate user has necessary resources
    if (this.userRole === 'TENANT' && this.userProperties.length === 0) {
      alert('No property assigned to you. Please contact your landlord.');
      return;
    }
    
    if (this.userRole === 'LANDLORD' && this.userProperties.length === 0) {
      alert('No properties available. Please create a property first.');
      return;
    }
    
    if (this.userRole === 'CARETAKER' && this.userProperties.length === 0) {
      alert('No properties assigned to you. Please contact the landlord.');
      return;
    }
    
    // Reset modal state
    this.selectedChatType = null;
    this.selectedResourceId = null;
    this.showNewChatModal = true;
  }

  createChat(): void {
    if (!this.selectedChatType || !this.selectedResourceId) {
      alert('Please select chat type and resource.');
      return;
    }

    this.loadingRooms = true;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    // Route to appropriate endpoint based on chat type
    switch (this.selectedChatType) {
      // TENANT ENDPOINTS - use propertyId
      case 'tenant-landlord':
        createObservable = this.chatService.createTenantLandlordChat(this.selectedResourceId);
        break;
      case 'tenant-caretaker':
        createObservable = this.chatService.createTenantCaretakerChat(this.selectedResourceId);
        break;

      // LANDLORD ENDPOINTS
      case 'landlord-tenant':
        // Uses unitId
        createObservable = this.chatService.createLandlordTenantChat(this.selectedResourceId);
        break;
      case 'landlord-caretaker':
        // Uses propertyId
        createObservable = this.chatService.createLandlordCaretakerChat(this.selectedResourceId);
        break;

      // CARETAKER ENDPOINTS - use unitId
      case 'caretaker-tenant':
        createObservable = this.chatService.createCaretakerTenantChat(this.selectedResourceId);
        break;

      default:
        this.loadingRooms = false;
        alert('Invalid chat type selected.');
        return;
    }

    if (!createObservable) {
      this.loadingRooms = false;
      alert('Failed to initialize chat creation.');
      return;
    }

    createObservable.subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        this.loadingRooms = false;
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.chatService.loadRooms(); // Refresh rooms list
          this.selectRoom(response.data);
        } else {
          alert('Failed to create chat: ' + (response?.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        this.loadingRooms = false;
        const errorMessage = error?.error?.message || error?.message || 'Failed to create chat';
        alert(errorMessage);
        console.error('Chat creation error:', error);
      }
    });
  }

  getAvailableResources(): (Property | Unit)[] {
    if (!this.selectedChatType) return [];

    const option = this.availableChatOptions.find(opt => opt.type === this.selectedChatType);
    if (!option) return [];

    return option.resourceType === 'property' ? this.userProperties : this.userUnits;
  }

  getResourceLabel(resource: Property | Unit): string {
    if ('unitNumber' in resource) {
      // It's a Unit
      return `Unit ${resource.unitNumber} (Property ${resource.propertyId})`;
    } else {
      // It's a Property
      return `${resource.name} - ${resource.address}`;
    }
  }

  getResourceId(resource: Property | Unit): number {
    return resource.id;
  }

  isResourceSelectionRequired(): boolean {
    if (!this.selectedChatType) return false;
    
    const option = this.availableChatOptions.find(opt => opt.type === this.selectedChatType);
    if (!option) return false;

    return option.resourceType === 'unit' ? this.userUnits.length > 1 : this.userProperties.length > 1;
  }

  getDefaultResourceId(): number | null {
    if (!this.selectedChatType) return null;

    const option = this.availableChatOptions.find(opt => opt.type === this.selectedChatType);
    if (!option) return null;

    if (option.resourceType === 'property') {
      return this.userProperties.length > 0 ? this.userProperties[0].id : null;
    } else {
      return this.userUnits.length > 0 ? this.userUnits[0].id : null;
    }
  }

  // Helper methods for template
  getSelectedChatDescription(): string {
    if (!this.selectedChatType) return '';
    const option = this.availableChatOptions.find(opt => opt.type === this.selectedChatType);
    return option ? option.description : '';
  }

  getResourceTypeLabel(): string {
    if (!this.selectedChatType) return '';
    const option = this.availableChatOptions.find(opt => opt.type === this.selectedChatType);
    return option?.resourceType === 'property' ? 'Select Property' : 'Select Unit';
  }

  getAutoSelectedResourceLabel(): string {
    const resources = this.getAvailableResources();
    return resources.length > 0 ? this.getResourceLabel(resources[0]) : '';
  }

  canCreateChat(): boolean {
    if (!this.selectedChatType || this.loadingRooms) {
      return false;
    }
    
    if (!this.isResourceSelectionRequired()) {
      return !!this.getDefaultResourceId();
    }
    
    return !!this.selectedResourceId;
  }

  onChatTypeChange(): void {
    // Auto-select resource if only one available
    if (!this.isResourceSelectionRequired()) {
      this.selectedResourceId = this.getDefaultResourceId();
    } else {
      this.selectedResourceId = null;
    }
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.selectedChatType = null;
    this.selectedResourceId = null;
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
      const fileMessage = `📎 File: ${file.name} (${this.formatFileSize(file.size)})`;
      this.chatService.sendMessage(fileMessage, this.currentRoom!.id).subscribe({
        next: () => {
          this.shouldScrollToBottom = true;
        },
        error: (error: any) => {
          alert(`Failed to send file: ${file.name}`);
          console.error('File upload error:', error);
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

  // Display helpers
  getRoomDisplayName(room: ChatRoom): string {
    return this.chatService.getRoomDisplayName(room);
  }

  getRoomSubtitle(room: ChatRoom): string {
    return this.chatService.getRoomSubtitle(room);
  }

  getMessageSenderInfo(message: Message): string {
    if (this.isMyMessage(message)) {
      return 'You';
    }
    
    return message.senderName || 'Unknown User';
  }

  getChatHeaderInfo(): { title: string, subtitle: string } {
    if (!this.currentRoom) return { title: 'Chat', subtitle: '' };
    
    return {
      title: this.getRoomDisplayName(this.currentRoom),
      subtitle: this.getRoomSubtitle(this.currentRoom)
    };
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
      console.error('Scroll error:', err);
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }
}