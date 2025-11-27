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
    // Monitor auth state changes
    this.authSubscription = this.authService.isAuthenticated$.subscribe({
      next: (isAuthenticated: boolean) => {
        console.log('🔐 Auth state changed in chat:', isAuthenticated);
        
        if (!isAuthenticated && this.isInitialized) {
          console.log('User logged out, cleaning up chat...');
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
      console.log('User not authenticated, redirecting to login...');
      this.redirectToLogin();
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    this.userRole = currentUser?.role?.toUpperCase() || '';
    console.log('🚀 Initializing chat component for role:', this.userRole);
    
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
        console.log('📥 Rooms subscription received:', rooms?.length || 0, 'rooms');
        this.rooms = rooms ?? [];
        this.loadingRooms = false;
        this.rooms.forEach(room => this.enrichRoomParticipants(room));
      },
      error: (error: any) => {
        console.error('❌ Error in rooms subscription:', error);
        this.loadingRooms = false;
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.currentRoom$.subscribe({
      next: (room: ChatRoom | null) => {
        console.log('📥 CurrentRoom subscription received:', room);
        this.currentRoom = room;
        if (room) {
          console.log('🔄 Enriching room participants for room:', room.id);
          this.enrichRoomParticipants(room);
          this.updateCurrentChatInfo();
        } else {
          this.currentChatInfo = null;
        }
      },
      error: (error: any) => {
        console.error('❌ Error in currentRoom subscription:', error);
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.messages$.subscribe({
      next: (messages: Message[]) => {
        console.log('📥 Messages subscription received:', messages?.length || 0, 'messages');
        const oldLength = this.messages.length;
        this.messages = messages ?? [];
        
        if (this.messages.length > oldLength) {
          console.log('🆕 New messages detected, will scroll to bottom');
          this.shouldScrollToBottom = true;
        }
        
        // Log message details for debugging
        if (messages.length > 0) {
          console.log('📝 First message:', messages[0]);
          console.log('📝 Last message:', messages[messages.length - 1]);
        }
      },
      error: (error: any) => {
        console.error('❌ Error in messages subscription:', error);
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
      }
    });

    this.chatService.connected$.subscribe({
      next: (connected: boolean) => {
        console.log('🔌 Connection status:', connected);
        this.isConnected = connected;
      },
      error: (error: any) => {
        console.error('❌ Error in connected subscription:', error);
      }
    });
  }

  private shouldHandleAuthError(error: any): boolean {
    // Only handle auth error if it's NOT a role-based access issue
    return error?.status === 401 && !this.isRoleBasedUnauthorized(error);
  }

  private isRoleBasedUnauthorized(error: any): boolean {
    // Check if it's a 401 but the token is still valid (role-based access issue)
    if (error?.status === 401 && this.authService.isAuthenticated()) {
      const url = error.url || '';
      
      // If it's a tenant endpoint but user is not a tenant
      if (url.includes('/api/tenant/') && !this.authService.isTenant()) {
        return true;
      }
      
      // If it's a landlord endpoint but user is not a landlord
      if (url.includes('/api/landlord/') && !this.authService.isLandlord()) {
        return true;
      }
      
      // If it's a caretaker endpoint but user is not a caretaker
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
            // If user is not a tenant, this is expected to fail
            if (error.status === 401 && !this.authService.isTenant()) {
              console.log('User is not a tenant, skipping tenant units');
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
      
      // After loading data, ensure chat service is connected
      this.ensureChatConnection();
    });
  }

  private ensureChatConnection(): void {
    if (!this.isConnected) {
      console.log('🔄 Ensuring chat connection...');
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
    
    console.log(`✅ Loaded data for ${userRole}:`, {
      properties: this.userProperties.length,
      units: this.userUnits.length
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
    // Only fetch tenant data if current user is authorized
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

  private handleAuthError(error: any): void {
    console.warn('Authentication error detected:', error);
    
    // Only redirect if user is actually not authenticated
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin();
    } else {
      // If still authenticated but got 401, show user-friendly message
      console.log('User is still authenticated, 401 might be temporary');
    }
  }

  private redirectToLogin(): void {
    this.cleanupOnLogout();
    this.router.navigate(['/login']);
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
    // Check if user has permission to create this chat type
    if (!this.canCreateChatType(chatType)) {
      alert(`You don't have permission to create ${chatType} chats`);
      return;
    }

    let resourceId: number | null = null;
    let createObservable: Observable<ApiResponse<ChatRoom>> | null = null;

    if (chatType === this.CHAT_TYPES.CARETAKER_TENANT) {
      if (this.userUnits.length > 0) {
        resourceId = this.userUnits[0].id;
      } else {
        alert('No units available for chat creation.');
        return;
      }
      
      createObservable = this.chatService.createCaretakerTenantChat(resourceId);
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
        console.error('Chat creation error:', error);
        
        // Only handle auth error if it's specifically 401 and not role-based
        if (this.shouldHandleAuthError(error)) {
          this.handleAuthError(error);
        }
        
        alert('Failed to create chat: ' + (error.error?.message || error.message || 'Unknown error'));
      }
    });
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
    console.log('🎯 SELECT ROOM CLICKED:', room);
    
    if (!this.authService.isAuthenticated()) {
      console.error('❌ User not authenticated');
      this.handleAuthError({ status: 401 });
      return;
    }

    if (!room || !room.id) {
      console.error('❌ Invalid room selected');
      return;
    }

    console.log('📥 Selecting room with ID:', room.id);
    console.log('📝 Room details:', {
      name: room.name,
      participants: room.participants?.length,
      lastMessage: room.lastMessage?.content
    });

    // Update current room immediately for UI feedback
    this.currentRoom = room;
    this.messages = []; // Clear previous messages
    
    // Call the service to load messages
    this.chatService.selectRoom(room);
    this.shouldScrollToBottom = true;

    // Force refresh messages after a short delay
    setTimeout(() => {
      console.log('🔄 Force refreshing messages for room:', room.id);
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

  canCreateCaretakerTenantChat(): boolean {
    return this.userRole === 'CARETAKER' && this.userUnits.length > 0;
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

  // Debug methods
  checkRoomState(): void {
    console.log('=== ROOM STATE CHECK ===');
    console.log('Current Room:', this.currentRoom);
    console.log('Rooms List:', this.rooms);
    console.log('Messages:', this.messages);
    console.log('Is Connected:', this.isConnected);
    
    // Check if service has the same current room
    this.chatService.currentRoom$.subscribe(room => {
      console.log('Service Current Room:', room);
    }).unsubscribe();
    
    this.chatService.messages$.subscribe(messages => {
      console.log('Service Messages Count:', messages.length);
    }).unsubscribe();
  }

 testConnection(): void {
  console.log('=== CONNECTION TEST ===');
 
  if (this.currentRoom) {
    const testMessage = `Test message ${new Date().toLocaleTimeString()}`;
    console.log('Sending test message:', testMessage);
    this.chatService.sendMessage(testMessage, this.currentRoom.id).subscribe({
      next: (response) => console.log('Test send success:', response),
      error: (error) => console.error('Test send error:', error)
    });
  } else {
    console.log('No room selected for test');
  }
}
  refreshChatData(): void {
    console.log('🔄 Manually refreshing chat data...');
    if (this.authService.isAuthenticated()) {
      this.chatService.loadRooms();
      if (this.currentRoom) {
        this.chatService.getMessages(this.currentRoom.id);
      }
    } else {
      console.log('Cannot refresh: User not authenticated');
    }
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