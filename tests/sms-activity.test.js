'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sms = require('../lib/sms-activity');

const sample = (overrides={}) => ({
  from:'bKash', text:'You have received Tk 45.00 from 01712345678. TrxID ABCD123456. Thank you.',
  sentStamp:'2026-11-09T10:00:00+06:00', receivedStamp:'2026-11-09T10:00:01+06:00', sim:'SIM 1', ...overrides
});

test('SMS Activity parser extracts bKash source, received amount, TrxID and payer number',()=>{
 const p=sms.parseBkashSms(sample());assert.equal(p.sourceMatch,true);assert.equal(p.received,true);assert.equal(p.amountMinor,4500);assert.equal(p.transactionId,'ABCD123456');assert.equal(p.payerPhone,'01712345678');
});

test('SMS Activity ignores a non-bKash source unless a sender filter is configured',()=>{
 assert.equal(sms.classifySms({smsActivityEvents:[]},sample({from:'01700000000'})).action,'ignored_source');
 assert.equal(sms.parseBkashSms(sample({from:'01700000000'}),{sender:'01700000000'}).sourceMatch,true);
});

test('SMS Activity auto-match requires one pending bKash order and exact amount',()=>{
 const data={smsActivityEvents:[],orders:[{id:'EH-001',paymentMethod:'bKash',transactionId:'ABCD123456',paymentStatus:'Pending Verification',price:45}],dueClearanceRequests:[]};
 const out=sms.classifySms(data,sample());assert.equal(out.action,'auto_verify');assert.equal(out.targetType,'customer_order');assert.equal(out.targetId,'EH-001');
});

test('SMS Activity auto-match supports reseller due clearance separately',()=>{
 const data={smsActivityEvents:[],orders:[],dueClearanceRequests:[{id:'DCR-1',paymentMethod:'bKash',transactionId:'ABCD123456',status:'Pending',amount:45}]};
 const out=sms.classifySms(data,sample());assert.equal(out.action,'auto_verify');assert.equal(out.targetType,'reseller_due');
});

test('SMS Activity sends unknown, outgoing, ambiguous, or amount-mismatched SMS to manual review',()=>{
 const data={smsActivityEvents:[],orders:[{id:'EH-001',paymentMethod:'bKash',transactionId:'ABCD123456',paymentStatus:'Pending Verification',price:50}],dueClearanceRequests:[]};
 assert.equal(sms.classifySms(data,sample()).action,'manual_review');
 assert.equal(sms.classifySms(data,sample({text:'Send Money Tk 45.00 to 01712345678. TrxID ABCD123456'})).action,'manual_review');
 assert.equal(sms.classifySms({smsActivityEvents:[],orders:[],dueClearanceRequests:[]},sample()).action,'manual_review');
});

test('SMS Activity detects repeated payload and previously verified transaction IDs',()=>{
 const payload=sample(),fingerprint=sms.smsFingerprint(payload);
 assert.equal(sms.classifySms({smsActivityEvents:[{fingerprint}]},payload).action,'duplicate_payload');
 assert.equal(sms.classifySms({smsActivityEvents:[{transactionId:'ABCD123456',status:'Auto Verified'}],orders:[],dueClearanceRequests:[]},payload).action,'duplicate_transaction');
});

test('SMS Activity manual review queue and webhook authorization are wired in the server',()=>{
 const fs=require('node:fs');const path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8');
 assert.match(source,/app\.post\('\/webhook\/sms-activity'/);
 assert.match(source,/function webhookTokenMatches\(req\)/);
 assert.match(source,/crypto\.timingSafeEqual\(a,b\)/);
 assert.match(source,/app\.get\('\/api\/admin\/sms-activity\/events'/);
 assert.match(source,/app\.post\('\/api\/admin\/sms-activity\/events\/:id\/resolve'/);
});
