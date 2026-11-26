'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const index = read('index.js');
const reseller = read('reseller-system.js');
const portal = read('Public/portal.html');
const searchPage = read('Public/order-search.html');
const domain = require('../lib/domain');
const { parseCustomerExpiryInput } = require('../lib/customer-expiry-date');

test('expired customer expiry shows a red EXPIRED badge and the exact expiry date', () => {
  assert.match(index, /expiryDays<0\?`<tg-button type="disabled" style="danger">EXPIRED/);
  assert.match(index, /fmtDate\(p\.customerExpiry\)/);
  assert.match(index, /stock_profile_reactivate:/);
  assert.match(portal, /function customerExpiryCellHtml\(/);
  assert.match(portal, /status-badge expired">EXPIRED/);
  assert.match(portal, /displayDhakaDate\(value\)/);
  assert.match(portal, /customerProfileStatusHtml\(p\)/);
});

test('customer date-only input does not roll a past DD.MM date into next year', () => {
  assert.equal(parseCustomerExpiryInput('05.11', '2026-11-10'), '2026-11-05');
  assert.equal(parseCustomerExpiryInput('15.11', '2026-11-10'), '2026-11-15');
  assert.match(index, /parseCustomerExpiryInput\(input,dhakaToday\(\)\)/);
});

test('Mini App profile editor can correct a saved customer expiry date and sync previews', () => {
  assert.match(portal, /name="customerExpiry" type="date"/);
  assert.ok(index.includes('profile-slots/:profileId'));
  assert.match(index, /p\.customerExpiry=expiry\|\|null/);
  assert.match(index, /await syncStockTelegramMessages\(st\)/);
});

test('Link Customer supports stock selection, multiple profiles, linked list, Back and separate Cancel', () => {
  for (const token of ['link_customer_stock:', 'link_customer_addanother', 'link_customer_another_stock', 'link_customer_view_profiles', 'link_customer_back:', 'link_customer_cancel']) assert.ok(index.includes(token), token);
  assert.match(index, /function linkCustomerStockListHtml/);
  assert.match(index, /function linkCustomerLinkedProfilesHtml/);
});

test('Stock Center and Account Update navigation use Rich Messages', () => {
  assert.match(index, /function stockMenuRichHtml/);
  assert.match(index, /function productKeyboardRichHtml/);
  assert.match(index, /function accountUpdateMenuHtml/);
  assert.match(index, /function accountNoticeStockListHtml/);
});

test('Stock account and account notice messages retain live-sync metadata', () => {
  assert.match(index, /kind:'stock_account'/);
  assert.match(index, /kind:'account_update_notice',profileId:p\.id,recipientId:recipient/);
  assert.match(index, /ref\.kind==='stock_account'\?stockAccountRichHtml/);
  const owner = {};
  domain.trackTelegramMessage(owner, { chatId: 1, messageId: 2, kind: 'account_update_notice', profileId: 'P1', recipientId: '12345' });
  assert.equal(owner.telegramMessages[0].profileId, 'P1');
  assert.equal(owner.telegramMessages[0].recipientId, '12345');
});

test('Reseller menu, quantity controls, grouped history and purchase report match requested layout', () => {
  assert.match(reseller, /🛒 ORDER NOW/);
  assert.match(reseller, /PURCHASE REPORT/);
  assert.match(reseller, /&nbsp;&nbsp;−&nbsp;&nbsp;/);
  assert.match(reseller, /&nbsp;&nbsp;＋&nbsp;&nbsp;/);
  assert.match(reseller, /PURCHASE ORDER HISTORY/);
  assert.match(reseller, /groups=new Map\(\)/);
  assert.match(reseller, /TODAY'S PRODUCT BREAKDOWN/);
  assert.match(reseller, /MONTHLY PRODUCT BREAKDOWN/);
  assert.match(portal, /Purchase Order History/);
  assert.match(portal, /Today's Product Breakdown/);
  assert.doesNotMatch(portal.slice(portal.indexOf('async function salesReport'), portal.indexOf('async function myProfile')), /Lifetime Sales|Lifetime Orders/);
});

test('Delivery previews use Rich Tables, copy_text, green Live Update and a vertical timeline', () => {
  const block = index.slice(index.indexOf('customer_delivery: { format:"rich_html"'), index.indexOf('reminder: {', index.indexOf('customer_delivery: { format:"rich_html"')));
  assert.match(block, /<table bordered compact><caption>ACCOUNT DETAILS/);
  assert.match(block, /type="copy_text" text="\{\{copyText\}\}"/);
  assert.match(block, /style="success" data="\{\{callbackPrefix\}\}_live/);
  assert.match(block, /\{\{timelineHtml\}\}/);
  assert.match(index, /function orderTimelineHtml\(/);
});

test('Premium Black and semantic category button colors are applied in the Mini App', () => {
  assert.match(portal, /APPROVED PREMIUM LIGHT REFINEMENTS/);
  assert.match(portal, /\.category-choice\.category-youtube\{background:#a91f35/);
  assert.match(portal, /\.category-choice\.category-amazon\{background:#1b467f/);
  assert.match(portal, /\.category-choice\.category-crunchyroll\{background:#fff;color:#111/);
  assert.match(portal, /categoryIcon=c=>/);
  assert.match(searchPage, /color-scheme:light/);
  assert.doesNotMatch(searchPage, /color-scheme:dark|#070a10/);
});

test('View Stock account details navigate between stock accounts in the same Rich Message and show expired account badge', () => {
  assert.match(index, /data="stock_nav:prev:\$\{esc\(st\.id\)\}"/);
  assert.match(index, /data="stock_nav:next:\$\{esc\(st\.id\)\}"/);
  assert.match(index, /bot\.action\(\/\^stock_nav:\(next\|prev\):\(\.\+\)\$\//);
  assert.match(index, /sendStockAccountRich\(ctx,target,true,messageId\)/);
  assert.match(index, /ACCOUNT EXPIRY STATUS: \$\{expiryBadge\}/);
  assert.match(index, /style="danger">EXPIRED<\/tg-button>/);
  assert.match(index, /ref\.kind==='stock_account'\?stockAccountRichHtml/);
});
