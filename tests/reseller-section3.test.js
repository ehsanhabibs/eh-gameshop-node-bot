'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const domain=require('../lib/domain');

test('reseller multi-product cart creates parent and item IDs with one ledger debit and 30-minute SLA',()=>{
 const data={nextOrderId:12,resellers:{'12345':{id:'12345',active:true,creditAuthorized:true}},orders:[],ledger:[]};
 const order=domain.createResellerCartOrder(data,{resellerId:'12345',customerId:'67890',customerName:'Test Customer',lines:[{product:'Amazon Prime',quantity:2,priceEach:80,packageName:'1 Month',durationDays:30},{product:'VPN',quantity:1,priceEach:10,packageName:'7 Days',durationDays:7}]});
 assert.match(order.id,/^EH-[0-9]{2}[A-Z]{3}[0-9]$/);assert.equal(order.items.length,3);assert.equal(new Set(order.items.map(x=>x.id)).size,3);assert.equal(order.price,170);assert.equal(data.ledger.length,1);assert.equal(data.ledger[0].debit,170);assert.equal(order.slaMinutes,30);assert.ok(new Date(order.deliveryDueAt).getTime()-new Date(order.createdAt).getTime()>=29*60*1000);
});

test('reseller multi-product cart blocks credit unless Admin authorized',()=>{
 const data={nextOrderId:1,resellers:{'12345':{id:'12345',active:true}},orders:[],ledger:[]};
 assert.throws(()=>domain.createResellerCartOrder(data,{resellerId:'12345',lines:[{product:'VPN',quantity:1,priceEach:10}]}),/not authorized/);
 assert.equal(data.orders.length,0);assert.equal(data.ledger.length,0);
});

test('reseller multi-product cart rejects invalid quantities and excessive total item count',()=>{
 const data={nextOrderId:1,resellers:{'12345':{id:'12345',active:true,creditAuthorized:true}},orders:[],ledger:[]};
 assert.throws(()=>domain.createResellerCartOrder(data,{resellerId:'12345',lines:[{product:'VPN',quantity:21,priceEach:10}]}),/Invalid cart/);
 assert.equal(data.orders.length,0);
});

test('retry preparation skips completed items and only prepares undelivered items',()=>{
 const data={};const order={id:'EHG-1',resellerId:'12345',customerId:'67890',items:[{id:'EHG-1-01',product:'VPN',status:'Completed',customerId:'67890'},{id:'EHG-1-02',product:'VPN',status:'Awaiting Stock',customerId:'67890'}]};
 const stock={id:'STK-1',product:'VPN',originalExpiry:'2099-12-31',profiles:[{id:'p1',profile:'Main',active:true}]};
 const prepared=domain.prepareResellerAutoDelivery(data,order,[stock]);
 assert.equal(prepared.length,1);assert.equal(prepared[0].item.id,'EHG-1-02');assert.equal(order.items[0].status,'Completed');
});

test('reseller allocation uses FEFO and preserves requested duration on successful delivery',()=>{
 const order={id:'EHG-2',resellerId:'12345',customerId:'67890',items:[{id:'EHG-2-01',product:'VPN',durationDays:7,status:'Awaiting Stock',customerId:'67890'}]};
 const later={id:'STK-LATE',product:'VPN',originalExpiry:'2099-12-31',profiles:[{id:'late-p1',profile:'Main',active:true}]};
 const sooner={id:'STK-SOON',product:'VPN',originalExpiry:'2027-01-01',profiles:[{id:'soon-p1',profile:'Main',active:true}]};
 const [prepared]=domain.prepareResellerAutoDelivery({},order,[later,sooner]);
 assert.equal(prepared.stock.id,'STK-SOON');
 const expiry=domain.markResellerDeliverySuccess(order,prepared.item,prepared.profile,prepared.stock);
 const expected=new Date(`${domain.todayKey()}T00:00:00+06:00`);expected.setDate(expected.getDate()+7);
 const expectedDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(expected);
 assert.equal(expiry,expectedDay);assert.equal(prepared.item.status,'Completed');
});

test('retry preparation never reprocesses rejected or completed items',()=>{
 const order={id:'EHG-3',resellerId:'12345',customerId:'67890',items:[{id:'EHG-3-01',product:'VPN',status:'Completed'},{id:'EHG-3-02',product:'VPN',status:'Rejected'},{id:'EHG-3-03',product:'VPN',status:'Awaiting Stock'}]};
 const stock={id:'STK-3',product:'VPN',originalExpiry:'2099-12-31',profiles:[{id:'p1',profile:'Main',active:true}]};
 const prepared=domain.prepareResellerAutoDelivery({},order,[stock]);
 assert.deepEqual(prepared.map(x=>x.item.id),['EHG-3-03']);
});


test('reseller stock allocation recognizes an existing available profile even when all profile slots are created',()=>{
 const order={id:'EHG-AVAILABLE',resellerId:'12345',customerId:'99999',customerName:'Wrong External Recipient',items:[{id:'EHG-AVAILABLE-01',product:'Crunchyroll',durationDays:30,status:'Awaiting Stock',customerId:'99999',customerName:'Wrong External Recipient'}]};
 const stock={id:'CR-1',product:'Crunchyroll',originalExpiry:'2099-12-31',status:'Fully Allocated',profiles:[
  {id:'p1',profile:'P1',active:true,customerId:'11111',customerExpiry:'2099-01-01'},
  {id:'p2',profile:'P2',active:true,customerId:'11112',customerExpiry:'2099-01-01'},
  {id:'p3',profile:'P3',active:true,customerId:'11113',customerExpiry:'2099-01-01'},
  {id:'p4',profile:'P4',active:true,customerId:'11114',customerExpiry:'2099-01-01'},
  {id:'p5',profile:'P5',active:true,customerId:null,customerExpiry:null,status:'Available'}
 ]};
 const [prepared]=domain.prepareResellerAutoDelivery({resellers:{'12345':{name:'My Reseller'}}},order,[stock]);
 assert.ok(prepared);
 assert.equal(prepared.profile.id,'p5');
 assert.equal(prepared.recipient,'12345');
 assert.equal(prepared.profile.customerId,'12345');
 assert.equal(prepared.profile.customerName,'My Reseller');
 assert.equal(prepared.item.customerId,'12345');
});

test('reseller cart recipient is always the reseller, never a supplied end-customer UID',()=>{
 const data={resellers:{'12345':{id:'12345',name:'Reseller Name',active:true,creditAuthorized:true}},orders:[],ledger:[]};
 const order=domain.createResellerCartOrder(data,{resellerId:'12345',customerId:'67890',customerName:'End Customer',lines:[{product:'Crunchyroll',quantity:1,priceEach:50,durationDays:30}]});
 assert.equal(order.customerId,'12345');
 assert.equal(order.customerName,'Reseller Name');
 assert.equal(order.items[0].customerId,'12345');
 assert.equal(order.items[0].customerName,'Reseller Name');
});


test('Telegram reseller auto delivery sends the Rich Message to the prepared reseller recipient',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','index.js'),'utf8');
 assert.match(source,/sendPreviewMessage\(recipient,rendered\)/);
 assert.doesNotMatch(source,/sendPreviewMessage\(resellerRecipient,rendered\)/);
 assert.match(source,/const \{item,stock,profile,recipient\}=row/);
});

test('Telegram reseller shop contains four equal-style product choices and YouTube Family quantity/email flow',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','reseller-system.js'),'utf8');
 assert.match(source,/style="primary" data="rs:cat:0">📦 AMAZON PRIME/);
 assert.match(source,/data="rs:cat:1">🍿 CRUNCHYROLL/);
 assert.match(source,/style="danger" data="rs:cat:2">▶️ YOUTUBE PREMIUM/);
 assert.match(source,/style="success" data="rs:cat:3">🛡️ VPN/);
 assert.match(source,/rs:youtube:family/);
 assert.match(source,/rs:youtube:individual/);
 assert.match(source,/ytqty:\(\?:plus\|minus\)/);
 assert.match(source,/f\.quantity=Math\.max\(1,Math\.min\(10/);
 assert.match(source,/youtubeFamilyEmails/);
 assert.match(source,/submitYoutubeRequest/);
});


test('YouTube reseller requests have Telegram Admin review and reseller status history paths',()=>{
 const server=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','index.js'),'utf8');
 const reseller=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','reseller-system.js'),'utf8');
 assert.match(server,/bot\.command\('youtube'/);
 assert.match(server,/ytadm:item:/);
 assert.match(server,/ya:s:/);
 assert.match(server,/notifyYoutubeRequestOwner\(parent\)/);
 assert.match(reseller,/rs:ytrequests/);
 assert.match(reseller,/STATUS TIMELINE/);
});
