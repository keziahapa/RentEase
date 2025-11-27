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

export type MessageType = 
  | 'TEXT'       
  | 'FILE'       
  | 'IMAGE'      
  | 'VIDEO'      
  | 'DOCUMENT';  

export type MessageStatus = 
  | 'SENT'       
  | 'DELIVERED'  
  | 'READ'       
  | 'DELETED';   

export type UserRole = 
  | 'TENANT'     
  | 'LANDLORD'   
  | 'CARETAKER'  
  | 'ADMIN'      
  | 'USER';      

export type UnitStatus = 
  | 'AVAILABLE'    
  | 'OCCUPIED'     
  | 'MAINTENANCE'  
  | 'UNAVAILABLE'; 

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
  editedAt?: Date;
  replyToMessageId?: number;
  replyToMessage?: Message;
  sender?: {
    id: number;
    name: string;
    email: string;
    role: string;
    profilePicture?: string;
    avatar?: string;
  };
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

export interface ChatRoom {
  id: number;
  name: string;
  type: ChatRoomType;
  propertyId?: number;
  propertyName?: string;
  propertyAddress?: string;
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
  isMuted?: boolean;
  isPinned?: boolean;
  description?: string;
  avatar?: string;
  settings?: ChatRoomSettings;
}

export interface Participant {
  id: number;
  userId?: number;
  name: string;
  fullName?: string;
  email: string;
  role: UserRole;
  avatar?: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: Date;
  phoneNumber?: string;
  joinedAt?: Date;
  isAdmin?: boolean;
  unitNumber?: string;
  propertyId?: number;
  propertyName?: string;
  propertyAddress?: string;
  unit?: {
    id?: number;
    unitNumber?: string;
    unitType?: string;
    propertyId?: number;
    propertyName?: string;
    rentAmount?: number;
  };
  property?: {
    id?: number;
    name?: string;
    address?: string;
    location?: string;
  };
  canSendMessage?: boolean;
  canDeleteMessage?: boolean;
  canEditMessage?: boolean;
  canManageParticipants?: boolean;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  location?: string;
  description?: string;
  propertyType?: string;
  totalUnits?: number;
  ownerId?: number;
  ownerName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  imageUrl?: string;
  amenities?: string[];
}

export interface Unit {
  id: number;
  unitNumber: string;
  unitType: string;
  rentAmount: number;
  propertyId: number;
  propertyName?: string;
  status?: UnitStatus;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  tenantId?: number;
  tenantName?: string;
  deposit?: number;
  leaseStartDate?: Date;
  leaseEndDate?: Date;
  description?: string;
  amenities?: string[];
  imageUrls?: string[];
}

export interface SendMessageRequest {
  content: string;
  chatRoomId: number;
  messageType?: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToMessageId?: number;
  metadata?: Record<string, any>;
}

export interface MarkReadRequest {
  messageId?: number;
  messageIds?: number[];
  chatRoomId?: number;
}

export interface MarkDeliveredRequest {
  messageId?: number;
  messageIds?: number[];
  chatRoomId?: number;
}

export interface BatchDeleteRequest {
  messageIds: number[];
  chatRoomId: number;
  deleteForEveryone?: boolean;
}

export interface DeleteMessageRequest {
  messageId: number;
  deleteForEveryone?: boolean;
}

export interface CreateChatRoomRequest {
  propertyId?: number;
  unitId?: number;
  type: ChatRoomType;
  participantIds?: number[];
  name?: string;
  description?: string;
  isGroup?: boolean;
}

export interface UpdateChatRoomRequest {
  name?: string;
  description?: string;
  avatar?: string;
  settings?: Partial<ChatRoomSettings>;
}

export interface AddParticipantRequest {
  userId: number;
  role?: UserRole;
  isAdmin?: boolean;
}

export interface RemoveParticipantRequest {
  userId: number;
}

export interface UpdateParticipantRequest {
  userId: number;
  isAdmin?: boolean;
  canSendMessage?: boolean;
  canDeleteMessage?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: string[];
  timestamp?: string | Date;
  status?: number;
  statusCode?: number;
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
  first?: boolean;
  empty?: boolean;
}

export interface ChatListResponse {
  rooms: ChatRoom[];
  total: number;
  unreadCount: number;
  page?: number;
  limit?: number;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  chatRoomId?: number;
  userId?: number;
  timestamp: Date;
  eventId?: string;
}

export type WebSocketMessageType = 
  | 'MESSAGE'       
  | 'DELETED'       
  | 'DELIVERED'     
  | 'READ'          
  | 'TYPING'        
  | 'ONLINE'        
  | 'OFFLINE'       
  | 'JOINED'        
  | 'LEFT'          
  | 'UPDATED'       
  | 'REACTION'      
  | 'ERROR';        

export interface TypingIndicator {
  userId: number;
  userName: string;
  chatRoomId: number;
  isTyping: boolean;
  timestamp?: Date;
}

export interface OnlineStatus {
  userId: number;
  userName?: string;
  isOnline: boolean;
  lastSeen?: Date;
  device?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts?: number;
}

export interface MessageAttachment {
  id: number;
  messageId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType?: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  userName: string;
  emoji: string;
  createdAt: Date;
}

export interface ChatRoomSettings {
  allowFileSharing?: boolean;
  allowImageSharing?: boolean;
  allowVideoSharing?: boolean;
  maxFileSize?: number;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
  autoDeleteMessages?: boolean;
  autoDeleteAfterDays?: number;
  requireApprovalToJoin?: boolean;
}

export interface ChatStatistics {
  totalMessages: number;
  totalRooms: number;
  unreadMessages: number;
  activeRooms: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
}

export interface UserChatPreferences {
  userId: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  enterToSend?: boolean;
}

export interface ChatSearchFilters {
  query?: string;
  chatRoomId?: number;
  senderId?: number;
  messageType?: MessageType;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  propertyId?: number;
  unitId?: number;
}

export interface ChatExportOptions {
  chatRoomId: number;
  format: 'PDF' | 'CSV' | 'JSON' | 'TXT';
  dateFrom?: Date;
  dateTo?: Date;
  includeAttachments?: boolean;
  includeMetadata?: boolean;
}

export interface EnrichedChatInfo {
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  propertyInfo?: string;
  unitInfo?: string;
  avatar?: string;
  statusColor?: string;
}

export interface ChatNotification {
  id: number;
  userId: number;
  chatRoomId: number;
  messageId?: number;
  type: 'NEW_MESSAGE' | 'MENTION' | 'ROOM_INVITE' | 'ROOM_UPDATE';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

export interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export type EnrichedChatRoom = ChatRoom & {
  enrichedParticipants?: Map<number, Participant>;
  lastActivity?: Date;
  participantCount?: number;
  messageCount?: number;
};

export type MessageWithSender = Message & {
  senderDetails?: Participant;
  recipientDetails?: Participant[];
};

export type PartialMessage = Partial<Message>;
export type PartialChatRoom = Partial<ChatRoom>;
export type PartialParticipant = Partial<Participant>;

export const CHAT_ROOM_TYPE_LABELS: Record<string, string> = {
  'tenant-landlord': 'Tenant - Landlord',
  'tenant-caretaker': 'Tenant - Caretaker',
  'landlord-caretaker': 'Landlord - Caretaker',
  'landlord-tenant': 'Landlord - Tenant',
  'caretaker-tenant': 'Caretaker - Tenant',
  'DIRECT': 'Direct Message',
  'GROUP': 'Group Chat'
};

export const MESSAGE_TYPE_ICONS: Record<MessageType, string> = {
  'TEXT': 'chat',
  'FILE': 'attach_file',
  'IMAGE': 'image',
  'VIDEO': 'videocam',
  'DOCUMENT': 'description'
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  'TENANT': 'Tenant',
  'LANDLORD': 'Landlord',
  'CARETAKER': 'Caretaker',
  'ADMIN': 'Administrator',
  'USER': 'User'
};

export const MESSAGE_STATUS_COLORS: Record<MessageStatus, string> = {
  'SENT': '#8a8d91',
  'DELIVERED': '#31a24c',
  'READ': '#1e3a8a',
  'DELETED': '#fa383e'
};

export function isTextMessage(message: Message): boolean {
  return message.messageType === 'TEXT';
}

export function hasAttachments(message: Message): boolean {
  return !!(message.attachments && message.attachments.length > 0);
}

export function isTenant(participant: Participant): boolean {
  return participant.role === 'TENANT';
}

export function isLandlord(participant: Participant): boolean {
  return participant.role === 'LANDLORD';
}

export function isCaretaker(participant: Participant): boolean {
  return participant.role === 'CARETAKER';
}

export function isGroupChat(room: ChatRoom): boolean {
  return room.isGroup || room.type === 'GROUP';
}

export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}

export type TenantParticipant = Participant & { role: 'TENANT' };
export type LandlordParticipant = Participant & { role: 'LANDLORD' };
export type CaretakerParticipant = Participant & { role: 'CARETAKER' };

export type MessageWithRequiredSender = Message & { sender: NonNullable<Message['sender']> };

export type ChatRoomWithParticipants = ChatRoom & { participants: Participant[] };