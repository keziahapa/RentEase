import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatService } from '../../../../../services/chat.service';
import { PropertyService } from '../../../../../services/property.service';
import { 
  ChatRoom, 
  ChatMessage, 
  CreateMessageRequest, 
  ApiResponse,
  ChatRoomResponse,
  ChatMessageResponse
} from '../../../../../services/chat.interface';

@Component({
  selector: 'app-landlord-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './landlord-chat.component.html',
  styleUrls: ['./landlord-chat.component.scss'],
  providers: [ChatService, PropertyService]
})
export class LandlordChatComponent implements OnInit {
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  properties: any[] = [];
  isLoading = false;
  selectedPropertyId: number | null = null;
  showNewChatModal = false;
  newChatType: 'tenant' | 'caretaker' | null = null;
  newMessage = '';

  constructor(
    private chatService: ChatService,
    private propertyService: PropertyService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadProperties();
    this.loadChatRooms();
  }

  private showSnackbar(message: string, type: 'success' | 'error' = 'success'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'error' ? ['error-snackbar'] : ['success-snackbar']
    });
  }

  loadProperties(): void {
    this.propertyService.getProperties().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.properties = response.data;
        } else {
          this.properties = [];
        }
      },
      error: (error: any) => {
        console.error('Failed to load properties:', error);
        this.showSnackbar('Failed to load properties', 'error');
        this.properties = [];
      }
    });
  }

  loadChatRooms(): void {
    this.isLoading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response: ChatRoomResponse) => {
        if (response.success && response.data) {
          this.chatRooms = response.data.filter((room: ChatRoom) => 
            room && (room.type === 'TENANT_LANDLORD' || room.type === 'LANDLORD_CARETAKER')
          );
          this.chatRooms = this.chatService.sortRoomsByLastMessage(this.chatRooms);
        } else {
          this.chatRooms = [];
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to load chat rooms:', error);
        this.showSnackbar('Failed to load chat rooms', 'error');
        this.chatRooms = [];
        this.isLoading = false;
      }
    });
  }

  openNewChatModal(type: 'tenant' | 'caretaker'): void {
    this.newChatType = type;
    this.showNewChatModal = true;
    this.selectedPropertyId = null;
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.newChatType = null;
    this.selectedPropertyId = null;
  }

  startNewChat(): void {
    if (!this.selectedPropertyId || !this.newChatType) {
      this.showSnackbar('Please select a property', 'error');
      return;
    }

    if (this.newChatType === 'tenant') {
      this.startTenantChat(this.selectedPropertyId);
    } else {
      this.startCaretakerChat(this.selectedPropertyId);
    }
  }

  startTenantChat(propertyId: number): void {
    this.chatService.createTenantLandlordRoom(propertyId).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success && response.data) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.closeNewChatModal();
          this.showSnackbar('Chat with tenant started successfully');
        } else {
          this.showSnackbar('Failed to start chat with tenant', 'error');
        }
      },
      error: (error: any) => {
        console.error('Failed to create tenant chat:', error);
        this.showSnackbar('Failed to start chat with tenant', 'error');
      }
    });
  }

  startCaretakerChat(propertyId: number): void {
    this.chatService.createLandlordCaretakerRoom(propertyId).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success && response.data) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.closeNewChatModal();
          this.showSnackbar('Chat with caretaker started successfully');
        } else {
          this.showSnackbar('Failed to start chat with caretaker', 'error');
        }
      },
      error: (error: any) => {
        console.error('Failed to create caretaker chat:', error);
        this.showSnackbar('Failed to start chat with caretaker', 'error');
      }
    });
  }

  selectRoom(room: ChatRoom): void {
    if (!room) return;
    
    this.currentRoom = room;
    this.loadRoomMessages(room.id);
    this.markRoomAsRead(room.id);
  }

  loadRoomMessages(roomId: number): void {
    this.chatService.getRoomMessages(roomId).subscribe({
      next: (response: ChatMessageResponse) => {
        if (response.success && response.data) {
          this.messages = response.data;
        } else {
          this.messages = [];
        }
      },
      error: (error: any) => {
        console.error('Failed to load messages:', error);
        this.showSnackbar('Failed to load messages', 'error');
        this.messages = [];
      }
    });
  }

  sendMessage(): void {
    if (!this.currentRoom || !this.newMessage.trim()) return;

    const messageData: CreateMessageRequest = {
      chatRoomId: this.currentRoom.id,
      content: this.newMessage.trim()
    };

    this.chatService.sendMessage(messageData).subscribe({
      next: (response: ApiResponse<ChatMessage>) => {
        if (response.success && response.data) {
          this.messages.push(response.data);
          this.newMessage = '';
          
          if (this.currentRoom) {
            this.currentRoom.lastMessage = response.data;
          }
          this.showSnackbar('Message sent successfully');
        } else {
          this.showSnackbar('Failed to send message', 'error');
        }
      },
      error: (error: any) => {
        console.error('Failed to send message:', error);
        this.showSnackbar('Failed to send message', 'error');
      }
    });
  }

  markRoomAsRead(roomId: number): void {
    this.chatService.markRoomAsRead(roomId).subscribe({
      next: (response: ApiResponse<null>) => {
        if (response.success) {
          const room = this.chatRooms.find(r => r.id === roomId);
          if (room) {
            room.unreadCount = 0;
          }
        }
      },
      error: (error: any) => {
        console.error('Failed to mark room as read:', error);
      }
    });
  }

  getRoomDisplayName(room: ChatRoom): string {
    if (!room || !room.participants) return 'Unknown User';
    
    const currentUserId = this.getCurrentUserId();
    return this.chatService.generateRoomDisplayName(room, currentUserId);
  }

  getPropertyName(propertyId: number): string {
    const property = this.properties.find(p => p.id === propertyId);
    return property ? property.name : 'Unknown Property';
  }

  getOtherParticipants(room: ChatRoom): any[] {
    if (!room || !room.participants || !Array.isArray(room.participants)) {
      return [];
    }
    
    const currentUserId = this.getCurrentUserId();
    return this.chatService.getOtherParticipants(room, currentUserId);
  }

  getCurrentUserId(): number {
    return this.chatService.getCurrentUserId();
  }
}