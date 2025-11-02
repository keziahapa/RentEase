// chat.interface.ts
export interface ChatParticipant {
  id: number;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface ChatMessage {
  id: number;
  content: string;
  timestamp: string;
  senderId: number;
  chatRoomId: number;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ';
  isEdited: boolean;
  isDeleted: boolean;
  replyTo?: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface ChatRoom {
  id: number;
  name?: string;
  propertyId: number;
  participantType: 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER';
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CreateMessageRequest {
  chatRoomId: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  replyTo?: number;
  file?: File;
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

export interface ChatRoomResponse {
  success: boolean;
  data: ChatRoom[];
  message: string;
}

export interface ChatMessageResponse {
  success: boolean;
  data: ChatMessage[];
  message: string;
}

export interface SingleChatRoomResponse {
  success: boolean;
  data: ChatRoom;
  message: string;
}

export interface BasicResponse {
  success: boolean;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}