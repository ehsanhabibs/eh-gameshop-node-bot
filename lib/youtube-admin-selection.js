'use strict';

// Two independent selection scopes share one persisted store:
//   email-item level  -> key "<adminId>:<requestId>"          (items inside one request)
//   request level     -> key "<adminId>:__requests__"         (requests on the All Requests screen)
// They use different keys, so changing one never touches the other.

function eligible(item) {
  return !['Completed', 'Cancelled', 'Rejected'].includes(String(item?.status || ''));
}
function requestEligible(parent) {
  return (parent?.items || []).some(eligible);
}
function readSet(store, key, validIds) {
  if (!store || typeof store !== 'object') return new Set();
  const saved = Array.isArray(store[key]) ? store[key].map(String) : [];
  const clean = [...new Set(saved.filter(id => validIds.has(id)))];
  if (clean.length) store[key] = clean;
  else delete store[key];
  return new Set(clean);
}
function writeSet(store, key, set) {
  if (set.size) store[key] = [...set]; else delete store[key];
  return set;
}

// ---- email-item level ----
function get(store, key, items = []) {
  return readSet(store, key, new Set((items || []).filter(eligible).map(x => String(x.id))));
}
function toggle(store, key, itemId, items = []) {
  const selected = get(store, key, items);
  const item = (items || []).find(x => String(x.id) === String(itemId));
  if (!item || !eligible(item)) return selected;
  const id = String(itemId);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  return writeSet(store, key, selected);
}
function selectAll(store, key, items = []) {
  const ids = (items || []).filter(eligible).map(x => String(x.id));
  return writeSet(store, key, new Set(ids));
}
function clear(store, key) {
  if (store && typeof store === 'object') delete store[key];
  return new Set();
}

// ---- request level ----
function requestKey(adminId) {
  return `${adminId}:__requests__`;
}
function getRequests(store, key, parents = []) {
  return readSet(store, key, new Set((parents || []).filter(requestEligible).map(x => String(x.id))));
}
function toggleRequest(store, key, requestId, parents = []) {
  const selected = getRequests(store, key, parents);
  const parent = (parents || []).find(x => String(x.id) === String(requestId));
  if (!parent || !requestEligible(parent)) return selected;
  const id = String(requestId);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  return writeSet(store, key, selected);
}
function selectAllRequests(store, key, parents = []) {
  const ids = (parents || []).filter(requestEligible).map(x => String(x.id));
  return writeSet(store, key, new Set(ids));
}

module.exports = { eligible, requestEligible, get, toggle, selectAll, clear, requestKey, getRequests, toggleRequest, selectAllRequests };
