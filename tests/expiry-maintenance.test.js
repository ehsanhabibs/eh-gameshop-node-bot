const test = require('node:test');
const assert = require('node:assert/strict');
const { daysUntilExpiry, reminderDue, expiryBucket, REMINDER_DAYS } = require('../lib/expiry-maintenance');
test('expiry day calculations use Bangladesh calendar dates', () => {
  assert.equal(daysUntilExpiry('2026-11-12', '2026-11-05'), 7);
  assert.equal(daysUntilExpiry('2026-11-05', '2026-11-05'), 0);
  assert.equal(daysUntilExpiry('2026-11-04', '2026-11-05'), -1);
});
test('customer expiry reminder helper remains one day before and on expiry day', () => {
  assert.deepEqual(REMINDER_DAYS, [1, 0]);
  const profile = { customerExpiry: '2026-11-08' };
  assert.equal(reminderDue(profile, '2026-11-05'), null);
  assert.deepEqual(reminderDue(profile, '2026-11-07'), { daysLeft: 1, key: '2026-11-08:1' });
  profile.customerExpiryReminderSent = { '2026-11-08:1': '2026-11-07T00:00:00Z' };
  assert.equal(reminderDue(profile, '2026-11-07'), null);
  assert.deepEqual(reminderDue(profile, '2026-11-08'), { daysLeft: 0, key: '2026-11-08:0' });
});
test('renewal date changes produce independent Admin-side expiry keys', () => {
  const profile = { customerExpiry: '2026-11-08', customerExpiryReminderSent: { '2026-11-08:1': 'sent' } };
  profile.customerExpiry = '2026-12-08';
  assert.deepEqual(reminderDue(profile, '2026-12-07'), { daysLeft: 1, key: '2026-12-08:1' });
});
test('expiry dashboard classifies dates into maintenance buckets', () => {
  assert.equal(expiryBucket('2026-11-04', '2026-11-05'), 'expired');
  assert.equal(expiryBucket('2026-11-05', '2026-11-05'), 'today');
  assert.equal(expiryBucket('2026-11-07', '2026-11-05'), 'soon');
  assert.equal(expiryBucket('2026-11-10', '2026-11-05'), 'upcoming');
  assert.equal(expiryBucket('2026-11-20', '2026-11-05'), 'active');
});
