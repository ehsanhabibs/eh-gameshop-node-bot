'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = require('node:path').join(__dirname, '..');
const source = fs.readFileSync(nodePath('index.js'), 'utf8');
const reseller = fs.readFileSync(nodePath('reseller-system.js'), 'utf8');
function nodePath(name) { return require('node:path').join(root, name); }

test('Account Update Notice passes the intended Telegram recipient into assignment verification', () => {
  assert.match(source, /accountUpdateNoticeHtml\(st,p,recipient\)/);
  assert.match(source, /PROFILE ASSIGNMENT CHECK FAILED/);
  assert.match(source, /accountUpdateNoticeHtml\(stock,\(stock\.profiles\|\|\[\]\)\.find\(p=>String\(p\.id\)===String\(ref\.profileId\)\),ref\.recipientId\)/);
});

test('Compact View Stock preview has independent Email and expand actions with an inline profile table', () => {
  assert.match(source, /function stockCompactPreviewHtml\(product,expandedStockId=null\)/);
  assert.match(source, /stock_account:\$\{esc\(st\.id\)\}/);
  assert.match(source, /stock_compact_expand:/);
  assert.match(source, /PROFILE DETAILS/);
  assert.match(source, /stock_profile_reactivate:/);
  assert.ok(source.includes("const expiry=st.originalExpiry?fmtDate(st.originalExpiry):'—'"));
  assert.match(source, /<th>STOCK ID<\/th><th>EMAIL \/ PASSWORD<\/th><th>EXPIRY<\/th><th>STATUS<\/th>/);
  assert.match(source, /type="disabled" style="success">● AVAILABLE/);
  assert.doesNotMatch(source, /type="callback_data" style="success" data="stock_account:\$\{esc\(st\.id\)\}">AVAILABLE/);
  assert.match(source, /STOCK CENTER · ACCOUNTS/);
});

test('Current stock expiry extension and new stock cycle are separate actions', () => {
  assert.match(source, /account_action:newcycle/);
  assert.match(source, /domain\.extendOriginalExpiry\(stock,date/);
  assert.match(source, /NEW STOCK CYCLE CREATED/);
  assert.match(source, /Same Stock ID retained/);
});

test('Crunchyroll purchase label, Order ID and cycle history are wired into Stock Details', () => {
  assert.match(source, /cr_purchase_edit_label:/);
  assert.match(source, /cr_purchase_edit_order:/);
  assert.match(source, /cr_purchase_history:/);
  assert.match(source, /stockPurchaseCycleHtml/);
  assert.match(source, /Previous cycles are kept unchanged/);
});

test('Link Customer success message shows immediate Profile Preview with PIN and Add Another action', () => {
  assert.match(source, /PROFILE PREVIEW/);
  assert.match(source, /linked\.pin\|\|'Not set'/);
  assert.match(source, /ADD ANOTHER PROFILE/);
  assert.match(source, /ADD PROFILE & LINK CUSTOMER/);
});

test('Expired and archived stock management is available and prevents adding profiles to unavailable stock', () => {
  assert.match(source, /stock_lifecycle_view/);
  assert.match(source, /\['ACTIVE',stocks\.filter/);
  assert.match(source, /\['ARCHIVED',stocks\.filter/);
  assert.match(source, /Expired or archived Stock cannot accept new profiles/);
});

test('Reseller product colors/icons and checkout button text follow the latest requested corrections', () => {
  assert.match(reseller, /style="primary" data="rs:cat:0">📦 AMAZON PRIME/);
  assert.match(reseller, /style="primary" data="rs:cat:1">🍿 CRUNCHYROLL/);
  assert.match(reseller, /style="primary" data="rs:cat:2">▶️ YOUTUBE/);
  assert.match(reseller, /style="primary" data="rs:cat:3">🛡️ VPN/);
  assert.match(reseller, /🛒 ORDER NOW/);
  assert.match(reseller, /data="rs:confirm">CONFIRM ORDER/);
  assert.doesNotMatch(reseller, /data="rs:confirm">✅ CONFIRM ORDER/);
});


test('YouTube Family and Individual email submit no longer hit undefined money helper and preserve Back navigation',()=>{
  assert.match(source,/function money\(value\)/);
  assert.match(source,/money\(unit\)/);
  assert.ok(reseller.includes('youtube:(?:family|individual|back)'));
  assert.match(reseller,/action==='youtube:back'/);
  assert.match(reseller,/data="rs:youtube:back"/);
  assert.match(reseller,/YouTube reseller email submission failed/);
});

test('Account Replace consumes the new password step before treating input as another email',()=>{
  const start=source.indexOf('if(flow.action==="replace" && flow.step==="newPassword")');
  const email=source.indexOf('if(flow.action==="email" || flow.action==="replace")');
  assert.ok(start>=0 && email>start);
});

test('Auto delivery requires a preconfigured named profile and does not create one automatically',()=>{
  const block=fs.readFileSync(nodePath('lib/domain.js'),'utf8');
  assert.match(block,/Never auto-create a profile during delivery/);
  assert.match(block,/String\(p\.profile\|\|''\)\.trim\(\)/);
});

test('Stock compact preview combines email and password, removes View action, and expands profile name/customer/PIN',()=>{
  assert.match(source,/<th>EMAIL \/ PASSWORD<\/th>/);
  assert.match(source,/Password: <code>\$\{esc\(st\.password\|\|'—'\)\}<\/code>/);
  assert.match(source,/PROFILE DETAILS/);
  assert.match(source,/PIN: \$\{esc\(p\.pin\)\}/);
  assert.doesNotMatch(source,/data="stock_account:\$\{esc\(st\.id\)\}">VIEW/);
});
