const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const reseller = fs.readFileSync(path.join(root, 'reseller-system.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'Public', 'portal.html'), 'utf8');

function extract(name) {
  const start = index.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0, i = index.indexOf('{', start);
  for (let j = i; j < index.length; j++) {
    if (index[j] === '{') depth++;
    else if (index[j] === '}' && --depth === 0) return index.slice(start, j + 1);
  }
  throw new Error('unbalanced ' + name);
}

test('View Stock account row is a fixed 2-row x 2-column table with values only (no field labels)', () => {
  const start = index.indexOf('const acctEmail=stockTrunc');
  const block = index.slice(start, start + 1400);
  assert.match(block, /<table compact><tr><td><b>\$\{esc\(acctEmail\)\}<\/b>.*<td align="right">\$\{status\}<\/td><\/tr><tr><td><code>\$\{esc\(acctPassword\)\}<\/code>.*<td align="right"><b>\$\{esc\(expiry\)\}<\/b><\/td><\/tr><\/table>/s);
  const summary = block.slice(0, block.indexOf('const copyRow'));
  for (const label of ['>EMAIL<', '>PASSWORD<', '>ACCOUNT STATUS<', '>EXPIRY DATE<']) assert.ok(!summary.includes(label), label);
});

test('long email is truncated for display so it cannot push the right column, while copy keeps the full value', () => {
  const stockTrunc = new Function(`${extract('stockTrunc')}; return stockTrunc;`)();
  const long = 'a.very.long.email.address.for.testing.alignment@example-domain.com';
  assert.ok(stockTrunc(long, 26).length <= 26);
  assert.ok(stockTrunc(long, 26).endsWith('…'));
  assert.equal(stockTrunc('short@x.com', 26), 'short@x.com');
  assert.ok(index.includes('<tg-button type="copy_text" text="${esc(v)}">📋</tg-button>'));
  assert.ok(index.includes('📋 COPY EMAIL') && index.includes('📋 COPY PASSWORD'));
});

test('account status appearance: ACTIVE clickable no-op, SOLD green disabled, EXPIRED red', () => {
  assert.ok(index.includes('style="success" data="stock_account_status_noop">ACTIVE'));
  assert.ok(index.includes("bot.action('stock_account_status_noop'"));
  assert.ok(index.includes('<tg-button type="disabled" style="success">✓ SOLD</tg-button>'));
  assert.ok(index.includes('<tg-button type="disabled" style="danger">EXPIRED</tg-button>'));
  assert.ok(!index.includes('style="disabled"'));
});

test('Mini App stock deletion uses an inline pasteable confirmation instead of browser prompt/confirm', () => {
  assert.ok(portal.includes('id="stockDeleteInput"'));
  assert.ok(portal.includes('id="copyStockDeletePhrase"'));
  const handler = portal.slice(portal.indexOf("$('deleteStockAccount').onclick"), portal.indexOf("$('deleteStockAccount').onclick") + 700);
  assert.ok(!/prompt\(|confirm\(/.test(handler));
  assert.ok(index.includes("app.delete('/api/admin/stocks/:id'"));
  assert.ok(!/is not archived/.test(index));
});

test('reseller directory: navigation is blue, back is link, profile heading has the person icon', () => {
  assert.ok(reseller.includes('style="primary" data="rs:listpage:${page-1}">PREVIOUS'));
  assert.ok(reseller.includes('style="primary" data="rs:listpage:${page+1}">NEXT'));
  assert.ok(reseller.includes('style="link" data="rs:listpage:${page}">← BACK TO DIRECTORY'));
  assert.ok(reseller.includes('<caption>👤 RESELLER INFORMATION</caption>'));
  assert.match(reseller, /styledCallback = \(text, callback_data, style\) => \(\{ text, callback_data, \.\.\.\(style \? \{ style \} : \{\}\) \}\)/);
  assert.match(index, /styledCallback = \(text, callback_data, style\) => \(\{ text, callback_data, \.\.\.\(style \? \{ style \} : \{\}\) \}\)/);
});

test('expiry reminder jobs cannot overlap and each keeps its per-day de-duplication key', () => {
  assert.ok(index.includes('if (expiryChecksRunning) return;'));
  assert.ok(index.includes('if(reminderAccountChecksRunning)return;'));
  assert.ok(index.includes('domain.markExpiryReminderSent(stock, due.key)'));
  assert.ok(index.includes('a.reminderSent?.[key]'));
});

test('/emojiid helper exists and the app does not claim custom emoji keyboard icons', () => {
  assert.ok(index.includes("bot.command('emojiid'"));
  assert.ok(!index.includes('icon_custom_emoji_id'));
});

test('Reseller Management menu uses function-based colours: add = green, lists/assign/rates = blue', () => {
  assert.ok(reseller.includes("styledCallback('➕ Add Reseller', 'rs:add', 'success')"));
  assert.ok(reseller.includes("styledCallback('🆔 Add by Telegram UID', 'rs:adduid', 'success')"));
  for (const cb of ['rs:list', 'rs:assign', 'rs:special']) assert.ok(new RegExp(`'${cb}', 'primary'\\)`).test(reseller), cb);
  assert.ok(index.includes('styledCallback("➕ Add Stock", "stock_add", "success")'));
});
