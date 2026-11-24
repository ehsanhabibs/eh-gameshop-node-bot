'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cycles = require('../lib/stock-purchase-cycles');

test('Crunchyroll purchase email label and Order ID are stored per stock cycle', () => {
  const stock = { id: 'STK-1', product: 'Crunchyroll', cycle: 1, purchaseCycles: [] };
  cycles.updatePurchaseField(stock, 'label', 'GMAIL-01', { now: '2026-11-16T00:00:00Z' });
  cycles.updatePurchaseField(stock, 'order', 'CR-ORDER-001', { now: '2026-11-16T00:01:00Z' });
  assert.deepEqual(stock.purchaseCycles[0], {
    cycle: 1, stockId: 'STK-1', emailLabel: 'GMAIL-01', orderId: 'CR-ORDER-001',
    changes: [
      { field: 'emailLabel', from: '', to: 'GMAIL-01', at: '2026-11-16T00:00:00Z' },
      { field: 'orderId', from: '', to: 'CR-ORDER-001', at: '2026-11-16T00:01:00Z' }
    ], createdAt: '2026-11-16T00:00:00Z', updatedAt: '2026-11-16T00:01:00Z'
  });
});

test('editing a purchase email label retains the previous value in the audit history', () => {
  const stock = { id: 'STK-1', product: 'Crunchyroll', cycle: 1 };
  cycles.updatePurchaseField(stock, 'label', 'GMAIL-01', { now: '2026-11-16T00:00:00Z' });
  cycles.updatePurchaseField(stock, 'label', 'GMAIL-02', { now: '2026-11-16T00:02:00Z' });
  assert.equal(stock.purchaseCycles[0].emailLabel, 'GMAIL-02');
  assert.equal(stock.purchaseCycles[0].changes.length, 2);
  assert.equal(stock.purchaseCycles[0].changes[1].from, 'GMAIL-01');
});

test('new subscription cycles keep older purchase cycle records linked and readable', () => {
  const first = { id: 'STK-1', product: 'Crunchyroll', cycle: 1, purchaseCycles: [{ cycle: 1, emailLabel: 'GMAIL-01', orderId: 'CR-001' }], nextCycleStockId: 'STK-2' };
  const second = { id: 'STK-2', product: 'Crunchyroll', cycle: 2, previousStockId: 'STK-1', purchaseCycles: [{ cycle: 2, emailLabel: 'GMAIL-02', orderId: 'CR-002' }] };
  assert.deepEqual(cycles.cycleChain([first, second], second).map(x => x.id), ['STK-1', 'STK-2']);
  assert.equal(first.purchaseCycles[0].orderId, 'CR-001');
});

test('purchase tracking rejects non-Crunchyroll stock and invalid lengths', () => {
  assert.throws(() => cycles.updatePurchaseField({ id: 'STK-1', product: 'Prime' }, 'label', 'GMAIL-01'), /Crunchyroll/);
  assert.throws(() => cycles.updatePurchaseField({ id: 'STK-1', product: 'Crunchyroll' }, 'label', 'x'.repeat(33)), /1–32/);
  assert.throws(() => cycles.updatePurchaseField({ id: 'STK-1', product: 'Crunchyroll' }, 'order', 'x'.repeat(121)), /1–120/);
});
