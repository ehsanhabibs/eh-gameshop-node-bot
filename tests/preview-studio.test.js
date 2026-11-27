'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.js'),'utf8');
const portal=fs.readFileSync(path.join(root,'Public','portal.html'),'utf8');
const reseller=fs.readFileSync(path.join(root,'reseller-system.js'),'utf8');
const domain=fs.readFileSync(path.join(root,'lib','domain.js'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'config','preview-templates.json'),'utf8'));

test('Preview Studio contains one-at-a-time stock layouts and reseller screen previews',()=>{
 for(const key of ['stock_list_original','stock_list_compact','stock_list_expanded','stock_list_hybrid','customer_delivery_new','reseller_delivery_new','reseller_directory','reseller_profile','reseller_dashboard','reseller_order','reseller_ledger','reseller_due','reseller_shop','reseller_support','admin_reseller_pricing','admin_order'])assert.ok(index.includes(key),`missing ${key}`);
 assert.match(portal,/Save & Send to My Telegram/);
 assert.match(portal,/পরেরবার অন্য Layout পাঠালে আগের Preview Message-টাই Edit হয়ে বদলে যাবে/);
 assert.match(portal,/data-preview-type="reseller_delivery"/);
});

test('Admin test preview is isolated to the requesting authenticated Admin and edits the prior preview',()=>{
 assert.match(index,/const user=webUser\(req\);const out=renderPreview\(name,previewSampleData\(name\)\);const sent=await sendOrEditAdminPreview\(user\.id,out\)/);
 assert.match(index,/adminPreviewMessageRefs=new Map\(\)/);
 assert.doesNotMatch(index,/for\(const id of ADMIN_IDS\)await sendPreviewMessage\(id,out\)/);
});

test('Customer and reseller delivery hide internal Extra Days and share the customer-facing format',()=>{
 const block=index.slice(index.indexOf('customer_delivery:'),index.indexOf('customer_delivery_new:'));
 assert.equal((block.match(/<h2>EH GAMESHOP<\/h2>/g)||[]).length,2);
 assert.doesNotMatch(block,/extraDaysLine|Extra Days/);
 assert.equal((block.match(/<th>PIN<\/th><td><code>\{\{pin\}\}<\/code><\/td>/g)||[]).length,2);
 assert.equal((block.match(/type="copy_text" text="\{\{copyText\}\}"/g)||[]).length,2);
 assert.equal((block.match(/<h3>ORDER TIMELINE<\/h3>/g)||[]).length,2);
 assert.equal((block.match(/style="success" data="\{\{callbackPrefix\}\}_live/g)||[]).length,2);
 assert.match(index,/selectedDeliveryTemplate\('reseller'\)/);
 assert.match(index,/deliveryTemplateValues\(order,item,stock,profile\)/);
});

test('Business report uses compact Rich Message quote blocks and keeps Last Updated outside the quote blocks',()=>{
 const start=index.indexOf('report: { format: "rich_html"');const end=index.indexOf('\n};',start);const block=index.slice(start,end);
 assert.match(block,/<blockquote><b>ORDERS<\/b>/);
 assert.match(block,/<blockquote><b>SALES<\/b>/);
 assert.match(block,/<blockquote><b>RECEIVED<\/b>/);
 assert.match(block,/<p align="right"><i>🕒 Last Updated:/);
 assert.doesNotMatch(block,/GLOBAL STATISTICS/i);
});

test('Stock preview variants retain Extra Days only in Admin stock templates',()=>{
 const stock=index.slice(index.indexOf('stock_list_original:'),index.indexOf('reseller_directory:'));
 assert.match(stock,/Extra Days/);
 assert.match(stock,/\{\{extra1\}\}/);
 assert.match(index,/stock_preview_menu:/);
 assert.match(index,/stock_preview_layout:/);
});

test('Reseller UI shows R-prefixed ID without a duplicate Telegram UID row',()=>{
 assert.match(reseller,/<tr><th>RESELLER ID<\/th><td><code>R-\$\{safe\(id\)\}<\/code><\/td><\/tr>/);
 assert.doesNotMatch(reseller,/<tr><th>TELEGRAM UID<\/th>/);
 assert.doesNotMatch(reseller,/UID: <code>\$\{safe\(id\)\}<\/code><\/i><br\/><i>Reseller ID/);
});

test('Order IDs are shorter random EHG identifiers with uniqueness checks',()=>{
 assert.ok(domain.includes('crypto.randomInt(0,s.length)'));
 assert.ok(domain.includes('id=`EH-${pick(digits)}'));
 assert.match(domain,/while\(\(data\.orders\|\|\[\]\)\.some/);
});

test('Starter preview JSON is synchronized and delivery templates do not expose Extra Days',()=>{
 for(const key of ['stock_list_original','stock_list_compact','stock_list_expanded','stock_list_hybrid','reseller_delivery','reseller_profile','reseller_support'])assert.ok(config.templates[key],`config missing ${key}`);
 assert.match(config.templates.customer_delivery.html,/ORDER TIMELINE/);
 assert.match(config.templates.reseller_delivery.html,/ORDER TIMELINE/);
 assert.doesNotMatch(config.templates.customer_delivery.html,/extraDaysLine|Extra Days/);
 assert.doesNotMatch(config.templates.reseller_delivery.html,/extraDaysLine|Extra Days/);
});

test('Extra Days stays Admin-only across profile, order and search API projections',()=>{
 assert.match(index,/if\(admin\)\{row\.extraDaysRequired=p\.extraDaysRequired/);
 assert.match(index,/function clientSafeOrder\(order,admin=false,includeCustomerDelivery=false\)/);
 assert.match(index,/for\(const key of \["extraDaysRequired","accountPassword","accountEmail","stockId","stockProfileId"\]\)delete row\[key\]/);
 assert.match(index,/rows\.map\(o=>\{const safeOrder=clientSafeOrder\(o,admin,!admin&&!r\?\.active\)/);
 assert.match(portal,/me\?\.role==='admin'\?`<div class="row"><span>Extra Days Required/);
});

test('Reseller ID is displayed with R prefix in due requests and test-order selection',()=>{
 assert.match(portal,/Reseller ID: R-\$\{esc\(x\.resellerId\)\}/);
 assert.match(portal,/\$\{esc\(r\.name\)\} · R-\$\{esc\(r\.id\)\}/);
});

test('Telegram reseller directory can open a profile preview in the same message',()=>{
 assert.match(reseller,/rs:detail:/);
 assert.match(reseller,/bot\.action\(\/\^rs:preview:profile:/);
 assert.match(reseller,/BACK TO DIRECTORY/);
});

test('Stock Original, Compact and Hybrid layouts expose preview-only row actions',()=>{
 const block=index.slice(index.indexOf('stock_list_original:'),index.indexOf('reseller_directory:'));
 assert.equal((block.match(/stock_preview_action:edit:profile1/g)||[]).length,4);
 assert.match(block,/stock_preview_action:delete:profile3/);
});

test('Reseller customer lookup does not show the raw Telegram ID for a reseller order',()=>{
 assert.match(portal,/Customer: \$\{esc\(o\.resellerId\?\(o\.customerName\|\|'Reseller'\):\(o\.customerId\|\|'—'\)\)\} · Reseller ID: R-/);
});


test('Hybrid stock preview keeps complete account information and profile management in one 3-column Rich Message',()=>{
 const hybrid=index.slice(index.indexOf('stock_list_hybrid:'),index.indexOf('reseller_directory:'));
 for(const token of ['<code>{{stockId}}</code>','{{email}}','{{password}}','{{originalExpiry}}','SL / PROFILE','{{customer1}}','{{expiry1}}','{{extra1}}','ACTIONS'])assert.ok(hybrid.includes(token),`hybrid missing ${token}`);
 assert.equal((hybrid.match(/<th>/g)||[]).length,9);
 const account= index.slice(index.indexOf('function stockAccountRichHtml'),index.indexOf('async function sendStockAccountRich'));
 assert.match(account,/<code>\$\{esc\(st\.id\)\}<\/code>/);
 assert.match(account,/<th>SL \/ PROFILE<\/th><th>EXPIRY<\/th><th>ACTIONS<\/th>/);
});

test('Reminder profile form uses customer expiry date and omits Telegram UID and manual extra days',()=>{
 assert.match(portal,/name="customerExpiry" type="date"/);
 const form=portal.slice(portal.indexOf('class=\"profileadd\"'),portal.indexOf('</form>',portal.indexOf('class=\"profileadd\"')));
 assert.doesNotMatch(form,/name=\"customerId\"/);
 assert.doesNotMatch(form,/name=\"extraDays\"/);
 assert.match(index,/reminderCalculatedExtraDays\(a\.originalExpiry,customerExpiry\)/);
});

test('Expiry reminders are Admin-only; customer reminder route and automatic sends are absent',()=>{
 assert.doesNotMatch(index,/sendCustomerExpiryReminder/);
 assert.doesNotMatch(index,/expiry-maintenance:\/:stockId\/:profileId\/remind/);
 assert.match(index,/Admin stock expiry reminder failed/);
 assert.match(portal,/Customers do not receive expiry reminders/);
 assert.doesNotMatch(portal,/data-expiry-remind/);
});

test('Account information update notice is a separate Admin-triggered action',()=>{
 assert.match(index,/account_notice_menu/);
 assert.match(index,/account_notice_send/);
 assert.doesNotMatch(index,/Linked Customer-দের notification পাঠানো হয়েছে/);
});


test('Reseller directory is three columns with name navigation and paired status controls',()=>{
 const block=reseller.slice(reseller.indexOf('function resellerDirectoryHtml'),reseller.indexOf('function resellerDetailHtml'));
 assert.match(block,/<th>SL<\/th><th>RESELLER NAME<\/th><th>ACTIONS<\/th>/);
 assert.match(block,/rs:detail:/);assert.match(block,/rs:toggle:/);assert.match(block,/rs:credit:/);
 assert.doesNotMatch(block,/>EDIT</);assert.doesNotMatch(block,/>DELETE</);
});

test('Reseller detail uses static status badges and highlighted priority privileges',()=>{
 const block=reseller.slice(reseller.indexOf('function resellerDetailHtml'),reseller.indexOf('async function sendRichDirectory'));
 assert.match(block,/<tg-button type=\"disabled\" style=\"\$\{active\?'success':'danger'\}\">/);
 assert.match(block,/RESELLER PRIORITY PRIVILEGES/);assert.match(block,/<blockquote>/);assert.match(block,/rs:listpage:/);
});


test('Reseller detail Back and directory pagination edit the same Rich Message',()=>{
 assert.match(reseller,/if \(action === 'list'\)\s*\{[\s\S]*?sendRichDirectory/);
 assert.match(reseller,/if \(action\.startsWith\('listpage:'\)\)\s*\{[\s\S]*?editRichDirectory/);
 assert.match(reseller,/rs:detail:\$\{safe\(id\)\}/);
});

test('Stock Link Customer Mini App offers existing/new profile paths without asking for Telegram ID',()=>{
 const block=portal.slice(portal.indexOf('const availableLinkProfiles='),portal.indexOf("$('stockAddProfile').onsubmit"));
 assert.match(portal,/data-link-mode=\"existing\">Select Existing Profile/);
 assert.match(portal,/data-link-mode=\"new\">Create New Profile \+ Link Customer/);
 assert.match(block,/name="profileId"/);
 assert.match(block,/name="customerName"/);
 assert.match(block,/name="customerExpiry"/);
 assert.doesNotMatch(block,/name="customerId"/);
 assert.doesNotMatch(block,/Telegram ID/);
});

test('Name-only customer-linked stock profiles are excluded from availability and order assignment',()=>{
 assert.match(domain,/!p\.customerId&&!p\.customerLinked&&!p\.reservedForItemId/);
 assert.match(index,/p\.customerLinked&&!p\.customerId/);
 assert.match(index,/!p\.customerId&&!p\.customerLinked/);
});

test('Mini App Back navigation re-renders screens and restores active tab instead of restoring dead HTML only',()=>{
 assert.match(portal,/let currentScreenRestore=null,pendingTabRestore=null/);
 assert.match(portal,/async function goBack\(\)/);
 assert.match(portal,/if\(typeof prev\.restore==='function'\)\{await prev\.restore\(\)\}/);
 assert.match(portal,/restore:currentScreenRestore,scrollY:window\.scrollY/);
});

test('Stock Profile form submissions refresh in place without adding navigation history or jumping to top',()=>{
 assert.match(portal,/function panel\(title,body,options=\{\}\)/);
 assert.match(portal,/if\(options\.preserveScroll\)window\.scrollTo\(\{top:scrollY,behavior:'instant'\}\)/);
 assert.match(portal,/renderAccount\(s\.id,\{preserveScroll:true,replace:true\}\)/);
 assert.match(portal,/restore:\(\)=>renderAccount\(id\)/);
});

test('Stock Profile management uses compact rows with Name, PIN, Expiry, semantic status and inline actions',()=>{
 assert.match(portal,/class="compact-profile-list"/);
 assert.match(portal,/class="compact-profile-row"/);
 assert.match(portal,/PIN: <code>/);
 assert.match(portal,/Expiry: <b>/);
 assert.match(portal,/customerProfileStatusHtml\(p\)/);
 assert.match(portal,/data-delete-slot=/);
});

test('Mini App product selection opens a package/plan detail table with an Order Now action',()=>{
 assert.match(portal,/function productDetails\(productId,items\)/);
 assert.match(portal,/<table class="product-detail-table">/);
 assert.match(portal,/<th>PACKAGE \/ PLAN<\/th><th>DURATION<\/th><th>DETAILS<\/th><th>PRICE<\/th><th>ACTION<\/th>/);
 assert.match(portal,/data-order-plan=/);
 assert.match(portal,/Order Now/);
 assert.match(portal,/data-product-details=/);
});

test('Subscription order form includes quantity +/- controls and restores the selected plan price',()=>{
 assert.match(portal,/subscriptionQtyMinus/);
 assert.match(portal,/subscriptionQtyPlus/);
 assert.match(portal,/updateTotal\(\);f\.onsubmit/);
 assert.match(portal,/restore:\(\)=>subscriptionBuy\(productId,items,preferredId\)/);
});


test('New Delivery Preview preserves the existing design and adds a selectable reference-based Rich Message',()=>{
 const block=index.slice(index.indexOf('customer_delivery_reference:'),index.indexOf('reminder:'));
 assert.equal((block.match(/Tap to view more details/g)||[]).length,2);
 assert.equal((block.match(/ACCOUNT INFORMATION/g)||[]).length,2);
 assert.equal((block.match(/type="copy_text" text="{{copyText}}">▢ Copy/g)||[]).length,2);
 assert.equal((block.match(/📦 <b>Order Number: {{orderNumber}}<\/b>/g)||[]).length,2);
 assert.equal((block.match(/data="delivery_live:{{orderId}}:{{itemId}}"/g)||[]).length,2);
 assert.match(index,/mainDeliveryTemplate/);
 assert.match(index,/selectedDeliveryTemplate/);
 assert.match(index,/orderHistoryTableHtml/);
 assert.match(portal,/customer_delivery_reference:'Customer Delivery · Reference-Based Design'/);
 assert.match(portal,/Set as Main Delivery Preview/);
 assert.match(index,/preview_delivery_new_more/);
 assert.match(index,/preview_delivery_new_hide/);
});

test('Stock Account Profile Management separates Edit and Delete actions into aligned table rows',()=>{
 const block=index.slice(index.indexOf('function stockAccountRichHtml'),index.indexOf('async function sendStockAccountRich'));
 assert.match(block,/rowspan="2"/);
 assert.match(block,/<table bordered compact><tr><th>SL \/ PROFILE<\/th>/);
 assert.ok(block.includes('<td>${edit}</td></tr><tr><td>${remove}</td></tr>'));
});


test('Primary Stock Center category list uses inline Email, Password, Expiry and per-account expand controls without a View button',()=>{
 const list=index.slice(index.indexOf('function stockCategoryAccountsRichHtml'),index.indexOf('function stockCompactPreviewHtml'));
 assert.match(list,/return stockCompactPreviewHtml\(product\)/);
 const compact=index.slice(index.indexOf('function stockCompactPreviewHtml'),index.indexOf('async function editStockRichScreen'));
 assert.match(compact,/STOCK CENTER · ACCOUNTS/);
 assert.match(compact,/data="stock_account:\$\{esc\(st\.id\)\}"/);
 assert.match(compact,/\$\{esc\(st\.password\|\|'—'\)\}/);
 assert.match(compact,/fmtDate\(st\.originalExpiry\)/);
 assert.match(compact,/<details><summary><table compact>/);
 assert.doesNotMatch(compact,/data="stock_account:\$\{esc\(st\.id\)\}">VIEW/);
});
