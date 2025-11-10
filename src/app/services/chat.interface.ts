// User Interface
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
  fullName?: string;
}

// Message Interface
export interface Message {
  id: number;
  content: string;
  senderId: number;
  senderName?: string;
  senderEmail?: string;
  chatRoomId: number;
  sentAt: Date;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  canDelete?: boolean;
  timestamp?: Date;
}

// Chat Room Interface
export interface ChatRoom {
  id: number;
  name: string;
  type: string;
  propertyId: number;
  propertyName: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Request Interfaces
export interface SendMessageRequest {
  content: string;
  chatRoomId: number;
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

// API Response Interface
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

// WebSocket Message Interfaces
export interface WebSocketSendMessageRequest {
  chatRoomId: number;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
}

export interface WebSocketDeleteMessageRequest {
  messageId: number;
}

export interface WebSocketDeleteMessageResponse {
  success: boolean;
  message: string;
  messageId?: number;
  chatRoomId: number;
}

// File Upload Interface
export interface FileUploadResponse {
  success: boolean;
  message: string;
  data: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
}

// Type Aliases
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
export type ChatRoomType = 'tenant-landlord' | 'tenant-caretaker' | 'landlord-caretaker';