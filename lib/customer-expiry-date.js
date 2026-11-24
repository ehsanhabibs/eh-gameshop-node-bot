'use strict';

// Customer expiry is an exact calendar date, not a recurring annual account date.
// Therefore a DD.MM value is interpreted in the current Dhaka year even when it
// has already passed. This prevents 05.11 entered on 10 November from silently
// becoming 05 November of the following year.
function parseCustomerExpiryInput(value, today) {
  const input = String(value || '').trim();
  const short = input.match(/^(\d{1,2})\s*[-/. ]\s*(\d{1,2})$/);
  if (!short) return null;
  const day = Number(short[1]);
  const month = Number(short[2]);
  const year = Number(String(today || '').slice(0, 4));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = { parseCustomerExpiryInput };
