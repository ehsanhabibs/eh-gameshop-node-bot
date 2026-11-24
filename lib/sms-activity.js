'use strict';
const crypto = require('node:crypto');

function amountToMinor(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseBkashSms(payload = {}, options = {}) {
  const source = String(payload.from ?? '').trim();
  const text = String(payload.text ?? '').trim();
  const configuredSender = String(options.sender || '').trim().toLowerCase();
  const sourceMatch = configuredSender ? source.toLowerCase().includes(configuredSender) : /bkash/i.test(source);
  const txMatch = text.match(/\b(?:trx\s*id|trxid|txn\s*id|transaction\s*id)\s*[:#=-]?\s*([a-z0-9]{6,24})\b/i);
  const amountMatch = text.match(/(?:tk\.?|bdt|৳)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i)
    || text.match(/([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:tk\.?|bdt|৳)/i);
  const payerMatch = text.match(/\b(?:from|sender)\s*[:=-]?\s*(?:\+?88)?(01[3-9]\d{8})\b/i);
  const received = /\b(received|cash\s*in|payment\s*received|credited|you\s+got)\b/i.test(text);
  const outgoing = /\b(send\s*money|sent\s+to|payment\s+to|cash\s*out)\b/i.test(text);
  return {
    source, text,
    sourceMatch,
    transactionId: txMatch ? txMatch[1].toUpperCase() : null,
    amountMinor: amountMatch ? amountToMinor(amountMatch[1]) : null,
    payerPhone: payerMatch ? payerMatch[1] : null,
    received,
    outgoing,
    sentStamp: payload.sentStamp ?? null,
    receivedStamp: payload.receivedStamp ?? null,
    sim: payload.sim ?? null
  };
}

function smsFingerprint(payload = {}) {
  const stable = [payload.from, payload.text, payload.sentStamp, payload.receivedStamp, payload.sim].map(x => String(x ?? '')).join('\u001f');
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function findPaymentMatches(data, parsed) {
  const tx = String(parsed.transactionId || '').toUpperCase();
  if (!tx) return { customerOrders: [], dueRequests: [] };
  const customerOrders = (data.orders || []).filter(o => String(o.transactionId || '').toUpperCase() === tx && String(o.paymentMethod || '').toLowerCase() === 'bkash' && o.paymentStatus === 'Pending Verification');
  const dueRequests = (data.dueClearanceRequests || []).filter(r => String(r.transactionId || '').toUpperCase() === tx && String(r.paymentMethod || '').toLowerCase() === 'bkash' && r.status === 'Pending');
  return { customerOrders, dueRequests };
}

function classifySms(data, payload, options = {}) {
  const parsed = parseBkashSms(payload, options);
  const fingerprint = smsFingerprint(payload);
  const events = data.smsActivityEvents || [];
  if (events.some(e => e.fingerprint === fingerprint)) return { action: 'duplicate_payload', parsed, fingerprint };
  if (!parsed.sourceMatch) return { action: 'ignored_source', parsed, fingerprint };
  if (parsed.outgoing || !parsed.received) return { action: 'manual_review', reason: 'SMS is not clearly an incoming payment receipt', parsed, fingerprint };
  if (!parsed.transactionId || parsed.amountMinor === null) return { action: 'manual_review', reason: 'Could not reliably extract Transaction ID and amount', parsed, fingerprint };
  if (events.some(e => String(e.transactionId || '').toUpperCase() === parsed.transactionId && ['Auto Verified', 'Manually Verified'].includes(e.status)) || (data.ledger || []).some(e => String(e.transactionId || '').toUpperCase() === parsed.transactionId) || (data.orders || []).some(o => String(o.transactionId || '').toUpperCase() === parsed.transactionId && o.paymentStatus === 'Verified')) return { action: 'duplicate_transaction', reason: 'Transaction ID was already verified or settled', parsed, fingerprint };
  const matches = findPaymentMatches(data, parsed);
  const all = [...matches.customerOrders.map(target => ({ type: 'customer_order', target })), ...matches.dueRequests.map(target => ({ type: 'reseller_due', target }))];
  if (all.length !== 1) return { action: 'manual_review', reason: all.length ? 'Transaction ID matched more than one pending payment' : 'No pending customer order or reseller due request matched this Transaction ID', parsed, fingerprint };
  const [{ type, target }] = all;
  const expected = amountToMinor(target.price ?? target.amount);
  if (expected !== parsed.amountMinor) return { action: 'manual_review', reason: `SMS amount does not match the pending ${type === 'customer_order' ? 'order' : 'due request'} amount`, parsed, fingerprint, targetType: type, targetId: target.id };
  return { action: 'auto_verify', parsed, fingerprint, targetType: type, targetId: target.id };
}

module.exports = { amountToMinor, parseBkashSms, smsFingerprint, findPaymentMatches, classifySms };
