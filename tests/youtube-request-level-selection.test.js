const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sel = require('../lib/youtube-admin-selection');
const yt = require('../lib/youtube-requests');
const root = path.resolve(__dirname, '..');

const mk = (id, statuses) => ({ id, items: statuses.map((s, i) => ({ id: `${id}-I${i}`, status: s })) });
const parents = () => [mk('YT-1', ['Pending Review', 'Pending Review']), mk('YT-2', ['Processing']), mk('YT-3', ['Completed']), mk('YT-4', ['Hold', 'Cancelled'])];

test('request-level selection keeps earlier selections when another request is selected', () => {
  const store = {}, key = sel.requestKey('9'), list = parents();
  sel.toggleRequest(store, key, 'YT-1', list);
  const s = sel.toggleRequest(store, key, 'YT-2', list);
  assert.deepEqual([...s].sort(), ['YT-1', 'YT-2']);
  assert.deepEqual([...sel.toggleRequest(store, key, 'YT-1', list)], ['YT-2']);
});

test('finished requests cannot be selected and Select All only takes eligible requests', () => {
  const store = {}, key = sel.requestKey('9'), list = parents();
  assert.equal(sel.toggleRequest(store, key, 'YT-3', list).size, 0);
  assert.deepEqual([...sel.selectAllRequests(store, key, list)].sort(), ['YT-1', 'YT-2', 'YT-4']);
  sel.clear(store, key);
  assert.equal(sel.getRequests(store, key, list).size, 0);
});

test('request-level and email-level selections are independent', () => {
  const store = {}, list = parents(), rkey = sel.requestKey('9');
  sel.toggle(store, '9:YT-1', 'YT-1-I0', list[0].items);
  sel.toggleRequest(store, rkey, 'YT-2', list);
  assert.deepEqual([...sel.get(store, '9:YT-1', list[0].items)], ['YT-1-I0']);
  assert.deepEqual([...sel.getRequests(store, rkey, list)], ['YT-2']);
  sel.clear(store, rkey);
  assert.deepEqual([...sel.get(store, '9:YT-1', list[0].items)], ['YT-1-I0']);
  sel.toggleRequest(store, rkey, 'YT-1', list);
  assert.deepEqual([...sel.get(store, '9:YT-1', list[0].items)], ['YT-1-I0']);
});

test('selection of one admin does not affect another admin', () => {
  const store = {}, list = parents();
  sel.toggleRequest(store, sel.requestKey('1'), 'YT-1', list);
  assert.equal(sel.getRequests(store, sel.requestKey('2'), list).size, 0);
});

test('Invited is no longer a valid status and legacy data migrates to Completed / Cancelled with history kept', () => {
  assert.ok(!yt.ITEM_STATUSES.includes('Invited'));
  assert.ok(!yt.ITEM_STATUSES.includes('Rejected'));
  assert.ok(yt.ITEM_STATUSES.includes('Cancelled'));
  assert.throws(() => yt.updateYoutubeItemStatus({ status: 'Pending Review' }, 'Invited', 'a'), /Invalid status/);
  const req = [{ id: 'YT-9', status: 'Invited', items: [
    { id: 'a', email: 'a@x.com', status: 'Invited', history: [{ action: 'STATUS', status: 'Invited' }] },
    { id: 'b', email: 'b@x.com', status: 'Rejected' }] }];
  yt.migrateYoutubeRequests(req);
  assert.equal(req[0].items[0].status, 'Completed');
  assert.equal(req[0].items[1].status, 'Cancelled');
  assert.equal(req[0].status, 'Completed');
  assert.equal(req[0].items[0].history[0].status, 'Invited');
  assert.equal(req[0].items[0].history.at(-1).action, 'STATUS_MIGRATION');
  const again = JSON.stringify(req); yt.migrateYoutubeRequests(req);
  assert.equal(JSON.stringify(req), again, 'migration must be idempotent');
});

test('All Requests screen exposes request-level controls, counts and no Invited button', () => {
  const src = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  for (const needle of ['ytadm:rsel:', 'ytadm:rall', 'ytadm:rclr', 'ytadm:rask:', 'ytadm:rdo:', 'TOTAL REQUESTS', 'ON HOLD', 'CLEAR SELECTION', 'COMPLETE SELECTED', 'COMPLETE ALL'])
    assert.ok(src.includes(needle), needle);
  assert.ok(!/INVITED/.test(src));
  assert.ok(!src.includes("['Invited','invited']"));
});

test('selection lists are compact: address + side mark only, normal colour when unselected, green when selected', () => {
  const src = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  for (const marker of ['data="ytadm:sel:', 'data="ytadm:rsel:']) {
    const at = src.indexOf(marker);
    const line = src.slice(Math.max(0, at - 260), at + 140);
    assert.ok(line.includes(`\${chosen?'style="success" ':''}`), 'selected = green only: ' + marker);
    assert.ok(line.includes("chosen?'✓':'☐'"), 'plain mark: ' + marker);
    assert.ok(!/style="primary"[^>]*data="ytadm:r?sel:/.test(line), 'no blue select button');
  }
  assert.ok(!src.includes('<th>EMAIL</th><th>STATUS</th><th>SELECT</th><th>ACTION</th>'));
  assert.ok(!src.includes("'secondary'"), 'secondary is not a valid Telegram button style');
  assert.ok(src.includes('<td align="center">${mark}</td>'));
});
