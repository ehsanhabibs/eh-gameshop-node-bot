'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { productSales, totals, monthlyReport, tierPrice, dateKey } = require('../reseller-system');

test('productSales aggregates product quantity and amount, excluding rejected orders', () => {
  const rows = productSales([
    { productName: 'Prime', price: 80, status: 'Completed' },
    { productName: 'Prime', price: 70, status: 'Processing' },
    { productName: 'YouTube', price: 120, status: 'Pending' },
    { productName: 'Prime', price: 10, status: 'Rejected' }
  ]);
  assert.deepEqual(rows, [
    { product: 'Prime', quantity: 2, amount: 150 },
    { product: 'YouTube', quantity: 1, amount: 120 }
  ]);
});

test('totals computes received and due without per-order partial-paid status', () => {
  assert.deepEqual(totals([
    { price: 100, paymentStatus: 'Verified', status: 'Completed' },
    { price: 50, paymentStatus: 'Pending', status: 'Processing' },
    { price: 30, paymentStatus: 'Rejected', status: 'Rejected' }
  ]), { sales: 150, received: 100, due: 50 });
});

test('tierPrice uses reseller special price before tier/base price', () => {
  assert.equal(tierPrice({ tier: 'Rate 2', tierPrices: { 'Rate 2': { Prime: 75 } } }, 'Prime', 80), 75);
  assert.equal(tierPrice({ specialPrices: { Prime: 68 }, tier: 'Rate 2' }, 'Prime', 80), 68);
  assert.equal(tierPrice({}, 'Prime', 80), 80);
});

test('monthlyReport returns product rows and grand totals', () => {
  const result = monthlyReport([
    { productName: 'Prime', price: 80, paymentStatus: 'Verified', createdAt: '2026-11-05T12:00:00+06:00' },
    { productName: 'Prime', price: 70, paymentStatus: 'Pending', createdAt: '2026-11-08T12:00:00+06:00' },
    { productName: 'VPN', price: 50, paymentStatus: 'Verified', createdAt: '2026-10-08T12:00:00+06:00' }
  ], 2026, 11);
  assert.equal(result.sales, 150);
  assert.equal(result.received, 80);
  assert.equal(result.due, 70);
  assert.deepEqual(result.rows, [{ product: 'Prime', quantity: 2, amount: 150 }]);
});

test('dateKey uses Asia/Dhaka calendar date', () => {
  assert.equal(dateKey('2026-10-31T19:00:00Z'), '2026-11-01');
});
