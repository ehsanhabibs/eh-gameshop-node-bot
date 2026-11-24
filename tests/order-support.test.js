const test = require('node:test');
const assert = require('node:assert/strict');
const support = require('../lib/order-support');

test('ticket access is limited to its owner unless caller is admin', () => {
  const ticket = { customerId: '1001' };
  assert.equal(support.canViewTicket(ticket, '1001'), true);
  assert.equal(support.canViewTicket(ticket, '2002'), false);
  assert.equal(support.canViewTicket(ticket, '2002', true), true);
});

test('ticket replies are timestamped and customer replies reopen non-resolved tickets', () => {
  const ticket = { id: 'EH-01001', status: 'Hold', messages: [] };
  const message = support.addTicketMessage(ticket, { senderRole: 'customer', senderId: '1001', senderName: 'Demo', message: 'Please check this', now: '2026-11-05T10:00:00.000Z' });
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.messages.length, 1);
  assert.equal(message.message, 'Please check this');
  assert.equal(message.createdAt, '2026-11-05T10:00:00.000Z');
});

test('resolved tickets reject customer replies but allow admin replies', () => {
  const ticket = { id: 'EH-01002', status: 'Resolved', messages: [] };
  assert.throws(() => support.addTicketMessage(ticket, { senderRole: 'customer', senderId: '1001', message: 'Again' }), /resolved/);
  assert.equal(support.addTicketMessage(ticket, { senderRole: 'admin', senderId: '9', message: 'We can help' }).senderRole, 'admin');
});

test('ticket status changes are auditable and Hold schedules a review', () => {
  const ticket = { id: 'EH-01003', status: 'Open' };
  support.setTicketStatus(ticket, 'Hold', '9', '2026-11-05T10:00:00.000Z');
  assert.equal(ticket.status, 'Hold');
  assert.equal(ticket.statusHistory.length, 1);
  assert.equal(ticket.reviewAt, '2026-11-05T12:00:00.000Z');
  support.setTicketStatus(ticket, 'Resolved', '9', '2026-11-05T11:00:00.000Z');
  assert.equal(ticket.reviewAt, undefined);
  assert.equal(ticket.statusHistory.length, 2);
});

test('order activity history records who changed what without exposing credentials', () => {
  const order = { id: 'EHG-000001' };
  const event = support.recordOrderEvent(order, 'ITEM_DELIVERED', '9', { itemId: 'EHG-000001-01' }, '2026-11-05T10:00:00.000Z');
  assert.equal(order.history.length, 1);
  assert.equal(event.actor, '9');
  assert.equal(order.updatedAt, event.at);
  assert.equal(JSON.stringify(event).includes('password'), false);
});
