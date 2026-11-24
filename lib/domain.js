'use strict';
const TZ='Asia/Dhaka';
const STOCK_REMINDER_DAYS=[7,3,1,0];
const normalizeProductKey=value=>{const v=String(value||'').trim().toLowerCase().replace(/\s+/g,' ');const aliases={'amazon prime':'prime','prime video':'prime','prime':'prime','youtube premium':'youtube','youtube':'youtube','vpn subscription':'vpn','vpn':'vpn','crunchyroll':'crunchyroll'};return aliases[v]||v;};
const SLOT_LIMITS={prime:6,amazon:6,crunchyroll:5};
const todayKey=(v=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const norm=s=>String(s||'').toLowerCase();
function newOrderId(data){const crypto=require('crypto');const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ',digits='0123456789';const pick=s=>s[crypto.randomInt(0,s.length)];let id;do{id=`EH-${pick(digits)}${pick(digits)}${pick(letters)}${pick(letters)}${pick(letters)}${pick(digits)}`;}while((data.orders||[]).some(o=>String(o.id||o.orderCode)===id));return id;}
function slotLimit(product){const p=norm(product);return p.includes('prime')||p.includes('amazon')?6:p.includes('crunchyroll')?5:1;}
function parseDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;const [y,m,d]=value.split('-').map(Number);const t=Date.UTC(y,m-1,d);const x=new Date(t);return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?t:null;}
function extraDays(customerExpiry,accountExpiry){const a=parseDay(accountExpiry),c=parseDay(customerExpiry);if(a===null||c===null)return 0;return Math.max(0,Math.round((c-a)/86400000));}
function expiryReminderDue(stock,today=todayKey()){
 if(!stock||!stock.originalExpiry||stock.status==='Archived')return null;
 const expiry=parseDay(stock.originalExpiry),now=parseDay(today);if(expiry===null||now===null)return null;
 const daysLeft=Math.round((expiry-now)/86400000);if(!STOCK_REMINDER_DAYS.includes(daysLeft))return null;
 const key=`${today}:${daysLeft}`;if(stock.reminderSent?.[key])return null;
 return {key,daysLeft,originalExpiry:stock.originalExpiry,profiles:(stock.profiles||[]).filter(p=>p.active!==false).map(p=>({id:p.id,profile:p.profile,customerId:p.customerId,customerName:p.customerName,customerExpiry:p.customerExpiry||null,extraDaysRequired:extraDays(p.customerExpiry,stock.originalExpiry)}))};
}
function markExpiryReminderSent(stock,key){if(!stock||!key)throw Error('Stock and reminder key are required');stock.reminderSent={...(stock.reminderSent||{}),[key]:true};stock.updatedAt=new Date().toISOString();return stock;}

function linkProfile(stock,{profile,customerId,customerName='',customerExpiry,resellerId=null}){
 if(!stock||!customerId||!customerExpiry)throw Error('Stock, customerId and customerExpiry are required');
 stock.profiles ||= []; const max=slotLimit(stock.product); const active=stock.profiles.filter(p=>p.active!==false);
 if(active.some(p=>norm(p.profile)===norm(profile)&&(!p.customerExpiry||String(p.customerExpiry)>=todayKey())))throw Error('Profile already linked');
 if(active.some(p=>String(p.customerId)===String(customerId)&&p.customerExpiry&&String(p.customerExpiry)>=todayKey()))throw Error('Customer already linked to this account');
 let p=active.find(x=>(x.customerId||x.customerLinked)&&x.customerExpiry&&String(x.customerExpiry)<todayKey());
 if(p){p.history||=[];p.history.push({customerId:p.customerId,customerName:p.customerName,customerExpiry:p.customerExpiry,resellerId:p.resellerId,endedAt:new Date().toISOString()});p.customerId=null;p.customerLinked=false;p.customerName='';p.customerExpiry=null;p.extraDaysRequired=0;p.resellerId=null;p.assignedOrderItemId=null;p.customerExpiryReminderSent={};}
 if(!p){if(active.length>=max)throw Error(`Profile capacity reached (${max})`);p={id:`${stock.id}-P${String(stock.profiles.length+1).padStart(2,'0')}`,profile:String(profile||`Profile ${stock.profiles.length+1}`),active:true,telegramMessages:[]};stock.profiles.push(p);}
 Object.assign(p,{profile:String(profile||p.profile),customerLinked:false,customerId:String(customerId),customerName:String(customerName||customerId),resellerId:resellerId?String(resellerId):null,customerExpiry,extraDaysRequired:extraDays(customerExpiry,stock.originalExpiry),customerExpiryReminderSent:{},active:true,linkedAt:new Date().toISOString()});stock.status=stock.profiles.length>=max?'Fully Allocated':'Partially Allocated';stock.updatedAt=new Date().toISOString();return p;
}
function linkNamedCustomer(stock,{mode='existing',profileId=null,profile='',pin='',customerName='',customerExpiry}){
 if(!stock)throw Error('Stock not found');
 const name=String(customerName||'').trim(),expiry=String(customerExpiry||'').trim();
 if(!name)throw Error('Customer name is required');
 if(!parseDay(expiry))throw Error('A valid Customer Expiry Date is required');
 stock.profiles ||= [];
 if(stock.lifecycleStatus==='Archived'||stock.status==='Archived'||String(stock.originalExpiry||'')<todayKey())throw Error('Expired or archived stock cannot accept a new profile link');
 const active=stock.profiles.filter(p=>p.active!==false&&p.status!=='Deleted');
 let target;
 if(mode==='existing'){
  target=active.find(p=>String(p.id)===String(profileId));
  if(!target)throw Error('Selected existing profile was not found');
  if(target.customerId||target.customerLinked||target.assignedOrderItemId||target.reservedForItemId)throw Error('This profile is already linked or reserved. Choose an available profile; existing customer links are protected.');
 }else if(mode==='new'){
  const profileName=String(profile||'').trim(),profilePin=String(pin||'').trim();
  if(!profileName||profileName.length>60)throw Error('Profile name is required (max 60 characters)');
  if(profilePin.length>30)throw Error('Profile PIN must be 30 characters or less');
  const limit=slotLimit(stock.product);
  if(active.length>=limit)throw Error(`Profile capacity reached (${limit})`);
  if(active.some(p=>norm(p.profile)===norm(profileName)))throw Error('Profile name already exists in this account');
  const n=stock.profiles.length+1;
  target={id:`${stock.id}-P${String(n).padStart(2,'0')}`,profile:profileName,pin:profilePin,active:true,status:'Available',createdAt:new Date().toISOString(),telegramMessages:[]};
  stock.profiles.push(target);
 }else throw Error('Choose Create New Profile or Select Existing Profile');
 Object.assign(target,{customerId:null,customerLinked:true,customerLinkType:'name_only',customerName:name,customerExpiry:expiry,extraDaysRequired:extraDays(expiry,stock.originalExpiry),customerExpiryReminderSent:{},status:'Running',linkedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 stock.status=active.length+(mode==='new'?1:0)>=slotLimit(stock.product)?'Fully Allocated':'Partially Allocated';
 stock.updatedAt=new Date().toISOString();
 return target;
}
function unlinkProfile(stock,profileId){const p=(stock?.profiles||[]).find(x=>x.id===profileId);if(!p)throw Error('Profile not found');p.active=false;p.unlinkedAt=new Date().toISOString();stock.status=(stock.profiles||[]).some(x=>x.active!==false)?'Partially Allocated':'Available';stock.updatedAt=new Date().toISOString();return p;}
function updateAccount(stock,patch){if(!stock)throw Error('Stock not found');if(patch.originalExpiry!==undefined&&parseDay(patch.originalExpiry)===null)throw Error('Invalid original account expiry date');for(const k of ['email','password','originalExpiry'])if(patch[k]!==undefined)stock[k]=patch[k];if(patch.originalExpiry!==undefined)for(const p of stock.profiles||[])p.extraDaysRequired=extraDays(p.customerExpiry,stock.originalExpiry);stock.updatedAt=new Date().toISOString();stock.reminderSent={};return stock;}
function trackTelegramMessage(target,{chatId,messageId,kind='delivery',sentAt=new Date().toISOString(),...metadata}){
 if(!target||chatId===undefined||messageId===undefined)throw Error('Target, chatId and messageId are required');
 target.telegramMessages ||= [];
 const ref={chatId:String(chatId),messageId:Number(messageId),kind:String(kind),sentAt,...metadata};
 const index=target.telegramMessages.findIndex(x=>String(x.chatId)===ref.chatId&&Number(x.messageId)===ref.messageId);
 if(index>=0)target.telegramMessages[index]=ref;else target.telegramMessages.push(ref);
 return ref;
}
function collectStockMessageRefs(data,stock){
 const refs=[];const seen=new Set();const add=(owner,ref)=>{if(!ref?.chatId||!ref?.messageId)return;const key=`${ref.chatId}:${ref.messageId}`;if(seen.has(key))return;seen.add(key);refs.push({...ref,ownerId:owner.id||owner.id});};
 for(const order of data.orders||[])for(const item of order.items||[]){if(String(item.stockId||'')!==String(stock.id))continue;for(const ref of item.telegramMessages||[])add(item,ref);for(const ref of order.telegramMessages||[])add(order,ref);}
 for(const profile of stock.profiles||[])for(const ref of profile.telegramMessages||[])add(profile,ref);
 return refs;
}
function extendOriginalExpiry(stock,newExpiry,{by='',now=new Date().toISOString()}={}){
 if(!stock)throw Error('Stock not found');if(stock.nextCycleStockId)throw Error('A newer stock cycle already exists. Extend the current active cycle instead.');const next=String(newExpiry||'');if(parseDay(next)===null)throw Error('Invalid original account expiry date');const previous=String(stock.originalExpiry||'');if(parseDay(previous)===null)throw Error('A valid current original expiry date is required');if(next<=previous)throw Error('New original expiry must be later than current expiry');
 stock.expiryHistory||=[];stock.expiryHistory.push({type:'EXPIRY_EXTENSION',from:previous,to:next,at:now,by:String(by)});stock.originalExpiry=next;stock.reminderSent={};
 const active=(stock.profiles||[]).filter(p=>p.active!==false&&p.status!=='Deleted');const occupied=active.filter(p=>Boolean(p.customerId||p.customerLinked||p.assignedOrderItemId||p.reservedForItemId)).length;const limit=slotLimit(stock.product);stock.status=occupied>=limit?'Fully Allocated':occupied>0?'Partially Allocated':'Available';stock.lifecycleStatus='Active';delete stock.archivedAt;
 for(const p of stock.profiles||[])if(p.active!==false&&p.customerExpiry)p.extraDaysRequired=extraDays(p.customerExpiry,next);stock.updatedAt=now;return {stock,previousExpiry:previous,newExpiry:next,preservedProfiles:active.length,preservedHistory:true};
}
function syncStockToOrders(data,stock){
 if(!data||!stock)throw Error('Data and stock are required');
 let updated=0;
 const profiles=new Map((stock.profiles||[]).map(p=>[String(p.id),p]));
 for(const order of data.orders||[])for(const item of order.items||[]){
  const profile=profiles.get(String(item.stockProfileId||''));
  if(String(item.stockId||'')!==String(stock.id)&&!profile)continue;
  item.stockId=stock.id;
  item.accountEmail=stock.email||null;
  item.accountPassword=stock.password||null;
  if(profile){item.customerExpiry=profile.customerExpiry||item.customerExpiry||null;item.extraDaysRequired=extraDays(profile.customerExpiry,stock.originalExpiry);item.profileName=profile.profile;}
  item.originalExpiry=stock.originalExpiry||null;
  item.stockUpdatedAt=new Date().toISOString();
  updated++;
 }
 return updated;
}


function aggregateOrderStatus(order){
 if(!order||!Array.isArray(order.items)||!order.items.length)return order?.status||'Pending';
 const items=order.items;
 const completed=items.filter(i=>i.status==='Completed').length;
 const rejected=items.filter(i=>i.status==='Rejected').length;
 if(completed===items.length)return 'Completed';
 if(rejected===items.length)return 'Rejected';
 if(completed+rejected===items.length)return 'Partially Completed';
 if(items.some(i=>i.status==='Processing'))return 'Processing';
 if(items.some(i=>i.status==='Accepted'))return 'Accepted';
 if(items.some(i=>i.status==='Manual Delivery'))return 'Manual Delivery';
 if(items.some(i=>i.status==='Awaiting Stock'))return 'Awaiting Stock';
 if(items.some(i=>i.status==='Pending'))return 'Pending';
 return order.status||'Pending';
}
function setOrderItemStatus(order,itemId,next){
 const item=order?.items?.find(i=>String(i.id)===String(itemId));if(!item)throw Error('Order item not found');
 const allowed={Pending:['Accepted','Rejected'],Accepted:['Processing','Rejected'],Processing:['Rejected'], 'Awaiting Stock':['Processing','Rejected'],'Manual Delivery':['Processing','Rejected'],Completed:[],Rejected:[]};
 if(!(allowed[item.status]||[]).includes(next))throw Error(`Invalid item transition ${item.status} → ${next}`);
 item.status=next;item.updatedAt=new Date().toISOString();order.status=aggregateOrderStatus(order);order.updatedAt=new Date().toISOString();return {order,item};
}

function createFreeFireOrder(data,{customerId,customerName='',uid,packageId,packageName,price}){
 const id=String(customerId||'');const gameUid=String(uid||'').trim();const name=String(packageName||'').trim();const amount=Number(price);
 if(!/^\d{6,15}$/.test(gameUid))throw Error('Valid Free Fire UID is required');
 if(!name||!Number.isFinite(amount)||amount<=0)throw Error('Valid Free Fire package and price are required');
 const orderId=newOrderId(data);const now=new Date().toISOString();
 const item={id:`${orderId}-01`,mainOrderId:orderId,product:'Free Fire',packageId:String(packageId||''),packageName:name,uid:gameUid,customerId:id,customerName:String(customerName||id),price:amount,status:'Pending Purchase',paymentStatus:'Pending',purchaseStatus:'Pending',createdAt:now,telegramMessages:[]};
 const order={id:orderId,orderCode:orderId,orderType:'Free Fire Top-up',product:'Free Fire',packageName:name,uid:gameUid,customerId:id,customerName:String(customerName||id),quantity:1,price:amount,items:[item],status:'Pending Purchase',purchaseStatus:'Pending',paymentStatus:'Pending',createdAt:now};
 (data.orders||=[]).push(order);return order;
}
function createCustomerSubscriptionOrder(data,{customerId,customerName='',product,packageName='Standard',durationDays=0,quantity=1,priceEach,productId=''}){
 const id=String(customerId||'');const name=String(product||'').trim();const pkg=String(packageName||'Standard').trim();
 quantity=Number(quantity);priceEach=Number(priceEach);durationDays=Number(durationDays)||0;
 if(!/^\d{5,20}$/.test(id))throw Error('Valid Telegram customer ID is required');
 if(!name||name.length>80||!pkg||pkg.length>80)throw Error('Valid product and package are required');
 if(!Number.isInteger(quantity)||quantity<1||quantity>10||!Number.isFinite(priceEach)||priceEach<=0)throw Error('Quantity must be 1–10 and price must be positive');
 const now=new Date().toISOString(),orderId=newOrderId(data),items=[];
 for(let i=0;i<quantity;i++)items.push({id:`${orderId}-${String(i+1).padStart(2,'0')}`,mainOrderId:orderId,customerId:id,customerName:String(customerName||id),product:name,productId:String(productId||''),packageName:pkg,durationDays,price:priceEach,status:'Awaiting Stock',paymentStatus:'Pending',createdAt:now,telegramMessages:[]});
 const order={id:orderId,orderCode:orderId,orderType:'Subscription',product:name,packageName:pkg,customerId:id,customerName:String(customerName||id),quantity,price:priceEach*quantity,items,status:'Awaiting Stock',paymentStatus:'Pending',createdAt:now,history:[{action:'ORDER_CREATED',actor:id,details:{quantity,product:name,packageName:pkg},at:now}]};
 (data.orders||=[]).push(order);return order;
}

function markFreeFirePurchaseCompleted(order,itemId){
 if(!order||order.orderType!=='Free Fire Top-up')throw Error('Free Fire order not found');
 const item=(order.items||[]).find(x=>String(x.id)===String(itemId));if(!item)throw Error('Order item not found');
 if(item.purchaseStatus==='Completed'||item.status==='Completed')throw Error('Purchase already completed');
 item.purchaseStatus='Completed';item.status='Completed';item.purchaseCompletedAt=new Date().toISOString();
 order.purchaseStatus='Completed';order.status='Completed';order.completedAt=item.purchaseCompletedAt;order.updatedAt=item.purchaseCompletedAt;return {order,item};
}

function createResellerBuyOrder(data,{resellerId,customerId,customerName,product,quantity=1,priceEach,stockProfileIds=[]}){
 const r=data.resellers?.[String(resellerId)];if(!r||!r.active)throw Error('Active reseller not found');quantity=Number(quantity);priceEach=Number(priceEach);if(!Number.isInteger(quantity)||quantity<1||quantity>20||!Number.isFinite(priceEach)||priceEach<=0)throw Error('Invalid quantity or price');
 const now=new Date().toISOString(),main=newOrderId(data);const items=[];
 for(let i=0;i<quantity;i++){const itemId=`${main}-${String(i+1).padStart(2,'0')}`;items.push({id:itemId,mainOrderId:main,resellerId:String(resellerId),customerId:String(customerId||''),customerName:String(customerName||''),product,price:priceEach,status:'Pending',paymentStatus:'Due',stockProfileId:stockProfileIds[i]||null,createdAt:now,telegramMessages:[]});}
 const order={id:main,orderCode:main,resellerId:String(resellerId),customerId:String(customerId||''),customerName:String(customerName||''),product,quantity,price:priceEach*quantity,items,status:'Pending',paymentStatus:'Due',createdAt:now};(data.orders||= []).push(order);(data.ledger||=[]).push({id:`LED-${Date.now()}`,resellerId:String(resellerId),orderId:main,type:'SALE_DUE',debit:order.price,credit:0,balanceDelta:order.price,createdAt:now,note:`${quantity} x ${product}`});return order;
}

function createResellerCartOrder(data,{resellerId,lines=[]}){
 const r=data.resellers?.[String(resellerId)];if(!r||!r.active)throw Error('Active reseller not found');
 if(!r.creditAuthorized)throw Error('Reseller credit purchasing is not authorized by Admin');
 if(!Array.isArray(lines)||!lines.length||lines.length>20)throw Error('Cart must contain 1–20 product lines');
 const clean=lines.map(x=>({product:String(x.product||'').trim(),quantity:Number(x.quantity),priceEach:Number(x.priceEach),packageName:String(x.packageName||''),durationDays:Number(x.durationDays||0)}));
 if(clean.some(x=>!x.product||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>20||!Number.isFinite(x.priceEach)||x.priceEach<=0)||clean.reduce((n,x)=>n+x.quantity,0)>20)throw Error('Invalid cart product, quantity or price (maximum 20 items)');
 const now=new Date().toISOString(),main=newOrderId(data),items=[];let seq=0;
 for(const line of clean)for(let i=0;i<line.quantity;i++){seq++;items.push({id:`${main}-${String(seq).padStart(2,'0')}`,mainOrderId:main,resellerId:String(resellerId),customerId:String(resellerId),customerName:String(r.name||'Reseller'),product:line.product,packageName:line.packageName,durationDays:line.durationDays,price:line.priceEach,status:'Awaiting Stock',paymentStatus:'Due',createdAt:now,telegramMessages:[]});}
 const total=items.reduce((n,x)=>n+x.price,0),order={id:main,orderCode:main,resellerId:String(resellerId),customerId:String(resellerId),customerName:String(r.name||'Reseller'),product:clean.length===1?clean[0].product:'Multiple Products',quantity:items.length,price:total,items,status:'Awaiting Stock',paymentStatus:'Due',deliveryMode:'Auto',createdAt:now,deliveryDueAt:new Date(Date.now()+30*60*1000).toISOString(),slaMinutes:30};
 (data.orders||=[]).push(order);(data.ledger||=[]).push({id:`LED-${Date.now()}-${main}`,resellerId:String(resellerId),orderId:main,type:'SALE_DUE',debit:total,credit:0,balanceDelta:total,createdAt:now,note:`${items.length} item reseller cart`});return order;
}

function findAvailableProfile(stock,item){
 stock.profiles ||= [];
 const usable = p => p && p.active!==false && p.status!=='Deleted' && String(p.profile||'').trim().length>0;
 const existing=stock.profiles.find(p=>usable(p)&&p.id===item.stockProfileId&&p.reservedForItemId===item.id);
 if(existing)return existing;
 const free=stock.profiles.find(p=>usable(p)&&!p.customerId&&!p.customerLinked&&!p.reservedForItemId&&!p.assignedOrderItemId&&p.status!=='Expired');
 if(free){free.reservedForItemId=item.id;return free;}
 // Never auto-create a profile during delivery. Expired customer profiles remain unavailable until an Admin explicitly reactivates the slot.
 return null;
}
function reactivateExpiredProfile(stock,profileId,{by='',now=new Date().toISOString()}={}){
 if(!stock)throw Error('Stock not found');
 if(stock.lifecycleStatus==='Archived'||stock.status==='Archived'||String(stock.originalExpiry||'')<todayKey())throw Error('Expired or archived stock cannot reactivate a profile slot');
 const p=(stock.profiles||[]).find(x=>String(x.id)===String(profileId));
 if(!p||p.active===false||p.status==='Deleted')throw Error('Profile not found or deleted');
 if(!p.customerExpiry||String(p.customerExpiry)>=todayKey())throw Error('Only an expired customer profile can be reactivated');
 p.history||=[];p.history.push({type:'EXPIRED_PROFILE_RELEASED',customerId:p.customerId||null,customerLinked:Boolean(p.customerLinked),customerName:p.customerName||'',customerExpiry:p.customerExpiry,resellerId:p.resellerId||null,orderItemId:p.assignedOrderItemId||null,endedAt:now,reactivatedBy:String(by)});
 Object.assign(p,{customerId:null,customerLinked:false,customerName:'',customerExpiry:null,extraDaysRequired:0,resellerId:null,assignedOrderItemId:null,reservedForItemId:null,customerExpiryReminderSent:{},status:'Available',reactivatedAt:now,reactivatedBy:String(by)});
 const active=(stock.profiles||[]).filter(x=>x.active!==false&&x.status!=='Deleted');
 const occupied=active.filter(x=>x.customerId||x.customerLinked||x.assignedOrderItemId||x.reservedForItemId).length;
 stock.status=occupied>=slotLimit(stock.product)?'Fully Allocated':occupied?'Partially Allocated':'Available';stock.updatedAt=now;return p;
}

function prepareResellerAutoDelivery(data,order,stocks){
 const prepared=[];
 for(const item of order.items||[]){
  if(['Completed','Rejected'].includes(item.status))continue;
  let stock=stocks.filter(s=>s.lifecycleStatus!=="Archived"&&s.status!=="Archived"&&String(s.originalExpiry||"")>=todayKey()&&normalizeProductKey(s.product)===normalizeProductKey(item.product||order.product)&&((s.profiles||[]).some(p=>p.active!==false&&p.status!=='Deleted'&&String(p.profile||'').trim()&&p.reservedForItemId===item.id)||((s.profiles||[]).some(p=>p.active!==false&&p.status!=='Deleted'&&String(p.profile||'').trim()&&!p.customerId&&!p.customerLinked&&!p.reservedForItemId&&!p.assignedOrderItemId)))).sort((a,b)=>String(a.originalExpiry).localeCompare(String(b.originalExpiry))||String(a.id).localeCompare(String(b.id)))[0];
  if(item.stockId){const pinned=stocks.find(s=>s.id===item.stockId&&s.lifecycleStatus!=="Archived"&&s.status!=="Archived"&&String(s.originalExpiry||"")>=todayKey()&&normalizeProductKey(s.product)===normalizeProductKey(item.product||order.product));if(pinned)stock=pinned;}
  if(!stock){item.status='Awaiting Stock';continue;}
  let profile=findAvailableProfile(stock,item);
  if(!profile){item.status='Awaiting Stock';continue;}
  profile.customerId=String(order.resellerId);
  profile.customerName=String(data.resellers?.[String(order.resellerId)]?.name||order.customerName||'Reseller');
  stock.lifecycleStatus='Active';const activeSlots=stock.profiles.filter(p=>p.active!==false&&p.status!=='Deleted');const occupiedSlots=activeSlots.filter(p=>p.customerId||p.customerLinked||p.assignedOrderItemId||p.reservedForItemId).length;stock.status=occupiedSlots>=slotLimit(stock.product)?'Fully Allocated':occupiedSlots===0?'Available':'Partially Allocated';
  profile.resellerId=String(order.resellerId);
  item.stockId=stock.id;item.stockProfileId=profile.id;item.profileName=profile.profile;item.accountEmail=stock.email;item.accountPassword=stock.password;item.status='Processing';item.customerValidityPending=true;
  item.customerId=String(order.resellerId);item.customerName=String(profile.customerName);
  prepared.push({item,stock,profile,recipient:String(order.resellerId)});
 }
 order.status=aggregateOrderStatus(order);order.updatedAt=new Date().toISOString();return prepared;
}
function markResellerDeliverySuccess(order,item,profile,stock){
 const expiryDate=new Date(`${todayKey()}T00:00:00+06:00`);expiryDate.setDate(expiryDate.getDate()+Math.max(1,Number(item.durationDays)||30));
 const customerExpiry=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(expiryDate);
 profile.customerExpiry=customerExpiry;profile.extraDaysRequired=extraDays(customerExpiry,stock?.originalExpiry);profile.customerExpiryReminderSent={};profile.status='Running';profile.reservedForItemId=null;profile.assignedOrderItemId=item.id;profile.linkedAt=profile.linkedAt||new Date().toISOString();
 item.customerExpiry=customerExpiry;item.customerValidityPending=false;item.status='Completed';item.deliveredAt=new Date().toISOString();order.status=aggregateOrderStatus(order);order.updatedAt=new Date().toISOString();return customerExpiry;
}
function settleResellerDue(data,resellerId,amount,meta={}){const id=String(resellerId);const due=dueForReseller(data,id);const paid=Number(amount);if(!Number.isFinite(paid)||paid<=0)throw Error('Settlement amount must be greater than zero');if(due<=0)throw Error('No outstanding due');if(paid>due)throw Error(`Payment exceeds outstanding due (${due})`);const trx=String(meta.transactionId||'').trim();if(trx&&(data.ledger||[]).some(x=>String(x.transactionId||'').toLowerCase()===trx.toLowerCase()))throw Error('This Transaction ID has already been used');const now=new Date().toISOString();const row={id:`LED-${Date.now()}`,resellerId:id,type:paid===due?'FULL_SETTLEMENT':'PARTIAL_SETTLEMENT',debit:0,credit:paid,balanceDelta:-paid,amount:paid,transactionId:trx||null,paymentMethod:String(meta.paymentMethod||''),confirmedBy:String(meta.confirmedBy||''),requestId:meta.requestId||null,createdAt:now,note:meta.note||'Admin-confirmed reseller payment'};(data.ledger||=[]).push(row);return row;}
function customerOwnOrders(data,userId){return(data.orders||[]).filter(o=>String(o.customerId)===String(userId)||(o.items||[]).some(i=>String(i.customerId)===String(userId)));}

function deleteTestOrder(data,orderId){
 const order=(data.orders||[]).find(o=>String(o.id)===String(orderId)&&o.isTest===true);
 if(!order)throw Error('Test order not found');
 for(const item of order.items||[])for(const stock of data.stocks||[]){
  const profile=(stock.profiles||[]).find(p=>p.testOrderId===order.id&&(p.id===item.stockProfileId||p.reservedForItemId===item.id));
  if(!profile)continue;
  profile.customerId=null;profile.customerLinked=false;profile.customerName='';profile.resellerId=null;profile.customerExpiry=null;profile.extraDaysRequired=0;profile.reservedForItemId=null;profile.assignedOrderItemId=null;profile.testOrderId=null;profile.customerExpiryReminderSent={};profile.status='Available';profile.telegramMessages=(profile.telegramMessages||[]).filter(ref=>!(item.telegramMessages||[]).some(x=>String(x.chatId)===String(ref.chatId)&&Number(x.messageId)===Number(ref.messageId)));
  const occupied=(stock.profiles||[]).some(p=>p.active!==false&&(p.customerId||p.customerLinked));
  stock.status=occupied?'Partially Allocated':'Available';
 }
 data.orders=(data.orders||[]).filter(o=>o.id!==order.id);
 data.ledger=(data.ledger||[]).filter(x=>x.orderId!==order.id);
 return {orderId:order.id,removedLedger:true,releasedProfiles:true};
}

function dueForReseller(data,id){return(data.ledger||[]).filter(x=>!x.isTest&&String(x.resellerId)===String(id)).reduce((n,x)=>n+Number(x.debit||0)-Number(x.credit||0),0);}
module.exports={SLOT_LIMITS,STOCK_REMINDER_DAYS,normalizeProductKey,newOrderId,slotLimit,extraDays,expiryReminderDue,markExpiryReminderSent,linkProfile,linkNamedCustomer,unlinkProfile,updateAccount,extendOriginalExpiry,syncStockToOrders,trackTelegramMessage,collectStockMessageRefs,createFreeFireOrder,createCustomerSubscriptionOrder,markFreeFirePurchaseCompleted,createResellerBuyOrder,createResellerCartOrder,findAvailableProfile,reactivateExpiredProfile,prepareResellerAutoDelivery,markResellerDeliverySuccess,settleResellerDue,customerOwnOrders,deleteTestOrder,dueForReseller,todayKey,aggregateOrderStatus,setOrderItemStatus};
