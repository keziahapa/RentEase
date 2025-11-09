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
  senderName?: string;
  status?: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  deleted?: boolean;
  selected?: boolean;
  replyTo?: number;
  attachments?: string[];
  type?: 'TEXT' | 'IMAGE' | 'FILE';
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
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  replyTo?: number;
  attachments?: string[];
}

export interface CreateRoomRequest {
  participantIds: number[];
  name?: string;
  participantType: string;
  propertyId?: number;
}

export interface CreateChatRoomRequest {
  participantId: string;
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
    users: { userId: number; name: string; startedAt: string }[];
  };
}

export interface ConnectionState {
  isConnected: boolean;
  lastConnected?: string;
  connectionType?: 'websocket' | 'polling' | 'offline';
  retryCount: number;
}

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

export interface PropertySearchResult {
  id: number;
  name: string;
  address: string;
  landlordName?: string;
  caretakerName?: string;
}

export interface PropertySearchResponse extends ApiResponse<PropertySearchResult[]> {}

export interface ChatRoomFilters {
  participantType?: string;
  propertyId?: number;
  isArchived?: boolean;
  hasUnread?: boolean;
  searchQuery?: string;
}

export interface MessagePaginationParams {
  roomId: number;
  page?: number;
  limit?: number;
  beforeMessageId?: number;
}

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

export interface ArchiveRoomRequest {
  roomId: number;
  archive: boolean;
}

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

export interface UserPresence {
  userId: number;
  isOnline: boolean;
  lastSeen?: string;
  currentRoom?: number;
  device?: 'MOBILE' | 'DESKTOP' | 'TABLET';
}

export interface RoomMessageSearchCriteria {
  roomId: number;
  query: string;
  limit?: number;
  offset?: number;
}

export interface MessageContext {
  originalMessage?: ChatMessage;
  replyChain: ChatMessage[];
}

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

export interface BulkMessageOperation {
  messageIds: number[];
  operation: 'DELETE' | 'MARK_READ' | 'MARK_UNREAD' | 'FORWARD';
  targetRoomId?: number;
}

export interface ModerationAction {
  id: number;
  roomId: number;
  moderatorId: number;
  targetUserId: number;
  actionType: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
  reason: string;
  duration?: number;
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

export interface MergeRoomsRequest {
  sourceRoomId: number;
  targetRoomId: number;
  preserveSource?: boolean;
}

export interface DuplicateRoomRequest {
  sourceRoomId: number;
  newName?: string;
  includeMessages?: boolean;
  includeParticipants?: boolean;
  includeSettings?: boolean;
}

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

export interface CleanupRequest {
  roomId: number;
  olderThan: string;
  messageTypes?: ('TEXT' | 'IMAGE' | 'FILE')[];
  keepPinned?: boolean;
}

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

// WebSocket specific interfaces
export interface SendMessageRequest {
  chatRoomId: number;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
}

export interface DeleteMessageRequest {
  messageId: number;
}

export interface DeleteMessageResponse {
  success: boolean;
  message: string;
  messageId?: number;
  chatRoomId: number;
}

// Additional interfaces for component compatibility
export interface ChatRoomSummary {
  id: number;
  name: string;
  unreadCount: number;
  lastMessage?: ChatMessage;
  participantCount: number;
  isOnline: boolean;
}

export interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

export interface ChatNotification {
  id: number;
  type: 'NEW_MESSAGE' | 'MESSAGE_READ' | 'TYPING_START' | 'TYPING_STOP' | 'USER_JOINED' | 'USER_LEFT';
  roomId: number;
  data: any;
  timestamp: string;
  isRead: boolean;
}

export interface ChatSearchResults {
  messages: ChatMessage[];
  rooms: ChatRoom[];
  users: User[];
  totalResults: number;
}

export interface ChatUpload {
  id: string;
  file: File;
  progress: number;
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  message?: ChatMessage;
  error?: string;
}

export interface ChatState {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  messages: ChatMessage[];
  typingUsers: TypingIndicator[];
  connectionState: ConnectionState;
  unreadCount: number;
  searchResults: ChatSearchResults | null;
  uploads: ChatUpload[];
  preferences: ChatPreferences;
}

export interface ChatContextMenu {
  message: ChatMessage;
  position: { x: number; y: number };
  options: string[];
}

export interface ChatScrollPosition {
  roomId: number;
  messageId: number;
  position: number;
  timestamp: string;
}

export interface ChatHistoryState {
  scrollPositions: ChatScrollPosition[];
  lastVisitedRooms: number[];
  searchHistory: string[];
}

export interface ChatExportProgress {
  roomId: number;
  progress: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  error?: string;
}

export interface ChatBackupProgress {
  roomId: number;
  progress: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  backup?: ChatBackup;
  error?: string;
}

export interface ChatImportProgress {
  roomId: number;
  progress: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  importedCount: number;
  totalCount: number;
  error?: string;
}

export interface ChatSyncState {
  lastSync: string;
  pendingOperations: number;
  isSyncing: boolean;
  syncError?: string;
}

export interface ChatOfflineQueue {
  operations: Array<{
    id: string;
    type: 'SEND_MESSAGE' | 'DELETE_MESSAGE' | 'MARK_READ' | 'MARK_DELIVERED';
    data: any;
    timestamp: string;
    retryCount: number;
  }>;
}

export interface ChatPerformanceMetrics {
  messageLoadTime: number;
  roomLoadTime: number;
  connectionTime: number;
  messageSendTime: number;
  searchTime: number;
}

export interface ChatError {
  code: string;
  message: string;
  timestamp: string;
  context?: any;
  recoverable: boolean;
}

export interface ChatValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ChatCompatibilityCheck {
  browser: string;
  version: string;
  supportsWebSockets: boolean;
  supportsLocalStorage: boolean;
  supportsNotifications: boolean;
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export interface ChatMigrationPlan {
  fromVersion: string;
  toVersion: string;
  steps: string[];
  estimatedTime: number;
  risks: string[];
  backupRequired: boolean;
}

export interface ChatAuditLog {
  id: number;
  action: string;
  userId: number;
  roomId?: number;
  messageId?: number;
  details: any;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChatRateLimit {
  limit: number;
  remaining: number;
  resetTime: string;
  window: string;
}

export interface ChatQuota {
  maxRooms: number;
  maxParticipants: number;
  maxMessageLength: number;
  maxFileSize: number;
  storageLimit: number;
  usedStorage: number;
}

export interface ChatSubscription {
  tier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  features: string[];
  expiresAt?: string;
  autoRenew: boolean;
  paymentMethod?: string;
}

export interface ChatBillingInfo {
  plan: string;
  monthlyCost: number;
  nextBillingDate: string;
  paymentStatus: 'ACTIVE' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
  invoices: Array<{
    id: string;
    amount: number;
    date: string;
    status: 'PAID' | 'PENDING' | 'FAILED';
    downloadUrl?: string;
  }>;
}

export interface ChatSupportTicket {
  id: number;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  assignedTo?: number;
  messages: Array<{
    id: number;
    senderId: number;
    content: string;
    timestamp: string;
    isInternal: boolean;
  }>;
}

export interface ChatFeedback {
  id: number;
  rating: number;
  comment?: string;
  userId: number;
  timestamp: string;
  context: {
    roomId?: number;
    messageId?: number;
    feature?: string;
  };
  status: 'NEW' | 'REVIEWED' | 'ACTIONED';
  response?: string;
  respondedAt?: string;
}

export interface ChatAnnouncement {
  id: number;
  title: string;
  content: string;
  type: 'INFO' | 'WARNING' | 'URGENT' | 'MAINTENANCE';
  startDate: string;
  endDate: string;
  targetAudience: 'ALL' | 'TENANTS' | 'LANDLORDS' | 'CARETAKERS' | 'ADMINS';
  isActive: boolean;
  createdAt: string;
  createdBy: number;
}

export interface ChatMaintenanceWindow {
  id: number;
  startTime: string;
  endTime: string;
  description: string;
  impact: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface ChatSystemStatus {
  overall: 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';
  components: Array<{
    name: string;
    status: 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';
    description: string;
    updatedAt: string;
  }>;
  incidents: Array<{
    id: number;
    title: string;
    status: 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
    impact: 'MINOR' | 'MAJOR' | 'CRITICAL';
    startedAt: string;
    updatedAt: string;
    resolvedAt?: string;
  }>;
  updatedAt: string;
}