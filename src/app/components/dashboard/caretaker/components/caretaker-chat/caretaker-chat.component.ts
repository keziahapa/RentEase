import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatService } from '../../../../../services/chat.service';
import { CaretakerService } from '../../../../../services/caretaker.service';
import { 
  ChatRoom, 
  ChatMessage, 
  CreateMessageRequest, 
  ApiResponse,
  ChatRoomResponse,
  ChatMessageResponse
} from '../../../../../services/chat.interface';

@Component({
  selector: 'app-caretaker-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './caretaker-chat.component.html',
  styleUrls: ['./caretaker-chat.component.scss'],
  providers: [ChatService, CaretakerService]
})
export class CaretakerChatComponent implements OnInit {
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  managedProperties: any[] = [];
  isLoading = false;
  selectedPropertyId: number | null = null;
  showNewChatModal = false;
  newChatType: 'tenant' | 'landlord' | null = null;
  newMessage = '';

  constructor(
    private chatService: ChatService,
    private caretakerService: CaretakerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadManagedProperties();
    this.loadChatRooms();
  }

  private showSnackbar(message: string, type: 'success' | 'error' = 'success'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'error' ? ['error-snackbar'] : ['success-snackbar']
    });
  }

  loadManagedProperties(): void {
    this.caretakerService.getProperties().subscribe({
      next: (properties: any[]) => {
        this.managedProperties = properties;
      },
      error: (error: any) => {
        console.error('Failed to load managed properties:', error);
        this.showSnackbar('Failed to load managed properties', 'error');
      }
    });
  }

  loadChatRooms(): void {
    this.isLoading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response: ChatRoomResponse) => {
        if (response.success) {
          this.chatRooms = response.data.filter((room: ChatRoom) => 
            room.type === 'TENANT_CARETAKER' || room.type === 'LANDLORD_CARETAKER'
          );
          this.chatRooms = this.chatService.sortRoomsByLastMessage(this.chatRooms);
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to load chat rooms:', error);
        this.showSnackbar('Failed to load chat rooms', 'error');
        this.isLoading = false;
      }
    });
  }

  openNewChatModal(type: 'tenant' | 'landlord'): void {
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
      this.startLandlordChat(this.selectedPropertyId);
    }
  }

  startTenantChat(propertyId: number): void {
    this.chatService.createTenantCaretakerRoom(propertyId).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.closeNewChatModal();
          this.showSnackbar('Chat with tenant started successfully');
        }
      },
      error: (error: any) => {
        console.error('Failed to create tenant chat:', error);
        this.showSnackbar('Failed to start chat with tenant', 'error');
      }
    });
  }

  startLandlordChat(propertyId: number): void {
    this.chatService.createLandlordCaretakerRoom(propertyId).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.closeNewChatModal();
          this.showSnackbar('Chat with landlord started successfully');
        }
      },
      error: (error: any) => {
        console.error('Failed to create landlord chat:', error);
        this.showSnackbar('Failed to start chat with landlord', 'error');
      }
    });
  }

  selectRoom(room: ChatRoom): void {
    this.currentRoom = room;
    this.loadRoomMessages(room.id);
    this.markRoomAsRead(room.id);
  }

  loadRoomMessages(roomId: number): void {
    this.chatService.getRoomMessages(roomId).subscribe({
      next: (response: ChatMessageResponse) => {
        if (response.success) {
          this.messages = response.data;
        }
      },
      error: (error: any) => {
        console.error('Failed to load messages:', error);
        this.showSnackbar('Failed to load messages', 'error');
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
        if (response.success) {
          this.messages.push(response.data);
          this.newMessage = '';
          
          if (this.currentRoom) {
            this.currentRoom.lastMessage = response.data;
          }
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
    return this.chatService.generateRoomDisplayName(room, this.getCurrentUserId());
  }

  getPropertyName(propertyId: number): string {
    const property = this.managedProperties.find(p => p.id === propertyId);
    return property ? property.name : 'Unknown Property';
  }

  getOtherParticipants(room: ChatRoom): any[] {
    return this.chatService.getOtherParticipants(room, this.getCurrentUserId());
  }

  getCurrentUserId(): number {
    return this.chatService.getCurrentUserId();
  }
}