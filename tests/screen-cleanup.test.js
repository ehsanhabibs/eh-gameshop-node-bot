const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sc = require('../lib/screen-cleanup');

function harness({ failDelete = false } = {}) {
  const calls = [];
  let nextId = 100;
  class FakeTelegram {
    async callApi(method, payload) {
      calls.push([method, payload]);
      if (method === 'deleteMessage') { if (failDelete) throw new Error('message to delete not found'); return true; }
      if (method === 'sendMessage' || method === 'sendRichMessage') return { message_id: ++nextId, chat: { id: payload.chat_id } };
      return true;
    }
    async sendMessage(chatId, text) { return this.callApi('sendMessage', { chat_id: chatId, text }); }
    async sendRichMessage(chatId, html) { return this.callApi('sendRichMessage', { chat_id: chatId, rich_message: { html } }); }
    async editMessageText(chatId, id) { return this.callApi('editMessageText', { chat_id: chatId, message_id: id }); }
  }
  const store = {};
  const labels = new Set(['📦 STOCK CENTER', '📋 VIEW HISTORY']);
  const deleted = [];
  const cleanup = sc.createScreenCleanup({ store: () => store, labels, onDeleted: (c, m) => deleted.push([c, m]), logger: { warn() {}, error() {} } });
  assert.equal(cleanup.patch(FakeTelegram), true);
  const tg = new FakeTelegram();
  const tap = (chatId, text, handler) => cleanup.middleware({ chat: { id: chatId, type: 'private' }, message: { text } }, () => handler(tg, chatId));
  const deletes = () => calls.filter(c => c[0] === 'deleteMessage').map(c => c[1].message_id);
  return { tg, tap, store, deleted, deletes, calls };
}

test('reopening the same screen deletes only its previous preview', async () => {
  const h = harness();
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendRichMessage(c, '<p>stock 1</p>'));
  assert.deepEqual(h.deletes(), []);
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendRichMessage(c, '<p>stock 2</p>'));
  assert.deepEqual(h.deletes(), [101]);
  assert.equal(h.store['7|📦 STOCK CENTER'], 102);
});

test('different screens and different chats never delete each other', async () => {
  const h = harness();
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendMessage(c, 'a'));
  await h.tap(7, '📋 VIEW HISTORY', (tg, c) => tg.sendMessage(c, 'b'));
  await h.tap(8, '📦 STOCK CENTER', (tg, c) => tg.sendMessage(c, 'c'));
  assert.deepEqual(h.deletes(), []);
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendMessage(c, 'd'));
  assert.deepEqual(h.deletes(), [101]);
});

test('only the first message of a handler is the preview; extra business messages are untouched', async () => {
  const h = harness();
  const run = () => h.tap(7, '📋 VIEW HISTORY', async (tg, c) => { await tg.sendMessage(c, 'preview'); await tg.sendMessage(c, 'notification'); });
  await run();
  await run();
  assert.deepEqual(h.deletes(), [101], 'the notification (102) must never be deleted');
});

test('plain text, unknown labels, edits and messages sent outside a tap are never tracked', async () => {
  const h = harness();
  await h.tap(7, 'hello there', (tg, c) => tg.sendMessage(c, 'x'));
  await h.tap(7, '📦 STOCK CENTER', async (tg, c) => { await tg.editMessageText(c, 55); });
  await h.tg.sendMessage(7, 'background notification');
  await h.tg.sendMessage(7, 'background notification 2');
  assert.deepEqual(h.deletes(), []);
  assert.deepEqual(h.store, {});
});

test('in-place navigation keeps the same message id and the registry untouched', async () => {
  const h = harness();
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendRichMessage(c, 'menu'));
  const before = { ...h.store };
  await h.tg.editMessageText(7, 101);
  await h.tg.editMessageText(7, 101);
  assert.deepEqual(h.store, before);
  assert.deepEqual(h.deletes(), []);
});

test('slash commands share a screen with their menu button; /start and /cancel are never cleaned', async () => {
  const h = harness();
  await h.tap(7, '/stock', (tg, c) => tg.sendRichMessage(c, 'menu'));
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendRichMessage(c, 'menu'));
  assert.deepEqual(h.deletes(), [101]);
  await h.tap(7, '/start', (tg, c) => tg.sendMessage(c, 'welcome'));
  await h.tap(7, '/start', (tg, c) => tg.sendMessage(c, 'welcome'));
  await h.tap(7, '/cancel', (tg, c) => tg.sendMessage(c, 'ok'));
  assert.deepEqual(h.deletes(), [101]);
  assert.equal(sc.keyForText('/stock@MyBot extra', new Set()), '📦 STOCK CENTER');
  assert.equal(sc.keyForText('/youtube', new Set()), '/youtube');
});

test('a failed delete (already removed) does not break the new screen and the registry still moves on', async () => {
  const h = harness({ failDelete: true });
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendMessage(c, 'a'));
  await h.tap(7, '📦 STOCK CENTER', (tg, c) => tg.sendMessage(c, 'b'));
  assert.equal(h.store['7|📦 STOCK CENTER'], 102);
  assert.deepEqual(h.deleted, [[7, 101]]);
});

test('forgetMessage removes only the matching registry slot', () => {
  const s = { '7|A': 5, '7|B': 6, '8|A': 5 };
  sc.forgetMessage(s, 7, 5);
  assert.deepEqual(s, { '7|B': 6, '8|A': 5 });
});

test('index.js wires the cleanup before the reseller handlers and patches the Telegram class', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.ok(src.indexOf('bot.use(screenCleanup.middleware)') > 0);
  assert.ok(src.indexOf('bot.use(screenCleanup.middleware)') < src.indexOf('registerResellerSystem(bot, {'));
  assert.ok(src.includes('screenCleanup.patch(require("telegraf").Telegram)'));
  assert.ok(src.includes('screenMenuLabels.add(trigger)'));
});
