
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline?: boolean; 
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
}


export interface ChatRoom {
  id: number;
  name?: string;
  participantType: 'TENANT_LANDLORD' | 'TENANT_CARETAKER' | 'LANDLORD_CARETAKER';
  participants: User[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageRequest {
  chatRoomId: number;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
}

export interface BatchDeleteRequest {
  messageIds: number[];
}

export interface BasicResponse {
  success: boolean;
  message: string;
  status?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  status?: number;
}

export interface ChatRoomResponse extends ApiResponse<ChatRoom[]> {}
export interface ChatMessageResponse extends ApiResponse<ChatMessage[]> {}
export interface SingleChatRoomResponse extends ApiResponse<ChatRoom> {}