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

export interface ChatParticipant {
  user: User;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  joinedAt: string;
  lastReadMessageId?: number;
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
  selected?: boolean; 
  replyTo?: number;
  attachments?: string[];
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

export interface ChatRoomDetails {
  id: number;
  name?: string;
  participantType: 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER' | 'GROUP';
  participants: ChatParticipant[]; 
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
  propertyId?: number;
  propertyName?: string;
  isArchived?: boolean;
  messageCount: number;
  createdBy: number;
  settings?: {
    allowFiles: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
    slowMode: boolean;
    slowModeInterval: number;
  };
}

export interface CreateMessageRequest {
  chatRoomId: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  replyTo?: number;
  attachments?: string[];
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
  timestamp?: string;
}

export interface MarkReadRequest {
  messageIds: number[];
  roomId: number;
}

export interface MarkDeliveredRequest {
  messageIds: number[];
  roomId: number;
}

export interface ReadReceipt {
  messageId: number;
  userId: number;
  readAt: string;
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

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}


export interface ChatRoomResponse extends ApiResponse<ChatRoom[]> {}
export interface ChatMessageResponse extends ApiResponse<ChatMessage[]> {}
export interface SingleChatRoomResponse extends ApiResponse<ChatRoom> {}
export interface SingleMessageResponse extends ApiResponse<ChatMessage> {}
export interface ChatRoomDetailsResponse extends ApiResponse<ChatRoomDetails> {}


export interface ChatEvent {
  type: 'MESSAGE_CREATED' | 'MESSAGE_UPDATED' | 'MESSAGE_DELETED' | 
         'TYPING_STARTED' | 'TYPING_STOPPED' | 'USER_ONLINE' | 'USER_OFFLINE' |
         'ROOM_CREATED' | 'ROOM_UPDATED' | 'ROOM_DELETED' | 'MESSAGE_READ' |
         'MESSAGE_DELIVERED' | 'USER_JOINED' | 'USER_LEFT';
  data: any;
  timestamp: string;
  roomId?: number;
  userId?: number;
}


export interface ChatSearchCriteria {
  query?: string;
  roomId?: number;
  userId?: number;
  startDate?: string;
  endDate?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ChatStats {
  totalRooms: number;
  totalMessages: number;
  unreadCount: number;
  activeConversations: number;
  totalParticipants: number;
  messagesToday: number;
}

export interface ChatPreferences {
  notifications: boolean;
  soundEnabled: boolean;
  typingIndicators: boolean;
  readReceipts: boolean;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
}


export interface FileUploadResponse {
  success: boolean;
  message: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export interface UploadProgress {
  percentage: number;
  loaded: number;
  total: number;
}


export interface TypingState {
  [roomId: number]: {
    users: {userId: number, name: string, startedAt: string}[];
  };
}


export interface ConnectionState {
  isConnected: boolean;
  lastConnected?: string;
  connectionType?: 'websocket' | 'polling' | 'offline';
  retryCount: number;
}