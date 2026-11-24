'use strict';
const REMINDER_DAYS = [1, 0];
function daysUntilExpiry(expiry, today) {
  if (!validDate(expiry) || !validDate(today)) return null;
  return Math.round((new Date(`${expiry}T12:00:00+06:00`) - new Date(`${today}T12:00:00+06:00`)) / 86400000);
}
function validDate(value) {
  const s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00+06:00`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function reminderKey(expiry, daysLeft) { return `${expiry}:${daysLeft}`; }
function reminderDue(profile, today) {
  const daysLeft = daysUntilExpiry(profile?.customerExpiry, today);
  if (!REMINDER_DAYS.includes(daysLeft)) return null;
  const key = reminderKey(profile.customerExpiry, daysLeft);
  if (profile.customerExpiryReminderSent?.[key]) return null;
  return { daysLeft, key };
}
function expiryBucket(expiry, today) {
  const n = daysUntilExpiry(expiry, today);
  if (n === null) return 'invalid';
  if (n < 0) return 'expired';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  if (n <= 7) return 'upcoming';
  return 'active';
}
module.exports = { REMINDER_DAYS, daysUntilExpiry, reminderKey, reminderDue, expiryBucket, validDate };
