'use strict';

function currentCycleRecord(stock, { create = true, now = new Date().toISOString() } = {}) {
  if (!stock || !/crunchyroll/i.test(String(stock.product || ''))) {
    throw new Error('Purchase cycle tracking is only available for Crunchyroll stock');
  }
  const cycle = Math.max(1, Number(stock.cycle || 1));
  stock.purchaseCycles = Array.isArray(stock.purchaseCycles) ? stock.purchaseCycles : [];
  let row = stock.purchaseCycles.find(item => Number(item.cycle) === cycle);
  if (!row && create) {
    row = { cycle, stockId: String(stock.id), emailLabel: '', orderId: '', changes: [], createdAt: now, updatedAt: now };
    stock.purchaseCycles.push(row);
  }
  return row || { cycle, stockId: String(stock.id), emailLabel: '', orderId: '', changes: [] };
}

function updatePurchaseField(stock, field, value, { now = new Date().toISOString() } = {}) {
  if (!['label', 'order'].includes(field)) throw new Error('Unknown purchase tracking field');
  const text = String(value || '').trim();
  const max = field === 'label' ? 32 : 120;
  if (!text || text.length > max) throw new Error(`${field === 'label' ? 'Email label' : 'Order ID'} must be 1–${max} characters`);
  const row = currentCycleRecord(stock, { create: true, now });
  const key = field === 'label' ? 'emailLabel' : 'orderId';
  const previous = String(row[key] || '');
  if (previous !== text) {
    row.changes ||= [];
    row.changes.push({ field: key, from: previous, to: text, at: now });
    row[key] = text;
  }
  row.updatedAt = now;
  stock.updatedAt = now;
  return row;
}

function cycleChain(stocks, stock) {
  if (!stock) return [];
  const all = Array.isArray(stocks) ? stocks : [];
  const chain = [];
  let current = stock;
  let guard = 0;
  while (current && guard++ < 100) {
    chain.unshift(current);
    current = current.previousStockId ? all.find(item => String(item.id) === String(current.previousStockId)) : null;
  }
  current = chain[0] || null;
  guard = 0;
  while (current?.nextCycleStockId && guard++ < 100) {
    const next = all.find(item => String(item.id) === String(current.nextCycleStockId));
    if (!next || chain.some(item => String(item.id) === String(next.id))) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

module.exports = { currentCycleRecord, updatePurchaseField, cycleChain };
