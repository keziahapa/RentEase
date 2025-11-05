export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  content: string;
  attachments: MessageAttachment[];
  isRead: boolean;
  priority: MessagePriority;
  category: MessageCategory;
  parentMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum MessageCategory {
  GENERAL = 'general',
  MAINTENANCE = 'maintenance',
  PAYMENT = 'payment',
  LEASE = 'lease',
  COMPLAINT = 'complaint',
  ANNOUNCEMENT = 'announcement'
}