'use strict';
function validDate(value){const s=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T12:00:00+06:00`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function renewalExpiry({currentExpiry,mode='date',days,expiryDate,today}){
 if(!validDate(today)||!validDate(currentExpiry))throw new Error('A valid current expiry and today date are required');
 let next;
 if(mode==='days'){
  const n=Number(days);if(!Number.isInteger(n)||n<1||n>3650)throw new Error('Renewal days must be between 1 and 3650');
  const base=currentExpiry>=today?currentExpiry:today,d=new Date(`${base}T12:00:00+06:00`);d.setDate(d.getDate()+n);next=d.toISOString().slice(0,10);
 }else next=String(expiryDate||'');
 if(!validDate(next)||next<=currentExpiry||next<today)throw new Error('New Customer Expiry must be later than the current expiry');
 const base=currentExpiry>=today?currentExpiry:today;
 return {expiry:next,daysAdded:Math.round((new Date(`${next}T12:00:00+06:00`)-new Date(`${base}T12:00:00+06:00`))/86400000)};
}
function replacementSubscription(profile,newStock){if(!profile?.customerId||!validDate(profile.customerExpiry))throw new Error('A linked customer and valid expiry are required');return {customerId:String(profile.customerId),customerName:String(profile.customerName||profile.customerId),resellerId:profile.resellerId||null,customerExpiry:profile.customerExpiry,customerExpiryReminderSent:{},extraDaysRequired:Math.max(0,Math.round((new Date(`${profile.customerExpiry}T12:00:00+06:00`)-new Date(`${newStock.originalExpiry}T12:00:00+06:00`))/86400000))};}
module.exports={validDate,renewalExpiry,replacementSubscription};
