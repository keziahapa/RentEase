import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { PropertyService } from '../../services/property.service';
import { Message, ChatRoom } from '../../services/chat.interface';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface Property {
  id: number;
  name: string;
  address: string;
}

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
  @ViewChild('emojiPicker') private emojiPicker!: PickerComponent;
  
  rooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: Message[] = [];
  newMessage = '';
  isConnected = false;
  emojiMartVisible = false;
  uploadingFiles = false;
  showNewChatModal = false;
  newChatType: 'tenant-landlord' | 'tenant-caretaker' | 'landlord-caretaker' = 'tenant-landlord';
  
  userProperties: Property[] = [];
  selectedPropertyId: number | null = null;
  loadingProperties = false;
  currentProperty: Property | null = null;
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

    this.loadUserProperties();

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

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  loadUserProperties(): void {
    this.loadingProperties = true;
    const userRole = this.authService.getCurrentUser()?.role;
    
    if (!userRole) {
      this.loadingProperties = false;
      return;
    }

    let propertyObservable: Observable<any>;

    switch(userRole.toUpperCase()) {
      case 'TENANT':
        propertyObservable = this.propertyService.getTenantUnits();
        break;
      case 'LANDLORD':
        propertyObservable = this.propertyService.getProperties();
        break;
      case 'CARETAKER':
        propertyObservable = this.propertyService.getProperties();
        break;
      default:
        this.loadingProperties = false;
        return;
    }

    propertyObservable.pipe(
      catchError((error: any) => {
        console.error('Error loading properties:', error);
        this.loadingProperties = false;
        return of([]);
      })
    ).subscribe((properties: any) => {
      this.userProperties = this.extractProperties(properties);
      this.loadingProperties = false;
      console.log('🏠 Loaded user properties:', this.userProperties);
      
      // AUTO-SELECT: Use the property that actually has users
      if (this.userProperties.length > 0) {
        // Try to find property with ID 1 first (the working one)
        const workingProperty = this.userProperties.find(p => p.id === 1) || this.userProperties[0];
        this.selectedPropertyId = workingProperty.id;
        this.currentProperty = workingProperty;
        console.log('✅ Auto-selected property:', this.currentProperty);
      } else {
        console.warn('⚠️ No properties found for user');
      }
    });
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

    if (response?.properties && Array.isArray(response.properties)) {
      return response.properties.map((property: any) => ({
        id: property.id,
        name: property.name || 'Unnamed Property',
        address: property.address || property.location || 'No address'
      })).filter((property: Property) => property.id);
    }

    if (response?.units && Array.isArray(response.units)) {
      const propertiesMap = new Map<number, Property>();
      
      response.units.forEach((unit: any) => {
        if (unit.property && unit.property.id) {
          propertiesMap.set(unit.property.id, {
            id: unit.property.id,
            name: unit.property.name || 'Unnamed Property',
            address: unit.property.address || 'No address'
          });
        }
      });
      
      return Array.from(propertiesMap.values());
    }

    return [];
  }

  trackByRoomId(index: number, room: ChatRoom): number {
    return room?.id ?? index;
  }

  trackByMessageId(index: number, message: Message): number {
    return message?.id ?? index;
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

  openNewChatModal(): void {
    if (!this.selectedPropertyId) {
      alert('No property found. Please make sure you are associated with a property.');
      return;
    }
    this.showNewChatModal = true;
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.newChatType = 'tenant-landlord';
  }

  createNewChat(): void {
    if (!this.selectedPropertyId) {
      alert('No property available. Please contact administrator.');
      return;
    }

    let createObservable;
    switch (this.newChatType) {
      case 'tenant-landlord':
        createObservable = this.chatService.createTenantLandlordChat(this.selectedPropertyId);
        break;
      case 'tenant-caretaker':
        createObservable = this.chatService.createTenantCaretakerChat(this.selectedPropertyId);
        break;
      case 'landlord-caretaker':
        createObservable = this.chatService.createLandlordCaretakerChat(this.selectedPropertyId);
        break;
      default:
        alert('Invalid chat type');
        return;
    }

    this.loadingRooms = true;
    createObservable!.subscribe({
      next: (response: any) => {
        this.loadingRooms = false;
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.selectRoom(response.data);
          alert('Chat created successfully!');
        } else {
          alert('Failed to create chat: ' + response?.message);
        }
      },
      error: (error: any) => {
        this.loadingRooms = false;
        console.error('Error creating chat:', error);
        alert('Failed to create chat: ' + (error.error?.message || error.message));
      }
    });
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

  goBack(): void {
    this.chatService.selectRoom(null);
  }

  canDelete(message: Message): boolean {
    return this.chatService.isMyMessage(message) || (message?.canDelete ?? false);
  }

  reconnect(): void {
    this.chatService.reconnect();
  }

  getConnectionStatus(): string {
    return this.isConnected ? 'Connected' : 'Disconnected';
  }

  getCurrentPropertyName(): string {
    return this.currentProperty ? `${this.currentProperty.name}` : 'No Property';
  }
}