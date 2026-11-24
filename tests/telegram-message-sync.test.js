'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { editArguments, syncTrackedMessages, editableFailure } = require('../lib/telegram-message-sync');

test('Rich Message updates use editMessageText with rich_message and preserve chat/message IDs', () => {
  assert.deepEqual(editArguments({chatId:'123',messageId:9},{rich:true,rich_message:{html:'<b>Updated</b>'}}),{chat_id:123,message_id:9,rich_message:{html:'<b>Updated</b>'}});
});

test('Tracked order message refs are edited once even when the same ref is on multiple owners', async () => {
  const calls=[];const ref={chatId:'123',messageId:9,kind:'delivery'};const a={telegramMessages:[ref]},b={telegramMessages:[ref]};
  const out=await syncTrackedMessages({targets:[a,b],render:async()=>({rich:true,rich_message:{html:'<b>New status</b>'}}),telegram:{callApi:async(method,args)=>calls.push({method,args})}});
  assert.deepEqual(out,{total:1,edited:1,replaced:0,failed:0,skipped:0});assert.equal(calls.length,1);assert.equal(calls[0].method,'editMessageText');
});

test('Uneditable old messages get a replacement and the stored reference is moved to the new message', async () => {
  const owner={telegramMessages:[{chatId:'123',messageId:9,kind:'order_status'}]};
  const out=await syncTrackedMessages({targets:[owner],render:async()=>({text:'Updated'}),telegram:{callApi:async()=>{throw new Error("Bad Request: message to edit not found")}},sendFallback:async()=>({chat:{id:123},message_id:10})});
  assert.deepEqual(out,{total:1,edited:0,replaced:1,failed:0,skipped:0});assert.deepEqual(owner.telegramMessages,[{chatId:'123',messageId:10,kind:'order_status',sentAt:owner.telegramMessages[0].sentAt,replaces:'123:9'}]);
});

test('Transient Telegram failures do not trigger duplicate fallback messages', async () => {
  let fallback=0;const owner={telegramMessages:[{chatId:'123',messageId:9}]};
  const out=await syncTrackedMessages({targets:[owner],render:async()=>({text:'Updated'}),telegram:{callApi:async()=>{throw new Error('ETIMEDOUT')}} ,sendFallback:async()=>{fallback++;return {chat:{id:123},message_id:10}}});
  assert.equal(out.failed,1);assert.equal(fallback,0);assert.equal(owner.telegramMessages[0].messageId,9);
});

test('Only known uneditable-message errors trigger fallback',()=>{
  assert.equal(editableFailure(new Error("Bad Request: message can't be edited")),true);
  assert.equal(editableFailure(new Error('ETIMEDOUT')),false);
});


test('Order payment and status routes use the shared tracked-message synchronizer',()=>{
 const fs=require('node:fs');const path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8');
 assert.match(source,/async function syncOrderTelegramMessages\(order\)/);
 assert.match(source,/await notifyAdminPaymentReview\(order\)/);
 assert.match(source,/await syncOrderTelegramMessages\(o\)/);
 assert.match(source,/kind:'admin_payment_review'/);
 assert.match(source,/kind:'order_status'/);
});

test('Reseller profile, credit toggle and due clearance messages use tracked in-place updates',()=>{
 const fs=require('node:fs');const path=require('node:path');const index=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8');const reseller=fs.readFileSync(path.join(__dirname,'..','reseller-system.js'),'utf8');
 assert.match(reseller,/async function updateResellerGreeting\(id,r\)/);
 assert.match(reseller,/await updateResellerGreeting\(id,r\)/);
 assert.match(reseller,/async function updateDueRequestMessages\(r\)/);
 assert.match(reseller,/await updateDueRequestMessages\(r\)/);
 assert.match(index,/async function syncDueClearanceMessages\(request\)/);
 assert.match(index,/await syncDueClearanceMessages\(r\)/);
});

test('Legacy Admin payment and due-clearance callback messages are captured before their first edit',()=>{
 const fs=require('node:fs');const path=require('node:path');const index=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8');const reseller=fs.readFileSync(path.join(__dirname,'..','reseller-system.js'),'utf8');
 assert.match(index,/kind:'admin_payment_review'\}\);if\(order\.paymentStatus/);
 assert.match(reseller,/kind:'admin_due_review'\}\);if\(r\.status/);
});

test('Telegram reseller checkout stores its confirmation message reference for future edits',()=>{
 const fs=require('node:fs');const path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'..','reseller-system.js'),'utf8');
 assert.match(source,/domain\.trackTelegramMessage\(out\.order,\{chatId:sent\.chat\.id,messageId:sent\.message_id,kind:'order_status'\}\)/);
});
