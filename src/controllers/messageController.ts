import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import {
  Conversation,
  Message,
  Temple,
  User,
  USER_ROLES,
  Notification,
  NOTIFICATION_TYPES,
} from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Helper to ensure a clean populated temple summary object
 */
const sanitizeTempleSummary = (temple: any) => {
  if (!temple) return null;
  const coverImg =
    temple.images?.find((img: any) => img.isCover)?.url ||
    temple.images?.[0]?.url ||
    null;

  return {
    _id: temple._id,
    name: temple.name,
    slug: temple.slug,
    city: temple.city,
    state: temple.state,
    image: coverImg,
    status: temple.status,
  };
};

/**
 * GET /api/messages/unread-count
 * Returns total unread messages for currently authenticated role
 */
export const getUnreadCount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
      if (!req.user.templeId) {
        res.status(200).json(ApiResponse.success({ unreadCount: 0 }));
        return;
      }

      const conversation = await Conversation.findOne({
        templeId: req.user.templeId,
      }).select('unreadForAuthority');

      const count = conversation?.unreadForAuthority || 0;
      res.status(200).json(ApiResponse.success({ unreadCount: count }));
      return;
    }

    if (req.user.role === USER_ROLES.ADMIN) {
      const result = await Conversation.aggregate([
        {
          $group: {
            _id: null,
            totalUnread: { $sum: '$unreadForAdmin' },
          },
        },
      ]);

      const count = result[0]?.totalUnread || 0;
      res.status(200).json(ApiResponse.success({ unreadCount: count }));
      return;
    }

    throw ApiError.forbidden('Only Platform Admins and Temple Authorities have access to messaging');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/conversations
 * Admin: lists all conversations with active temples, ordered by latest message
 * Authority: gets their own temple conversation
 */
export const getConversations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    // 1. TEMPLE AUTHORITY FLOW
    if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
      if (!req.user.templeId) {
        throw ApiError.forbidden('No temple assigned to this authority account');
      }

      let conversation = await Conversation.findOne({
        templeId: req.user.templeId,
      }).populate('templeId', 'name slug city state images status');

      if (!conversation) {
        const temple = await Temple.findById(req.user.templeId).select(
          'name slug city state images status'
        );
        if (!temple) {
          throw ApiError.notFound('Assigned temple record not found');
        }

        conversation = await Conversation.create({
          templeId: temple._id,
          authorityId: req.user.userId,
          unreadForAdmin: 0,
          unreadForAuthority: 0,
        });

        conversation = await Conversation.findById(conversation._id).populate(
          'templeId',
          'name slug city state images status'
        );
      }

      const formatted = {
        _id: conversation!._id,
        templeId: sanitizeTempleSummary(conversation!.templeId),
        authorityId: conversation!.authorityId,
        lastMessage: conversation!.lastMessage || '',
        lastMessageAt: conversation!.lastMessageAt || conversation!.createdAt,
        unreadForAdmin: conversation!.unreadForAdmin,
        unreadForAuthority: conversation!.unreadForAuthority,
        createdAt: conversation!.createdAt,
        updatedAt: conversation!.updatedAt,
      };

      res.status(200).json(
        ApiResponse.success({
          conversations: [formatted],
          totalUnread: conversation!.unreadForAuthority || 0,
        })
      );
      return;
    }

    // 2. PLATFORM ADMIN FLOW
    if (req.user.role === USER_ROLES.ADMIN) {
      // Find all active temples so Admin can message any active temple
      const activeTemples = await Temple.find({ status: 'ACTIVE' })
        .select('name slug city state images status authorityId')
        .lean();

      // Find all existing conversations
      const existingConversations = await Conversation.find({})
        .populate('templeId', 'name slug city state images status')
        .sort({ lastMessageAt: -1 })
        .lean();

      const existingTempleIdSet = new Set(
        existingConversations
          .filter((c) => c.templeId)
          .map((c) => (c.templeId as any)._id.toString())
      );

      // Create conversation records for any active temple that lacks one
      const missingTemples = activeTemples.filter(
        (t) => !existingTempleIdSet.has(t._id.toString())
      );

      if (missingTemples.length > 0) {
        const docsToInsert = missingTemples.map((t) => ({
          templeId: t._id,
          authorityId: t.authorityId || null,
          unreadForAdmin: 0,
          unreadForAuthority: 0,
          lastMessage: '',
          lastMessageAt: t.createdAt || new Date(),
        }));

        try {
          await Conversation.insertMany(docsToInsert, { ordered: false });
        } catch {
          // Ignore duplicate key race conditions
        }
      }

      // Re-query all conversations sorted by latest message first
      const allConversations = await Conversation.find({})
        .populate('templeId', 'name slug city state images status')
        .sort({ lastMessageAt: -1 })
        .lean();

      let totalUnread = 0;
      const formattedConversations = allConversations
        .filter((c) => c.templeId) // Filter out deleted temples
        .map((c) => {
          totalUnread += c.unreadForAdmin || 0;
          return {
            _id: c._id,
            templeId: sanitizeTempleSummary(c.templeId),
            authorityId: c.authorityId,
            lastMessage: c.lastMessage || '',
            lastMessageAt: c.lastMessageAt || c.createdAt,
            unreadForAdmin: c.unreadForAdmin || 0,
            unreadForAuthority: c.unreadForAuthority || 0,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          };
        });

      // Sort: conversations with messages first, then by temple name
      formattedConversations.sort((a, b) => {
        const aHasMsg = Boolean(a.lastMessage);
        const bHasMsg = Boolean(b.lastMessage);
        if (aHasMsg && !bHasMsg) return -1;
        if (!aHasMsg && bHasMsg) return 1;

        if (aHasMsg && bHasMsg) {
          const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return timeB - timeA;
        }

        const nameA = a.templeId?.name || '';
        const nameB = b.templeId?.name || '';
        return nameA.localeCompare(nameB);
      });

      res.status(200).json(
        ApiResponse.success({
          conversations: formattedConversations,
          totalUnread,
        })
      );
      return;
    }

    throw ApiError.forbidden('Only Platform Admins and Temple Authorities have access to messaging');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/my-conversation
 * For Temple Authority: directly opens their conversation and marks received messages read
 */
export const getMyConversation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== USER_ROLES.TEMPLE_AUTHORITY) {
      throw ApiError.forbidden('This endpoint is restricted to Temple Authorities');
    }

    if (!req.user.templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    let conversation = await Conversation.findOne({
      templeId: req.user.templeId,
    }).populate('templeId', 'name slug city state images status');

    if (!conversation) {
      const temple = await Temple.findById(req.user.templeId).select(
        'name slug city state images status'
      );
      if (!temple) {
        throw ApiError.notFound('Assigned temple record not found');
      }

      conversation = await Conversation.create({
        templeId: temple._id,
        authorityId: req.user.userId,
        unreadForAdmin: 0,
        unreadForAuthority: 0,
      });

      conversation = await Conversation.findById(conversation._id).populate(
        'templeId',
        'name slug city state images status'
      );
    }

    // Mark unread messages as read for authority
    if (conversation!.unreadForAuthority > 0) {
      conversation!.unreadForAuthority = 0;
      await conversation!.save();

      await Message.updateMany(
        {
          conversationId: conversation!._id,
          readAt: null,
          senderRole: USER_ROLES.ADMIN,
        },
        { $set: { readAt: new Date() } }
      );
    }

    // Fetch conversation messages
    const messages = await Message.find({
      conversationId: conversation!._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    const formattedConversation = {
      _id: conversation!._id,
      templeId: sanitizeTempleSummary(conversation!.templeId),
      authorityId: conversation!.authorityId,
      lastMessage: conversation!.lastMessage || '',
      lastMessageAt: conversation!.lastMessageAt || conversation!.createdAt,
      unreadForAdmin: conversation!.unreadForAdmin,
      unreadForAuthority: 0,
      createdAt: conversation!.createdAt,
      updatedAt: conversation!.updatedAt,
    };

    res.status(200).json(
      ApiResponse.success({
        conversation: formattedConversation,
        messages,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/conversations/:conversationId
 * Retrieves message history for a conversation and marks unread messages as read
 */
export const getConversationMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw ApiError.badRequest('Invalid conversation ID');
    }

    const conversation = await Conversation.findById(conversationId).populate(
      'templeId',
      'name slug city state images status'
    );

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    // Security check: Authority can ONLY access their own temple's conversation
    if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
      if (
        !req.user.templeId ||
        conversation.templeId._id.toString() !== req.user.templeId.toString()
      ) {
        throw ApiError.forbidden('Access denied: You are not authorized to view this conversation');
      }
    } else if (req.user.role !== USER_ROLES.ADMIN) {
      throw ApiError.forbidden('Access restricted to Platform Admins and Temple Authorities');
    }

    // Auto-mark unread messages as read
    if (req.user.role === USER_ROLES.ADMIN && conversation.unreadForAdmin > 0) {
      conversation.unreadForAdmin = 0;
      await conversation.save();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          readAt: null,
          senderRole: USER_ROLES.TEMPLE_AUTHORITY,
        },
        { $set: { readAt: new Date() } }
      );
    } else if (
      req.user.role === USER_ROLES.TEMPLE_AUTHORITY &&
      conversation.unreadForAuthority > 0
    ) {
      conversation.unreadForAuthority = 0;
      await conversation.save();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          readAt: null,
          senderRole: USER_ROLES.ADMIN,
        },
        { $set: { readAt: new Date() } }
      );
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    const formattedConversation = {
      _id: conversation._id,
      templeId: sanitizeTempleSummary(conversation.templeId),
      authorityId: conversation.authorityId,
      lastMessage: conversation.lastMessage || '',
      lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
      unreadForAdmin: conversation.unreadForAdmin,
      unreadForAuthority: conversation.unreadForAuthority,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    res.status(200).json(
      ApiResponse.success({
        conversation: formattedConversation,
        messages,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/conversations/:conversationId/messages
 * Sends a message in the conversation and notifies the recipient
 */
export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw ApiError.badRequest('Invalid conversation ID');
    }

    const text = String(req.body.message || '').trim();
    if (!text) {
      throw ApiError.badRequest('Message text cannot be empty');
    }

    if (text.length > 4000) {
      throw ApiError.badRequest('Message cannot exceed 4000 characters');
    }

    const conversation = await Conversation.findById(conversationId).populate(
      'templeId',
      'name slug city state images status'
    );

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    // Security check: Authority can ONLY send in their own temple's conversation
    if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
      if (
        !req.user.templeId ||
        conversation.templeId._id.toString() !== req.user.templeId.toString()
      ) {
        throw ApiError.forbidden('Access denied: You are not authorized to send messages in this conversation');
      }
    } else if (req.user.role !== USER_ROLES.ADMIN) {
      throw ApiError.forbidden('Access restricted to Platform Admins and Temple Authorities');
    }

    // 1. Create message record
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user.userId,
      senderRole: req.user.role,
      message: text,
      readAt: null,
    });

    // 2. Update conversation state
    conversation.lastMessage = text;
    conversation.lastMessageAt = message.createdAt || new Date();

    if (req.user.role === USER_ROLES.ADMIN) {
      conversation.unreadForAuthority = (conversation.unreadForAuthority || 0) + 1;

      // Notify the temple authority user if exists
      const authorityUser = await User.findOne({
        templeId: conversation.templeId._id,
        role: USER_ROLES.TEMPLE_AUTHORITY,
        isActive: true,
      });

      if (authorityUser) {
        try {
          await Notification.create({
            userId: authorityUser._id,
            title: 'New message from Platform Administration',
            message: text.length > 100 ? `${text.slice(0, 97)}...` : text,
            type: NOTIFICATION_TYPES.SYSTEM,
            metadata: {
              templeId: conversation.templeId._id,
              actionUrl: '/authority/dashboard',
            },
          });
        } catch {
          // Do not fail message delivery if notification record fails
        }
      }
    } else {
      conversation.unreadForAdmin = (conversation.unreadForAdmin || 0) + 1;
      conversation.authorityId = req.user.userId;
    }

    await conversation.save();

    res.status(201).json(
      ApiResponse.created(
        {
          message,
          conversation: {
            _id: conversation._id,
            templeId: sanitizeTempleSummary(conversation.templeId),
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
            unreadForAdmin: conversation.unreadForAdmin,
            unreadForAuthority: conversation.unreadForAuthority,
          },
        },
        'Message sent successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/conversations/:conversationId/read
 * Marks all messages in conversation as read for the calling role
 */
export const markConversationRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw ApiError.badRequest('Invalid conversation ID');
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    // Security check
    if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
      if (
        !req.user.templeId ||
        conversation.templeId.toString() !== req.user.templeId.toString()
      ) {
        throw ApiError.forbidden('Access denied: You are not authorized for this conversation');
      }
      conversation.unreadForAuthority = 0;
      await conversation.save();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          readAt: null,
          senderRole: USER_ROLES.ADMIN,
        },
        { $set: { readAt: new Date() } }
      );
    } else if (req.user.role === USER_ROLES.ADMIN) {
      conversation.unreadForAdmin = 0;
      await conversation.save();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          readAt: null,
          senderRole: USER_ROLES.TEMPLE_AUTHORITY,
        },
        { $set: { readAt: new Date() } }
      );
    } else {
      throw ApiError.forbidden('Access restricted to Platform Admins and Temple Authorities');
    }

    res.status(200).json(ApiResponse.success({ success: true }));
  } catch (error) {
    next(error);
  }
};

export default {
  getUnreadCount,
  getConversations,
  getMyConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
};
