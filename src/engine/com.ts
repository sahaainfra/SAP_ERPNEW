/* ======================================================================== */
/*  VULCAN ERP — PART 9A: COMMUNICATION SUITE                               */
/*  Conversation management, message handling, notifications, tasks         */
/*  All bound to ERP records, governed, searchable, legally exportable      */
/* ======================================================================== */

import type { ERPState, Res, Conversation, Message, Notification, Task, ConversationType, MessageContentType } from './types';
import { cloneState, uid, nowStamp, pushAudit, authorize } from './engine';

/* ===================== Conversation Management ===================== */

export function createConversation(
  sIn: ERPState,
  args: {
    type: ConversationType;
    title: string;
    companyId: string;
    projectCode?: string;
    linkedObjectType?: string;
    linkedObjectId?: string;
    visibility?: 'INTERNAL' | 'EXTERNAL_INCLUDED';
    retentionClass?: 'OPERATIONAL' | 'PROJECT' | 'CONTRACTUAL' | 'LEGAL';
    participants: string[];
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'COM_CONV', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const now = nowStamp();
  const conv: Conversation = {
    id: uid(),
    type: args.type,
    title: args.title,
    createdBy: userId,
    createdAt: now,
    companyId: args.companyId,
    projectCode: args.projectCode,
    linkedObjectType: args.linkedObjectType,
    linkedObjectId: args.linkedObjectId,
    visibility: args.visibility ?? 'INTERNAL',
    retentionClass: args.retentionClass ?? 'OPERATIONAL',
    legalHold: false,
    archived: false,
    participants: args.participants,
    lastMessageAt: now,
    lastMessagePreview: 'Conversation created',
    sequenceCounter: 0,
  };

  s.conversations.unshift(conv);
  pushAudit(s, userId, 'CHANGE', 'CONVERSATION', conv.id, {
    reason: `${args.type} conversation created: ${args.title}`,
  });

  return { s, ok: true, msg: `Conversation "${args.title}" created with ${args.participants.length} participants.`, tone: 'ok', docId: conv.id };
}

export function sendMessage(
  sIn: ERPState,
  args: {
    conversationId: string;
    clientMessageId: string;
    contentType: MessageContentType;
    body: string;
    replyToMessageId?: string;
    mentions?: string[];
    linkedObjectType?: string;
    linkedObjectId?: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const conv = s.conversations.find((c) => c.id === args.conversationId);
  if (!conv) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };

  // Check authorization
  if (!conv.participants.includes(userId)) {
    return { s, ok: false, msg: 'You are not a participant in this conversation', tone: 'bad' };
  }

  // Idempotency check
  const existing = s.messages.find((m) => m.clientMessageId === args.clientMessageId);
  if (existing) {
    return { s, ok: true, msg: 'Message already sent (idempotent)', tone: 'info', docId: existing.id };
  }

  // Legal hold check
  if (conv.legalHold && args.contentType !== 'SYSTEM') {
    return { s, ok: false, msg: 'Conversation is under legal hold — only system messages allowed', tone: 'bad' };
  }

  const now = nowStamp();
  conv.sequenceCounter++;
  const msg: Message = {
    id: uid(),
    clientMessageId: args.clientMessageId,
    conversationId: args.conversationId,
    senderId: userId,
    senderType: 'USER',
    sequenceNumber: conv.sequenceCounter,
    serverTimestamp: now,
    clientTimestamp: now,
    contentType: args.contentType,
    body: args.body,
    replyToMessageId: args.replyToMessageId,
    mentions: args.mentions,
    linkedObjectType: args.linkedObjectType,
    linkedObjectId: args.linkedObjectId,
    pinned: false,
    deliveryStates: Object.fromEntries(conv.participants.map((p) => [p, 'SENT'])),
  };

  s.messages.unshift(msg);
  conv.lastMessageAt = now;
  conv.lastMessagePreview = args.body.slice(0, 50);

  // Update tool library stats
  s.toolLibrary.notificationEngine.notificationsSent++;

  return { s, ok: true, msg: 'Message sent', tone: 'ok', docId: msg.id };
}

export function sendSystemMessage(
  sIn: ERPState,
  conversationId: string,
  body: string,
): Res {
  const s = cloneState(sIn);
  const conv = s.conversations.find((c) => c.id === conversationId);
  if (!conv) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };

  const now = nowStamp();
  conv.sequenceCounter++;
  const msg: Message = {
    id: uid(),
    clientMessageId: uid(),
    conversationId,
    senderId: 'SYSTEM',
    senderType: 'SYSTEM',
    sequenceNumber: conv.sequenceCounter,
    serverTimestamp: now,
    clientTimestamp: now,
    contentType: 'SYSTEM',
    body,
    pinned: false,
    deliveryStates: Object.fromEntries(conv.participants.map((p) => [p, 'DELIVERED'])),
  };

  s.messages.unshift(msg);
  conv.lastMessageAt = now;
  conv.lastMessagePreview = body.slice(0, 50);

  return { s, ok: true, msg: 'System message posted', tone: 'ok', docId: msg.id };
}

export function editMessage(
  sIn: ERPState,
  messageId: string,
  newBody: string,
  userId: string,
): Res {
  const s = cloneState(sIn);
  const msg = s.messages.find((m) => m.id === messageId);
  if (!msg) return { s, ok: false, msg: 'Message not found', tone: 'bad' };

  if (msg.senderId !== userId) {
    return { s, ok: false, msg: 'You can only edit your own messages', tone: 'bad' };
  }

  if (msg.contentType === 'SYSTEM') {
    return { s, ok: false, msg: 'System messages cannot be edited', tone: 'bad' };
  }

  // Check edit window (15 minutes)
  const editWindowMs = 15 * 60 * 1000;
  const msgTime = new Date(msg.serverTimestamp).getTime();
  const nowTime = new Date(s.today).getTime();
  if (nowTime - msgTime > editWindowMs) {
    return { s, ok: false, msg: 'Edit window (15 minutes) has expired', tone: 'bad' };
  }

  // Save edit history
  if (!msg.editHistory) msg.editHistory = [];
  msg.editHistory.push({ at: nowStamp(), body: msg.body });
  msg.body = newBody;
  msg.editedAt = nowStamp();

  return { s, ok: true, msg: 'Message edited', tone: 'ok' };
}

export function deleteMessage(
  sIn: ERPState,
  messageId: string,
  reason: string,
  userId: string,
): Res {
  const s = cloneState(sIn);
  const msg = s.messages.find((m) => m.id === messageId);
  if (!msg) return { s, ok: false, msg: 'Message not found', tone: 'bad' };

  const conv = s.conversations.find((c) => c.id === msg.conversationId);
  if (!conv) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };

  // Legal hold check
  if (conv.legalHold) {
    pushAudit(s, userId, 'SECURITY', 'MESSAGE_DELETE', messageId, {
      reason: 'Deletion refused — conversation under legal hold',
    });
    return { s, ok: false, msg: 'Cannot delete: conversation is under legal hold', tone: 'bad' };
  }

  // Contractual/legal retention check
  if (conv.retentionClass === 'CONTRACTUAL' || conv.retentionClass === 'LEGAL') {
    return { s, ok: false, msg: 'Cannot delete: conversation has contractual/legal retention', tone: 'bad' };
  }

  // Soft delete (tombstone)
  msg.deletedAt = nowStamp();
  msg.deletionReason = reason;
  msg.body = '[This message was deleted]';

  pushAudit(s, userId, 'CHANGE', 'MESSAGE', messageId, { reason });

  return { s, ok: true, msg: 'Message deleted (tombstoned)', tone: 'ok' };
}

/* ===================== Notifications ===================== */

export function sendNotification(
  sIn: ERPState,
  args: {
    eventKey: string;
    userId: string;
    channel: 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'CHAT';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    title: string;
    body: string;
    linkedObjectType?: string;
    linkedObjectId?: string;
  },
): Res {
  const s = cloneState(sIn);

  const notif: Notification = {
    id: uid(),
    eventKey: args.eventKey,
    userId: args.userId,
    channel: args.channel,
    priority: args.priority,
    title: args.title,
    body: args.body,
    linkedObjectType: args.linkedObjectType,
    linkedObjectId: args.linkedObjectId,
    sentAt: nowStamp(),
  };

  s.notifications.unshift(notif);
  s.toolLibrary.notificationEngine.notificationsSent++;

  return { s, ok: true, msg: 'Notification sent', tone: 'ok', docId: notif.id };
}

export function markNotificationRead(sIn: ERPState, notifId: string, userId: string): Res {
  const s = cloneState(sIn);
  const notif = s.notifications.find((n) => n.id === notifId);
  if (!notif) return { s, ok: false, msg: 'Notification not found', tone: 'bad' };

  if (notif.userId !== userId) {
    return { s, ok: false, msg: 'Notification does not belong to you', tone: 'bad' };
  }

  notif.readAt = nowStamp();
  return { s, ok: true, msg: 'Notification marked as read', tone: 'ok' };
}

/* ===================== Tasks ===================== */

export function createTask(
  sIn: ERPState,
  args: {
    title: string;
    description?: string;
    assigneeId: string;
    dueDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    linkedObjectType?: string;
    linkedObjectId?: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);

  const task: Task = {
    id: uid(),
    title: args.title,
    description: args.description,
    assigneeId: args.assigneeId,
    creatorId: userId,
    dueDate: args.dueDate,
    priority: args.priority ?? 'MEDIUM',
    status: 'OPEN',
    linkedObjectType: args.linkedObjectType,
    linkedObjectId: args.linkedObjectId,
    createdAt: nowStamp(),
  };

  s.tasks.unshift(task);

  // Send notification to assignee
  sendNotification(s, {
    eventKey: 'TASK_ASSIGNED',
    userId: args.assigneeId,
    channel: 'IN_APP',
    priority: args.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
    title: 'New task assigned',
    body: `${args.title}${args.dueDate ? ` (due ${args.dueDate})` : ''}`,
    linkedObjectType: 'TASK',
    linkedObjectId: task.id,
  });

  return { s, ok: true, msg: `Task created and assigned to ${args.assigneeId}`, tone: 'ok', docId: task.id };
}

export function updateTaskStatus(
  sIn: ERPState,
  taskId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  userId: string,
): Res {
  const s = cloneState(sIn);
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return { s, ok: false, msg: 'Task not found', tone: 'bad' };

  if (task.assigneeId !== userId && task.creatorId !== userId) {
    return { s, ok: false, msg: 'You are not authorized to update this task', tone: 'bad' };
  }

  task.status = status;
  if (status === 'COMPLETED') {
    task.completedAt = nowStamp();
  }

  return { s, ok: true, msg: `Task status updated to ${status}`, tone: 'ok' };
}

/* ===================== Message → ERP Object Conversion ===================== */

export function convertMessageToNCR(
  sIn: ERPState,
  messageId: string,
  userId: string,
): Res {
  const s = cloneState(sIn);
  const msg = s.messages.find((m) => m.id === messageId);
  if (!msg) return { s, ok: false, msg: 'Message not found', tone: 'bad' };

  // This would call the QMS module to create an NCR
  // For now, just link the message
  msg.linkedObjectType = 'NCR';
  msg.linkedObjectId = uid(); // Placeholder

  return { s, ok: true, msg: 'Message converted to NCR draft', tone: 'ok', docId: msg.linkedObjectId };
}

export function convertMessageToTask(
  sIn: ERPState,
  messageId: string,
  assigneeId: string,
  userId: string,
  dueDate?: string,
): Res {
  const s = cloneState(sIn);
  const msg = s.messages.find((m) => m.id === messageId);
  if (!msg) return { s, ok: false, msg: 'Message not found', tone: 'bad' };

  const taskRes = createTask(s, {
    title: msg.body.slice(0, 100),
    description: msg.body,
    assigneeId,
    dueDate,
    linkedObjectType: 'MESSAGE',
    linkedObjectId: messageId,
  }, userId);

  if (!taskRes.ok) return taskRes;

  // Update message to link to task
  msg.linkedObjectType = 'TASK';
  msg.linkedObjectId = taskRes.docId;

  return taskRes;
}

/* ===================== Queries ===================== */

export function getConversationMessages(s: ERPState, conversationId: string, limit = 50): Message[] {
  return s.messages
    .filter((m) => m.conversationId === conversationId && !m.deletedAt)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .slice(-limit);
}

export function getUserNotifications(s: ERPState, userId: string, unreadOnly = false): Notification[] {
  return s.notifications
    .filter((n) => n.userId === userId && (!unreadOnly || !n.readAt))
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export function getUserTasks(s: ERPState, userId: string, openOnly = false): Task[] {
  return s.tasks
    .filter((t) => t.assigneeId === userId && (!openOnly || t.status !== 'COMPLETED'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function searchMessages(s: ERPState, query: string, userId: string): Message[] {
  const lowerQuery = query.toLowerCase();
  return s.messages
    .filter((m) => {
      // Check if user is a participant in the conversation
      const conv = s.conversations.find((c) => c.id === m.conversationId);
      if (!conv || !conv.participants.includes(userId)) return false;
      // Search in body
      return m.body.toLowerCase().includes(lowerQuery);
    })
    .sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime())
    .slice(0, 50);
}
