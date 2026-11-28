'use strict';

// Same-Screen Preview Cleanup
// ---------------------------
// When a persistent-menu button (or a slash command) opens a screen, the first message the bot sends
// while handling that tap is registered as the "preview" of that logical screen for that chat.
// The next time the SAME logical screen is opened in the same chat, the previously registered preview
// is deleted after the new one has been sent. Nothing else is ever deleted:
//   * other screens have other keys;
//   * only the first message sent by the handler is registered (notifications/extra messages are untouched);
//   * in-place navigation (editMessageText on the same message) never changes the message id, so it is unaffected.
// Registry shape (persisted by the caller): { "<chatId>|<screenKey>": <messageId> }.

const { AsyncLocalStorage } = require('node:async_hooks');

const SEND_METHODS = new Set(['sendMessage', 'sendRichMessage']);
const EXCLUDED_COMMANDS = new Set(['/start', '/cancel', '/help']);
const ALIASES = { '/stock': '📦 STOCK CENTER' };

function keyForText(text, labels) {
  const value = String(text || '').trim();
  if (!value) return null;
  if (value.startsWith('/')) {
    const command = value.split(/\s+/)[0].split('@')[0].toLowerCase();
    if (EXCLUDED_COMMANDS.has(command)) return null;
    return ALIASES[command] || command;
  }
  return labels && labels.has(value) ? value : null;
}

function slot(chatId, key) {
  return `${chatId}|${key}`;
}

// Registers the new preview and returns the previous message id that should now be deleted (or null).
function swapScreen(store, chatId, key, messageId) {
  const k = slot(chatId, key);
  const previous = store[k];
  store[k] = Number(messageId);
  return previous && Number(previous) !== Number(messageId) ? Number(previous) : null;
}

function forgetMessage(store, chatId, messageId) {
  for (const k of Object.keys(store)) {
    if (k.startsWith(`${chatId}|`) && Number(store[k]) === Number(messageId)) delete store[k];
  }
}

function createScreenCleanup({ store, saveData = () => {}, labels = new Set(), onDeleted = () => {}, logger = console } = {}) {
  const als = new AsyncLocalStorage();
  const getStore = typeof store === 'function' ? store : () => store;

  function middleware(ctx, next) {
    const isPrivate = ctx.chat?.type === 'private';
    const key = isPrivate ? keyForText(ctx.message?.text, labels) : null;
    if (!key) return next();
    return als.run({ chatId: ctx.chat.id, key, done: false }, next);
  }

  function patch(TelegramClass) {
    const proto = TelegramClass?.prototype;
    if (!proto || typeof proto.callApi !== 'function') {
      logger.warn?.('Same-Screen Preview Cleanup is disabled: Telegram.prototype.callApi was not found.');
      return false;
    }
    if (proto.__screenCleanupPatched) return true;
    const original = proto.callApi;
    proto.callApi = async function patchedCallApi(method, payload, ...rest) {
      const result = await original.call(this, method, payload, ...rest);
      if (SEND_METHODS.has(method)) {
        const scope = als.getStore();
        if (scope && !scope.done && String(payload?.chat_id) === String(scope.chatId) && result?.message_id) {
          scope.done = true;
          try {
            const previous = swapScreen(getStore(), scope.chatId, scope.key, result.message_id);
            saveData();
            if (previous) {
              try {
                await original.call(this, 'deleteMessage', { chat_id: scope.chatId, message_id: previous });
              } catch (error) {
                // Already deleted by the user or older than Telegram allows: nothing else to do.
                logger.warn?.(`Same-screen cleanup could not delete ${scope.chatId}:${previous}: ${error.message}`);
              }
              onDeleted(scope.chatId, previous);
            }
          } catch (error) {
            logger.error?.('Same-screen cleanup bookkeeping failed:', error.message);
          }
        }
      }
      return result;
    };
    proto.__screenCleanupPatched = true;
    return true;
  }

  return { middleware, patch, labels };
}

module.exports = { keyForText, swapScreen, forgetMessage, createScreenCleanup, SEND_METHODS, ALIASES };
