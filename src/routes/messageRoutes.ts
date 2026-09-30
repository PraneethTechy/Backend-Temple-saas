import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/index.js';
import {
  getUnreadCount,
  getConversations,
  getMyConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/messageController.js';

const router: Router = Router();

// Base protection: All messaging endpoints require authentication & Admin or Authority role
// DEVOTEES ARE STRICTLY FORBIDDEN (403)
router.use(authenticate);
router.use(requireRole(USER_ROLES.ADMIN, USER_ROLES.TEMPLE_AUTHORITY));

// 1. Unread message count badge for floating button
router.get('/unread-count', getUnreadCount);

// 2. Conversation listing
router.get('/conversations', getConversations);

// 3. Direct conversation view for Temple Authority
router.get('/my-conversation', getMyConversation);

// 4. Conversation message history
router.get('/conversations/:conversationId', getConversationMessages);

// 5. Send message in conversation
router.post('/conversations/:conversationId/messages', sendMessage);

// 6. Mark conversation as read
router.patch('/conversations/:conversationId/read', markConversationRead);

export default router;
