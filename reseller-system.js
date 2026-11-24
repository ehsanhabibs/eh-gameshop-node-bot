'use strict';

const TZ = 'Asia/Dhaka';
const reportData = require('./lib/reports');
const domain = require('./lib/domain');
const { syncTrackedMessages } = require('./lib/telegram-message-sync');

function dateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
function formatDhaka(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value));
}
function formatDhakaReportStamp(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date(value)).replace(/\b(am|pm)\b/i, x => x.toUpperCase());
}
function money(value) { return `৳${Math.round((Number(value) || 0) * 100) / 100}`; }
function safe(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function shortLabel(value, max=28) { const text=String(value??''); return text.length>max?`${text.slice(0,max-1)}…`:text; }

function productSales(orders) {
  const map = new Map();
  for (const o of orders) {
    if (o.isTest || ['Rejected', 'Cancelled'].includes(o.status)) continue;
    const items = Array.isArray(o.items) && o.items.length ? o.items : [null];
    const total = Number(o.price || 0);
    const fallbackEach = items.length ? total / items.length : total;
    for (const item of items) {
      const name = item?.product || item?.productName || o.productName || o.product || 'Unknown';
      const row = map.get(name) || { product: name, quantity: 0, amount: 0 };
      row.quantity += Math.max(1, Number(item?.quantity || 1));
      row.amount += Number(item?.price ?? fallbackEach);
      map.set(name, row);
    }
  }
  return [...map.values()].sort((a, b) => a.product.localeCompare(b.product));
}
function totals(orders) {
  const valid = orders.filter(o => !o.isTest && !['Rejected', 'Cancelled'].includes(o.status));
  const sales = valid.reduce((n, o) => n + Number(o.price || 0), 0);
  const received = valid.filter(o => ['Verified', 'Paid', 'Completed'].includes(o.paymentStatus)).reduce((n, o) => n + Number(o.price || 0), 0);
  return { sales, received, due: Math.max(0, sales - received) };
}
function monthlyReport(orders, year, month) {
  const rows = orders.filter(o => {
    const key = dateKey(o.createdAt || o.date || 0);
    const [y, m] = key.split('-').map(Number);
    return y === Number(year) && m === Number(month);
  });
  return { rows: productSales(rows), ...totals(rows) };
}
function resellerOrders(data, userId) {
  return (data.orders || []).filter(o => !o.isTest && String(o.resellerId || o.sellerId || '') === String(userId));
}
function tierPrice(reseller, product, basePrice) {
  const special = reseller?.specialPrices?.[product];
  if (special !== undefined && special !== null && Number.isFinite(Number(special))) return Number(special);
  const tier = reseller?.tier || 'Rate 1';
  const tierValue = reseller?.tierPrices?.[tier]?.[product];
  return Number.isFinite(Number(tierValue)) && tierValue !== undefined ? Number(tierValue) : Number(basePrice || 0);
}

function registerResellerSystem(bot, { data, saveData, isAdmin, renderPreview, sendPreviewMessage, getCatalog = () => [], placeOrder = null, submitYoutubeRequest = null }) {
  const { Markup } = require('telegraf');
  const styledCallback = (text, callback_data, _style) => ({ text, callback_data });
  const flows = new Map();
  const homeMessageRefs = bot.__ehResellerHomeMessageRefs ||= new Map();
  const persist = () => saveData();
  async function editResellerRich(ctx,html,fallback='This Rich Message could not be updated.') {
    const messageId=ctx.callbackQuery?.message?.message_id;
    if(messageId){try{const sent=await ctx.telegram.callApi('editMessageText',{chat_id:ctx.chat.id,message_id:messageId,rich_message:{html}});homeMessageRefs.set(String(ctx.from.id),{chatId:ctx.chat.id,messageId:sent?.message_id||messageId});return sent;}catch(e){if(/message is not modified/i.test(e.message||'')){homeMessageRefs.set(String(ctx.from.id),{chatId:ctx.chat.id,messageId});return;}console.error('Reseller Rich Message edit failed:',e.message);}}
    return sendResellerRich(ctx,html,fallback);
  }
  async function sendResellerRich(ctx,html,fallback='This Rich Message could not be sent.') {
    const key=String(ctx.from.id),ref=homeMessageRefs.get(key);
    if(ref?.chatId&&ref?.messageId){try{const sent=await ctx.telegram.callApi('editMessageText',{chat_id:ref.chatId,message_id:ref.messageId,rich_message:{html}});homeMessageRefs.set(key,{chatId:ref.chatId,messageId:sent?.message_id||ref.messageId});return sent;}catch(e){if(/message is not modified/i.test(e.message||''))return;if(!/message to edit not found|message_id_invalid|message can't be edited|message to edit not found/i.test(e.message||''))console.error('Reseller Home Message edit failed:',e.message);homeMessageRefs.delete(key);}}
    try{const sent=await ctx.telegram.callApi('sendRichMessage',{chat_id:ctx.chat.id,rich_message:{html}});homeMessageRefs.set(key,{chatId:sent.chat?.id||ctx.chat.id,messageId:sent.message_id});return sent;}catch(e){console.error('Reseller Rich Message send failed:',e.message);return ctx.reply(fallback);}
  }
  const resellerHomeKeyboard=()=>Markup.keyboard([['🛒 Order Now','📦 My Orders'],['📊 Purchase Report','💳 Account Statement'],['🆘 Support']]).resize().persistent();
  function productLabel(name){const n=String(name||'').toLowerCase();if(n.includes('prime')||n==='prime')return 'Amazon Prime';if(n.includes('youtube'))return 'YouTube Premium';return String(name||'Product');}
  function resellerMenuHtml(r){return `<h2>🤝 EH GAMESHOP RESELLER PANEL</h2><p>Welcome, <b>${safe(r.name||'Reseller')}</b> · ${safe(r.tier||'Rate 1')}</p><table bordered compact><tr><th>ACCOUNT</th><td>${r.active?'🟢 ACTIVE':'🔴 INACTIVE'}</td></tr><tr><th>CREDIT</th><td>${r.creditAuthorized?'🟢 ON':'🔴 OFF'}</td></tr><tr><th>OUTSTANDING DUE</th><td>${money(domain.dueForReseller(data,r.id))}</td></tr></table><p>Choose an action below. All reseller work is handled here in Telegram.</p><tg-button-row><tg-button type="callback_data" style="success" data="rs:shop">🛒 ORDER NOW</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="primary" data="rs:orders">📦 MY ORDERS</tg-button><tg-button type="callback_data" style="success" data="rs:sales">📊 PURCHASE REPORT</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="primary" data="rs:ytrequests">▶️ YOUTUBE REQUESTS</tg-button><tg-button type="callback_data" style="primary" data="rs:statement">💳 ACCOUNT STATEMENT</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="primary" data="rs:support">🆘 SUPPORT</tg-button></tg-button-row>`;}
  function resellerOrderCategoriesHtml(){return `<h2>🛍️ RESELLER SHOP</h2><p>Select one product to continue.</p><tg-button-row><tg-button type="callback_data" style="primary" data="rs:cat:0">📦 AMAZON PRIME</tg-button><tg-button type="callback_data" style="primary" data="rs:cat:1">🍿 CRUNCHYROLL</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="primary" data="rs:cat:2">▶️ YOUTUBE</tg-button><tg-button type="callback_data" style="primary" data="rs:cat:3">🛡️ VPN</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="link" data="rs:menu">← BACK TO MENU</tg-button></tg-button-row>`;}

  function resellerQuantityHtml(f,r){const unit=tierPrice(r,f.product.name,Number(f.product.price||0)),total=unit*Number(f.quantity||1),qty=Number(f.quantity||1);return `<h2>🧾 ORDER PREVIEW</h2><table bordered compact><tr><th>PRODUCT</th><td>${safe(productLabel(f.product.name))}</td></tr><tr><th>PACKAGE</th><td>${safe(f.product.package||f.product.duration||'Standard')}</td></tr><tr><th>UNIT PRICE</th><td>${money(unit)}</td></tr><tr><th>TOTAL DUE</th><td><b>${money(total)}</b></td></tr><tr><th>DELIVERY TO</th><td>Your reseller Telegram account</td></tr></table><table compact><tr><td align="center"><tg-button type="callback_data" style="success" data="rs:qty:minus">&nbsp;&nbsp;−&nbsp;&nbsp;</tg-button></td><td align="center"><tg-button type="disabled">QTY: ${qty}</tg-button></td><td align="center"><tg-button type="callback_data" style="success" data="rs:qty:plus">&nbsp;&nbsp;＋&nbsp;&nbsp;</tg-button></td></tr></table><tg-button-row><tg-button type="callback_data" style="success" data="rs:confirm">CONFIRM ORDER</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="danger" data="rs:cancel">CANCEL</tg-button></tg-button-row>`;}
  const adminOnly = async ctx => {
    if (isAdmin(ctx)) return true;
    await ctx.reply('এই অপশনটি শুধু Admin-এর জন্য।');
    return false;
  };

  // A new menu/action must never leave an older text prompt trapping the user.
  // Keep only callbacks that are genuine steps inside the active reseller shop flow.
  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (id && ctx.callbackQuery?.data) {
      const action = String(ctx.callbackQuery.data);
      const isShopStep = /^rs:(?:cat:\d+|product:\d+|qty:(?:plus|minus)|confirm|cancel|delivery:(?:auto|manual)|youtube:(?:family|individual|back)|ytqty:(?:plus|minus)|yt:emails|ytrequests|ytrequest:[A-Za-z0-9-]+)$/.test(action);
      if (!isShopStep) flows.delete(id);
    }
    if (id && ctx.message?.text) {
      const input = String(ctx.message.text).trim();
      const menuLabels = new Set([
        '🌐 Open EH Gameshop','📦 Stock Center','👤 Account & Profiles','📋 Orders / Reports',
        '🤝 Reseller Management','💳 Due Requests','🛠 Support Inbox','🤝 Reseller Panel',
        '📦 My Orders','🔎 Order Search','🆘 Support','Back','⬅️ Back','Cancel','❌ Cancel','Main Menu'
      ]);
      if (input.startsWith('/') || menuLabels.has(input)) flows.delete(id);
    }
    return next();
  });

  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      const id = String(ctx.from.id);
      const existed = Boolean(data.customers[id]);
      if (!existed) {
        data.customers[id] = { id, name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || ctx.from.username || 'Customer', username: ctx.from.username || '', joinedAt: new Date().toISOString(), active: true, lifetimePurchases: {} };
        persist();
        if (isAdmin(ctx)) { /* avoid notifying the same admin about their own test chat */ }
        else for (const adminId of (process.env.ADMIN_IDS || '').split(/[ ,]+/).filter(Boolean)) {
          try { await bot.telegram.sendMessage(Number(adminId), `👤 <b>NEW CUSTOMER JOINED</b>\nName: ${safe(data.customers[id].name)}\nTelegram ID: <code>${id}</code>\nJoined: ${formatDhaka(data.customers[id].joinedAt)}`, { parse_mode: 'HTML' }); } catch { /* admin may not have started the bot */ }
        }
      } else {
        data.customers[id].name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || data.customers[id].name;
        data.customers[id].username = ctx.from.username || data.customers[id].username;
      }
      const seenNow=new Date().toISOString();const previous=data.customers[id].lastSeen;data.customers[id].lastSeen=seenNow;if(!previous||Date.now()-new Date(previous).getTime()>60000)persist();
    }
    return next();
  });

  function resellerGreetingHtml(id,r) {
    const c=data.customers?.[id]||{};const joined=r.createdAt||new Date().toISOString();const last=c.lastSeen||r.lastSeen||c.joinedAt||null;
    const date=v=>v?formatDhaka(v):'Not available';
    const username=r.username||c.username;
    const status=r.active?{label:'ACTIVE',style:'success'}:{label:'INACTIVE',style:'danger'};
    const credit=r.creditAuthorized?{label:'CREDIT ON',style:'success'}:{label:'CREDIT OFF',style:'danger'};
    return `<table compact><tr><td align="center"><b>WELCOME</b></td></tr><tr><td align="center"><b>TO</b></td></tr></table><aside><b>✨ RESELLER NETWORK ✨</b></aside>
<table bordered compact><caption>RESELLER INFORMATION</caption>
<tr><th>CUSTOMER NAME</th><td><b>${safe(r.name||c.name||id)}</b></td></tr>
<tr><th>TELEGRAM USERNAME</th><td>${safe(username?'@'+username:'Not set')}</td></tr>
<tr><th>RESELLER ID</th><td><code>R-${safe(id)}</code></td></tr>
<tr><th>ACCOUNT STATUS</th><td><tg-button type="disabled" style="${status.style}">${status.label}</tg-button></td></tr>
<tr><th>CREDIT STATUS</th><td><tg-button type="disabled" style="${credit.style}">${credit.label}</tg-button></td></tr>
<tr><th>TIER</th><td>${safe(r.tier||'Rate 1')}</td></tr>
<tr><th>JOINING DATE</th><td>${safe(date(joined))}</td></tr>
<tr><th>LAST SEEN</th><td>${safe(date(last))}</td></tr>
</table>
<h3>RESELLER PRIORITY PRIVILEGES</h3>
<blockquote><b>⚡ Priority Order Processing</b></blockquote><blockquote><b>⏱ 30-Minute Delivery Guarantee</b></blockquote><blockquote><b>🏷 Special Reseller Pricing</b></blockquote><blockquote><b>💳 Credit Purchase Facility</b></blockquote><blockquote><b>📊 Personal Order History &amp; Reports</b></blockquote>
<p><b>YOUR RESELLER ACCOUNT IS NOW ${r.active?'ACTIVE':'INACTIVE'}!</b></p><p>Thank you for joining EH Gameshop. Welcome aboard!</p>
<tg-button-row align="center"><tg-button type="callback_data" style="primary" data="rs:menu">OPEN RESELLER MENU</tg-button></tg-button-row>`;
  }
  async function sendResellerGreeting(ctx,id,r,kind='JOINED') {
    try{
      try{await bot.telegram.setChatMenuButton({chat_id:Number(id),menu_button:{type:'commands'}});}catch(menuError){console.error('Could not hide reseller Mini App menu button:',menuError.message);}
      const sent=await bot.telegram.callApi('sendRichMessage',{chat_id:Number(id),rich_message:{html:resellerGreetingHtml(id,r)}});
      domain.trackTelegramMessage(r,{chatId:sent.chat.id,messageId:sent.message_id,kind:'reseller_profile'});await persist();return true;
    }catch(e){console.error('Reseller rich welcome message failed:',e.message);return false;}
  }
  async function updateResellerGreeting(id,r){
    if(!(r.telegramMessages||[]).some(x=>x.kind==='reseller_profile'))return sendResellerGreeting(null,id,r,'UPDATED');
    return syncTrackedMessages({targets:[r],telegram:bot.telegram,save:persist,
      render:async()=>({rich:true,rich_message:{html:resellerGreetingHtml(id,r)}}),
      sendFallback:async(ref,rendered)=>bot.telegram.callApi('sendRichMessage',{chat_id:Number(ref.chatId),rich_message:rendered.rich_message})
    });
  }
  function dueReviewHtml(r){
    const actions=r.status==='Pending'?`<tg-button-row><tg-button type="callback_data" style="success" data="duepay:confirm:${safe(r.id)}">CONFIRM PAYMENT</tg-button><tg-button type="callback_data" style="danger" data="duepay:reject:${safe(r.id)}">REJECT</tg-button></tg-button-row>`:`<tg-button-row><tg-button type="disabled" style="${r.status==='Confirmed'?'success':'danger'}">${safe(r.status)}</tg-button></tg-button-row>`;
    return `<h2>💳 RESELLER DUE CLEARANCE REQUEST</h2><table bordered compact><tr><th>RESELLER</th><td>${safe(r.resellerName)} · <code>R-${safe(r.resellerId)}</code></td></tr><tr><th>AMOUNT</th><td><b>${money(r.amount)}</b></td></tr><tr><th>METHOD</th><td>${safe(r.paymentMethod)}</td></tr><tr><th>TRANSACTION ID</th><td><code>${safe(r.transactionId)}</code></td></tr><tr><th>REQUEST</th><td><code>${safe(r.id)}</code></td></tr><tr><th>STATUS</th><td><b>${safe(r.status)}</b></td></tr></table>${actions}`;
  }
  function dueResellerStatusHtml(r){const due=domain.dueForReseller(data,r.resellerId);return `<h2>🤝 RESELLER DUE PAYMENT UPDATE</h2><table bordered compact><tr><th>REQUEST</th><td><code>${safe(r.id)}</code></td></tr><tr><th>AMOUNT</th><td>${money(r.amount)}</td></tr><tr><th>STATUS</th><td><b>${safe(r.status)}</b></td></tr><tr><th>REMAINING DUE</th><td><b>${money(due)}</b></td></tr></table>${r.status==='Rejected'?`<p>${safe(r.adminNote||'Payment could not be verified')}</p>`:''}`;}
  async function sendDueRequestMessages(r){
    r.telegramMessages||=[];
    for(const adminId of (process.env.ADMIN_IDS||'').split(/[ ,]+/).filter(Boolean))try{const sent=await bot.telegram.callApi('sendRichMessage',{chat_id:Number(adminId),rich_message:{html:dueReviewHtml(r)}});domain.trackTelegramMessage(r,{chatId:sent.chat.id,messageId:sent.message_id,kind:'admin_due_review'});}catch{}
    try{const sent=await bot.telegram.callApi('sendRichMessage',{chat_id:Number(r.resellerId),rich_message:{html:dueResellerStatusHtml(r)}});domain.trackTelegramMessage(r,{chatId:sent.chat.id,messageId:sent.message_id,kind:'reseller_due_status'});}catch{}
    await persist();
  }
  async function updateDueRequestMessages(r){
    return syncTrackedMessages({targets:[r],telegram:bot.telegram,save:persist,
      render:async(_owner,ref)=>({rich:true,rich_message:{html:ref.kind==='reseller_due_status'?dueResellerStatusHtml(r):dueReviewHtml(r)}}),
      sendFallback:async(ref,rendered)=>bot.telegram.callApi('sendRichMessage',{chat_id:Number(ref.chatId),rich_message:rendered.rich_message})
    });
  }
  async function addReseller(ctx,id,name,username='') {
    const c=data.customers?.[id];if(!c)return ctx.reply('User must start the bot before being registered.');
    if(data.resellers[id])return ctx.reply('This user is already registered as a reseller.');
    const r=data.resellers[id]={id,name:name||c.name||id,username:username||c.username||'',tier:'Rate 1',active:true,creditAuthorized:false,createdAt:new Date().toISOString(),createdBy:String(ctx.from.id),specialPrices:{},lastSeen:c.lastSeen||c.joinedAt||null};
    await persist();const sent=await sendResellerGreeting(ctx,id,r,'JOINED');return ctx.reply(`✅ <b>RESELLER REGISTERED</b>\nName: ${safe(r.name)}\nReseller ID: <code>R-${safe(id)}</code>\nNotification: ${sent?'Sent successfully':'Could not deliver. User must open the bot and press /start first.'}`,{parse_mode:'HTML'});
  }

  function purchasedCustomerRows() {
    const byId = new Map();
    for (const o of data.orders || []) {
      if (o.isTest || o.resellerId || ['Rejected','Cancelled'].includes(o.status)) continue;
      if (!['Verified','Paid','Completed'].includes(String(o.paymentStatus||'')) && o.status !== 'Completed') continue;
      const id = String(o.customerId || o.userId || '');
      if (!/^\d{5,20}$/.test(id) || data.resellers?.[id]) continue;
      const customer = data.customers?.[id] || {};
      const row = byId.get(id) || { id, name: o.customerName || customer.name || id, username: customer.username || '', orders: 0, lastPurchase: null, total: 0 };
      row.orders += 1;
      row.total += Number(o.price || 0);
      const at = o.createdAt || o.date || null;
      if (at && (!row.lastPurchase || new Date(at) > new Date(row.lastPurchase))) row.lastPurchase = at;
      if (o.customerName) row.name = o.customerName;
      byId.set(id, row);
    }
    return [...byId.values()].sort((a,b) => String(b.lastPurchase || '').localeCompare(String(a.lastPurchase || '')) || a.name.localeCompare(b.name));
  }
  function addCandidatesHtml(page=0) {
    const all = purchasedCustomerRows(), size = 7, rows = all.slice(page*size,(page+1)*size);
    let html = `<h2>ADD RESELLER</h2><p>Customers who have purchased from EH Gameshop and are not resellers.</p><p><b>${all.length}</b> eligible customers · Page ${page+1}</p><table bordered compact>`;
    for (const c of rows) {
      const details = `<b>${safe(shortLabel(c.name,28))}</b><br/><i>${safe(shortLabel(c.username ? '@'+c.username : 'No username',22))}</i><br/><i>UID: <code>${safe(c.id)}</code></i><br/><i>Orders: ${c.orders} · Purchases: ${money(c.total)}<br/>Last Purchase: ${safe(c.lastPurchase ? formatDhaka(c.lastPurchase) : 'Not available')}</i>`;
      html += `<tr><td>${details}</td><td align="right"><tg-button type="callback_data" data="rs:adduser:${safe(c.id)}" style="success">ADD RESELLER</tg-button></td></tr>`;
    }
    if (!rows.length) html += `<tr><td colspan="2">No eligible purchasing customers found.</td></tr>`;
    html += `</table>`;
    const nav=[];
    if(page>0) nav.push(`<tg-button type="callback_data" data="rs:userpage:${page-1}">PREVIOUS</tg-button>`);
    if((page+1)*size<all.length) nav.push(`<tg-button type="callback_data" data="rs:userpage:${page+1}">NEXT</tg-button>`);
    if(nav.length) html += `<tg-button-row>${nav.join('')}</tg-button-row>`;
    return html;
  }
  function resellerRows() {
    return Object.entries(data.resellers || {}).sort((a,b)=>String(a[1].name||a[0]).localeCompare(String(b[1].name||b[0])));
  }
  function resellerDirectoryHtml(page=0) {
    const all=resellerRows(),size=5,slice=all.slice(page*size,(page+1)*size);
    let html=`<h2>EH GAMESHOP · RESELLER DIRECTORY</h2><p><b>${all.length}</b> resellers · Page ${page+1}</p><table bordered compact><tr><th>SL</th><th>RESELLER NAME</th><th>ACTIONS</th></tr>`;
    for(const [rowIndex,[id,r]] of slice.entries()){
      const c=data.customers?.[id]||{},active=Boolean(r.active),credit=Boolean(r.creditAuthorized),serial=page*size+rowIndex+1;
      const name=safe(shortLabel(r.name||c.name||id,26));
      html+=`<tr><td>${serial}</td><td><tg-button type="callback_data" style="link" data="rs:detail:${safe(id)}">${name}</tg-button></td><td><tg-button type="callback_data" style="${active?'success':'danger'}" data="rs:toggle:${safe(id)}">${active?'ACTIVE':'INACTIVE'}</tg-button> <tg-button type="callback_data" style="${credit?'success':'danger'}" data="rs:credit:${safe(id)}">${credit?'CREDIT ON':'CREDIT OFF'}</tg-button></td></tr>`;
    }
    if(!slice.length)html+=`<tr><td colspan="3">No resellers registered yet.</td></tr>`;
    html+='</table>';
    const nav=[];if(page>0)nav.push(`<tg-button type="callback_data" data="rs:listpage:${page-1}">PREVIOUS</tg-button>`);if((page+1)*size<all.length)nav.push(`<tg-button type="callback_data" data="rs:listpage:${page+1}">NEXT</tg-button>`);
    if(nav.length)html+=`<tg-button-row>${nav.join('')}</tg-button-row>`;
    return html;
  }
  function resellerDetailHtml(id,page=0){
    const r=data.resellers?.[String(id)];if(!r)return '<h2>RESELLER NOT FOUND</h2>';
    const c=data.customers?.[String(id)]||{},active=Boolean(r.active),credit=Boolean(r.creditAuthorized),due=domain.dueForReseller(data,id);
    const date=v=>v?formatDhaka(v):'Not available';
    return `<table compact><tr><td align="center"><b>WELCOME</b></td></tr><tr><td align="center"><b>TO</b></td></tr></table><aside><b>✨ RESELLER NETWORK ✨</b></aside><table bordered compact><caption>RESELLER INFORMATION</caption><tr><th>NAME</th><td><b>${safe(r.name||c.name||id)}</b></td></tr><tr><th>USERNAME</th><td>${safe(r.username||c.username?'@'+(r.username||c.username):'Not set')}</td></tr><tr><th>RESELLER ID</th><td><code>R-${safe(id)}</code></td></tr><tr><th>ACCOUNT STATUS</th><td><tg-button type="disabled" style="${active?'success':'danger'}">${active?'ACTIVE':'INACTIVE'}</tg-button></td></tr><tr><th>CREDIT STATUS</th><td><tg-button type="disabled" style="${credit?'success':'danger'}">${credit?'CREDIT ON':'CREDIT OFF'}</tg-button></td></tr><tr><th>TIER</th><td>${safe(r.tier||'Rate 1')}</td></tr><tr><th>OUTSTANDING DUE</th><td>${money(due)}</td></tr><tr><th>JOINED</th><td>${safe(date(r.createdAt))}</td></tr><tr><th>LAST SEEN</th><td>${safe(date(c.lastSeen||r.lastSeen||c.joinedAt))}</td></tr></table><h3>RESELLER PRIORITY PRIVILEGES</h3><blockquote><b>⚡ Priority Order Processing</b></blockquote><blockquote><b>⏱ 30-Minute Delivery Guarantee</b></blockquote><blockquote><b>🏷 Special Reseller Pricing</b></blockquote><blockquote><b>💳 Credit Purchase Facility</b></blockquote><blockquote><b>📊 Personal Order History &amp; Reports</b></blockquote><tg-button-row><tg-button type="callback_data" data="rs:listpage:${page}">← BACK TO DIRECTORY</tg-button></tg-button-row>`;
  }
  async function sendRichDirectory(ctx,html,fallbackText) {
    try{return await ctx.telegram.callApi('sendRichMessage',{chat_id:ctx.chat.id,rich_message:{html}});}
    catch(error){console.error('Reseller Rich Message send failed:',error.message);return ctx.reply(fallbackText||'Rich directory is not available in this Telegram client.');}
  }
  async function editRichDirectory(ctx,html,fallbackText) {
    try{return await ctx.telegram.callApi('editMessageText',{chat_id:ctx.chat.id,message_id:ctx.callbackQuery.message.message_id,rich_message:{html}});}
    catch(error){console.error('Reseller Rich Message edit failed:',error.message);return ctx.reply(fallbackText||'Could not update the reseller directory message.');}
  }
  function resellerPageFor(id) { const index=resellerRows().findIndex(([key])=>String(key)===String(id));return index<0?0:Math.floor(index/5); }

  bot.action(/^rs:preview:profile:(\d+)$/,async ctx=>{await ctx.answerCbQuery();if(!await adminOnly(ctx))return;const page=Number(ctx.match[1])||0;const html=resellerDetailHtml(Object.keys(data.resellers||{})[0]||'0',page);return ctx.telegram.callApi('editMessageText',{chat_id:ctx.chat.id,message_id:ctx.callbackQuery.message.message_id,rich_message:{html}});});
  bot.action(/^rs:detail:(\d+)$/,async ctx=>{await ctx.answerCbQuery();if(!await adminOnly(ctx))return;const id=ctx.match[1],page=resellerPageFor(id);if(!data.resellers?.[id])return ctx.answerCbQuery('Reseller not found',{show_alert:true});return editRichDirectory(ctx,resellerDetailHtml(id,page),'Reseller details are unavailable.');});

  // Persistent Reply Keyboard: each bottom-menu item opens its corresponding Telegram Rich Message screen.
  bot.hears('🛒 Order Now',async ctx=>{
    const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');
    if(!r.creditAuthorized)return sendResellerRich(ctx,'<h2>🛍️ RESELLER SHOP</h2><p>Credit purchasing is not enabled. Please contact EH Gameshop Admin.</p>');
    const all=(getCatalog()||[]).filter(p=>p.active!==false&&Number(tierPrice(r,p.name,Number(p.price||0)))>0);
    const key=p=>{const n=String(p.name||'').toLowerCase();if(n.includes('prime')||n.includes('amazon'))return 0;if(n.includes('crunchy'))return 1;if(n.includes('youtube'))return 2;if(n.includes('vpn'))return 3;return -1;};
    const catalog=all.filter(p=>key(p)>=0),categories=['Amazon Prime','Crunchyroll','YouTube Premium','VPN'];
    flows.set(ctx.from.id,{mode:'resellerShop',step:'category',categories,catalog,quantity:1});
    return sendResellerRich(ctx,resellerOrderCategoriesHtml(),'Order categories are unavailable in this Telegram client.');
  });
  bot.hears('📦 My Orders',async ctx=>{
    const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');
    const list=resellerOrders(data,ctx.from.id).slice().sort((a,b)=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0)).slice(0,30),groups=new Map();
    for(const o of list){const day=dateKey(o.createdAt||o.date||new Date());if(!groups.has(day))groups.set(day,[]);groups.get(day).push(o);}
    const sections=[...groups.entries()].map(([day,orders])=>{const rows=orders.map(o=>{const st=String(o.status||'Pending'),style=st==='Completed'?'success':(['Cancelled','Rejected'].includes(st)?'danger':st==='Processing'?'primary':'disabled');return `<tr><td><tg-button type="callback_data" style="link" data="rs:order:${safe(o.id)}">${safe(o.id)}</tg-button></td><td>${safe(productLabel(o.product||o.items?.[0]?.product||'Order'))}</td><td><tg-button type="disabled" style="${style}">${safe(st.toUpperCase())}</tg-button></td><td>${money(o.price)}</td></tr>`;}).join('');return `<h3>📅 ${safe(day)}</h3><table bordered compact><tr><th>ORDER ID</th><th>PRODUCT</th><th>STATUS</th><th>TOTAL</th></tr>${rows}</table>`;}).join('');
    return sendResellerRich(ctx,`<h2>📦 PURCHASE ORDER HISTORY</h2><p align="right"><i>Last Updated: ${safe(formatDhakaReportStamp())}</i></p>${sections||'<p>No orders yet.</p>'}<tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">OPEN RESELLER MENU</tg-button></tg-button-row>`);
  });
  bot.hears('📊 Purchase Report',async ctx=>{
    const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');
    const orders=resellerOrders(data,ctx.from.id),todayKey=dateKey(),monthKey=todayKey.slice(0,7),today=orders.filter(o=>dateKey(o.createdAt||o.date)===todayKey),month=orders.filter(o=>dateKey(o.createdAt||o.date).slice(0,7)===monthKey),dailyTotal=totals(today),monthlyTotal=totals(month);
    const quote=(label,value)=>`<blockquote><b>${label}</b> · ${value}</blockquote>`;
    const dailyRows=productSales(today).map(x=>quote(safe(x.product),`${x.quantity} item(s) · ${money(x.amount)}`)).join('')||'<blockquote>No purchases today.</blockquote>';
    const monthlyRows=productSales(month).map(x=>quote(safe(x.product),`${x.quantity} item(s) · ${money(x.amount)}`)).join('')||'<blockquote>No purchases this month.</blockquote>';
    const html=`<h2>📊 MY PURCHASE REPORT</h2><h3>TODAY · ${todayKey}</h3>${quote('ORDERS',dailyTotal.orders)}${quote('PURCHASE AMOUNT',money(dailyTotal.sales))}${quote('RECEIVED',money(dailyTotal.received))}${quote('OUTSTANDING DUE',money(dailyTotal.due))}<h3>TODAY'S PRODUCT BREAKDOWN</h3>${dailyRows}<h3>THIS MONTH · ${monthKey}</h3>${quote('ORDERS',monthlyTotal.orders)}${quote('PURCHASE AMOUNT',money(monthlyTotal.sales))}${quote('RECEIVED',money(monthlyTotal.received))}${quote('OUTSTANDING DUE',money(monthlyTotal.due))}<h3>MONTHLY PRODUCT BREAKDOWN</h3>${monthlyRows}<p align="right"><i>🕒 Last Updated: ${safe(formatDhakaReportStamp())}</i></p><tg-button-row><tg-button type="callback_data" data="rs:orders" style="primary">PURCHASE HISTORY</tg-button><tg-button type="callback_data" data="rs:menu" style="link">OPEN MENU</tg-button></tg-button-row>`;
    return sendResellerRich(ctx,html);
  });
  bot.hears('💳 Account Statement',async ctx=>{
    const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');
    const due=domain.dueForReseller(data,ctx.from.id),ledger=(data.ledger||[]).filter(x=>String(x.resellerId)===String(ctx.from.id)&&!x.isTest).slice().reverse().slice(0,12);
    const rows=ledger.map(x=>`<tr><td>${safe(x.type||'Entry')}</td><td>${money(x.debit||0)}</td><td>${money(x.credit||0)}</td><td>${safe(dateKey(x.createdAt||new Date()))}</td></tr>`).join('');
    return sendResellerRich(ctx,`<h2>💳 ACCOUNT STATEMENT</h2><table bordered compact><tr><th>OUTSTANDING DUE</th><td><b>${money(due)}</b></td></tr><tr><th>LEDGER ENTRIES</th><td>${ledger.length}</td></tr></table><table bordered compact><tr><th>TYPE</th><th>DEBIT</th><th>CREDIT</th><th>DATE</th></tr>${rows||'<tr><td colspan="4">No ledger entries.</td></tr>'}</table><tg-button-row>${due>0?'<tg-button type="callback_data" data="rs:request" style="success">REQUEST DUE CLEARANCE</tg-button>':''}<tg-button type="callback_data" data="rs:menu" style="link">OPEN MENU</tg-button></tg-button-row>`);
  });
  bot.hears('🆘 Support',async ctx=>{
    const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.reply('For support, contact EH Gameshop Admin.');
    flows.set(ctx.from.id,{mode:'ticket',step:'order'});
    await sendResellerRich(ctx,'<h2>🛟 SUPPORT TICKET</h2><p>Send the Order ID in your next Telegram message. Rich Message buttons cannot collect free text directly.</p>');
    return ctx.reply('যে Order ID নিয়ে সমস্যা, সেটি পাঠাও:');
  });

  bot.command('reseller', async ctx => {
    flows.delete(ctx.from.id);
    const r = data.resellers[String(ctx.from.id)];
    if (!r || !r.active) return ctx.reply('Your Reseller access is not active. Please contact EH Gameshop Admin.');
    try{await ctx.telegram.setChatMenuButton({chat_id:ctx.chat.id,menu_button:{type:'commands'}});}catch(e){console.error('Reseller Mini App menu button update failed:',e.message);}
    await ctx.reply('🤝 EH Gameshop Reseller Home Menu',resellerHomeKeyboard());
    return sendResellerRich(ctx,resellerMenuHtml(r),'EH GAMESHOP RESELLER PANEL · Rich Message is unavailable.');
  });

  bot.command('resellermanagement', async ctx => {
    flows.delete(ctx.from.id);
    if (!await adminOnly(ctx)) return;
    return ctx.reply('🤝 <b>RESELLER MANAGEMENT</b>\nChoose a management action:', { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [styledCallback('➕ Add Reseller', 'rs:add', 'primary')],
      [styledCallback('🆔 Add by Telegram UID', 'rs:adduid', 'primary')],
      [styledCallback('📋 Reseller List / Status', 'rs:list', 'primary')],
      [styledCallback('🏷️ Assign Rate Tier', 'rs:assign', 'primary')],
      [styledCallback('💰 Special Product Rate', 'rs:special', 'primary')]
    ]) });
  });

  bot.command('support', async ctx => {
    flows.delete(ctx.from.id);
    flows.set(ctx.from.id, { mode: 'ticket', step: 'order' });
    return ctx.reply('🛟 <b>SUPPORT INBOX</b>\nOrder ID পাঠাও। একই Order ID ও একই সমস্যার Ticket আগে থাকলে সেটিই আবার খোলা হবে।', { parse_mode: 'HTML' });
  });
  bot.hears('🆘 Support', async ctx => {
    const r=data.resellers?.[String(ctx.from.id)];
    if(!r?.active)return ctx.reply('For support, contact EH Gameshop Admin.');
    flows.delete(ctx.from.id);flows.set(ctx.from.id,{mode:'ticket',step:'order'});
    return ctx.reply('🛟 <b>RESELLER SUPPORT</b>\nযে Order ID নিয়ে সমস্যা, সেটি পাঠাও।', {parse_mode:'HTML'});
  });
  bot.command('tickets', async ctx => {
    if (!await adminOnly(ctx)) return;
    const rows=(data.tickets||[]).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,30);
    if(!rows.length)return ctx.reply('এখনো কোনো Support Ticket নেই।');
    return ctx.reply('🛟 <b>SUPPORT TICKETS</b>\n\n'+rows.map(t=>`<b>${safe(t.id)}</b> · ${safe(t.status)}\nOrder: ${safe(t.orderId||'N/A')} · Customer: <code>${safe(t.customerId)}</code>\n${safe(t.subject||t.issue)}`).join('\n\n'),{parse_mode:'HTML'});
  });

  bot.command('customers', async ctx => {
    if (!await adminOnly(ctx)) return;
    const rows = Object.values(data.customers || {}).sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt))).slice(0, 30);
    if (!rows.length) return ctx.reply('এখনো কোনো Customer নেই।');
    return ctx.reply('👥 <b>CUSTOMER LIST</b>\n\n' + rows.map(c => `• <b>${safe(c.name)}</b> · ${c.active === false ? 'Inactive' : 'Active'}\nID: <code>${c.id}</code> · ${formatDhaka(c.joinedAt)}`).join('\n\n'), { parse_mode: 'HTML' });
  });
  bot.command('report', async ctx => {
    if (!await adminOnly(ctx)) return;
    return ctx.reply('📊 <b>EH GAMESHOP REPORTS</b>\nকোন Report দেখতে চান?', { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [styledCallback('📅 Daily Report', 'adminreport:daily', 'primary'), styledCallback('🗓 Monthly Report', 'adminreport:monthly', 'primary')],
      [styledCallback('👥 Customer Lifetime Purchases', 'adminreport:lifetime', 'primary')]
    ]) });
  });
  bot.action(/^adminreport:(daily|monthly|lifetime)$/, async ctx => {
    await ctx.answerCbQuery(); if (!await adminOnly(ctx)) return;
    const mode = ctx.match[1]; const orders = data.orders || [];
    if (mode === 'lifetime') {
      const rows = reportData.lifetimePurchases(orders, data.customers || []).slice(0, 30);
      const totals = rows.reduce((a, x) => ({ sales:a.sales+x.purchase, received:a.received+x.received, due:a.due+x.due, orders:a.orders+x.orders }), { sales:0, received:0, due:0, orders:0 });
      const list = rows.map(x => `• ${safe(x.name)} · Orders ${x.orders} · Items ${x.quantity} · ${money(x.purchase)}`).join('\n') || 'No Customer Purchase History';
      if(renderPreview&&sendPreviewMessage){const out=renderPreview('report',{date:`Lifetime · ${dateKey()}`,orders:totals.orders,sales:money(totals.sales),received:money(totals.received),due:money(totals.due),products:list,lastUpdated:formatDhakaReportStamp()});return sendPreviewMessage(ctx.chat.id,out);}
      return ctx.reply(`👥 <b>CUSTOMER LIFETIME PURCHASES</b>\nCustomers: ${rows.length} · Orders: ${totals.orders}\nSales: ${money(totals.sales)} · Received: ${money(totals.received)} · Due: ${money(totals.due)}\n\n${list}`, { parse_mode:'HTML' });
    }
    const today = dateKey();
    const report = mode === 'daily' ? reportData.dailyReport(orders, today) : reportData.monthlyReport(orders, Number(today.slice(0,4)), Number(today.slice(5,7)));
    const productList = report.products.map(x => `${safe(x.product)} — ${x.quantity} / ${money(x.amount)}`).join('\n') || 'No Sales';
    const dailyList = mode === 'monthly' ? '\n\nDaily Sales\n' + report.daily.map(x => `${safe(x.day)} · ${money(x.amount)}`).join('\n') : '';
    if(renderPreview&&sendPreviewMessage){const out=renderPreview('report',{date:mode==='daily'?today:today.slice(0,7),orders:report.orders,sales:money(report.sales),received:money(report.received),due:money(report.due),products:productList+dailyList,lastUpdated:formatDhakaReportStamp()});return sendPreviewMessage(ctx.chat.id,out);}
    return ctx.reply(`📊 <b>${mode === 'daily' ? 'DAILY' : 'MONTHLY'} SALES REPORT</b>\n${mode === 'daily' ? today : today.slice(0,7)}\n\nOrders: ${report.orders}\nSales: ${money(report.sales)}\nReceived: ${money(report.received)}\nDue: ${money(report.due)}\n\n<b>Products</b>\n${productList}${dailyList}`, { parse_mode:'HTML' });
  });

  bot.action(/^rs:paymethod:(bkash|nagad|rocket)$/,async ctx=>{await ctx.answerCbQuery();const f=flows.get(ctx.from.id);if(!f||f.mode!=='dueRequest'||f.step!=='method')return ctx.answerCbQuery('Payment step expired. Start again.',{show_alert:true});f.paymentMethod=ctx.match[1][0].toUpperCase()+ctx.match[1].slice(1);f.step='trx';flows.set(ctx.from.id,f);return ctx.reply(`✅ Payment Method: ${f.paymentMethod}\nTransaction ID পাঠান:`);});

  bot.action(/^rs:order:(.+)$/,async ctx=>{await ctx.answerCbQuery();const order=resellerOrders(data,ctx.from.id).find(o=>String(o.id)===String(ctx.match[1]));if(!order)return ctx.answerCbQuery('Order not found.',{show_alert:true});const items=(order.items||[]).map(i=>`<tr><td>${safe(i.product||order.product)}</td><td>${safe(i.packageName||'Standard')}</td><td>${safe(i.status||order.status||'Pending')}</td><td>${money(i.price||0)}</td></tr>`).join('');const status=String(order.status||'Pending'),style=status==='Completed'?'success':(['Cancelled','Rejected'].includes(status)?'danger':(['Processing','Accepted'].includes(status)?'primary':'primary'));return editResellerRich(ctx,`<h2>🧾 ORDER DETAILS</h2><table bordered compact><tr><th>ORDER ID</th><td><code>${safe(order.id)}</code></td></tr><tr><th>STATUS</th><td><tg-button type="disabled" style="${style}">${safe(status.toUpperCase())}</tg-button></td></tr><tr><th>DATE</th><td>${safe(formatDhaka(order.createdAt||order.date))}</td></tr><tr><th>TOTAL</th><td><b>${money(order.price)}</b></td></tr></table><h3>ITEMS</h3><table bordered compact><tr><th>PRODUCT</th><th>PACKAGE</th><th>STATUS</th><th>PRICE</th></tr>${items||'<tr><td colspan="4">No item details.</td></tr>'}</table><tg-button-row><tg-button type="callback_data" data="rs:orders" style="primary">← ORDER HISTORY</tg-button></tg-button-row>`);});

  bot.action(/^rs:(today|report|due|search|add|list|assign|special|shop|addusers|adduid|support|request|orders|sales|statement|menu|confirm|cancel|qty:(?:plus|minus)|youtube:(?:family|individual|back)|ytqty:(?:plus|minus)|yt:emails|ytrequests|ytrequest:[A-Za-z0-9-]+|userpage:\d+|adduser:\d+|listpage:\d+|profile:\d+|detail:\d+|toggle:\d+|credit:\d+|product:\d+|delivery:(auto|manual))$/, async ctx => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];
    if(action==='youtube:back'){
      const f=flows.get(ctx.from.id),r=data.resellers?.[String(ctx.from.id)];if(!f||!r?.active||!r.creditAuthorized)return ctx.answerCbQuery('Order session expired or credit access is disabled.',{show_alert:true});
      if(f.mode==='youtubeFamilyEmails'){f.mode='youtubeFamilyQty';f.step='quantity';flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM · FAMILY INVITE</h2><p>Select how many email addresses you want to submit.</p><table bordered compact><tr><th>QUANTITY</th><td><b>${f.quantity}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:ytqty:minus">−</tg-button><tg-button type="disabled">QTY ${f.quantity}</tg-button><tg-button type="callback_data" style="primary" data="rs:ytqty:plus">＋</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="success" data="rs:yt:emails">CONTINUE · ENTER EMAILS</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" data="rs:youtube:back" style="link">← BACK</tg-button></tg-button-row>`);}
      f.mode='resellerShop';f.step='category';flows.set(ctx.from.id,f);const product=f.youtubeProduct||f.catalog?.find(x=>String(x.name||'').toLowerCase().includes('youtube'));return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM</h2><p>One-month service · Choose the service type.</p><table bordered compact><tr><th>UNIT PRICE</th><td><b>${money(tierPrice(r,product?.name||'YouTube Premium',Number(product?.price||0)))}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:youtube:family">👨‍👩‍👧 FAMILY INVITE</tg-button><tg-button type="callback_data" style="primary" data="rs:youtube:individual">👤 INDIVIDUAL</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" data="rs:shop" style="link">← BACK TO PRODUCTS</tg-button></tg-button-row>`);
    }
    if(action==='youtube:family'||action==='youtube:individual'){
      const f=flows.get(ctx.from.id),r=data.resellers?.[String(ctx.from.id)];if(!f||f.mode!=='resellerShop'||!r?.active||!r.creditAuthorized)return ctx.answerCbQuery('Order session expired or credit access is disabled.',{show_alert:true});
      if(action==='youtube:family'){f.mode='youtubeFamilyQty';f.youtubeType='family';f.quantity=1;flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM · FAMILY INVITE</h2><p>Select how many email addresses you want to submit. Default quantity is 1.</p><table bordered compact><tr><th>QUANTITY</th><td><b>${f.quantity}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:ytqty:minus">−</tg-button><tg-button type="disabled">QTY ${f.quantity}</tg-button><tg-button type="callback_data" style="primary" data="rs:ytqty:plus">＋</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="success" data="rs:yt:emails">CONTINUE · ENTER EMAILS</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" data="rs:youtube:back" style="link">← BACK</tg-button></tg-button-row>`);}
      f.mode='youtubeIndividualEmail';f.youtubeType='individual';f.step='email';flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM · INDIVIDUAL</h2><p>Send the customer's email address in your next Telegram message.</p><p><i>For account safety, do not send Google passwords or backup codes in Telegram chat.</i></p><tg-button-row><tg-button type="callback_data" data="rs:youtube:back" style="link">← BACK</tg-button></tg-button-row>`);
    }
    if(action==='ytqty:plus'||action==='ytqty:minus'){
      const f=flows.get(ctx.from.id);if(!f||f.mode!=='youtubeFamilyQty')return ctx.answerCbQuery('YouTube request session expired.',{show_alert:true});f.quantity=Math.max(1,Math.min(10,Number(f.quantity||1)+(action==='ytqty:plus'?1:-1)));flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM · FAMILY INVITE</h2><p>Select how many email addresses you want to submit.</p><table bordered compact><tr><th>QUANTITY</th><td><b>${f.quantity}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:ytqty:minus">−</tg-button><tg-button type="disabled">QTY ${f.quantity}</tg-button><tg-button type="callback_data" style="primary" data="rs:ytqty:plus">＋</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" style="success" data="rs:yt:emails">CONTINUE · ENTER EMAILS</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" data="rs:youtube:back" style="link">← BACK</tg-button></tg-button-row>`);
    }
    if(action==='yt:emails'){
      const f=flows.get(ctx.from.id);if(!f||f.mode!=='youtubeFamilyQty')return ctx.answerCbQuery('YouTube request session expired.',{show_alert:true});f.mode='youtubeFamilyEmails';f.step='emails';flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE FAMILY INVITE · EMAILS</h2><p>Quantity: <b>${f.quantity}</b></p><p>${f.quantity===1?'একটি Email Address পাঠাও।':'প্রতিটি Email আলাদা লাইনে পাঠাও।'}</p><blockquote>name1@example.com${f.quantity>1?'<br/>name2@example.com':''}</blockquote><p>একবারে ঠিক ${f.quantity}টি valid Email দিতে হবে।</p><tg-button-row><tg-button type="callback_data" style="link" data="rs:youtube:back">← BACK TO QUANTITY</tg-button></tg-button-row>`);
    }
    if (['add', 'list', 'assign', 'special', 'addusers', 'adduid'].includes(action) || action.startsWith('userpage:') || action.startsWith('adduser:') || action.startsWith('listpage:') || action.startsWith('profile:') || action.startsWith('detail:') || action.startsWith('toggle:') || action.startsWith('credit:')) { if (!await adminOnly(ctx)) return; }
    if(action==='support'){const r=data.resellers[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');flows.delete(ctx.from.id);flows.set(ctx.from.id,{mode:'ticket',step:'order'});await editResellerRich(ctx,'<h2>🛟 RESELLER SUPPORT</h2><p>Send the Order ID you need help with in your next Telegram message.</p><p><i>Telegram Rich Messages cannot collect free text directly, so the Order ID is entered in the next chat message.</i></p><tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">← BACK TO RESELLER MENU</tg-button></tg-button-row>');return ctx.reply('যে Order ID নিয়ে সমস্যা, সেটি পাঠাও:');}
    if(action==='request'){const r=data.resellers[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');const due=domain.dueForReseller(data,ctx.from.id);if(due<=0)return ctx.reply('আপনার কোনো Outstanding Due নেই।');flows.set(ctx.from.id,{mode:'dueRequest',step:'amount',due});return ctx.reply(`🧾 <b>DUE CLEARANCE REQUEST</b>\nCurrent Due: <b>${money(due)}</b>\nকত টাকা পেমেন্ট করেছেন? Amount লিখুন:`,{parse_mode:'HTML'});}
    if (action === 'add' || action === 'addusers' || action.startsWith('userpage:')) {
      const page = action.startsWith('userpage:') ? Math.max(0, Number(action.split(':')[1]) || 0) : 0;
      const html=addCandidatesHtml(page);
      return sendRichDirectory(ctx,html,`ADD RESELLER\n${purchasedCustomerRows().length} eligible purchasing customers. Rich Message view is unavailable.`);
    }
    if(action==='adduid'){flows.set(ctx.from.id,{mode:'reseller',step:'id'});return ctx.reply('Send the Telegram UID of the user. They must have started the bot at least once so EH Gameshop can notify them:');}
    if(action.startsWith('adduser:')){
      const id=action.split(':')[1];
      if(data.resellers?.[id])return ctx.reply('This customer is already a reseller.');
      const candidate=purchasedCustomerRows().find(x=>x.id===id);
      if(!candidate)return ctx.reply('Only customers with a verified or completed purchase can be added as resellers.');
      let c=data.customers?.[id];
      if(!c){c=data.customers[id]={id,name:candidate.name||id,username:candidate.username||'',joinedAt:candidate.lastPurchase||new Date().toISOString(),active:true,lifetimePurchases:{}};await persist();}
      await addReseller(ctx,id,c.name||candidate.name||id,c.username||'');
      return editRichDirectory(ctx,addCandidatesHtml(0),'Customer was added. Refresh Add Reseller to see remaining eligible customers.');
    }
    if(action.startsWith('detail:')){const id=action.split(':')[1];return editRichDirectory(ctx,resellerDetailHtml(id,resellerPageFor(id)),'Reseller details are unavailable.');}
    if(action.startsWith('profile:')){
      const id=action.split(':')[1];
      if(!data.resellers?.[id])return ctx.reply('Reseller not found.');
      return sendRichDirectory(ctx,resellerDirectoryHtml(resellerPageFor(id)),'Reseller directory is unavailable.');
    }
    if(action.startsWith('credit:')){
      const id=action.split(':')[1],r=data.resellers?.[id];if(!r)return ctx.reply('Reseller not found.');
      r.creditAuthorized=!r.creditAuthorized;r.creditUpdatedAt=new Date().toISOString();r.creditUpdatedBy=String(ctx.from.id);await persist();await updateResellerGreeting(id,r);
      return editRichDirectory(ctx,resellerDirectoryHtml(resellerPageFor(id)),'Credit status updated. Reopen Reseller List to refresh.');
    }
    if(action.startsWith('toggle:')){
      const id=action.split(':')[1],r=data.resellers?.[id];if(!r)return ctx.reply('Reseller not found.');
      r.active=!r.active;r.statusUpdatedAt=new Date().toISOString();r.statusUpdatedBy=String(ctx.from.id);await persist();await updateResellerGreeting(id,r);
      return editRichDirectory(ctx,resellerDirectoryHtml(resellerPageFor(id)),'Account status updated. Reopen Reseller List to refresh.');
    }
    if(action==='menu'){const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});return editResellerRich(ctx,resellerMenuHtml(r));}
    if(action==='shop'){
      const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});if(!r.creditAuthorized)return editResellerRich(ctx,`<h2>🛍️ RESELLER SHOP</h2><p>Credit purchasing is not enabled. Please contact EH Gameshop Admin.</p><tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">← BACK TO MENU</tg-button></tg-button-row>`);
      const all=(getCatalog()||[]).filter(p=>p.active!==false&&Number(tierPrice(r,p.name,Number(p.price||0)))>0);
      const key=p=>{const n=String(p.name||'').toLowerCase();if(n.includes('prime')||n.includes('amazon'))return 0;if(n.includes('crunchy'))return 1;if(n.includes('youtube'))return 2;if(n.includes('vpn'))return 3;return -1;};
      const catalog=all.filter(p=>key(p)>=0);const categories=['Amazon Prime','Crunchyroll','YouTube Premium','VPN'];flows.set(ctx.from.id,{mode:'resellerShop',step:'category',categories,catalog,quantity:1});return editResellerRich(ctx,resellerOrderCategoriesHtml());
    }
    if(action.startsWith('product:')){const f=flows.get(ctx.from.id);if(!f||f.mode!=='resellerShop')return ctx.answerCbQuery('Order session expired. Open /reseller again.',{show_alert:true});const p=f.items?.[Number(action.split(':')[1])];if(!p)return ctx.answerCbQuery('Package not found.',{show_alert:true});f.product=p;f.quantity=1;f.step='preview';flows.set(ctx.from.id,f);return editResellerRich(ctx,resellerQuantityHtml(f,data.resellers[String(ctx.from.id)]));}
    if(action==='qty:plus'||action==='qty:minus'){const f=flows.get(ctx.from.id);if(!f||f.mode!=='resellerShop'||!f.product)return ctx.answerCbQuery('Order session expired.',{show_alert:true});f.quantity=Math.max(1,Math.min(20,Number(f.quantity||1)+(action==='qty:plus'?1:-1)));flows.set(ctx.from.id,f);return editResellerRich(ctx,resellerQuantityHtml(f,data.resellers[String(ctx.from.id)]));}
    if(action==='cancel'){const r=data.resellers?.[String(ctx.from.id)];flows.delete(ctx.from.id);return editResellerRich(ctx,resellerMenuHtml(r||{name:'Reseller',active:false,creditAuthorized:false,id:String(ctx.from.id)}));}
    if(action==='confirm'){const f=flows.get(ctx.from.id),r=data.resellers?.[String(ctx.from.id)];if(!f||f.mode!=='resellerShop'||!f.product||!r?.active||!r.creditAuthorized)return ctx.answerCbQuery('Order session expired or credit access is disabled.',{show_alert:true});if(!placeOrder)return editResellerRich(ctx,'<h2>⚠️ ORDER UNAVAILABLE</h2><p>Telegram ordering is temporarily unavailable. Please contact Admin.</p>');await editResellerRich(ctx,'<h2>⏳ ORDER CONFIRMED · PREPARING</h2><p>Checking available stock and preparing your delivery…</p><p><tg-button type="disabled" style="primary">◌ GENERATING ACCOUNT DETAILS</tg-button></p>');try{const out=await placeOrder({resellerId:String(ctx.from.id),product:f.product,quantity:f.quantity,deliveryMode:'Auto'});flows.delete(ctx.from.id);const delivery=out.delivery||[];const html=`<h2>✅ RESELLER ORDER CREATED</h2><table bordered compact><tr><th>ORDER ID</th><td><code>${safe(out.order.id)}</code></td></tr><tr><th>PRODUCT</th><td>${safe(productLabel(f.product.name))}</td></tr><tr><th>PACKAGE</th><td>${safe(f.product.package||f.product.duration||'Standard')}</td></tr><tr><th>QUANTITY</th><td>${Number(f.quantity)}</td></tr><tr><th>TOTAL DUE</th><td><b>${money(out.order.price)}</b></td></tr><tr><th>DELIVERY</th><td>Auto · ${delivery.filter(x=>x.delivered).length}/${out.order.items.length} delivered</td></tr><tr><th>CURRENT DUE</th><td><b>${money(out.due)}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:orders">MY ORDERS</tg-button><tg-button type="callback_data" data="rs:menu" style="link">MENU</tg-button></tg-button-row>`;const sent=await editResellerRich(ctx,html);if(sent?.chat?.id&&sent?.message_id){domain.trackTelegramMessage(out.order,{chatId:sent.chat.id,messageId:sent.message_id,kind:'order_status'});await persist();}return sent;}catch(e){return editResellerRich(ctx,`<h2>❌ ORDER NOT CREATED</h2><p>${safe(e.message)}</p><tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">BACK TO MENU</tg-button></tg-button-row>`);}}
    if(action==='ytrequests'){const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});const list=(data.youtubeRequests||[]).filter(x=>String(x.resellerId||x.customerId)===String(ctx.from.id)).slice().reverse().slice(0,20);const rows=list.map(x=>`<tr><td><tg-button type="callback_data" style="link" data="rs:ytrequest:${safe(x.id)}">${safe(x.id)}</tg-button></td><td>${x.type==='family'?'FAMILY':'INDIVIDUAL'}</td><td>${(x.items||[]).length}</td><td>${safe(x.status||'Pending Review')}</td></tr>`).join('');return editResellerRich(ctx,`<h2>▶️ MY YOUTUBE REQUESTS</h2><table bordered compact><tr><th>REQUEST</th><th>TYPE</th><th>QTY</th><th>STATUS</th></tr>${rows||'<tr><td colspan="4">No YouTube requests yet.</td></tr>'}</table><tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">← RESELLER MENU</tg-button></tg-button-row>`);}
    if(action.startsWith('ytrequest:')){const id=action.slice('ytrequest:'.length),request=(data.youtubeRequests||[]).find(x=>x.id===id&&String(x.resellerId||x.customerId)===String(ctx.from.id));if(!request)return ctx.answerCbQuery('YouTube request not found.',{show_alert:true});const rows=(request.items||[]).map((it,i)=>{const history=(it.history||[]).map(h=>`${safe(h.status||h.action)} · ${safe(formatDhaka(h.at))}`).join('<br/>')||'Submitted';return `<tr><td>${String(i+1).padStart(2,'0')} · <code>${safe(it.email)}</code></td><td><b>${safe(it.status||'Pending Review')}</b><br/><i>${history}</i></td></tr>`;}).join('');return editResellerRich(ctx,`<h2>▶️ YOUTUBE REQUEST DETAILS</h2><table bordered compact><tr><th>REQUEST</th><td><code>${safe(request.id)}</code></td></tr><tr><th>TYPE</th><td>${request.type==='family'?'FAMILY INVITE':'INDIVIDUAL'}</td></tr><tr><th>OVERALL STATUS</th><td><b>${safe(request.status||'Pending Review')}</b></td></tr></table><table bordered compact><tr><th>EMAIL ITEM</th><th>STATUS TIMELINE</th></tr>${rows}</table><tg-button-row><tg-button type="callback_data" data="rs:ytrequests" style="primary">← MY YOUTUBE REQUESTS</tg-button><tg-button type="callback_data" data="rs:menu" style="link">MENU</tg-button></tg-button-row>`);}
    if(action==='orders'){const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});const list=resellerOrders(data,ctx.from.id).slice().sort((a,b)=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0)).slice(0,30),groups=new Map();for(const o of list){const day=dateKey(o.createdAt||o.date||new Date());if(!groups.has(day))groups.set(day,[]);groups.get(day).push(o);}const sections=[...groups.entries()].map(([day,orders])=>{const rows=orders.map(o=>{const st=String(o.status||'Pending'),style=st==='Completed'?'success':(['Cancelled','Rejected'].includes(st)?'danger':st==='Processing'?'primary':'disabled');return `<tr><td><tg-button type="callback_data" style="link" data="rs:order:${safe(o.id)}">${safe(o.id)}</tg-button></td><td>${safe(productLabel(o.product||o.items?.[0]?.product||'Order'))}</td><td><tg-button type="disabled" style="${style}">${safe(st.toUpperCase())}</tg-button></td><td>${money(o.price)}</td></tr>`;}).join('');return `<h3>📅 ${safe(day)}</h3><table bordered compact><tr><th>ORDER ID</th><th>PRODUCT</th><th>STATUS</th><th>TOTAL</th></tr>${rows}</table>`;}).join('');return editResellerRich(ctx,`<h2>📦 PURCHASE ORDER HISTORY</h2><p align="right"><i>Last Updated: ${safe(formatDhakaReportStamp())}</i></p>${sections||'<p>No orders yet.</p>'}<tg-button-row><tg-button type="callback_data" data="rs:menu" style="link">← BACK TO MENU</tg-button></tg-button-row>`);}
    if(action==='sales'){
      const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});
      const orders=resellerOrders(data,ctx.from.id),todayKey=dateKey(),monthKey=todayKey.slice(0,7),today=orders.filter(o=>dateKey(o.createdAt||o.date)===todayKey),month=orders.filter(o=>dateKey(o.createdAt||o.date).slice(0,7)===monthKey),dailyTotal=totals(today),monthlyTotal=totals(month);
      const quote=(label,value)=>`<blockquote><b>${label}</b> · ${value}</blockquote>`;
      const dailyRows=productSales(today).map(x=>quote(safe(x.product),`${x.quantity} item(s) · ${money(x.amount)}`)).join('')||'<blockquote>No purchases today.</blockquote>';
      const monthlyRows=productSales(month).map(x=>quote(safe(x.product),`${x.quantity} item(s) · ${money(x.amount)}`)).join('')||'<blockquote>No purchases this month.</blockquote>';
      const html=`<h2>📊 MY PURCHASE REPORT</h2><h3>TODAY · ${todayKey}</h3>${quote('ORDERS',dailyTotal.orders)}${quote('PURCHASE AMOUNT',money(dailyTotal.sales))}${quote('RECEIVED',money(dailyTotal.received))}${quote('OUTSTANDING DUE',money(dailyTotal.due))}<h3>TODAY'S PRODUCT BREAKDOWN</h3>${dailyRows}<h3>THIS MONTH · ${monthKey}</h3>${quote('ORDERS',monthlyTotal.orders)}${quote('PURCHASE AMOUNT',money(monthlyTotal.sales))}${quote('RECEIVED',money(monthlyTotal.received))}${quote('OUTSTANDING DUE',money(monthlyTotal.due))}<h3>MONTHLY PRODUCT BREAKDOWN</h3>${monthlyRows}<p align="right"><i>🕒 Last Updated: ${safe(formatDhakaReportStamp())}</i></p><tg-button-row><tg-button type="callback_data" data="rs:orders" style="primary">PURCHASE HISTORY</tg-button><tg-button type="callback_data" data="rs:menu" style="link">← BACK TO MENU</tg-button></tg-button-row>`;
      return editResellerRich(ctx,html);
    }
    if(action==='statement'){const r=data.resellers?.[String(ctx.from.id)];if(!r?.active)return ctx.answerCbQuery('Active reseller access required.',{show_alert:true});const due=domain.dueForReseller(data,ctx.from.id),ledger=(data.ledger||[]).filter(x=>String(x.resellerId)===String(ctx.from.id)&&!x.isTest).slice().reverse().slice(0,12);const rows=ledger.map(x=>`<tr><td>${safe(x.type||'Entry')}</td><td>${money(x.debit||0)}</td><td>${money(x.credit||0)}</td><td>${safe(dateKey(x.createdAt||new Date()))}</td></tr>`).join('');return editResellerRich(ctx,`<h2>💳 ACCOUNT STATEMENT</h2><table bordered compact><tr><th>OUTSTANDING DUE</th><td><b>${money(due)}</b></td></tr><tr><th>LEDGER ENTRIES</th><td>${ledger.length}</td></tr></table><table bordered compact><tr><th>TYPE</th><th>DEBIT</th><th>CREDIT</th><th>DATE</th></tr>${rows||'<tr><td colspan="4">No ledger entries.</td></tr>'}</table><tg-button-row>${due>0?'<tg-button type="callback_data" data="rs:request" style="success">REQUEST DUE CLEARANCE</tg-button>':''}<tg-button type="callback_data" data="rs:menu" style="link">← MENU</tg-button></tg-button-row>`);}
    if(action==='support'){const r=data.resellers[String(ctx.from.id)];if(!r?.active)return ctx.reply('Active reseller access required.');flows.set(ctx.from.id,{mode:'ticket',step:'order'});return ctx.reply('🛟 SUPPORT TICKET\nযে Order ID নিয়ে সমস্যা, সেটি পাঠাও। Rich Message-এ সরাসরি free-text input নেওয়া যায় না, তাই এই উত্তরটি আলাদা Telegram message হিসেবে পাঠাতে হবে।');}
    if (action === 'list') {
      return sendRichDirectory(ctx,resellerDirectoryHtml(0),`RESELLER DIRECTORY\n${resellerRows().length} registered resellers. Rich Message view is unavailable.`);
    }
    if (action.startsWith('listpage:')) {
      const page=Math.max(0,Number(action.split(':')[1])||0);
      return editRichDirectory(ctx,resellerDirectoryHtml(page),`RESELLER DIRECTORY\n${resellerRows().length} registered resellers. Rich Message view is unavailable.`);
    }
    if (action === 'assign') { flows.set(ctx.from.id, { mode: 'tier', step: 'id' }); return ctx.reply('Reseller Telegram ID পাঠাও:'); }
    if (action === 'special') { flows.set(ctx.from.id, { mode: 'special', step: 'id' }); return ctx.reply('Reseller Telegram ID পাঠাও:'); }
    if (action === 'search') { flows.set(ctx.from.id, { mode: 'search', step: 'query' }); return ctx.reply('Order ID, Ticket ID, Customer ID বা Account Email লিখে Search করো:'); }
    const r = data.resellers[String(ctx.from.id)];
    if (!r) return ctx.reply('Reseller profile পাওয়া যায়নি।');
    const orders = resellerOrders(data, ctx.from.id);
    const today = orders.filter(o => dateKey(o.createdAt || o.date) === dateKey());
    const t = totals(orders);
    if (action === 'due') return ctx.reply(`💳 <b>TOTAL DUE</b>\nTotal Sales: ${money(t.sales)}\nTotal Received: ${money(t.received)}\n<b>Total Due: ${money(t.due)}</b>`, { parse_mode: 'HTML' });
    if (action === 'today') {
      const todayTotals=totals(today);const items=productSales(today).map(x=>`${safe(x.product)} — ${x.quantity} / ${money(x.amount)}`).join('\n')||'No sales';
      if(renderPreview&&sendPreviewMessage){const out=renderPreview('report',{date:`Today · ${dateKey()}`,orders:today.length,sales:money(todayTotals.sales),received:money(todayTotals.received),due:money(todayTotals.due),products:items,lastUpdated:formatDhakaReportStamp()});return sendPreviewMessage(ctx.chat.id,out);}
      return ctx.reply(`📊 <b>TODAY’S SALES</b> · ${dateKey()}\nOrders: ${today.length}\nTotal Amount: ${money(todayTotals.sales)}\n\n${items}`, { parse_mode: 'HTML' });
    }
    const todayKey=dateKey(),[year,month]=todayKey.split('-').map(Number),monthly=reportData.monthlyReport(orders,year,month);
    const items=monthly.products.map(x=>`${safe(x.product)} — ${x.quantity} / ${money(x.amount)}`).join('\n')||'No purchases this month';
    if(renderPreview&&sendPreviewMessage){const out=renderPreview('report',{date:`This Month · ${todayKey.slice(0,7)}`,orders:monthly.orders,sales:money(monthly.sales),received:money(monthly.received),due:money(monthly.due),products:items,lastUpdated:formatDhakaReportStamp()});return sendPreviewMessage(ctx.chat.id,out);}
    return ctx.reply(`📊 <b>MONTHLY PURCHASE REPORT</b> · ${todayKey.slice(0,7)}\nOrders: ${monthly.orders}\nSales: ${money(monthly.sales)}\nReceived: ${money(monthly.received)}\nDue: ${money(monthly.due)}\n\n<b>PRODUCT BREAKDOWN</b>\n${items}\n\n<i>🕒 Last Updated: ${formatDhakaReportStamp()}</i>`, { parse_mode: 'HTML' });
  });

  bot.action(/^rs:cat:(\d+)$/,async ctx=>{await ctx.answerCbQuery();const f=flows.get(ctx.from.id),r=data.resellers?.[String(ctx.from.id)];if(!f||f.mode!=='resellerShop'||!r?.active)return ctx.answerCbQuery('Please reopen /reseller.',{show_alert:true});const category=f.categories[Number(ctx.match[1])];if(!category)return ctx.answerCbQuery('Category not found.',{show_alert:true});if(category==='YouTube Premium'){const youtubeProduct=f.catalog.find(p=>String(p.name||'').toLowerCase().includes('youtube'));if(!youtubeProduct)return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM</h2><p>No active YouTube reseller price is configured. Please contact Admin.</p><tg-button-row><tg-button type="callback_data" data="rs:shop" style="link">← BACK TO PRODUCTS</tg-button></tg-button-row>`);f.youtubeProduct=youtubeProduct;flows.set(ctx.from.id,f);return editResellerRich(ctx,`<h2>▶️ YOUTUBE PREMIUM</h2><p>One-month service · Choose the service type.</p><table bordered compact><tr><th>UNIT PRICE</th><td><b>${money(tierPrice(r,youtubeProduct.name,Number(youtubeProduct.price||0)))}</b></td></tr></table><tg-button-row><tg-button type="callback_data" style="primary" data="rs:youtube:family">👨‍👩‍👧 FAMILY INVITE</tg-button><tg-button type="callback_data" style="primary" data="rs:youtube:individual">👤 INDIVIDUAL</tg-button></tg-button-row><tg-button-row><tg-button type="callback_data" data="rs:shop" style="link">← BACK TO PRODUCTS</tg-button></tg-button-row>`);}const key=category==='Amazon Prime'?'prime':category==='Crunchyroll'?'crunchy':'vpn';const items=f.catalog.filter(p=>{const n=String(p.name||'').toLowerCase();return key==='prime'?(n.includes('prime')||n.includes('amazon')):key==='crunchy'?n.includes('crunchy'):n.includes('vpn');});if(!items.length)return editResellerRich(ctx,`<h2>${safe(category)}</h2><p>No active packages found for this product. Contact Admin to add a package and reseller price.</p><tg-button-row><tg-button type="callback_data" data="rs:shop" style="link">← BACK</tg-button></tg-button-row>`);f.items=items;f.category=category;f.step='packages';flows.set(ctx.from.id,f);const rows=items.map((p,i)=>`<tg-button-row><tg-button type="callback_data" style="primary" data="rs:product:${i}">${safe(p.package||p.duration||'Standard')} · ${money(tierPrice(r,p.name,Number(p.price||0)))}</tg-button></tg-button-row>`).join('');return editResellerRich(ctx,`<h2>📦 ${safe(category)}</h2><p>Select a package / plan.</p>${rows}<tg-button-row><tg-button type="callback_data" data="rs:shop" style="link">← BACK TO PRODUCTS</tg-button></tg-button-row>`);});

  bot.on('text', async (ctx, next) => {
    const f = flows.get(ctx.from.id);
    if (!f) return next();
    const input = String(ctx.message.text || '').trim();
    if (input.startsWith('/')) return next();
    if(f.mode==='youtubeFamilyEmails'||f.mode==='youtubeIndividualEmail'){
      const r=data.resellers?.[String(ctx.from.id)];if(!r?.active||!r.creditAuthorized){flows.delete(ctx.from.id);return ctx.reply('Active reseller credit access is required.');}
      if(!submitYoutubeRequest)return ctx.reply('YouTube request service is unavailable. Please contact Admin.');
      try{
        const emails=f.mode==='youtubeFamilyEmails'?input.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean):null;
        if(f.mode==='youtubeFamilyEmails'&&emails.length!==Number(f.quantity||1))return ctx.reply(`তুমি ${emails.length}টি Email দিয়েছ। Quantity ${f.quantity}; ঠিক ${f.quantity}টি Email আলাদা লাইনে পাঠাও:`);
        const parent=await submitYoutubeRequest({resellerId:String(ctx.from.id),type:f.mode==='youtubeFamilyEmails'?'family':'individual',emails,email:f.mode==='youtubeIndividualEmail'?input:undefined,product:f.youtubeProduct});
        flows.delete(ctx.from.id);const itemRows=(parent.items||[]).map((it,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td>${safe(it.email)}</td><td>PENDING REVIEW</td></tr>`).join('');
        return editResellerRich(ctx,`<h2>✅ YOUTUBE REQUEST SUBMITTED</h2><table bordered compact><tr><th>REQUEST ID</th><td><code>${safe(parent.id)}</code></td></tr><tr><th>TYPE</th><td>${parent.type==='family'?'FAMILY INVITE':'INDIVIDUAL'}</td></tr><tr><th>QUANTITY</th><td>${parent.items.length}</td></tr><tr><th>STATUS</th><td><b>PENDING REVIEW</b></td></tr><tr><th>TOTAL DUE</th><td><b>${money(parent.price||0)}</b></td></tr></table><h3>EMAIL ITEMS</h3><table bordered compact><tr><th>SL</th><th>EMAIL</th><th>STATUS</th></tr>${itemRows}</table><p>Admin will review and process each email item manually.</p><tg-button-row><tg-button type="callback_data" data="rs:menu" style="primary">RESELLER MENU</tg-button></tg-button-row>`);
      }catch(e){console.error('YouTube reseller email submission failed:',e.stack||e.message);return editResellerRich(ctx,`<h2>⚠️ EMAIL NOT ACCEPTED</h2><p>${safe(e.message||'Email validation failed.')}</p><p>তথ্য ঠিক করে আবার Email পাঠাও।</p><tg-button-row><tg-button type="callback_data" style="link" data="rs:youtube:back">← BACK</tg-button></tg-button-row>`);}
    }
    if (f.mode === 'ticket') {
      if (f.step === 'order') { f.orderId = input; f.step = 'issue'; return ctx.reply('সমস্যাটি সংক্ষেপে লিখো:'); }
      if (f.step === 'issue') {
        const issue = input.toLowerCase();
        let ticket = (data.tickets || []).find(t => String(t.orderId).toLowerCase() === String(f.orderId).toLowerCase() && String(t.customerId) === String(ctx.from.id) && t.issueKey === issue && t.status !== 'Resolved');
        if (!ticket) {
          ticket = { id: `EH-${data.nextTicketId++}`, orderId: f.orderId, customerId: String(ctx.from.id), customerName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '), issue: input, issueKey: issue, status: 'Open', messages: [], createdAt: new Date().toISOString() };
          data.tickets.push(ticket);
        }
        ticket.messages.push({ from: String(ctx.from.id), text: input, at: new Date().toISOString() }); persist(); flows.delete(ctx.from.id);
        for (const adminId of (process.env.ADMIN_IDS || '').split(/[ ,]+/).filter(Boolean)) { try { await bot.telegram.sendMessage(Number(adminId), `🛟 <b>SUPPORT TICKET ${ticket.id}</b>\nOrder: ${safe(ticket.orderId)}\nCustomer: ${safe(ticket.customerName)} (<code>${ticket.customerId}</code>)\nStatus: ${ticket.status}\nIssue: ${safe(ticket.issue)}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('💬 Reply', `ticket:reply:${ticket.id}`), Markup.button.callback('⏸ Hold', `ticket:hold:${ticket.id}`)], [Markup.button.callback('✅ Resolve', `ticket:resolve:${ticket.id}`), Markup.button.callback('🔁 Reopen', `ticket:reopen:${ticket.id}`)]]) }); } catch { /* ignore unavailable admin chat */ } }
        return ctx.reply(`✅ আপনার Support Ticket তৈরি/আপডেট হয়েছে।\nTicket ID: <code>${ticket.id}</code>\nOrder ID: <code>${safe(ticket.orderId)}</code>\nStatus: ${ticket.status}\nএই Ticket-এ উত্তর দিতে /support আবার ব্যবহার করে Order ID দিন।`, { parse_mode: 'HTML' });
      }
    }
    if(f.mode==='dueRequest'){
      if(f.step==='amount'){const amount=Number(input.replace(/[,৳\s]/g,''));if(!Number.isFinite(amount)||amount<=0||amount>f.due)return ctx.reply(`সঠিক Amount লিখুন। সর্বোচ্চ Due: ${money(f.due)}`);f.amount=amount;f.step='method';return ctx.reply('Payment Method নির্বাচন করো:',Markup.inlineKeyboard([[Markup.button.callback('bKash','rs:paymethod:bkash')],[Markup.button.callback('Nagad','rs:paymethod:nagad')],[Markup.button.callback('Rocket','rs:paymethod:rocket')]]));}
      if(f.step==='method')return ctx.reply('নিচের Button থেকে bKash, Nagad অথবা Rocket নির্বাচন করো।');
      if(f.step==='trx'){const trx=input.trim();if(trx.length<4||trx.length>100)return ctx.reply('সঠিক Transaction ID পাঠান:');if((data.dueClearanceRequests||[]).some(x=>String(x.transactionId||'').toLowerCase()===trx.toLowerCase())||(data.ledger||[]).some(x=>String(x.transactionId||'').toLowerCase()===trx.toLowerCase()))return ctx.reply('এই Transaction ID আগে ব্যবহার করা হয়েছে।');const resellerId=String(ctx.from.id),r=data.resellers[resellerId],id=`DCR-${Date.now()}`;const item={id,resellerId,resellerName:r.name||resellerId,amount:f.amount,paymentMethod:f.paymentMethod,transactionId:trx,status:'Pending',createdAt:new Date().toISOString(),source:'telegram'};(data.dueClearanceRequests||=[]).push(item);await persist();flows.delete(ctx.from.id);await sendDueRequestMessages(item);return ctx.reply(`✅ Payment request sent to Admin.\nRequest: ${id}\nAmount: ${money(item.amount)}\nStatus: Pending Admin Verification\nআপনার Due Admin Confirm না করা পর্যন্ত পরিবর্তন হবে না।`);}
    }
    if (f.mode === 'reseller') {
      if (f.step === 'id') { if (!/^\d{5,20}$/.test(input)) return ctx.reply('Send a valid numeric Telegram UID:'); const c=data.customers?.[input];if(!c)return ctx.reply('This user has not started EH Gameshop yet. Ask them to press /start, then add them from Started Users or send their UID again.');return addReseller(ctx,input,c.name||input,c.username||''); }
    }
    if (f.mode === 'tier') {
      if (f.step === 'id') { if (!data.resellers[input]) return ctx.reply('Reseller পাওয়া যায়নি। আগে Add Reseller করো:'); f.id = input; f.step = 'tier'; return ctx.reply('Tier লিখো: Rate 1, Rate 2 অথবা Rate 3'); }
      if (f.step === 'tier') { if (!['Rate 1', 'Rate 2', 'Rate 3'].includes(input)) return ctx.reply('শুধু Rate 1, Rate 2 অথবা Rate 3 লিখো:'); data.resellers[f.id].tier = input; persist(); flows.delete(ctx.from.id); return ctx.reply(`✅ ${f.id}-এর Tier ${input} করা হয়েছে।`); }
    }
    if (f.mode === 'special') {
      if (f.step === 'id') { if (!data.resellers[input]) return ctx.reply('Reseller পাওয়া যায়নি।'); f.id = input; f.step = 'product'; return ctx.reply('Product-এর নাম লিখো:'); }
      if (f.step === 'product') { f.product = input; f.step = 'price'; return ctx.reply('Special Price লিখো (সংখ্যা):'); }
      if (f.step === 'price') { const n = Number(input); if (!(n > 0)) return ctx.reply('সঠিক দাম লিখো:'); data.resellers[f.id].specialPrices ||= {}; data.resellers[f.id].specialPrices[f.product] = n; persist(); flows.delete(ctx.from.id); return ctx.reply(`✅ ${f.id}: ${f.product} = ${money(n)}`); }
    }
    if (f.mode === 'search') {
      const q = input.toLowerCase(); const visibleOrders = isAdmin(ctx) ? (data.orders || []) : resellerOrders(data,ctx.from.id); const orders = visibleOrders.filter(o => [o.orderCode, o.id, o.customerName, o.userId, o.accountEmail].some(v => String(v || '').toLowerCase().includes(q)));
      const visibleTickets = isAdmin(ctx) ? (data.tickets || []) : (data.tickets || []).filter(t => String(t.customerId)===String(ctx.from.id)); const tickets = visibleTickets.filter(t => [t.id, t.orderId, t.customerName, t.customerId, t.issue].some(v => String(v || '').toLowerCase().includes(q)));
      flows.delete(ctx.from.id);
      return ctx.reply(`🔎 <b>SEARCH RESULTS</b>\n\n<b>Orders</b>\n${orders.map(o => `${safe(o.orderCode || o.id)} · ${safe(o.productName || o.product)} · ${money(o.price)}`).join('\n') || 'No orders'}\n\n<b>Tickets</b>\n${tickets.map(t => `${safe(t.id)} · Order ${safe(t.orderId)} · ${safe(t.status)}\n${safe(t.issue)}`).join('\n') || 'No tickets'}`, { parse_mode: 'HTML' });
    }
    return next();
  });

  bot.action(/^duepay:(confirm|reject):(DCR-\d+)$/,async ctx=>{await ctx.answerCbQuery();if(!await adminOnly(ctx))return;const [,action,id]=ctx.match;const r=(data.dueClearanceRequests||[]).find(x=>x.id===id);if(!r)return ctx.reply('Payment request not found.');if(ctx.callbackQuery?.message?.chat?.id&&ctx.callbackQuery?.message?.message_id)domain.trackTelegramMessage(r,{chatId:ctx.callbackQuery.message.chat.id,messageId:ctx.callbackQuery.message.message_id,kind:'admin_due_review'});if(r.status!=='Pending'){await updateDueRequestMessages(r);return;}if(action==='confirm'){try{const row=domain.settleResellerDue(data,r.resellerId,r.amount,{transactionId:r.transactionId,paymentMethod:r.paymentMethod,confirmedBy:String(ctx.from.id),requestId:r.id});r.status='Confirmed';r.confirmedAt=new Date().toISOString();r.confirmedBy=String(ctx.from.id);r.ledgerId=row.id;await persist();await updateDueRequestMessages(r);return;}catch(e){return ctx.reply(`❌ Cannot confirm: ${safe(e.message)}`,{parse_mode:'HTML'});}}r.status='Rejected';r.rejectedAt=new Date().toISOString();r.rejectedBy=String(ctx.from.id);r.adminNote='Payment could not be verified';await persist();await updateDueRequestMessages(r);return;});

  bot.action(/^ticket:(reply|hold|resolve|reopen):(EH-\d+)$/, async ctx => {
    await ctx.answerCbQuery(); if (!await adminOnly(ctx)) return;
    const [, action, id] = ctx.match; const ticket = (data.tickets || []).find(t => t.id === id); if (!ticket) return ctx.reply('Ticket পাওয়া যায়নি।');
    if (action === 'reply') { flows.set(ctx.from.id, { mode: 'ticketReply', ticketId: id }); return ctx.reply(`Ticket ${id}-এর Reply লিখো:`); }
    ticket.status = action === 'hold' ? 'Hold' : action === 'resolve' ? 'Resolved' : 'Reopened'; ticket.updatedAt = new Date().toISOString(); if(action==='hold'){ticket.reviewAt=new Date(Date.now()+2*60*60*1000).toISOString();ticket.holdReminderSent=false;} else {ticket.reviewAt=null;ticket.holdReminderSent=false;} persist();
    try { await bot.telegram.sendMessage(Number(ticket.customerId), `🛟 Support Ticket ${id}\nআপনার Ticket Status: ${ticket.status}${action === 'hold' ? '\nAdmin আপনার বিষয়টি পর্যালোচনা করবেন।' : ''}`); } catch { /* customer may have blocked bot */ }
    return ctx.reply(`Ticket ${id}: ${ticket.status}`);
  });


  bot.on('text', async (ctx, next) => {
    const f = flows.get(ctx.from.id); if (!f || f.mode !== 'ticketReply') return next();
    const ticket = (data.tickets || []).find(t => t.id === f.ticketId); flows.delete(ctx.from.id); if (!ticket) return ctx.reply('Ticket পাওয়া যায়নি।');
    const text = String(ctx.message.text || ''); ticket.messages.push({ from: String(ctx.from.id), text, at: new Date().toISOString() }); persist();
    try { await bot.telegram.sendMessage(Number(ticket.customerId), `💬 Admin Reply · ${ticket.id}\n${text}`); } catch { return ctx.reply('Reply সংরক্ষণ হয়েছে, তবে Customer-কে পাঠানো যায়নি।'); }
    return ctx.reply('✅ Reply Customer-কে পাঠানো হয়েছে।');
  });
}

module.exports = { registerResellerSystem, productSales, totals, monthlyReport, tierPrice, formatDhaka, dateKey };
