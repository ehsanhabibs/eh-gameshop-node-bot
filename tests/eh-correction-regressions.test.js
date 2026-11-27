'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.js'),'utf8');
const reseller=fs.readFileSync(path.join(root,'reseller-system.js'),'utf8');
const portal=fs.readFileSync(path.join(root,'Public','portal.html'),'utf8');

test('Expiry Reminder menu has an Admin callback and persisted pause/resume control',()=>{
 assert.match(index,/bot\.action\("reminder_menu"/);
 assert.match(index,/bot\.action\("reminder_toggle_repeat"/);
 assert.match(index,/expiredRepeatReminderEnabled: true/);
 assert.match(index,/expiredRepeatReminderEnabled = !data\.settings\.expiredRepeatReminderEnabled/);
 assert.match(index,/30 \* 60 \* 1000/);
 assert.match(index,/ACCOUNT EXPIRED · RENEWAL REQUIRED/);
 assert.match(index,/STOP ALERTS/);
});

test('Due Clearance Payment Method callbacks are preserved by the reseller flow middleware',()=>{
 assert.ok(reseller.includes('paymethod:(?:bkash|nagad|rocket)'));
 assert.match(reseller,/bot\.action\(\/\^rs:paymethod:/);
});

test('Main Delivery Template selector supports original, existing new, and reference-based layouts',()=>{
 for(const key of ['customer_delivery_reference','reseller_delivery_reference'])assert.ok(index.includes(key));
 assert.match(index,/main-delivery-template/);
 assert.match(index,/selectedDeliveryTemplate/);
 assert.match(index,/order\.deliveryTemplateKey=order\.deliveryTemplateKey\|\|selectedDeliveryTemplate\('reseller'\)/);
 assert.match(index,/order\.deliveryTemplateKey\|\|\(order\.resellerId\?'reseller_delivery':'customer_delivery'\)/);
 assert.match(portal,/Set as Main Delivery Preview/);
 assert.match(index,/deliveryTemplateValues/);
});

test('Reference-based delivery uses native collapsible details, bordered account table, order row and live update',()=>{
 assert.match(index,/<details><summary>⌄ 🔐 Tap to view account details<\/summary>/);
 assert.match(index,/<table bordered compact><tr><th>ACCOUNT INFORMATION/);
 assert.match(index,/📦 <b>Order Number: {{orderNumber}}<\/b>/);
 assert.match(index,/ORDER HISTORY<\/b><\/td><td align=\"right\"><tg-button type=\"callback_data\" style=\"success\" data=\"delivery_live/);
 assert.ok(index.includes('│'));
 assert.match(index,/style="success" data="delivery_live:{{orderId}}:{{itemId}}"/);
 assert.match(index,/function orderHistoryTableHtml/);
});

test('Telegram stock profile expansion uses native details and separates profile, customer, PIN, expiry and status',()=>{
 const block=index.slice(index.indexOf('function stockCompactPreviewHtml'),index.indexOf('async function editStockRichScreen'));
 assert.match(block,/<details><summary>⌄ PROFILES ·/);
 for(const label of ['👤 CUSTOMER','🔐 PIN','📅 EXPIRY DATE','📌 STATUS'])assert.ok(block.includes(label));
});

test('Mini App has a large circular order loader with five stages and a minimum 5 second display',()=>{
 assert.match(portal,/\.order-loader-ring/);
 assert.match(portal,/async function runOrderLoading/);
 assert.match(portal,/Checking selected plan/);
 assert.match(portal,/Verifying order details/);
 assert.match(portal,/Preparing payment request/);
 assert.match(portal,/Order Request Ready/);
 assert.match(portal,/deliveryStages/);
 assert.match(portal,/mode:'delivery'/);
 assert.match(portal,/5000-\(Date\.now\(\)-started\)/);
});

test('Mini App uses DD MMM YYYY and 12-hour Dhaka date-time formatting',()=>{
 assert.match(portal,/month:'short',year:'numeric'/);
 assert.match(portal,/hour12:true/);
 assert.match(index,/month:"short", year:"numeric"/);
});

test('Reseller ordering is view-only in the Mini App',()=>{
 assert.match(portal,/Reseller ordering is not available in the Mini App/);
 assert.match(index,/if\(u\.role==='reseller'\)return res\.status\(403\)/);
});

test('Persistent Telegram keyboards use native semantic button styles and uppercase labels',()=>{
 assert.match(index,/text:'🌐 OPEN EH GAMESHOP',style:'primary'/);
 assert.match(index,/text:'📦 STOCK CENTER',style:'primary'/);
 assert.match(index,/text:'🛠 SUPPORT INBOX',style:'danger'/);
 assert.match(reseller,/text:'🛒 ORDER NOW',style:'success'/);
 assert.match(reseller,/text:'🆘 SUPPORT',style:'danger'/);
});

test('Mini App Order Search replaces one preview in-place below the results',()=>{
 assert.match(portal,/data-order-detail/);
 assert.match(portal,/orderSearchPreview/);
 assert.match(portal,/renderResults\(items,role,expandedIndex===i\?null:i,true\)/);
 assert.match(portal,/window\.scrollTo\(\{top:document\.body\.scrollHeight,behavior:'smooth'\}\)/);
});

test('Mini App Stock Account Details supports Previous and Next in-place navigation',()=>{
 assert.match(portal,/id="stockPrev"/);
 assert.match(portal,/id="stockNext"/);
 assert.match(portal,/renderAccount\(previous\.id,\{replace:true,preserveScroll:true\}\)/);
 assert.match(portal,/renderAccount\(next\.id,\{replace:true,preserveScroll:true\}\)/);
 assert.match(portal,/addEventListener\('touchstart'/);assert.match(portal,/addEventListener\('touchend'/);
});

test('Mini App product CTA and order status colors are semantic',()=>{
 for(const cls of ['brand-amazon','brand-youtube','brand-vpn','brand-crunchyroll'])assert.ok(portal.includes(cls));
 assert.match(portal,/status-chip\.pending/);assert.match(portal,/status-chip\.processing/);assert.match(portal,/status-chip\.completed/);assert.match(portal,/status-chip\.rejected/);
});
