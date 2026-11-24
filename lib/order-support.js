'use strict';

function recordOrderEvent(order, action, actor, details = {}, now = new Date().toISOString()) {
  if (!order || typeof order !== 'object') throw new Error('Order is required');
  order.history ||= [];
  const event = { action: String(action), actor: String(actor || 'system'), details, at: now };
  order.history.push(event);
  order.updatedAt = now;
  return event;
}

function canViewTicket(ticket, userId, isAdmin = false) {
  return Boolean(ticket && (isAdmin || String(ticket.customerId) === String(userId)));
}

function addTicketMessage(ticket, { senderRole, senderId, senderName = '', message, now = new Date().toISOString() }) {
  if (!ticket || typeof ticket !== 'object') throw new Error('Ticket is required');
  const text = String(message || '').trim();
  if (!text || text.length > 2000) throw new Error('Message must contain 1–2000 characters');
  if (!['admin', 'customer'].includes(senderRole)) throw new Error('Invalid sender role');
  if (ticket.status === 'Resolved' && senderRole === 'customer') throw new Error('This ticket is resolved. Contact support to reopen it.');
  ticket.messages ||= [];
  const row = {
    id: `MSG-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    senderRole,
    senderId: String(senderId),
    senderName: String(senderName || (senderRole === 'admin' ? 'Support Team' : 'Customer')).slice(0, 100),
    message: text,
    createdAt: now
  };
  ticket.messages.push(row);
  ticket.updatedAt = now;
  if (senderRole === 'customer') ticket.status = 'Open';
  return row;
}

function setTicketStatus(ticket, next, actor, now = new Date().toISOString()) {
  if (!ticket || typeof ticket !== 'object') throw new Error('Ticket is required');
  if (!['Open', 'Hold', 'Resolved'].includes(next)) throw new Error('Invalid status');
  ticket.statusHistory ||= [];
  if (ticket.status !== next) ticket.statusHistory.push({ from: ticket.status, to: next, by: String(actor), at: now });
  ticket.status = next;
  ticket.updatedAt = now;
  if (next === 'Hold') ticket.reviewAt = new Date(new Date(now).getTime() + 2 * 60 * 60 * 1000).toISOString();
  else delete ticket.reviewAt;
  return ticket;
}

module.exports = { recordOrderEvent, canViewTicket, addTicketMessage, setTicketStatus };
