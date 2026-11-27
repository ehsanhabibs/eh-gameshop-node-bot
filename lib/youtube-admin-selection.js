'use strict';

function eligible(item) {
  return !['Completed', 'Rejected'].includes(String(item?.status || ''));
}
function get(store, key, items = []) {
  if (!store || typeof store !== 'object') return new Set();
  const valid = new Set((items || []).filter(eligible).map(x => String(x.id)));
  const saved = Array.isArray(store[key]) ? store[key].map(String) : [];
  const clean = [...new Set(saved.filter(id => valid.has(id)))];
  if (clean.length) store[key] = clean;
  else delete store[key];
  return new Set(clean);
}
function toggle(store, key, itemId, items = []) {
  const selected = get(store, key, items);
  const item = (items || []).find(x => String(x.id) === String(itemId));
  if (!item || !eligible(item)) return selected;
  const id = String(itemId);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  if (selected.size) store[key] = [...selected]; else delete store[key];
  return selected;
}
function selectAll(store, key, items = []) {
  const ids = (items || []).filter(eligible).map(x => String(x.id));
  if (ids.length) store[key] = ids; else delete store[key];
  return new Set(ids);
}
function clear(store, key) {
  if (store && typeof store === 'object') delete store[key];
  return new Set();
}
module.exports = { eligible, get, toggle, selectAll, clear };
