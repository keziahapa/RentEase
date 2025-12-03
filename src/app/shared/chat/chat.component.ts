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
import { catchError, map, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

interface EnrichedChatInfo {
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
}

// ✅ Extended interfaces for temporary use
interface ExtendedProperty extends Property {
  description?: string;
  unitsCount?: number;
  [key: string]: any; // Allow additional properties
}

interface ExtendedUnit extends Unit {
  propertyName?: string;
  tenantName?: string;
  [key: string]: any; // Allow additional properties
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

  userProperties: ExtendedProperty[] = [];
  userUnits: ExtendedUnit[] = [];
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
  availableUnits: ExtendedUnit[] = [];

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
        dataObservable = forkJoin([
          this.tenantService.getTenantUnits(),
          this.propertyService.getProperties()
        ]).pipe(
          map(([unitsResponse, propertiesResponse]) => {
            console.log('Tenant units raw:', unitsResponse);
            console.log('Properties raw:', propertiesResponse);
            
            const units = this.extractUnits(unitsResponse);
            const properties = this.extractProperties(propertiesResponse);
            
            console.log('Extracted units:', units);
            console.log('Extracted properties:', properties);
            
            const unitsWithPropertyIds = units.map(unit => {
              if (unit.propertyId && unit.propertyId > 0) {
                return unit;
              }
              
              const propertyName = unit.propertyName || '';
              if (propertyName) {
                const matchedProperty = properties.find(p => 
                  p.name.toLowerCase() === propertyName.toLowerCase() ||
                  p.name.toLowerCase().includes(propertyName.toLowerCase()) ||
                  propertyName.toLowerCase().includes(p.name.toLowerCase())
                );
                
                if (matchedProperty) {
                  console.log(`✅ Matched unit "${unit.unitNumber}" to property:`, matchedProperty);
                  return { ...unit, propertyId: matchedProperty.id };
                }
              }
              
              console.log(`❌ Could not find propertyId for unit:`, unit);
              return unit;
            });
            
            return { units: unitsWithPropertyIds, properties };
          }),
          catchError((error: any) => {
            console.error('Error loading tenant data:', error);
            return of({ units: [], properties: [] });
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
    console.log(`Processing user data for ${userRole}:`, response);
    
    switch(userRole) {
      case 'TENANT':
        this.userUnits = (response.units || this.extractUnits(response)) as ExtendedUnit[];
        this.userProperties = (response.properties || this.extractPropertiesFromUnits(response)) as ExtendedProperty[];
        
        console.log('Final tenant units:', this.userUnits);
        console.log('Final tenant properties:', this.userProperties);
        
        this.userUnits.forEach((unit, index) => {
          console.log(`Unit ${index + 1}:`, {
            id: unit.id,
            unitNumber: unit.unitNumber,
            propertyName: unit.propertyName,
            propertyId: unit.propertyId,
            hasValidPropertyId: !!(unit.propertyId && unit.propertyId > 0)
          });
        });
        break;
        
      case 'LANDLORD':
      case 'CARETAKER':
        this.userProperties = this.extractProperties(response) as ExtendedProperty[];
        console.log(`${userRole} properties:`, this.userProperties);
        break;
    }
  }

  private extractUnits(response: any): ExtendedUnit[] {
    if (!response) {
      console.log('No response for extractUnits');
      return [];
    }
    
    console.log('Raw response for extractUnits:', response);
    
    try {
      let dataArray: any[] = [];
      
      if (Array.isArray(response)) {
        dataArray = response;
      } else if (response?.data && Array.isArray(response.data)) {
        dataArray = response.data;
      } else if (response?.units && Array.isArray(response.units)) {
        dataArray = response.units;
      } else if (response && typeof response === 'object') {
        const possibleKeys = ['units', 'data', 'tenantUnits', 'assignedUnits', 'unitsList'];
        for (const key of possibleKeys) {
          if (Array.isArray(response[key])) {
            dataArray = response[key];
            console.log(`Found units in key: ${key}`);
            break;
          }
        }
      }
      
      if (dataArray.length === 0) {
        console.warn('No units found in response:', response);
        return [];
      }
      
      const extractedUnits = dataArray.map((item: any, index: number) => {
        let propertyId: number = 0;
        let propertyName: string = '';
        
        // Check all possible property ID locations
        if (item.propertyId && Number(item.propertyId) > 0) {
          propertyId = Number(item.propertyId);
        } else if (item.property?.id && Number(item.property.id) > 0) {
          propertyId = Number(item.property.id);
        } else if (item.property_id && Number(item.property_id) > 0) {
          propertyId = Number(item.property_id);
        } else if (item.unit?.propertyId && Number(item.unit.propertyId) > 0) {
          propertyId = Number(item.unit.propertyId);
        }
        
        // Check all possible property name locations
        if (item.propertyName) {
          propertyName = item.propertyName;
        } else if (item.property?.name) {
          propertyName = item.property.name;
        } else if (item.property_name) {
          propertyName = item.property_name;
        } else if (item.unit?.propertyName) {
          propertyName = item.unit.propertyName;
        } else if (item.property?.propertyName) {
          propertyName = item.property.propertyName;
        } else if (item.buildingName) {
          propertyName = item.buildingName;
        }
        
        const unit: ExtendedUnit = {
          id: Number(item.id || item.unitId || item.unit?.id || index + 1),
          unitNumber: item.unitNumber || item.unit?.unitNumber || item.unit_number || `Unit ${index + 1}`,
          unitType: item.unitType || item.unit?.unitType || item.unit_type || 'APARTMENT',
          rentAmount: item.rentAmount || item.unit?.rentAmount || item.rent_amount || 0,
          propertyId: propertyId,
          propertyName: propertyName,
          tenantName: item.tenantName || item.tenant?.name || item.fullName || item.user?.name || ''
        };
        
        console.log(`Extracted unit ${index}:`, unit);
        return unit;
      });
      
      const filteredUnits = extractedUnits.filter((unit: ExtendedUnit) => 
        unit.propertyName && unit.propertyName.trim() !== ''
      );
      
      console.log(`Extracted ${filteredUnits.length} valid units`);
      return filteredUnits;
      
    } catch (error) {
      console.error('Error extracting units:', error, response);
      return [];
    }
  }

  private extractProperties(response: any): ExtendedProperty[] {
    if (!response) return [];
    
    console.log('Raw response for extractProperties:', response);
    
    try {
      let dataArray: any[] = [];
      
      if (Array.isArray(response)) {
        dataArray = response;
      } else if (response?.data && Array.isArray(response.data)) {
        dataArray = response.data;
      } else if (response?.properties && Array.isArray(response.properties)) {
        dataArray = response.properties;
      }
      
      if (dataArray.length === 0) {
        console.warn('No properties found in response:', response);
        return [];
      }
      
      const properties = dataArray.map((item: any) => {
        // ✅ FIX: Use type assertion to bypass TypeScript check
        const property = {
          id: Number(item.id || item.propertyId || item.property?.id || 0),
          name: item.name || item.propertyName || item.property?.name || 'Unnamed Property',
          address: item.address || item.property?.address || item.location || item.property?.location || 'No address',
          // ✅ These are allowed in ExtendedProperty interface
          description: item.description || item.property?.description || '',
          unitsCount: item.unitsCount || item.property?.unitsCount || item.totalUnits || 0
        } as ExtendedProperty;
        
        if (property.id > 0) {
          console.log('Extracted property:', property);
          return property;
        }
        return null;
      }).filter((p: ExtendedProperty | null): p is ExtendedProperty => p !== null);
      
      console.log(`Extracted ${properties.length} valid properties`);
      return properties;
      
    } catch (error) {
      console.error('Error extracting properties:', error);
      return [];
    }
  }

  private extractPropertiesFromUnits(response: any): ExtendedProperty[] {
    const units = this.extractUnits(response);
    const propertyMap = new Map<number, ExtendedProperty>();
    
    units.forEach(unit => {
      const propertyName = unit.propertyName || '';
      if (unit.propertyId && unit.propertyId > 0 && propertyName) {
        if (!propertyMap.has(unit.propertyId)) {
          propertyMap.set(unit.propertyId, {
            id: unit.propertyId,
            name: propertyName,
            address: 'Address not available',
            description: '',
            unitsCount: 1
          } as ExtendedProperty);
        }
      }
    });
    
    const properties = Array.from(propertyMap.values());
    console.log('Properties extracted from units:', properties);
    return properties;
  }

  // Rest of your methods (same as before, just with proper type handling)

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
      case this.CHAT_TYPES.TENANT_CARETAKER:
        if (this.userRole !== 'TENANT') {
          alert('Only tenants can create landlord or caretaker chats.');
          return;
        }
        
        if (this.userUnits.length === 0) {
          alert('No units found. Please contact your landlord.');
          return;
        }
        
        const tenantUnit = this.userUnits[0];
        resourceId = this.getPropertyIdFromUnit(tenantUnit);
        
        if (!resourceId || resourceId === 0) {
          console.error('No valid propertyId found for tenant unit:', tenantUnit);
          const unitInfo = tenantUnit.unitNumber ? `Unit ${tenantUnit.unitNumber}` : 'your unit';
          alert(`Unable to determine property for ${unitInfo}. Please contact support.`);
          return;
        }
        
        console.log(`${chatType} chat with propertyId: ${resourceId}`);
        
        if (chatType === this.CHAT_TYPES.TENANT_LANDLORD) {
          createObservable = this.chatService.createTenantLandlordChat(resourceId);
        } else {
          createObservable = this.chatService.createTenantCaretakerChat(resourceId);
        }
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
        
        resourceId = this.selectedPropertyId || this.userProperties[0].id;
        console.log(`Landlord creating caretaker chat with propertyId: ${resourceId}`);
        createObservable = this.chatService.createLandlordCaretakerChat(resourceId);
        break;
        
      case this.CHAT_TYPES.LANDLORD_TENANT:
        if (this.userRole !== 'LANDLORD') {
          alert('Only landlords can create tenant chats.');
          return;
        }
        
        this.openTenantSelectionModal();
        return;
        
      case this.CHAT_TYPES.CARETAKER_TENANT:
        if (this.userRole !== 'CARETAKER') {
          alert('Only caretakers can create tenant chats.');
          return;
        }
        
        this.openTenantSelectionModal();
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

  private getPropertyIdFromUnit(unit: ExtendedUnit): number | null {
    if (!unit) return null;
    
    if (unit.propertyId && unit.propertyId > 0) {
      return unit.propertyId;
    }
    
    if ((unit as any).property?.id && (unit as any).property.id > 0) {
      return (unit as any).property.id;
    }
    
    if ((unit as any).property_id && (unit as any).property_id > 0) {
      return (unit as any).property_id;
    }
    
    return null;
  }

  openTenantSelectionModal(): void {
    const propertyId = this.userRole === 'LANDLORD' 
      ? (this.selectedPropertyId || (this.userProperties.length > 0 ? this.userProperties[0].id : null))
      : (this.selectedCaretakerPropertyId || (this.userProperties.length > 0 ? this.userProperties[0].id : null));
    
    if (!propertyId) {
      alert('Please select a property first.');
      return;
    }
    
    this.loadingUnits = true;
    this.showTenantSelectionModal = true;
    this.selectedUnitId = null;
    
    this.propertyService.getPropertyUnits(propertyId.toString()).subscribe({
      next: (response: any) => {
        this.availableUnits = this.extractUnits(response) as ExtendedUnit[];
        this.loadingUnits = false;
      },
      error: (error: any) => {
        console.error('Error loading units:', error);
        alert('Failed to load units for this property.');
        this.loadingUnits = false;
        this.showTenantSelectionModal = false;
      }
    });
  }

  closeTenantSelectionModal(): void {
    this.showTenantSelectionModal = false;
    this.selectedUnitId = null;
    this.availableUnits = [];
  }

  selectUnitForChat(unit: ExtendedUnit): void {
    this.selectedUnitId = unit.id;
  }

  createTenantChat(): void {
    if (!this.selectedUnitId) {
      alert('Please select a unit first.');
      return;
    }
    
    const chatType = this.userRole === 'LANDLORD' 
      ? this.CHAT_TYPES.LANDLORD_TENANT 
      : this.CHAT_TYPES.CARETAKER_TENANT;
    
    this.loadingRooms = true;
    
    const createObservable = this.userRole === 'LANDLORD'
      ? this.chatService.createLandlordTenantChat(this.selectedUnitId)
      : this.chatService.createCaretakerTenantChat(this.selectedUnitId);
    
    createObservable.subscribe({
      next: (response: any) => {
        this.handleChatCreationResponse(response, chatType);
        this.closeTenantSelectionModal();
      },
      error: (error: any) => {
        this.handleChatCreationError(error, chatType);
        this.closeTenantSelectionModal();
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
    this.selectedPropertyId = null;
    this.selectedCaretakerPropertyId = null;
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

  formatTime(timestamp: Date): string {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const messageDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      
      if (messageDate.getTime() === today.getTime()) {
        return this.formatLocalTime(date);
      } else if (messageDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  }

  formatMessageTime(timestamp: Date): string {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) return '';
      
      return this.formatLocalTime(date);
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
  }

  private formatLocalTime(date: Date): string {
    const timezoneOffset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (timezoneOffset * 60000));
    
    return localDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  trackByRoomId(index: number, room: ChatRoom): number {
    return room?.id ?? index;
  }

  trackByMessageId(index: number, message: Message): number {
    return message?.id ?? index;
  }

  trackByPropertyId(index: number, property: ExtendedProperty): number {
    return property?.id ?? index;
  }

  trackByUnitId(index: number, unit: ExtendedUnit): number {
    return unit?.id ?? index;
  }

  isMyMessage(message: Message): boolean {
    return this.chatService.isMyMessage(message);
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
      const propertyName = unit.propertyName || '';
      return propertyName 
        ? `${propertyName} - Unit ${unit.unitNumber}`
        : `Unit ${unit.unitNumber}`;
    } else if (this.userProperties.length > 0) {
      return this.userProperties[0].name;
    }
    return 'No Property/Unit';
  }

  formatChatName(room: ChatRoom): string {
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

  getChatHeaderInfo(): EnrichedChatInfo {
    if (!this.currentRoom) {
      return { title: 'Chat', subtitle: '', description: '' };
    }

    const currentUser = this.authService.getCurrentUser();
    const otherParticipants = this.currentRoom.participants?.filter(p => p.id !== currentUser?.id) || [];

    if (otherParticipants.length === 0) {
      return this.getDefaultChatInfo(this.currentRoom.type);
    }

    if (otherParticipants.length === 1) {
      return this.getSingleParticipantInfo(otherParticipants[0], this.currentRoom);
    } else {
      return this.getMultipleParticipantsInfo(otherParticipants, this.currentRoom);
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

  getMessageSenderInfo(message: Message): string {
    if (!message || !message.sender) return 'User';
    return message.sender.name || message.sender.email || 'User';
  }

  getMessageStatusClass(message: Message): string {
    if (!message) return 'status-sent';
    
    if (message.isEdited) {
      return 'status-edited';
    }
    
    return 'status-sent';
  }

  getMessageStatusIcon(message: Message): string {
    const statusClass = this.getMessageStatusClass(message);
    
    switch (statusClass) {
      case 'status-read':
        return 'done_all';
      case 'status-delivered':
        return 'done_all';
      case 'status-edited':
        return 'edit';
      case 'status-failed':
        return 'error';
      default:
        return 'done';
    }
  }

  clearChat(): void {
    if (!this.currentRoom) return;
    
    if (confirm('Are you sure you want to clear all messages in this chat?')) {
      alert('Clear chat functionality would be implemented here.');
    }
  }

  refreshRooms(): void {
    this.loadingRooms = true;
    console.log('Refreshing chat rooms...');
    this.chatService.reconnect();
    setTimeout(() => {
      this.loadingRooms = false;
      console.log('Chat rooms refresh complete');
    }, 2000);
  }

  getPropertyName(propertyId: number): string {
    const property = this.userProperties.find(p => p.id === propertyId);
    return property?.name || `Property ${propertyId}`;
  }

  onPropertySelectedForChat(event: any): void {
    const value = event.target.value;
    if (value) {
      if (this.userRole === 'LANDLORD') {
        this.selectedPropertyId = parseInt(value, 10);
      } else if (this.userRole === 'CARETAKER') {
        this.selectedCaretakerPropertyId = parseInt(value, 10);
      }
    } else {
      this.selectedPropertyId = null;
      this.selectedCaretakerPropertyId = null;
    }
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
}