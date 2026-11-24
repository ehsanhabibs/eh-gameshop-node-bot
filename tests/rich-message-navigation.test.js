'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { editRichMessageOrSend } = require('../lib/rich-message-navigation');

test('Rich navigation edits the existing message in-place and does not send a duplicate', async () => {
  const calls = [];
  const result = await editRichMessageOrSend({
    telegram: { callApi: async (method, args) => { calls.push({ method, args }); return { message_id: 9, chat: { id: 123 } }; } },
    chatId: 123, messageId: 9, html: '<h2>Stock</h2>', logger: { error() {} }
  });
  assert.equal(result.message_id, 9);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'editMessageText');
  assert.equal(calls[0].args.message_id, 9);
  assert.equal(calls[0].args.rich_message.html, '<h2>Stock</h2>');
});

test('Uneditable messages are replaced with a new Rich Message', async () => {
  const calls = [];
  const result = await editRichMessageOrSend({
    telegram: { callApi: async (method, args) => {
      calls.push(method);
      if (method === 'editMessageText') throw new Error("Bad Request: message can't be edited");
      return { message_id: 10, chat: { id: 123 } };
    } },
    chatId: 123, messageId: 9, html: '<h2>Stock</h2>', logger: { error() {} }
  });
  assert.deepEqual(calls, ['editMessageText', 'sendRichMessage']);
  assert.equal(result.message_id, 10);
});

test('Transient edit failures do not send duplicate replacement messages', async () => {
  const calls = [];
  await assert.rejects(() => editRichMessageOrSend({
    telegram: { callApi: async method => { calls.push(method); throw new Error('ETIMEDOUT'); } },
    chatId: 123, messageId: 9, html: '<h2>Stock</h2>', logger: { error() {} }
  }), /ETIMEDOUT/);
  assert.deepEqual(calls, ['editMessageText']);
});

test('When Rich Message replacement is unavailable, a supplied basic fallback is used', async () => {
  let replied = null;
  const result = await editRichMessageOrSend({
    telegram: { callApi: async method => {
      if (method === 'editMessageText') throw new Error("Bad Request: message can't be edited");
      throw new Error('Rich Message unsupported');
    } },
    chatId: 123, messageId: 9, html: '<h2>Stock</h2>',
    fallbackText: 'Basic stock list', fallbackMarkup: { reply_markup: 'keyboard' },
    reply: async (text, markup) => { replied = { text, markup }; return 'fallback'; },
    logger: { error() {} }
  });
  assert.equal(result, 'fallback');
  assert.deepEqual(replied, { text: 'Basic stock list', markup: { reply_markup: 'keyboard' } });
});

test('Stock navigation helper is defined and category navigation uses the same message', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(source, /async function editStockRichScreen\(/);
  assert.match(source, /bot\.action\("stock_view"[\s\S]*?showStockRichScreen\(ctx,html\)/);
  assert.match(source, /bot\.action\(\/\^stock_cat:\(\.\+\)\$\/[\s\S]*?editStockRichScreen\(ctx,stockCategoryAccountsRichHtml\(product\)/);
});

test('Reseller Rich Message menu includes Support and its callback keeps the free-text limitation explicit', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const reseller = fs.readFileSync(path.join(__dirname, '..', 'reseller-system.js'), 'utf8');
  assert.match(index, /data="rs:support">🆘 SUPPORT/);
  assert.match(reseller, /data="rs:support">🆘 SUPPORT/);
  assert.match(reseller, /if\(action==='support'\)[\s\S]*?editResellerRich\(ctx,'<h2>🛟 RESELLER SUPPORT/);
});
