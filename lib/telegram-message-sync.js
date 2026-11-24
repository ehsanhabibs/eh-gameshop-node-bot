'use strict';

function editableFailure(error) {
  const message = String(error?.description || error?.message || '').toLowerCase();
  return [
    'message to edit not found',
    'message can\'t be edited',
    'message is not editable',
    'message_id_invalid',
    'chat not found',
    'there is no text in the message to edit',
    'message to edit is not found'
  ].some(fragment => message.includes(fragment));
}

function editArguments(ref, rendered) {
  const args = { chat_id: Number(ref.chatId), message_id: Number(ref.messageId) };
  if (rendered?.rich) args.rich_message = rendered.rich_message;
  else args.text = String(rendered?.text || '');
  return { ...args, ...(rendered?.options || {}) };
}

async function syncTrackedMessages({ targets = [], render, telegram, sendFallback, save = async () => {} }) {
  const refs = [];
  const seen = new Set();
  for (const owner of targets) {
    for (const ref of owner?.telegramMessages || []) {
      if (!ref?.chatId || !ref?.messageId) continue;
      const key = `${ref.chatId}:${ref.messageId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ owner, ref });
    }
  }

  const result = { total: refs.length, edited: 0, replaced: 0, failed: 0, skipped: 0 };
  for (const { owner, ref } of refs) {
    let rendered;
    try {
      rendered = await render(owner, ref);
      await telegram.callApi('editMessageText', editArguments(ref, rendered));
      result.edited++;
    } catch (error) {
      const message = String(error?.description || error?.message || '').toLowerCase();
      if (message.includes('message is not modified')) {
        result.edited++;
        continue;
      }
      if (!editableFailure(error)) {
        result.failed++;
        continue;
      }
      try {
        if (typeof sendFallback !== 'function') throw error;
        const sent = await sendFallback(ref, rendered);
        if (!sent?.message_id || !sent?.chat?.id) throw new Error('Fallback send did not return a Telegram message reference');
        owner.telegramMessages = (owner.telegramMessages || []).filter(x => !(String(x.chatId) === String(ref.chatId) && Number(x.messageId) === Number(ref.messageId)));
        owner.telegramMessages.push({ ...ref, chatId: String(sent.chat.id), messageId: Number(sent.message_id), kind: ref.kind || 'status', sentAt: new Date().toISOString(), replaces: `${ref.chatId}:${ref.messageId}` });
        result.replaced++;
      } catch (_) {
        result.failed++;
      }
    }
  }
  if (result.replaced) await save();
  return result;
}

module.exports = { editableFailure, editArguments, syncTrackedMessages };
