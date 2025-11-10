import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { Message, ChatRoom, Property, Unit, ChatRoomType } from '../../services/chat.interface';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;
  
  // Chat Data
  rooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: Message[] = [];
  newMessage = '';
  isConnected = false;
  emojiMartVisible = false;
  uploadingFiles = false;
  
  // Auto-managed Properties & Units
  userProperties: Property[] = [];
  userUnits: Unit[] = [];
  
  // UI States
  showNewChatModal = false;
  newChatType: ChatRoomType = 'tenant-landlord';
  loadingProperties = false;
  loadingRooms = false;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private propertyService: PropertyService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      console.error('User not authenticated');
      return;
    }

    this.loadUserDataAutomatically();
    this.initializeSubscriptions();
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  private initializeSubscriptions(): void {
    this.chatService.rooms$.subscribe((rooms: ChatRoom[]) => {
      this.rooms = rooms ?? [];
      console.log('📋 Rooms updated:', this.rooms.length);
      this.loadingRooms = false;
    });

    this.chatService.currentRoom$.subscribe((room: ChatRoom | null) => {
      this.currentRoom = room;
      console.log('🎯 Current room:', room);
    });

    this.chatService.messages$.subscribe((messages: Message[]) => {
      this.messages = messages ?? [];
      console.log('💬 Messages updated:', this.messages.length);
      setTimeout(() => this.scrollToBottom(), 100);
    });

    this.chatService.connected$.subscribe((connected: boolean) => {
      this.isConnected = connected;
      console.log('🔌 Connection status:', connected);
    });
  }

  private loadUserDataAutomatically(): void {
    this.loadingProperties = true;
    const userRole = this.authService.getCurrentUser()?.role;
    
    if (!userRole) {
      this.loadingProperties = false;
      return;
    }

    console.log(`👤 Loading data for user role: ${userRole}`);

    let dataObservable: Observable<any>;

    switch(userRole.toUpperCase()) {
      case 'TENANT':
        dataObservable = this.propertyService.getTenantUnits();
        break;
      case 'LANDLORD':
      case 'CARETAKER':
        dataObservable = this.propertyService.getProperties();
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
      this.processUserData(response, userRole);
      this.loadingProperties = false;
    });
  }

  private processUserData(response: any, userRole: string): void {
    switch(userRole.toUpperCase()) {
      case 'TENANT':
        this.userUnits = this.extractUnits(response);
        this.userProperties = this.extractPropertiesFromUnits(response);
        console.log('✅ Tenant data loaded:', {
          units: this.userUnits,
          properties: this.userProperties
        });
        break;

      case 'LANDLORD':
      case 'CARETAKER':
        this.userProperties = this.extractProperties(response);
        console.log('✅ Landlord/Caretaker properties loaded:', this.userProperties);
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

  openNewChatModal(): void {
    const userRole = this.authService.getCurrentUser()?.role;
    
    if (userRole?.toUpperCase() === 'TENANT') {
      if (this.userUnits.length === 0) {
        alert('No units assigned to you. Please contact your landlord.');
        return;
      }
      this.newChatType = 'tenant-landlord';
    } 
    else if (userRole?.toUpperCase() === 'LANDLORD') {
      if (this.userProperties.length === 0) {
        alert('No properties available. Please create a property first.');
        return;
      }
      this.newChatType = 'landlord-caretaker';
    }
    else if (userRole?.toUpperCase() === 'CARETAKER') {
      if (this.userProperties.length === 0) {
        alert('No properties assigned to you. Please contact administrator.');
        return;
      }
      this.newChatType = 'tenant-caretaker';
    }
    
    this.showNewChatModal = true;
  }

  createNewChat(): void {
    const userRole = this.authService.getCurrentUser()?.role;
    
    let resourceId: number | null = null;
    let createObservable;

    switch (this.newChatType) {
      case 'tenant-landlord':
      case 'tenant-caretaker':
      case 'landlord-caretaker':
        resourceId = this.userProperties.length > 0 ? this.userProperties[0].id : null;
        break;
        
      case 'landlord-tenant':
      case 'caretaker-tenant':
        resourceId = this.userUnits.length > 0 ? this.userUnits[0].id : null;
        break;
    }

    if (!resourceId) {
      alert('No available resource found for chat creation.');
      return;
    }

    switch (this.newChatType) {
      case 'tenant-landlord':
        createObservable = this.chatService.createTenantLandlordChat(resourceId);
        break;
      case 'tenant-caretaker':
        createObservable = this.chatService.createTenantCaretakerChat(resourceId);
        break;
      case 'landlord-caretaker':
        createObservable = this.chatService.createLandlordCaretakerChat(resourceId);
        break;
      case 'landlord-tenant':
        createObservable = this.chatService.createLandlordTenantChat(resourceId);
        break;
      case 'caretaker-tenant':
        createObservable = this.chatService.createCaretakerTenantChat(resourceId);
        break;
    }

    this.loadingRooms = true;
    
    createObservable.subscribe({
      next: (response: any) => {
        this.loadingRooms = false;
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.selectRoom(response.data);
          console.log('✅ Chat created successfully');
        } else {
          alert('Failed to create chat: ' + (response?.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        this.loadingRooms = false;
        console.error('❌ Backend error creating chat:', error);
        alert('Failed to create chat: ' + (error.error?.message || error.message));
      }
    });
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
  }

  selectRoom(room: ChatRoom): void {
    this.chatService.selectRoom(room);
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.currentRoom) {
      this.chatService.sendMessage(this.newMessage.trim(), this.currentRoom.id).subscribe({
        next: () => {
          this.newMessage = '';
          this.hideEmojiPicker();
        },
        error: (error: any) => {
          console.error('Error sending message:', error);
          alert('Failed to send message. Please try again.');
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
    this.emojiMartVisible = !this.emojiMartVisible;
  }

  hideEmojiPicker(): void {
    this.emojiMartVisible = false;
  }

  addEmoji(event: any): void {
    if (event.emoji && event.emoji.native) {
      this.newMessage += event.emoji.native;
    }
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
          console.log('File message sent successfully');
        },
        error: (error: any) => {
          console.error('Error sending file message:', error);
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

  getMessageStatus(message: Message): string {
    if (!message?.status) return '✓';
    return message.status === 'READ' ? '✓✓' : message.status === 'DELIVERED' ? '✓✓' : '✓';
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
    const userRole = this.authService.getCurrentUser()?.role;
    if (userRole?.toUpperCase() === 'TENANT' && this.userUnits.length > 0) {
      return `Unit ${this.userUnits[0].unitNumber}`;
    } else if (this.userProperties.length > 0) {
      return this.userProperties[0].name;
    }
    return 'No Property/Unit';
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }
}