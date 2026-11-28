'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const reseller=fs.readFileSync(require('node:path').join(__dirname,'..','reseller-system.js'),'utf8');

test('Add Reseller directory is built from real non-reseller customer purchases',()=>{
 assert.match(reseller,/function purchasedCustomerRows\(\)/);
 assert.match(reseller,/if \(o\.isTest \|\| o\.resellerId \|\| \['Rejected','Cancelled'\]\.includes\(o\.status\)\) continue/);
 assert.match(reseller,/\['Verified','Paid','Completed'\]/);
 assert.match(reseller,/data\.resellers\?\.\[id\]/);
 assert.match(reseller,/ADD RESELLER/);
});

test('Reseller directory uses rich table buttons for live Active and Credit toggles',()=>{
 assert.match(reseller,/function resellerDirectoryHtml\(page=0\)/);
 assert.match(reseller,/data="rs:toggle:/);
 assert.match(reseller,/data="rs:credit:/);
 assert.match(reseller,/active\?'success':'danger'/);
 assert.match(reseller,/credit\?'success':'danger'/);
 assert.match(reseller,/active\?'ACTIVE':'INACTIVE'/);
 assert.match(reseller,/credit\?'CREDIT ON':'CREDIT OFF'/);
 assert.match(reseller,/callApi\('editMessageText'/);
});

test('Reseller Telegram checkout uses Rich Message quantity stepper and explicit confirmation',()=>{
 assert.doesNotMatch(reseller,/step:'customerId'/);
 assert.doesNotMatch(reseller,/type SELF/);
 assert.match(reseller,/Your reseller Telegram account/);
 assert.match(reseller,/rs:qty:minus/);
 assert.match(reseller,/rs:qty:plus/);
 assert.match(reseller,/rs:confirm/);
 assert.match(reseller,/deliveryMode:'Auto'/);
});

test('Reseller pending text flow is cancelled by new menu/actions and commands',()=>{
 assert.match(reseller,/A new menu\/action must never leave an older text prompt trapping the user/);
 assert.match(reseller,/if \(input\.startsWith\('\/'\) \|\| menuLabels\.has\(input\)\) flows\.delete\(id\)/);
});

test('Regular inline keyboards keep their requested Bot API 9.4 style while Rich Message buttons retain native styles',()=>{
 assert.match(reseller,/styledCallback = \(text, callback_data, style\) => \({ text, callback_data, \.\.\.\(style \? { style } : {}\) }\)/);
 assert.match(reseller,/data="duepay:confirm:/);
 assert.match(reseller,/data="duepay:reject:/);
 assert.match(reseller,/style="success"/);
 assert.match(reseller,/style="danger"/);
});


test('Reseller Rich Message menu includes Support while the persistent keyboard remains available',()=>{
 assert.match(reseller,/function resellerMenuHtml\(r\)/);
 for(const action of ['rs:shop','rs:orders','rs:sales','rs:statement'])assert.ok(reseller.includes(`data="${action}"`),`missing ${action}`);
 assert.match(reseller,/data="rs:support"/);
 assert.match(reseller,/if\(action==='support'\)[\s\S]*?editResellerRich\(ctx,'<h2>🛟 RESELLER SUPPORT/);
 assert.match(reseller,/bot\.hears\('🆘 SUPPORT'/);
 assert.doesNotMatch(reseller,/OPEN MINI APP SHOP/);
 assert.match(reseller,/setChatMenuButton\(\{chat_id:Number\(id\),menu_button:\{type:'commands'\}\}\)/);
});

test('Reseller order package preview and quantity changes remain in one Rich Message',()=>{
 assert.match(reseller,/function resellerQuantityHtml\(f,r\)/);
 assert.match(reseller,/rs:qty:plus/);
 assert.match(reseller,/rs:qty:minus/);
 assert.match(reseller,/editResellerRich\(ctx,resellerQuantityHtml/);
 assert.match(reseller,/style="success" data="rs:confirm"/);
});

test('Reseller Network title uses a centered pull quote and no Mini App button',()=>{
 assert.match(reseller,/<aside><b>✨ RESELLER NETWORK ✨<\/b><\/aside>/);
 assert.doesNotMatch(reseller,/OPEN MINI APP/);
});

test('Reseller /start opens the Telegram Rich Message order panel and puts Support on persistent reply keyboard',()=>{
 const server=fs.readFileSync(require('node:path').join(__dirname,'..','index.js'),'utf8');
 const resellerSource=fs.readFileSync(require('node:path').join(__dirname,'..','reseller-system.js'),'utf8');
 const start=server.slice(server.indexOf('bot.start('),server.indexOf("bot.hears('📦 Stock Center'"));
 assert.match(start,/sendRichMessage/);
 assert.match(start,/rs:shop/);
 assert.match(start,/rs:orders/);
 assert.match(start,/rs:sales/);
 assert.match(start,/rs:statement/);
 assert.match(start,/Markup\.keyboard\(\[\[\{text:'🛒 ORDER NOW',style:'success'\},\{text:'📦 MY ORDERS',style:'primary'\}\],\[\{text:'📊 PURCHASE REPORT',style:'success'\},\{text:'💳 ACCOUNT STATEMENT',style:'primary'\}\],\[\{text:'🆘 SUPPORT',style:'danger'\}\]\]\)\.resize\(\)\.persistent\(\)/);
 assert.match(resellerSource,/bot\.hears\('🛒 ORDER NOW'/);
 assert.match(resellerSource,/bot\.hears\('📦 MY ORDERS'/);
 assert.match(resellerSource,/bot\.hears\('📊 PURCHASE REPORT'/);
 assert.match(resellerSource,/bot\.hears\('💳 ACCOUNT STATEMENT'/);
 assert.match(resellerSource,/bot\.hears\('🆘 SUPPORT'/);
 assert.match(start,/rs:support/);
});

test('Reseller quantity preview places green +/- controls around a centered quantity and a separate green confirm row',()=>{
 assert.match(reseller,/<table compact><tr><td align="center"><tg-button type="callback_data" style="success" data="rs:qty:minus">&nbsp;&nbsp;−&nbsp;&nbsp;/);
 assert.match(reseller,/<tg-button type="disabled">QTY: \$\{qty\}<\/tg-button>/);
 assert.match(reseller,/<tg-button type="callback_data" style="success" data="rs:qty:plus">&nbsp;&nbsp;＋&nbsp;&nbsp;/);
 assert.match(reseller,/<tg-button-row><tg-button type="callback_data" style="success" data="rs:confirm">/);
});

test('Reseller due clearance uses three selectable payment method buttons',()=>{
 assert.match(reseller,/rs:paymethod:bkash/);
 assert.match(reseller,/rs:paymethod:nagad/);
 assert.match(reseller,/rs:paymethod:rocket/);
 assert.match(reseller,/bot\.action\(\/\^rs:paymethod:/);
});
