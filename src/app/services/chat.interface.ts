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

// NEW: Added for new chat modal functionality
export interface CreateChatRoomRequest {
  participantId: string; // Can be user ID or email
  participantType: string;
  propertyId?: number | null;
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

// NEW: Added for new chat creation response
export interface CreateChatRoomResponse extends ApiResponse<ChatRoom> {}

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

// NEW: Added for user search and selection
export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline?: boolean;
  phoneNumber?: string;
}

export interface UserSearchResponse extends ApiResponse<UserSearchResult[]> {}

// NEW: Added for property search and selection
export interface PropertySearchResult {
  id: number;
  name: string;
  address: string;
  landlordName?: string;
  caretakerName?: string;
}

export interface PropertySearchResponse extends ApiResponse<PropertySearchResult[]> {}

// NEW: Added for chat room filters
export interface ChatRoomFilters {
  participantType?: string;
  propertyId?: number;
  isArchived?: boolean;
  hasUnread?: boolean;
  searchQuery?: string;
}

// NEW: Added for message pagination
export interface MessagePaginationParams {
  roomId: number;
  page?: number;
  limit?: number;
  beforeMessageId?: number;
}

// NEW: Added for chat room settings update
export interface UpdateRoomSettingsRequest {
  roomId: number;
  settings: {
    allowFiles?: boolean;
    maxFileSize?: number;
    allowedFileTypes?: string[];
    slowMode?: boolean;
    slowModeInterval?: number;
  };
}

// NEW: Added for participant management
export interface AddParticipantRequest {
  roomId: number;
  participantId: number;
  role?: 'MEMBER' | 'ADMIN';
}

export interface RemoveParticipantRequest {
  roomId: number;
  participantId: number;
}

export interface UpdateParticipantRoleRequest {
  roomId: number;
  participantId: number;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
}

// NEW: Added for chat room archiving
export interface ArchiveRoomRequest {
  roomId: number;
  archive: boolean;
}

// NEW: Added for message reactions
export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
  user?: User;
}

export interface AddReactionRequest {
  messageId: number;
  emoji: string;
}

export interface RemoveReactionRequest {
  messageId: number;
  reactionId: number;
}

// NEW: Added for message pinning
export interface PinnedMessage {
  id: number;
  messageId: number;
  roomId: number;
  pinnedBy: number;
  pinnedAt: string;
  message?: ChatMessage;
  pinnedByUser?: User;
}

export interface PinMessageRequest {
  messageId: number;
  roomId: number;
}

export interface UnpinMessageRequest {
  messageId: number;
  roomId: number;
}

// NEW: Added for chat room invitations
export interface ChatInvitation {
  id: number;
  roomId: number;
  inviteeEmail: string;
  inviterId: number;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  inviter?: User;
  room?: ChatRoom;
}

export interface CreateInvitationRequest {
  roomId: number;
  inviteeEmail: string;
  expiresInHours?: number;
}

export interface AcceptInvitationRequest {
  token: string;
}

// NEW: Added for chat analytics
export interface ChatAnalytics {
  totalMessages: number;
  messagesByType: {
    TEXT: number;
    IMAGE: number;
    FILE: number;
  };
  messagesByHour: { [hour: string]: number };
  busiestDay: string;
  averageResponseTime: number;
  topParticipants: Array<{
    user: User;
    messageCount: number;
  }>;
}

// NEW: Added for chat exports
export interface ChatExportRequest {
  roomId: number;
  format: 'JSON' | 'CSV' | 'PDF';
  startDate?: string;
  endDate?: string;
  includeMediaInfo?: boolean;
}

export interface ChatExportResponse {
  success: boolean;
  message: string;
  downloadUrl?: string;
  fileSize?: number;
  expiresAt?: string;
}

// NEW: Added for real-time presence
export interface UserPresence {
  userId: number;
  isOnline: boolean;
  lastSeen?: string;
  currentRoom?: number;
  device?: 'MOBILE' | 'DESKTOP' | 'TABLET';
}

// NEW: Added for chat search within room
export interface RoomMessageSearchCriteria {
  roomId: number;
  query: string;
  limit?: number;
  offset?: number;
}

// NEW: Added for message context (reply chains)
export interface MessageContext {
  originalMessage?: ChatMessage;
  replyChain: ChatMessage[];
}

// NEW: Added for chat room templates
export interface ChatRoomTemplate {
  id: number;
  name: string;
  participantType: string;
  defaultSettings: {
    allowFiles: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
    slowMode: boolean;
    slowModeInterval: number;
  };
  welcomeMessage?: string;
  autoAddParticipants?: number[];
}

// NEW: Added for bulk operations
export interface BulkMessageOperation {
  messageIds: number[];
  operation: 'DELETE' | 'MARK_READ' | 'MARK_UNREAD' | 'FORWARD';
  targetRoomId?: number;
}

// NEW: Added for chat moderation
export interface ModerationAction {
  id: number;
  roomId: number;
  moderatorId: number;
  targetUserId: number;
  actionType: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
  reason: string;
  duration?: number; // in minutes
  createdAt: string;
  expiresAt?: string;
  moderator?: User;
  targetUser?: User;
}

export interface CreateModerationActionRequest {
  roomId: number;
  targetUserId: number;
  actionType: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
  reason: string;
  duration?: number;
}

// NEW: Added for chat room backup
export interface ChatBackup {
  id: number;
  roomId: number;
  backupDate: string;
  messageCount: number;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
}

export interface CreateBackupRequest {
  roomId: number;
  includeMedia?: boolean;
}

// NEW: Added for chat room merge
export interface MergeRoomsRequest {
  sourceRoomId: number;
  targetRoomId: number;
  preserveSource?: boolean;
}

// NEW: Added for chat room duplication
export interface DuplicateRoomRequest {
  sourceRoomId: number;
  newName?: string;
  includeMessages?: boolean;
  includeParticipants?: boolean;
  includeSettings?: boolean;
}

// NEW: Added for chat room import
export interface ImportMessagesRequest {
  roomId: number;
  messages: Array<{
    content: string;
    messageType: 'TEXT' | 'IMAGE' | 'FILE';
    senderId: number;
    timestamp: string;
    attachments?: string[];
  }>;
}

// NEW: Added for chat room cleanup
export interface CleanupRequest {
  roomId: number;
  olderThan: string;
  messageTypes?: ('TEXT' | 'IMAGE' | 'FILE')[];
  keepPinned?: boolean;
}

// NEW: Added for chat room statistics
export interface RoomStatistics {
  roomId: number;
  totalMessages: number;
  activeParticipants: number;
  averageMessagesPerDay: number;
  lastActivity: string;
  messageDistribution: {
    byType: { [key: string]: number };
    byUser: { [key: number]: number };
    byHour: { [key: number]: number };
  };
}