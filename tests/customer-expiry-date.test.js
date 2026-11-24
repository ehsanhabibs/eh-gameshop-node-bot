'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCustomerExpiryInput } = require('../lib/customer-expiry-date');

test('customer DD.MM expiry uses the current year instead of silently rolling a past date into next year', () => {
  assert.equal(parseCustomerExpiryInput('05.11', '2026-11-10'), '2026-11-05');
  assert.equal(parseCustomerExpiryInput('15.11', '2026-11-10'), '2026-11-15');
});

test('customer DD.MM expiry validates impossible calendar dates', () => {
  assert.equal(parseCustomerExpiryInput('31.02', '2026-02-01'), null);
  assert.equal(parseCustomerExpiryInput('00.11', '2026-11-10'), null);
});
