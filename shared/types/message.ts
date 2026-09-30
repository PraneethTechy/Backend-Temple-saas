/**
 * DevaSetu Shared Message & Conversation Contracts
 * Platform Admin <-> Temple Authority Communication Architecture
 */

export interface IConversation {
  _id: string;
  templeId: string;
  authorityId?: string | null;
  lastMessage?: string;
  lastMessageAt?: string | Date;
  unreadForAdmin: number;
  unreadForAuthority: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'ADMIN' | 'TEMPLE_AUTHORITY';
  message: string;
  readAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface TempleConversationSummary {
  _id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  image?: string | null;
  status?: string;
}

export interface ConversationWithTemple extends Omit<IConversation, 'templeId'> {
  templeId: TempleConversationSummary;
}

export interface SendMessagePayload {
  message: string;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
