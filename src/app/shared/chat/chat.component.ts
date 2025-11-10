import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Message, ChatRoom } from '../../services/chat.interface';

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
  
  rooms: ChatRoom[] = [];
  currentRoom: ChatRoom | null = null;
  messages: Message[] = [];
  newMessage = '';
  isConnected = false;
  emojiMartVisible = false;
  uploadingFiles = false;
  showNewChatModal = false;
  newChatType: 'tenant-landlord' | 'tenant-caretaker' | 'landlord-caretaker' = 'tenant-landlord';
  propertyIdForNewChat: number | null = null;

  constructor(
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      console.error('User not authenticated');
      return;
    }

    this.chatService.rooms$.subscribe((rooms: ChatRoom[]) => {
      this.rooms = rooms ?? [];
      console.log('📋 Rooms updated:', this.rooms.length);
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
        error: (error) => {
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
        error: (error) => {
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
    this.newMessage += event.emoji?.native ?? '';
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
    files.forEach((file) => {
      const fileMessage = `📎 File: ${file.name} (${this.formatFileSize(file.size)})`;
      this.chatService.sendMessage(fileMessage, this.currentRoom!.id).subscribe({
        next: () => {
          console.log('File message sent successfully');
        },
        error: (error) => {
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
    this.showNewChatModal = true;
    this.propertyIdForNewChat = null;
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.propertyIdForNewChat = null;
    this.newChatType = 'tenant-landlord';
  }

  createNewChat(): void {
    if (!this.propertyIdForNewChat) {
      alert('Please enter a property ID');
      return;
    }

    let createObservable;
    switch (this.newChatType) {
      case 'tenant-landlord':
        createObservable = this.chatService.createTenantLandlordChat(this.propertyIdForNewChat);
        break;
      case 'tenant-caretaker':
        createObservable = this.chatService.createTenantCaretakerChat(this.propertyIdForNewChat);
        break;
      case 'landlord-caretaker':
        createObservable = this.chatService.createLandlordCaretakerChat(this.propertyIdForNewChat);
        break;
      default:
        alert('Invalid chat type');
        return;
    }

    createObservable!.subscribe({
      next: (response) => {
        if (response?.success && response.data) {
          this.closeNewChatModal();
          this.selectRoom(response.data);
          alert('Chat created successfully!');
        } else {
          alert('Failed to create chat: ' + response?.message);
        }
      },
      error: (error) => {
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

  // ✅ ADDED: Safe method to get last message time
  getLastMessageTime(room: ChatRoom): string {
    if (!room?.lastMessage?.sentAt) return '';
    return this.formatTime(room.lastMessage.sentAt);
  }

  // ✅ ADDED: Safe method to get unread count
  getUnreadCount(room: ChatRoom): number {
    return room?.unreadCount || 0;
  }

  // ✅ ADDED: Safe method to get participant count
  getParticipantCount(room: ChatRoom): number {
    return room?.participants?.length || 0;
  }

  // ✅ ADDED: Safe method to get message status
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
}