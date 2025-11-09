// src/app/services/chat.interface.ts
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
  phoneNumber?: string;
  profilePicture?: string;
}

export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

// Alternative: Update the interface in chat.interface.ts
export interface ChatMessage {
  id: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  senderId: number;
  chatRoomId: number;
  timestamp: string;
  read: boolean;
  sender?: User | null; 
  senderName?: string;
  status?: MessageStatus;
  deleted?: boolean;
  selected?: boolean;
  replyTo?: number;
  attachments?: string[];
  fileUrl?: string;
  fileName?: string;
}
export interface ChatRoom {
  id: number;
  name?: string;
  participantType: 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER' | 'GROUP';
  participants: User[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
  propertyId?: number;
  propertyName?: string;
  isArchived?: boolean;
}

export interface CreateMessageRequest {
  chatRoomId: number;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  replyTo?: number;
  attachments?: string[];
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

export interface BasicResponse {
  success: boolean;
  message: string;
  status?: number;
  timestamp?: string;
  error?: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  status?: number;
  timestamp?: string;
  error?: string;
}

export interface ChatRoomResponse extends ApiResponse<ChatRoom[]> {}
export interface ChatMessageResponse extends ApiResponse<ChatMessage[]> {}
export interface CreateChatRoomResponse extends ApiResponse<ChatRoom> {}