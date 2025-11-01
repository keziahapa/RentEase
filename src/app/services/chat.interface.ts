export interface ChatRoom {
  id: number;
  name: string;
  type: 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER' | 'GROUP';
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  propertyId?: number;
  propertyName?: string;
}

export interface ChatParticipant {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  isDelivered: boolean;
  timestamp: string;
  reactions?: MessageReaction[];
  replyTo?: number;
  deleted: boolean;
}

export interface MessageReaction {
  userId: number;
  userName: string;
  emoji: string;
  timestamp: string;
}

export interface CreateMessageRequest {
  content: string;
  chatRoomId: number;
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

export interface ChatHealth {
  status: string;
  timestamp: string;
  activeConnections: number;
  version: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ChatRoomResponse extends ApiResponse<ChatRoom[]> {}
export interface ChatMessageResponse extends ApiResponse<ChatMessage[]> {}
export interface SingleChatRoomResponse extends ApiResponse<ChatRoom> {}
export interface ChatHealthResponse extends ApiResponse<ChatHealth> {}
export interface BasicResponse extends ApiResponse<null> {}