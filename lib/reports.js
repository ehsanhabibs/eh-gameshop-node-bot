'use strict';
const TZ = 'Asia/Dhaka';
const CLOSED = new Set(['Rejected', 'Cancelled']);
const PAID = new Set(['Verified', 'Paid', 'Completed']);
function dateKey(value) {
  const d = new Date(value || 0);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function validOrders(orders) { return (orders || []).filter(o => !o.isTest && !CLOSED.has(o.status)); }
function sums(orders) {
  const valid = validOrders(orders);
  const sales = valid.reduce((n, o) => n + Number(o.price || 0), 0);
  const received = valid.filter(o => PAID.has(o.paymentStatus)).reduce((n, o) => n + Number(o.price || 0), 0);
  return { orders: valid.length, sales, received, due: Math.max(0, sales - received) };
}
function productRows(orders) {
  const map = new Map();
  for (const o of validOrders(orders)) {
    const items = Array.isArray(o.items) && o.items.length ? o.items : [null];
    const total = Number(o.price || 0);
    const itemPrice = items.length ? total / items.length : total;
    for (const item of items) {
      const product = item?.product || item?.productName || o.productName || o.product || 'Unknown';
      const row = map.get(product) || { product, quantity: 0, amount: 0 };
      row.quantity += Math.max(1, Number(item?.quantity || 1));
      row.amount += item?.price != null ? Number(item.price) : itemPrice;
      map.set(product, row);
    }
  }
  return [...map.values()].sort((a, b) => a.product.localeCompare(b.product));
}
function dailyReport(orders, date) {
  const rows = validOrders(orders).filter(o => dateKey(o.createdAt || o.date) === date);
  const products = productRows(rows);
  return { date, ...sums(rows), products, items: rows.map(o => ({ id: o.id || o.orderCode, customerId: o.customerId || o.userId || null, customerName: o.customerName || null, product: o.productName || o.product || (o.items || []).map(i => i.product).filter(Boolean).join(', ') || 'Unknown', price: Number(o.price || 0), status: o.status || 'Pending', paymentStatus: o.paymentStatus || 'Due', createdAt: o.createdAt || o.date || null })) };
}
function monthlyReport(orders, year, month) {
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-`;
  const rows = validOrders(orders).filter(o => dateKey(o.createdAt || o.date).startsWith(prefix));
  const daily = new Map();
  for (const o of rows) { const day = dateKey(o.createdAt || o.date); daily.set(day, (daily.get(day) || 0) + Number(o.price || 0)); }
  return { year: Number(year), month: Number(month), ...sums(rows), products: productRows(rows), daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => ({ day, amount })) };
}
function lifetimePurchases(orders, customers = {}) {
  const map = new Map();
  for (const o of validOrders(orders)) {
    const id = String(o.customerId || o.userId || '');
    // Reseller credit purchases without an end-customer are reseller liabilities, not customer purchases.
    if (!id) continue;
    const customer = customers[id] || {};
    const row = map.get(id) || { customerId: id, name: o.customerName || customer.name || id, orders: 0, quantity: 0, purchase: 0, received: 0, due: 0, lastPurchase: null, products: {} };
    row.orders += 1;
    row.purchase += Number(o.price || 0);
    if (PAID.has(o.paymentStatus)) row.received += Number(o.price || 0); else row.due += Number(o.price || 0);
    const items = Array.isArray(o.items) && o.items.length ? o.items : [null];
    for (const item of items) {
      const product = item?.product || item?.productName || o.productName || o.product || 'Unknown';
      const qty = Math.max(1, Number(item?.quantity || 1));
      row.quantity += qty;
      row.products[product] = (row.products[product] || 0) + qty;
    }
    const at = o.createdAt || o.date || null;
    if (at && (!row.lastPurchase || new Date(at) > new Date(row.lastPurchase))) row.lastPurchase = at;
    if (o.customerName) row.name = o.customerName;
    map.set(id, row);
  }
  return [...map.values()].map(r => ({ ...r, products: Object.entries(r.products).map(([product, quantity]) => ({ product, quantity })).sort((a,b) => b.quantity-a.quantity) })).sort((a,b) => b.purchase-a.purchase);
}
module.exports = { dateKey, sums, productRows, dailyReport, monthlyReport, lifetimePurchases };
