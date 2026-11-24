const test = require('node:test');
const assert = require('node:assert/strict');
const yt = require('../lib/youtube-requests');

test('family invite creates separate email items with unique item IDs', () => {
  const items = yt.createYoutubeItems({type:'family',emails:['A@example.com','b@example.com'],idPrefix:'YTTEST',now:'2026-11-05T10:00:00Z'});
  assert.equal(items.length,2); assert.equal(items[0].email,'a@example.com');
  assert.notEqual(items[0].id,items[1].id); assert.equal(items[1].status,'Pending Review');
});
test('family invite rejects duplicate, invalid, and more than ten emails', () => {
  assert.throws(()=>yt.createYoutubeItems({type:'family',emails:['a@b.com','a@b.com']}),/Duplicate/);
  assert.throws(()=>yt.createYoutubeItems({type:'family',emails:['bad']}),/valid email/);
  assert.throws(()=>yt.createYoutubeItems({type:'family',emails:Array.from({length:11},(_,i)=>`a${i}@b.com`)}),/1–10/);
});
test('individual request accepts email and notes but no credential field is created', () => {
  const [item] = yt.createYoutubeItems({type:'individual',email:' Person@Example.com ',notes:'Please invite me',password:'must be ignored'});
  assert.equal(item.email,'person@example.com'); assert.equal(item.notes,'Please invite me');
  assert.equal(Object.hasOwn(item,'password'),false);
});
test('each email item can be replaced once and history retains both addresses', () => {
  const [item] = yt.createYoutubeItems({type:'individual',email:'old@example.com',idPrefix:'REPL'});
  yt.replaceYoutubeItem(item,'new@example.com','Admin approved','123','2026-11-05T11:00:00Z');
  assert.equal(item.email,'new@example.com'); assert.equal(item.replacementCount,1);
  assert.equal(item.history[0].oldEmail,'old@example.com');
  assert.throws(()=>yt.replaceYoutubeItem(item,'again@example.com'),/already been used/);
});
test('item status updates are validated and auditable', () => {
  const [item] = yt.createYoutubeItems({type:'individual',email:'x@example.com'});
  yt.updateYoutubeItemStatus(item,'Invited','admin','2026-11-05T12:00:00Z');
  assert.equal(item.status,'Invited'); assert.equal(item.history[0].by,'admin');
  assert.throws(()=>yt.updateYoutubeItemStatus(item,'Unknown','admin'),/Invalid status/);
});
test('legacy migration converts family emails and strips stored password and OCR content', () => {
  const rows = yt.migrateYoutubeRequests([{id:'OLD',type:'family',payload:{emails:['a@example.com'],password:'secret'},ocrText:'secret',attachment:{file:'x'},status:'Accepted'}]);
  assert.equal(rows[0].items.length,1); assert.equal(rows[0].items[0].status,'Accepted');
  assert.equal(Object.hasOwn(rows[0],'payload'),false); assert.equal(Object.hasOwn(rows[0],'ocrText'),false);
  assert.equal(Object.hasOwn(rows[0],'attachment'),false);
});


test('Hold is a supported YouTube request status and is recorded in history', () => {
  const [item] = yt.createYoutubeItems({type:'individual',email:'hold@example.com'});
  yt.updateYoutubeItemStatus(item,'Hold','admin','2026-11-05T13:00:00Z');
  assert.equal(item.status,'Hold');
  assert.equal(item.history[0].status,'Hold');
});
