'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Public', 'portal.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

test('Mini App uses the Premium Black theme with accessible app structure and accessible app structure', () => {
  assert.match(html, /APPROVED PREMIUM LIGHT REFINEMENTS/);
  assert.match(html, /color-scheme:light/);
  assert.match(html, /--bg:#f5f7fa/);
  assert.match(html, /--surface:#fff/);
  assert.doesNotMatch(html, /PREMIUM BLACK UI REDESIGN|Premium Black theme/);
  assert.match(html, /\.product-grid/);
  assert.match(html, /@media\(min-width:720px\)/);
  assert.match(html, /aria-label="Main navigation"/);
  assert.match(html, /aria-live="polite"/);
});

test('Mini App product category buttons use the approved YouTube red, Amazon blue and Crunchyroll white styling',()=>{
 assert.match(html,/\.category-choice\.category-youtube\{background:#a91f35;border-color:#94192d/);
 assert.match(html,/\.category-choice\.category-amazon\{background:#1b467f;border-color:#163a69/);
 assert.match(html,/\.category-choice\.category-crunchyroll\{background:#fff;color:#111/);
 assert.match(html,/categoryIcon=c=>/);
 assert.match(html,/if\(n\.includes\('prime'\)\)return '📦';if\(n\.includes\('crunchy'\)\)return '🍿';/);
 assert.match(html,/categoryClass=c=>/);
});

test('Mini App product catalogue and purchase/order views render product logos', () => {
  assert.match(html, /async function shop\(/);
  assert.match(html, /async function freeFireBuy\(/);
  assert.match(html, /async function subscriptionBuy\(/);
  assert.match(html, /async function vpnBuy\(/);
  assert.match(html, /data-product-details/);
  assert.match(html, /function productDetails\(/);
  assert.match(html, /data-order-plan/);
  assert.match(html, /function productTile\(/);
  assert.match(html, /logoFor\(\{name:o\.product/);
  for (const asset of ['youtube-premium.png', 'prime-video.png', 'crunchyroll.png', 'netflix.svg', 'vpn.svg', 'canva.svg', 'duolingo.svg', 'spotify.svg', 'freefire.svg']) {
    assert.ok(fs.existsSync(path.join(root, 'assets', asset)), `missing logo asset ${asset}`);
  }
});

test('Admin Mini App includes product, brand and system maintenance studios', () => {
  for (const fn of ['productStudio', 'brandStudio', 'systemMaintenance', 'adminReport', 'lifetimeReport']) {
    assert.match(html, new RegExp(`function ${fn}\\(`), `missing ${fn}`);
  }
  assert.match(html, /tab\('Brand Studio',brandStudio\)/);
  assert.match(html, /tab\('System Health',systemMaintenance\)/);
});

test('Backend exposes public catalogue/branding and authenticated product management routes', () => {
  for (const route of ["app.get('/api/catalog'", "app.get('/api/portal/settings'", "app.put('/api/admin/portal-settings'", "app.post('/api/admin/products'", "app.patch('/api/admin/products/:id'", "app.delete('/api/admin/products/:id'"]) {
    assert.ok(server.includes(route), `missing route ${route}`);
  }
  assert.match(server, /app\.use\("\/assets",express\.static/);
  assert.match(server, /p\.active=false;p\.archivedAt=/);
  assert.match(server, /app\.post\("\/api\/customer\/subscription-orders"/);
  assert.match(server, /app\.post\("\/api\/customer\/orders\/:id\/payment"/);
});

test('Customer checkout supports subscription orders, VPN provider selection, Free Fire UID and manual payment verification',()=>{
  assert.match(html,/async function subscriptionBuy\(/);
  assert.match(html,/async function vpnBuy\(/);
  assert.match(html,/Select Duration/);
  assert.match(html,/Select VPN Name/);
  assert.match(html,/Enter your Free Fire UID/);
  assert.match(server,/app\.post\(\"\/api\/customer\/subscription-orders\"/);
  assert.match(server,/createCustomerSubscriptionOrder/);
  assert.match(server,/This Transaction ID has already been submitted/);
  assert.match(server,/app\.post\(\"\/api\/admin\/orders\/:id\/payment\"/);
  assert.match(server,/Weekly Membership\",price:155/);
  assert.match(server,/Monthly Membership\",price:760/);
});

test('Mini App navigation only references implemented handlers', () => {
  const init = html.match(/async function init\(\)[\s\S]*?\}\)\(\);/)[0];
  const names = [...init.matchAll(/tab\('[^']+',([A-Za-z_$][\w$]*)\)/g)].map(m => m[1]);
  for (const name of names) assert.match(html, new RegExp(`function ${name}\\(`), `tab references missing handler ${name}`);
});

test('Admin Test Orders has a complete create, assign, deliver and delete interface',()=>{assert.match(html,/async function testOrdersAdmin\(/);assert.match(html,/tab\('🧪 Test Orders',testOrdersAdmin\)/);assert.match(html,/data-test-assign/);assert.match(html,/data-test-deliver/);assert.match(html,/data-test-delete/);assert.match(server,/app\.get\("\/api\/admin\/test-orders"/);assert.match(server,/app\.post\("\/api\/admin\/test-orders"/);assert.match(server,/app\.delete\("\/api\/admin\/test-orders\/:id"/);});
test('Test activity is separated from live report totals and reseller payable due',()=>{assert.match(html,/TEST ACTIVITY \(SEPARATE · NOT LIVE SALES\)/);assert.match(html,/Test Activity:.*not payable; excluded from due/);assert.match(server,/testActivity:\{orders:testItems\.length/);assert.match(server,/testRows=rows\.filter\(x=>x\.isTest===true\)/);});
test('Order identifiers use random EHG tokens rather than sequential numbering',()=>{const domain=fs.readFileSync(path.join(root,'lib','domain.js'),'utf8');assert.ok(domain.includes('crypto.randomInt(0,s.length)'));assert.ok(domain.includes('id=`EH-${pick(digits)}'));assert.doesNotMatch(domain,/EH-\$\{String\(data\.nextOrderId\+\+\)/);});

test('Stock accounts support nested profile management in Bot and Mini App',()=>{
  assert.match(server,/stock_cat:/);
  assert.match(server,/stock_profile_add:/);
  assert.match(server,/stock_profile_edit:/);
  assert.match(server,/stock_profile_delete_confirm:/);
  assert.match(server,/profile-slots/);
  assert.match(html,/Profile Name/);
  assert.match(html,/Customer Name/);
  assert.match(html,/Expiry Date/);
  assert.match(html,/Extra Days/);
  assert.match(html,/Add Profile/);
  assert.match(html,/Link Customer/);
});

test('Order Search is available to all roles with server-side ownership filtering',()=>{
  assert.match(server,/app\.get\("\/api\/order-search"/);
  assert.match(server,/domain\.customerOwnOrders\(data,id\)/);
  assert.match(server,/🔎 Order Search/);
  assert.match(html,/async function orderSearch\(/);
  const searchPage=fs.readFileSync(path.join(root,'Public','order-search.html'),'utf8');
  assert.match(searchPage,/\/api\/order-search/);
  assert.match(searchPage,/Customers and resellers can only view their own orders/);
});


test('Reseller Mini App shop uses Category → Product Details → Purchase → Auto Delivery flow',()=>{
  assert.match(html,/api\(reseller\?'\/api\/reseller\/catalog'/);
  assert.match(html,/async function resellerPurchase\(/);
  assert.match(html,/deliveryMode:'Auto'/);
  assert.doesNotMatch(html,/tab\('Credit Buy',resellerBuy\)/);
  assert.match(html,/data-product-details/);
  assert.match(html,/Order Now/);
});

test('Mini App header keeps logo left and Bangladesh time/date separated on the right',()=>{
  assert.match(html,/id=\"brandLogo\"/);
  assert.match(html,/clock-flag/);
  assert.match(html,/id=\"clockTime\"/);
  assert.match(html,/id=\"clockDate\"/);
  assert.doesNotMatch(html,/Dhaka, Bangladesh/);
});

test('Stock account details expose dedicated copy actions and global ID copy support',()=>{
  assert.match(html,/data-copy-value=\"\$\{esc\(s\.id\)\}\"/);
  assert.match(html,/data-copy-value=\"\$\{esc\(s\.email\)\}\"/);
  assert.match(html,/function copyTextValue\(/);
  assert.match(html,/EHG-\[A-Z0-9-\]/);
});

test('Stock input state can be cancelled with /cancel and global menu selection',()=>{
 assert.match(server,/bot\.command\(\"cancel\"/);
 assert.match(server,/menuLabels\.has\(input\)\) stockFlows\.delete\(id\)/);
});

test('Main Mini App Order Search follows the dedicated page list/detail/copy experience',()=>{
 assert.match(html,/order-search-hero/);
 assert.match(html,/data-order-detail/);
 assert.match(html,/renderDetail=/);
 assert.match(html,/COPY ORDER ID/);
 assert.match(html,/order-search-item/);
});


test('Reseller Mini App menu exposes requested Today, Purchase History, Purchase Report, Account Statement and Profile sections',()=>{
 assert.match(html,/tab\('Reseller Shop',shop\)/);
 assert.match(html,/tab\(\"Today's Orders\",todayOrders\)/);
 assert.match(html,/tab\('Order History',orders\)/);
 assert.match(html,/tab\('Purchase Report',salesReport\)/);
 assert.match(html,/async function salesReport\(\)[\s\S]*?Purchase Report/);
 assert.doesNotMatch(html,/Lifetime Sales/);
 assert.match(html,/tab\('Account Statement',ledger\)/);
 assert.match(html,/tab\('My Profile',myProfile\)/);
 assert.match(html,/tab\('Order Search',orderSearch\)/);
 assert.match(html,/tab\('Support',support\)/);
});

test('Reseller dashboard report and profile endpoints are scoped to the authenticated reseller',()=>{
 assert.match(server,/app\.get\('\/api\/reseller\/report'/);
 assert.match(server,/app\.get\('\/api\/reseller\/profile'/);
 assert.match(server,/String\(o\.resellerId\|\|''\)===id/);
 assert.match(server,/domain\.dueForReseller\(data,id\)/);
});


test('Mini App Link Customer form filters inactive profiles and shows submit/error feedback',()=>{
 assert.match(html,/const availableLinkProfiles=profiles\.filter\(p=>p\.active!==false&&p\.status!=='Deleted'/);
 assert.match(html,/name="customerExpiry" type="date" min="\$\{minCustomerExpiry\}" required/);
 assert.match(html,/submit\.textContent='Linking…'/);
 assert.match(html,/msg\(`Link failed: \$\{x\.message\}`\)/);
 assert.match(html,/Customer linked successfully/);
});
