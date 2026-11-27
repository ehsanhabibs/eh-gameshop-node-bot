const test = require('node:test');
const assert = require('node:assert/strict');
const selection = require('../lib/youtube-admin-selection');

test('multiple YouTube items remain selected independently in persistent store', () => {
  const store = {};
  const items = [{id:'a',status:'Pending Review'},{id:'b',status:'Processing'},{id:'c',status:'Completed'},{id:'d',status:'Rejected'}];
  selection.toggle(store, 'admin:req', 'a', items);
  selection.toggle(store, 'admin:req', 'b', items);
  assert.deepEqual([...selection.get(store, 'admin:req', items)].sort(), ['a','b']);
  const reloaded = JSON.parse(JSON.stringify(store));
  assert.deepEqual([...selection.get(reloaded, 'admin:req', items)].sort(), ['a','b']);
});

test('Select All includes only unfinished items and Clear removes all selections', () => {
  const store = {};
  const items = [{id:'a',status:'Pending Review'},{id:'b',status:'Processing'},{id:'c',status:'Completed'},{id:'d',status:'Rejected'}];
  assert.deepEqual([...selection.selectAll(store, 'admin:req', items)].sort(), ['a','b']);
  assert.deepEqual([...selection.get(store, 'admin:req', items)].sort(), ['a','b']);
  selection.clear(store, 'admin:req');
  assert.deepEqual([...selection.get(store, 'admin:req', items)], []);
});

test('selection automatically drops items that become Completed or Rejected', () => {
  const store = {'admin:req':['a','b','c']};
  const items = [{id:'a',status:'Completed'},{id:'b',status:'Rejected'},{id:'c',status:'Hold'}];
  assert.deepEqual([...selection.get(store, 'admin:req', items)], ['c']);
  assert.deepEqual(store['admin:req'], ['c']);
});
