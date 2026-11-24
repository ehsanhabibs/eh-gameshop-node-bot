'use strict';

const { editableFailure } = require('./telegram-message-sync');

function isNotModified(error) {
  const message = String(error?.description || error?.message || '').toLowerCase();
  return message.includes('message is not modified');
}

/**
 * Prefer editing the current Rich Message. Only send a replacement when
 * Telegram explicitly says the old message cannot be edited. Transient
 * failures must not create duplicate screens.
 */
async function editRichMessageOrSend({
  telegram,
  chatId,
  messageId,
  html,
  fallbackText,
  fallbackMarkup,
  reply,
  logger = console
}) {
  if (!telegram?.callApi) throw new TypeError('Telegram callApi is required');
  if (chatId === undefined || chatId === null) throw new TypeError('Telegram chatId is required');

  const sendArgs = {
    chat_id: Number(chatId),
    rich_message: { html: String(html || '') }
  };

  if (messageId !== undefined && messageId !== null) {
    try {
      return await telegram.callApi('editMessageText', {
        ...sendArgs,
        message_id: Number(messageId)
      });
    } catch (error) {
      if (isNotModified(error)) {
        return { chat: { id: Number(chatId) }, message_id: Number(messageId), notModified: true };
      }
      if (!editableFailure(error)) throw error;
      logger.error?.('Rich Message is not editable; sending a replacement screen:', error.message || error);
    }
  }

  try {
    return await telegram.callApi('sendRichMessage', sendArgs);
  } catch (error) {
    if (typeof reply === 'function' && fallbackText) {
      logger.error?.('Rich Message replacement failed; using the basic Telegram fallback:', error.message || error);
      return reply(fallbackText, fallbackMarkup);
    }
    throw error;
  }
}

module.exports = { isNotModified, editRichMessageOrSend };
