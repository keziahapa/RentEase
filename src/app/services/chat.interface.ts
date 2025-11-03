export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface ChatMessage {
  id: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  senderId: number;
  chatRoomId: number;
  timestamp: string;
  read: boolean;
  sender?: User;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  deleted?: boolean;
  selected?: boolean; // For batch operations
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
}

export interface CreateMessageRequest {
  chatRoomId: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  replyTo?: number;
}

export interface CreateRoomRequest {
  participantIds: number[];
  name?: string;
  participantType: string;
  propertyId?: number;
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

export interface TypingIndicator {
  userId: number;
  userName: string;
  roomId: number;
  isTyping: boolean;
}

export interface MarkReadRequest {
  messageIds: number[];
  roomId: number;
}

export interface MarkDeliveredRequest {
  messageIds: number[];
  roomId: number;
}

// Response Interfaces
export interface BasicResponse {
  success: boolean;
  message: string;
  status?: number;
  timestamp?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  status?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Specific Response Types
export interface ChatRoomResponse extends ApiResponse<ChatRoom[]> {}
export interface ChatMessageResponse extends ApiResponse<ChatMessage[]> {}
export interface SingleChatRoomResponse extends ApiResponse<ChatRoom> {}
export interface SingleMessageResponse extends ApiResponse<ChatMessage> {}

// Real-time Events
export interface ChatEvent {
  type: 'MESSAGE_CREATED' | 'MESSAGE_UPDATED' | 'MESSAGE_DELETED' | 
         'TYPING_STARTED' | 'TYPING_STOPPED' | 'USER_ONLINE' | 'USER_OFFLINE' |
         'ROOM_CREATED' | 'ROOM_UPDATED' | 'ROOM_DELETED';
  data: any;
  timestamp: string;
}

// Search and Filter Interfaces
export interface ChatSearchCriteria {
  query?: string;
  roomId?: number;
  userId?: number;
  startDate?: string;
  endDate?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  limit?: number;
  offset?: number;
}

export interface ChatStats {
  totalRooms: number;
  totalMessages: number;
  unreadCount: number;
  activeConversations: number;
}