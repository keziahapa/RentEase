export type ChatRoomType = 
  | 'tenant-landlord' 
  | 'tenant-caretaker' 
  | 'landlord-caretaker' 
  | 'landlord-tenant' 
  | 'caretaker-tenant'
  | 'TENANT_LANDLORD'
  | 'TENANT_CARETAKER'
  | 'LANDLORD_CARETAKER'
  | 'LANDLORD_TENANT'
  | 'CARETAKER_TENANT'
  | 'DIRECT'
  | 'GROUP';

export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'DELETED';

export interface Message {
  id: number;
  content: string;
  senderId: number;
  senderName: string;
  senderEmail?: string;
  chatRoomId: number;
  sentAt: Date;
  timestamp: Date;
  messageType: MessageType;
  status: MessageStatus;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  canDelete?: boolean;
  isEdited?: boolean;
  deletedAt?: Date;
  sender?: {
    id: number;
    name: string;
    email: string;
    role: string;
    profilePicture?: string;
  };
}

export interface ChatRoom {
  id: number;
  name: string;
  type: ChatRoomType;
  propertyId?: number;
  propertyName?: string;
  unitId?: number;
  unitNumber?: string;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  isActive?: boolean;
}

export interface Participant {
  id: number;
  userId?: number;
  name: string;
  fullName?: string;
  email: string;
  role: 'TENANT' | 'LANDLORD' | 'CARETAKER' | 'ADMIN' | 'USER';
  avatar?: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: Date;
  phoneNumber?: string;
  joinedAt?: Date;
  isAdmin?: boolean;
  unitNumber?: string;  // Add this line
  propertyId?: number;  // Add this line
  unit?: {              // Add this optional unit object
    unitNumber?: string;
    propertyId?: number;
  };
}

export interface SendMessageRequest {
  content: string;
  chatRoomId: number;
  messageType?: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface MarkReadRequest {
  messageId?: number;
  messageIds?: number[];
}

export interface MarkDeliveredRequest {
  messageId?: number;
  messageIds?: number[];
}

export interface BatchDeleteRequest {
  messageIds: number[];
  chatRoomId: number;
}

export interface DeleteMessageRequest {
  messageId: number;
}

export interface CreateChatRoomRequest {
  propertyId?: number;
  unitId?: number;
  type: ChatRoomType;
  participantIds?: number[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: string[];
  timestamp?: string | Date;
  status?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  location?: string;
  description?: string;
  ownerId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Unit {
  id: number;
  unitNumber: string;
  unitType: string;
  rentAmount: number;
  propertyId: number;
  status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'UNAVAILABLE';
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  tenantId?: number;
}

export interface WebSocketMessage {
  type: 'MESSAGE' | 'DELETED' | 'DELIVERED' | 'READ' | 'TYPING' | 'ONLINE' | 'OFFLINE';
  data: any;
  chatRoomId?: number;
  userId?: number;
  timestamp: Date;
}

export interface TypingIndicator {
  userId: number;
  userName: string;
  chatRoomId: number;
  isTyping: boolean;
}

export interface OnlineStatus {
  userId: number;
  isOnline: boolean;
  lastSeen?: Date;
}