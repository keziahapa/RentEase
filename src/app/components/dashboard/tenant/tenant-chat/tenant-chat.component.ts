import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatService } from '../../../../services/chat.service';
import { TenantService } from '../../../../services/tenant.service';
import { 
  ChatRoom, 
  ChatMessage, 
  CreateMessageRequest, 
  ApiResponse,
  ChatRoomResponse,
  ChatMessageResponse
} from '../../../../services/chat.interface';

@Component({
  selector: 'app-tenant-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './tenant-chat.component.html',
  styleUrls: ['./tenant-chat.component.scss'],
  providers: [ChatService, TenantService]
})
export class TenantChatComponent implements OnInit {
  chatRooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];
  isLoading = false;
  currentProperty: any = null;
  newMessage = '';
  unreadMessagesCount: number = 0;

  constructor(
    private chatService: ChatService,
    private tenantService: TenantService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadCurrentProperty();
    this.loadChatRooms();
  }

  private showSnackbar(message: string, type: 'success' | 'error' = 'success'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'error' ? ['error-snackbar'] : ['success-snackbar']
    });
  }

  loadCurrentProperty(): void {
    this.currentProperty = {
      id: 1,
      name: 'Sunrise Apartments',
      address: '123 Main Street, Nairobi'
    };
  }

  loadChatRooms(): void {
    this.isLoading = true;
    this.chatService.getChatRooms().subscribe({
      next: (response: ChatRoomResponse) => {
        if (response.success) {
          this.chatRooms = response.data.filter((room: ChatRoom) => 
            room.type === 'TENANT_LANDLORD' || room.type === 'TENANT_CARETAKER'
          );
          this.chatRooms = this.chatService.sortRoomsByLastMessage(this.chatRooms);
          this.calculateUnreadCount();
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

  startLandlordChat(): void {
    if (!this.currentProperty?.id) {
      this.showSnackbar('Property information not available', 'error');
      return;
    }

    this.chatService.createTenantLandlordRoom(this.currentProperty.id).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.showSnackbar('Chat with landlord started successfully');
        }
      },
      error: (error: any) => {
        console.error('Failed to create landlord chat:', error);
        this.showSnackbar('Failed to start chat with landlord', 'error');
      }
    });
  }

  startCaretakerChat(): void {
    if (!this.currentProperty?.id) {
      this.showSnackbar('Property information not available', 'error');
      return;
    }

    this.chatService.createTenantCaretakerRoom(this.currentProperty.id).subscribe({
      next: (response: ApiResponse<ChatRoom>) => {
        if (response.success) {
          this.chatRooms.unshift(response.data);
          this.selectRoom(response.data);
          this.showSnackbar('Chat with caretaker started successfully');
        }
      },
      error: (error: any) => {
        console.error('Failed to create caretaker chat:', error);
        this.showSnackbar('Failed to start chat with caretaker', 'error');
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
            this.currentRoom.unreadCount = 0;
          }
          
          this.calculateUnreadCount();
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
          this.calculateUnreadCount();
        }
      },
      error: (error: any) => {
        console.error('Failed to mark room as read:', error);
      }
    });
  }

  calculateUnreadCount(): void {
    this.unreadMessagesCount = this.chatRooms.reduce((total, room) => total + room.unreadCount, 0);
  }

  getRoomDisplayName(room: ChatRoom): string {
    const currentUserId = this.getCurrentUserId();
    return this.chatService.generateRoomDisplayName(room, currentUserId);
  }

  getOtherParticipants(room: ChatRoom): any[] {
    const currentUserId = this.getCurrentUserId();
    return this.chatService.getOtherParticipants(room, currentUserId);
  }

  canStartChat(): boolean {
    return !!this.currentProperty?.id;
  }

  getPropertyName(): string {
    return this.currentProperty?.name || 'Your Property';
  }

  formatMessageTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  isMaintenanceRelated(message: ChatMessage): boolean {
    const maintenanceKeywords = ['maintenance', 'repair', 'fix', 'broken', 'leak', 'issue', 'problem'];
    return maintenanceKeywords.some(keyword => 
      message.content.toLowerCase().includes(keyword)
    );
  }

  isRentRelated(message: ChatMessage): boolean {
    const rentKeywords = ['rent', 'payment', 'due', 'invoice', 'bill'];
    return rentKeywords.some(keyword => 
      message.content.toLowerCase().includes(keyword)
    );
  }

  getCurrentUserId(): number {
    return this.chatService.getCurrentUserId();
  }
}