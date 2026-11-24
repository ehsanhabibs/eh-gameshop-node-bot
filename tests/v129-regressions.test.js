'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.js'),'utf8');
const reseller=fs.readFileSync(path.join(root,'reseller-system.js'),'utf8');
const portal=fs.readFileSync(path.join(root,'Public','portal.html'),'utf8');
const domain=require('../lib/domain');

test('Reseller bottom Home Menu has direct actions and keeps one Rich Message updated in-place',()=>{
  for(const label of ['🛒 Order Now','📦 My Orders','📊 Purchase Report','💳 Account Statement','🆘 Support'])assert.ok(reseller.includes(`bot.hears('${label}'`),`missing ${label} handler`);
  assert.match(reseller,/bot\.__ehResellerHomeMessageRefs\s*\|\|=\s*new Map\(\)/);
  assert.match(reseller,/homeMessageRefs\.get\(key\)/);
  assert.match(reseller,/editMessageText.*homeMessageRefs\.set/s);
  assert.match(index,/bot\.__ehResellerHomeMessageRefs\?\.set\(String\(ctx\.from\.id\)/);
});

test('Stock table status controls are display-only and profile rows distinguish AVAILABLE, SOLD and EXPIRED',()=>{
  assert.match(index,/<th>STOCK ID<\/th><th>EMAIL \/ PASSWORD<\/th><th>EXPIRY<\/th><th>STATUS<\/th>/);
  assert.match(index,/type="disabled" style="success">● AVAILABLE/);
  assert.match(index,/<b>🟩 SOLD<\/b>/);
  assert.match(index,/type="disabled" style="danger">EXPIRED/);
  assert.doesNotMatch(index,/type="callback_data"[^>]*>● AVAILABLE/);
});

test('Expired profile can only be freed by explicit Admin reactivation and retains history',()=>{
  assert.match(index,/bot\.action\(\/\^stock_profile_reactivate:/);
  assert.match(index,/REACTIVATE SLOT/);
  assert.equal(typeof domain.reactivateExpiredProfile,'function');
  const stock={id:'STK-TEST',product:'Prime',originalExpiry:'2099-12-31',profiles:[{id:'P1',profile:'Profile 1',active:true,customerId:'11111',customerName:'Old',customerExpiry:'2000-01-01',assignedOrderItemId:'EH-OLD'}]};
  const p=domain.reactivateExpiredProfile(stock,'P1',{by:'admin-test',now:'2026-11-22T00:00:00.000Z'});
  assert.equal(p.customerId,null);assert.equal(p.status,'Available');assert.equal(p.history[0].customerId,'11111');
});

test('Mini App displays expired profiles in red with DD/MM/YYYY expiry and active profiles in green',()=>{
  assert.match(portal,/\.status-badge\.rejected,\.status-badge\.inactive,\.status-badge\.expired/);
  assert.match(portal,/function displayDhakaDate\(/);
  assert.match(portal,/status-badge expired/);
  assert.match(portal,/status-badge active/);
  assert.match(portal,/customerProfileStatusHtml\(p\)/);
});
