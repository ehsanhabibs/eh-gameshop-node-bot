const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('YouTube admin request supports per-item selection and confirmed selected/all bulk completion', () => {
  const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  assert.match(source, /ytadm:sel:/);
  assert.match(source, /ytadm:bulk:ask:/);
  assert.match(source, /ytadm:bulk:do:/);
  assert.match(source, /COMPLETE SELECTED/);
  assert.match(source, /COMPLETE ALL/);
  assert.match(source, /!\['Completed','Rejected'\]\.includes/);
  assert.match(source, /updateYoutubeItemStatus\(item,'Completed',ctx\.from\.id\)/);
  assert.match(source, /notifyYoutubeRequestOwner\(parent\)/);
});

test('YouTube reseller request status uses compact semantic status pills', () => {
  const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  assert.match(source, /function youtubeStatusPill\(status\)/);
  assert.ok(source.includes('style="success">✓ COMPLETED'));
  assert.ok(source.includes('style="danger">✕ REJECTED'));
  assert.match(source, /🟠 HOLD/);
});

test('Reseller product category buttons use the requested semantic color mapping', () => {
  const source = fs.readFileSync(path.join(root, 'reseller-system.js'), 'utf8');
  assert.match(source, /style="primary" data="rs:cat:0">📦 AMAZON PRIME/);
  assert.match(source, /data="rs:cat:1">🍿 CRUNCHYROLL/);
  assert.match(source, /style="danger" data="rs:cat:2">▶️ YOUTUBE PREMIUM/);
  assert.match(source, /style="success" data="rs:cat:3">🛡️ VPN/);
});


test('YouTube request overview displays per-status item counts and Select All control', () => {
  const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  assert.match(source, /function youtubeStatusSummary\(parent\)/);
  assert.match(source, /ITEM STATUS SUMMARY/);
  assert.match(source, /SELECT ALL/);
  assert.match(source, /ytadm:bulk:all:/);
  assert.match(source, /youtubeAdminSelections/);
});

test('new YouTube request notifications show item status summary before opening details', () => {
  const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  assert.match(source, /<tr><th>ITEM STATUS<\/th><td>\$\{esc\(youtubeStatusSummary\(parent\)\)\}<\/td><\/tr>/);
});

test('Mini App YouTube request cards show total and per-status item counts', () => {
  const portal = fs.readFileSync(path.join(root, 'Public', 'portal.html'), 'utf8');
  assert.match(portal, /const summary=\['Pending Review','Accepted','Processing','Invited','Hold','Completed','Rejected'\]/);
  assert.match(portal, /\$\{\(x\.items\|\|\[\]\)\.length\} total/);
});
