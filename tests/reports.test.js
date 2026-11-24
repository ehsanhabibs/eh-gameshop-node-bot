'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../lib/reports');
const orders = [
  { id:'A', customerId:'100', customerName:'A', product:'Prime', price:80, paymentStatus:'Verified', status:'Completed', createdAt:'2026-11-01T01:00:00+06:00' },
  { id:'B', customerId:'100', customerName:'A', product:'YouTube', price:120, paymentStatus:'Pending', status:'Processing', createdAt:'2026-11-01T20:00:00+06:00' },
  { id:'C', customerId:'200', customerName:'B', product:'Prime', price:70, paymentStatus:'Verified', status:'Completed', createdAt:'2026-10-31T23:00:00Z' },
  { id:'D', customerId:'100', product:'VPN', price:50, paymentStatus:'Verified', status:'Rejected', createdAt:'2026-11-01T10:00:00+06:00' },
  { id:'R', resellerId:'300', orderType:'Reseller', product:'Prime', price:200, paymentStatus:'Due', status:'Awaiting Stock', createdAt:'2026-11-01T10:00:00+06:00' }
];
test('daily report uses Asia/Dhaka date and excludes rejected orders',()=>{const x=r.dailyReport(orders,'2026-11-01');assert.equal(x.orders,4);assert.equal(x.sales,470);assert.equal(x.received,150);assert.equal(x.due,320);assert.equal(x.products.length,2);});
test('monthly report summarizes month totals and daily totals in Dhaka timezone',()=>{const x=r.monthlyReport(orders,2026,11);assert.equal(x.orders,4);assert.equal(x.sales,470);assert.deepEqual(x.daily,[{day:'2026-11-01',amount:470}]);});
test('lifetime summary groups customer purchases across all time and excludes reseller-only credit orders',()=>{const x=r.lifetimePurchases(orders,{'100':{name:'A saved'}});assert.equal(x.length,2);const a=x.find(v=>v.customerId==='100');assert.equal(a.name,'A');assert.equal(a.orders,2);assert.equal(a.quantity,2);assert.equal(a.purchase,200);assert.equal(a.received,80);assert.equal(a.due,120);assert.equal(a.products.length,2);});
test('daily report returns zero totals for a date with no sales',()=>{assert.deepEqual(r.dailyReport(orders,'2026-11-02').orders,0);});

test('test orders are excluded from business reports and lifetime summaries',()=>{
  const rows=[{id:'LIVE',customerId:'1',product:'Prime',price:80,paymentStatus:'Verified',status:'Completed',createdAt:'2026-11-02T10:00:00+06:00'},{id:'TEST',customerId:'1',product:'Prime',price:900,paymentStatus:'Verified',status:'Completed',isTest:true,createdAt:'2026-11-02T10:00:00+06:00'}];
  assert.equal(r.dailyReport(rows,'2026-11-02').sales,80);
  assert.equal(r.lifetimePurchases(rows).find(x=>x.customerId==='1').purchase,80);
});
