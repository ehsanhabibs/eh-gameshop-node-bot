const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const reseller = fs.readFileSync(path.join(root, 'reseller-system.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'Public', 'portal.html'), 'utf8');

test('Stock View opens the Rich Account Details table', () => {
  assert.match(index, /function stockAccountRichHtml\(st\)/);
  assert.match(index, /async function sendStockAccountRich\(ctx,st/);
  assert.match(index, /bot\.action\(\/\^stock_account:\(\.\+\)\$\/.*?sendStockAccountRich\(ctx,st\)/s);
  assert.match(index, /<th>SL \/ PROFILE<\/th><th>EXPIRY<\/th><th>ACTIONS<\/th>/);
});

test('Profile Add/Edit/Delete actions refresh the same Rich Message', () => {
  assert.match(index, /chatId:ctx\.chat\.id,messageId:ctx\.callbackQuery\.message\?\.message_id/);
  assert.match(index, /Could not refresh stock rich message/);
  assert.match(index, /stock_profile_delete_confirm/);
});

test('Reseller welcome message uses the Rich Table with status and credit badges', () => {
  assert.match(reseller, /function sendResellerGreeting/);
  assert.match(reseller, /<table compact><tr><td align="center"><b>WELCOME<\/b><\/td><\/tr><tr><td align="center"><b>TO<\/b><\/td><\/tr><\/table>/);
  assert.match(reseller, /<table bordered compact><caption>RESELLER INFORMATION<\/caption>/);
  assert.match(reseller, /ACCOUNT STATUS/);
  assert.match(reseller, /CREDIT STATUS/);
  assert.match(reseller, /sendRichMessage/);
});

test('Latest Premium Black Mini App and aligned Reseller Directory are preserved', () => {
  assert.match(portal, /stock-table-wrap/);
  assert.match(portal, /stock-view-btn/);
  assert.match(reseller, /function resellerDirectoryHtml/);
  assert.match(reseller, /<th>SL<\/th><th>RESELLER NAME<\/th><th>ACTIONS<\/th>/);
  assert.match(reseller, /data="rs:toggle:/);
  assert.match(reseller, /data="rs:credit:/);
  assert.match(reseller, /data="rs:detail:/);
});

test('Telegram Link Customer selects a Stock Account, supports repeat linking and retains flow state',()=>{
 assert.match(index,/async function openLinkCustomerMiniApp/);
 assert.match(index,/mode:'linkCustomer',step:'category'/);
 assert.match(index,/function linkCustomerCategoryHtml\(\)/);
 assert.match(index,/link_customer_cat:/);
 assert.match(index,/link_customer_stock:/);
 assert.match(index,/link_customer_pick:\(new\|\\d\+\)/);
 assert.match(index,/flow\.step==='customerExpiry'/);
 assert.match(index,/domain\.linkNamedCustomer\(st/);
 assert.match(index,/link_customer_addanother/);
 assert.match(index,/link_customer_another_stock/);
 assert.match(index,/link_customer_view_profiles/);
 assert.match(index,/link_customer_cancel/);
 assert.match(index,/activeFlow\?\.mode === "linkCustomer"/);
 assert.doesNotMatch(index,/OPEN STOCK MANAGEMENT/);
});

test('View Stock category screen and account list use Rich Tables with in-place navigation',()=>{
 assert.match(index,/function stockCategoriesRichHtml\(\)/);
 assert.match(index,/function stockCategoryAccountsRichHtml\(product\)/);
 assert.match(index,/bot\.action\("stock_view".*?sendRichMessage/s);
 assert.match(index,/bot\.action\(\/\^stock_cat:\(\.\+\)\$\/.*?editStockRichScreen/s);
 assert.match(index,/bot\.action\(\/\^stock_account:\(\.\+\)\$\/.*?sendStockAccountRich\(ctx,st,true,messageId\)/s);
 assert.ok(index.includes('<details><summary><table compact>'));
 assert.ok(index.includes("<b>${esc(acctEmail)}</b>"));
 assert.match(index,/function stockCategoryStyle\(product\)/);
});

test('Stock Profile detail text is normal, not italic',()=>{
 assert.match(index,/const expiryDays=p\.customerExpiry\?expiryMaintenance\.daysUntilExpiry/);
 assert.match(index,/expiryDays<0\?`<tg-button type="disabled" style="danger">EXPIRED/);
 assert.match(index,/fmtDate\(p\.customerExpiry\)/);
 assert.match(index,/stock_profile_reactivate:/);
 assert.match(index,/\$\{expiryCell\}/);
 assert.doesNotMatch(index,/Math\.max\(0,Math\.ceil\(\(new Date\(`\$\{p\.customerExpiry\}/);
});


test('Reseller Mini App API access is denied while bot menu access remains available',()=>{
 assert.match(index,/Reseller Mini App access is temporarily disabled/);
 assert.match(index,/app\.use\('\/api'/);
});


test('Stock product buttons use equal full-row layout and requested native brand styles',()=>{
 const start=index.indexOf('function productKeyboard(prefix)');
 const end=index.indexOf('async function saveStock',start);
 const keyboard=index.slice(start,end);
 assert.match(keyboard,/AMAZON PRIME.*primary/s);
 assert.match(keyboard,/CRUNCHYROLL.*primary/s);
 assert.match(keyboard,/YOUTUBE.*primary/s);
 assert.match(keyboard,/styledCallback\("📦 AMAZON PRIME"/);
 assert.match(keyboard,/styledCallback\("🍿 CRUNCHYROLL"/);
 assert.match(keyboard,/styledCallback\("▶️ YOUTUBE"/);
});

test('Existing reseller chat menu buttons are reset to Commands on startup and reseller start',()=>{
 assert.match(index,/for\(const \[resellerId,reseller\] of Object\.entries\(data\.resellers\|\|\{\}\)\)/);
 assert.match(index,/resellerActive&&!isAdmin\(ctx\)/);
 assert.match(index,/resellerActive \? \[\[\{text:'🛒 ORDER NOW',style:'success'\},\{text:'📦 MY ORDERS',style:'primary'\}\],\[\{text:'📊 PURCHASE REPORT',style:'success'\},\{text:'💳 ACCOUNT STATEMENT',style:'primary'\}\],\[\{text:'🆘 SUPPORT',style:'danger'\}\]\]/);
 assert.match(index,/Reseller Mini App access is temporarily disabled/);
});


test('Mini App Link Customer API rejects past expiry dates before saving',()=>{
 assert.match(index,/Customer Expiry Date must be today or a future date/);
});


test('Add Stock inline keyboard uses only supported Telegram styles and includes VPN + popcorn Crunchyroll',()=>{
 const start=index.indexOf('function productKeyboard(prefix)');const end=index.indexOf('async function saveStock',start);const keyboard=index.slice(start,end);
 assert.match(keyboard,/🍿 CRUNCHYROLL.*primary/s);assert.match(keyboard,/VPN.*primary/s);assert.doesNotMatch(keyboard,/CRUNCHYROLL[^\n]*link/);
});
test('Account update customer notice hides internal Stock ID',()=>{const start=index.indexOf('bot.action(/^account_notice_send:');const end=index.indexOf('function stockCategoryStyle',start);const block=index.slice(start,end);assert.doesNotMatch(block,/Stock ID: <code>\$\{esc\(st\.id\)\}/);});
test('Expiry reminder menu lets admin choose each active stock instead of only latest stock',()=>{assert.ok(index.includes('bot.action(/^reminder_stock:'));assert.ok(index.includes('entries.map((x,i)=>`<tr>'));
 assert.match(index,/customerExpiry\|\|st\.originalExpiry/);
 assert.match(index,/entries\.sort\(\(a,b\)=>a\.date\.localeCompare\(b\.date\)/);
 assert.match(index,/function reminderStockListRichHtml\(\)/);
 assert.match(index,/data="reminder_stock:\$\{esc\(x\.st\.id\)\}"/);});

test('Telegram Link Customer Customer Name prompt includes Back and restores prior profile step',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8');
 assert.match(server,/link_customer_back:\$\{back\}/);
 assert.match(server,/bot\.action\(\/\^link_customer_back:/);
 assert.match(server,/flow\.step==='customerName'/);
 assert.match(server,/flow\.action==='new'\?'profilePin':'chooseProfile'/);
});
