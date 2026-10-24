'use strict';
// Lab-only demo shop for the HDD hackathon demo (fictional brand "CoreByte", fake data only).
// This is a plain shop: it has no protection of its own. Put it behind Hack Dev Defence (HDD) with the HDD guide.
// The admin login builds its SQL by string concatenation when SHOP_VULN is not "0", on purpose, so HDD can be shown
// blocking the injection. Set SHOP_VULN=0 for the fixed (parameterised) behaviour. Never reuse this code in a real shop.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const ui = require('../lib/ui');

const VULN = process.env.SHOP_VULN !== '0';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'; // hdd-secret-scan:allow (lab demo credential, fake data)
const hash = (p) => crypto.createHash('sha256').update('hdd-demo:' + p).digest('hex');

const PRODUCTS = [
  ['VX-4070TI-12', 'Voltrix VX 4070 Ti 12GB GDDR6X', 'Voltrix', 'gpu', 649.99, 719.99, 4.7, 412, 14, '12 GB GDDR6X|192-bit|3 fans|PCIe 4.0 x16'],
  ['VX-4060-8', 'Voltrix VX 4060 8GB Dual Fan', 'Voltrix', 'gpu', 299.99, 329.99, 4.5, 880, 33, '8 GB GDDR6|128-bit|2 fans|PCIe 4.0 x8'],
  ['NC-N78', 'NovaCore N7-7800 8-Core 5.0 GHz', 'NovaCore', 'cpu', 329.0, 369.0, 4.8, 640, 21, '8 cores / 16 threads|5.0 GHz boost|AM5|65 W'],
  ['NC-N56', 'NovaCore N5-5600 6-Core 4.4 GHz', 'NovaCore', 'cpu', 179.0, 179.0, 4.6, 1210, 48, '6 cores / 12 threads|4.4 GHz boost|AM4|65 W'],
  ['QT-D5-32', 'Quantik 32GB (2x16GB) DDR5-6000 CL30', 'Quantik', 'ram', 119.99, 139.99, 4.7, 530, 6, '32 GB kit|DDR5-6000|CL30|RGB heat spreader'],
  ['QT-D4-16', 'Quantik 16GB (2x8GB) DDR4-3200 CL16', 'Quantik', 'ram', 44.99, 44.99, 4.6, 2040, 120, '16 GB kit|DDR4-3200|CL16|low profile'],
  ['HX-NV1', 'Helix NVMe Gen4 SSD 1TB', 'Helix', 'ssd', 79.99, 99.99, 4.8, 1560, 64, '1 TB|7,000 MB/s read|M.2 2280|5-year warranty'],
  ['HX-NV2', 'Helix NVMe Gen4 SSD 2TB', 'Helix', 'ssd', 139.99, 169.99, 4.8, 940, 9, '2 TB|7,000 MB/s read|M.2 2280|heatsink'],
  ['HX-SA5', 'Helix SATA SSD 500GB', 'Helix', 'ssd', 39.99, 39.99, 4.4, 3120, 85, '500 GB|560 MB/s read|2.5 inch|3-year warranty'],
  ['AE-B650', 'Aeris B650 ATX WiFi 6E Motherboard', 'Aeris', 'mb', 189.99, 209.99, 4.5, 360, 17, 'AM5|DDR5|PCIe 5.0 M.2|WiFi 6E'],
  ['AE-750G', 'Aeris 750W 80+ Gold Fully Modular PSU', 'Aeris', 'psu', 109.99, 124.99, 4.7, 770, 26, '750 W|80+ Gold|fully modular|10-year warranty'],
  ['AE-MT1', 'Aeris Mesh Mid-Tower Case', 'Aeris', 'case', 89.99, 89.99, 4.6, 450, 3, 'ATX mid-tower|mesh front|4 fans included|tempered glass'],
  ['FL-360', 'Frostline 360mm Liquid CPU Cooler', 'Frostline', 'cooler', 139.99, 159.99, 4.6, 280, 12, '360 mm radiator|3 x 120 mm fans|AM5 / LGA1700|ARGB'],
  ['LM-27Q', 'Lumen 27" QHD 165Hz IPS Gaming Monitor', 'Lumen', 'monitor', 279.99, 329.99, 4.7, 510, 15, '27 inch|2560x1440|165 Hz|1 ms|IPS'],
  ['KY-MK75', 'Keyed MK75 Hot-swap Mechanical Keyboard', 'Keyed', 'kb', 79.99, 89.99, 4.6, 690, 41, '75% layout|hot-swap switches|RGB|USB-C'],
  ['KY-MX2', 'Keyed MX2 Wireless Gaming Mouse', 'Keyed', 'kb', 59.99, 59.99, 4.5, 1180, 0, '26,000 DPI|2.4 GHz wireless|70 h battery|63 g'],
];
const SEED_ORDERS = [
  ['Asha Rai', 'asha.rai@example.test', 3, 1, 'delivered', 9], ['Bimal Thapa', 'bimal.thapa@example.test', 1, 1, 'shipped', 2],
  ['Carol Diaz', 'carol.diaz@example.test', 14, 2, 'delivered', 8], ['Dev Karki', 'dev.karki@example.test', 7, 1, 'delivered', 7],
  ['Elena Petrova', 'elena.p@example.test', 12, 1, 'processing', 1], ['Farhan Ali', 'farhan.ali@example.test', 5, 2, 'shipped', 3],
  ['Grace Liu', 'grace.liu@example.test', 11, 1, 'delivered', 6], ['Hari Shrestha', 'hari.s@example.test', 2, 1, 'cancelled', 5],
  ['Isha Gurung', 'isha.g@example.test', 15, 1, 'processing', 0], ['Jon Weber', 'jon.weber@example.test', 8, 1, 'delivered', 4],
  ['Kiran Bista', 'kiran.b@example.test', 13, 1, 'shipped', 1], ['Lena Fischer', 'lena.f@example.test', 4, 1, 'delivered', 10],
];

let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const wasm = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
      const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasm) });
      const d = new SQL.Database();
      d.run(`CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY, sku TEXT, name TEXT, brand TEXT, cat TEXT, price REAL, was REAL, rating REAL, reviews INTEGER, stock INTEGER, specs TEXT);
CREATE TABLE orders(id INTEGER PRIMARY KEY, customer TEXT, email TEXT, item TEXT, qty INTEGER, total REAL, status TEXT, created TEXT);`);
      d.run('INSERT INTO users VALUES(1,?,?,?)', ['admin', hash(ADMIN_PASSWORD), 'admin']);
      d.run('INSERT INTO users VALUES(2,?,?,?)', ['staff', hash(crypto.randomBytes(9).toString('base64url')), 'staff']);
      PRODUCTS.forEach((p, i) => d.run('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?)', [i + 1, ...p]));
      SEED_ORDERS.forEach((o, i) => {
        const p = PRODUCTS[o[2] - 1];
        d.run('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)', [i + 1, o[0], o[1], p[1], o[3], +(p[4] * o[3]).toFixed(2), o[4], new Date(Date.now() - o[5] * 86400000).toISOString().slice(0, 10)]);
      });
      return d;
    })();
  }
  return dbPromise;
}

const sign = (v) => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function verify(cookie) {
  const m = /(?:^|; )hddshop=([^;]+)/.exec(cookie || '');
  if (!m) return null;
  let raw;
  try { raw = decodeURIComponent(m[1]); } catch (e) { return null; }
  const i = raw.lastIndexOf('.');
  const v = raw.slice(0, i);
  const mac = raw.slice(i + 1);
  const ok = crypto.createHmac('sha256', SECRET).update(v).digest('hex');
  return v && mac.length === ok.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(ok)) ? v : null;
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let n = 0;
  for await (const c of req) { n += c.length; if (n > 65536) throw new Error('body too large'); chunks.push(c); }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}
const rows = (d, sql, p) => { const r = d.exec(sql, p); return r.length ? r[0].values.map((v) => Object.fromEntries(r[0].columns.map((c, i) => [c, v[i]]))) : []; };

function login(d, user, pass) {
  if (VULN) {
    // Deliberately injectable: user input is concatenated into the SQL text.
    return rows(d, "SELECT id, username, role FROM users WHERE username='" + user + "' AND password='" + hash(pass) + "'");
  }
  return rows(d, 'SELECT id, username, role FROM users WHERE username = ? AND password = ?', [user, hash(pass)]);
}

const parseCart = (cookie) => {
  const m = /(?:^|; )cart=([^;]*)/.exec(cookie || '');
  if (!m) return [];
  return m[1].split(',').map((x) => x.split('.').map(Number)).filter((x) => x[0] > 0 && x[1] > 0 && x[1] < 20).slice(0, 30);
};
const cartCookie = (items) => `cart=${items.map((x) => x.join('.')).join(',')}; Path=/; SameSite=Lax; Max-Age=86400`;

module.exports = async (req, res) => {
  const send = (code, html, extra = {}) => {
    res.statusCode = code;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('x-content-type-options', 'nosniff');
    Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
    res.end(html);
  };
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const d = await db();
    const cart = parseCart(req.headers.cookie);
    const cartCount = cart.reduce((a, x) => a + x[1], 0);
    if (p === '/healthz') { res.setHeader('content-type', 'application/json'); return res.end('{"ok":true}'); }

    if (p === '/' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').slice(0, 80);
      const c = (url.searchParams.get('c') || '').slice(0, 12);
      const list = rows(d, 'SELECT * FROM products WHERE (name LIKE ? OR brand LIKE ? OR specs LIKE ?) AND (? = \'\' OR cat = ?) ORDER BY id', ['%' + q + '%', '%' + q + '%', '%' + q + '%', c, c]);
      const home = !q && !c;
      const hero = home ? `<section class="hero"><div><h1>Build your next rig with CoreByte</h1><p>Graphics cards, processors, memory and storage from trusted brands. Free shipping over $99.</p><a class="btn" href="/?c=gpu">Shop graphics cards</a></div><div class="art">${ui.art('gpu', 'h')}</div></section>
<div class="perks"><div class="perk"><b>Free shipping</b>On orders over $99</div><div class="perk"><b>30-day returns</b>No questions asked</div><div class="perk"><b>2-year warranty</b>On every component</div><div class="perk"><b>Build advice</b>Chat with our team</div></div>
<div class="sec"><h2>Shop by category</h2></div><div class="cats">${ui.CATS.map(([k, n]) => `<a class="cat" href="/?c=${k}">${ui.art(k, 'k')}${ui.esc(n)}</a>`).join('')}</div>` : '';
      const title = c ? ui.catName(c) : q ? `Results for "${q}"` : 'Top deals this week';
      const side = `<aside class="side"><h3>Categories</h3><a href="/" class="${!c ? 'on' : ''}">All products</a>${ui.CATS.map(([k, n]) => `<a href="/?c=${k}" class="${c === k ? 'on' : ''}">${ui.esc(n)}</a>`).join('')}</aside>`;
      const body = `<div class="wrap">${hero}<div class="lay">${side}<section><div class="sec" style="margin-top:0"><h2>${ui.esc(title)}</h2><span>${list.length} product${list.length === 1 ? '' : 's'}</span></div>${list.length ? `<div class="grid">${list.map(ui.card).join('')}</div>` : '<div class="box">No products match your search. Try a different keyword or browse a category.</div>'}</section></div></div>`;
      return send(200, ui.shell({ title: home ? 'Computer hardware' : title, body, cartCount, active: c, q }));
    }
    if (p === '/product' && req.method === 'GET') {
      const pr = rows(d, 'SELECT * FROM products WHERE id = ?', [Number(url.searchParams.get('id')) || 0])[0];
      if (!pr) return send(404, ui.shell({ title: 'Not found', body: '<div class="wrap"><div class="box" style="margin-top:22px">That product does not exist. <a href="/">Back to the shop</a>.</div></div>', cartCount }));
      const off = pr.was > pr.price ? Math.round((1 - pr.price / pr.was) * 100) : 0;
      const body = `<div class="wrap"><div class="crumb"><a href="/">Home</a> / <a href="/?c=${ui.esc(pr.cat)}">${ui.esc(ui.catName(pr.cat))}</a> / ${ui.esc(pr.name)}</div><div class="pd"><div class="img">${ui.art(pr.cat, 'p')}</div><div><span class="brand">${ui.esc(pr.brand)}</span><h1 style="font-size:26px">${ui.esc(pr.name)}</h1><div class="rt">${ui.stars(pr.rating)} <small>${pr.rating} (${pr.reviews} reviews)</small></div><div class="pr" style="font-size:32px;margin:12px 0">${ui.money(pr.price)}${off ? `<s>${ui.money(pr.was)}</s><em>Save ${off}%</em>` : ''}</div><p>${ui.stockLine(pr.stock)}</p><ul>${String(pr.specs).split('|').map((s) => `<li>${ui.esc(s)}</li>`).join('')}</ul><form method="post" action="/cart/add"><input type="hidden" name="id" value="${Number(pr.id)}"><button class="btn" ${pr.stock <= 0 ? 'disabled' : ''}>Add to cart</button></form><p class="note">SKU ${ui.esc(pr.sku)} · Free shipping over $99 · 30-day returns</p></div></div></div>`;
      return send(200, ui.shell({ title: pr.name, body, cartCount, active: pr.cat }));
    }
    if (p === '/cart/add' && req.method === 'POST') {
      const b = await readBody(req);
      const id = Number(b.id) || 0;
      if (rows(d, 'SELECT id FROM products WHERE id = ?', [id]).length) {
        const hit = cart.find((x) => x[0] === id);
        if (hit) hit[1] = Math.min(hit[1] + 1, 10); else cart.push([id, 1]);
      }
      return send(303, '', { location: '/cart', 'set-cookie': cartCookie(cart) });
    }
    if (p === '/cart/clear' && req.method === 'POST') return send(303, '', { location: '/cart', 'set-cookie': cartCookie([]) });
    if (p === '/cart' && req.method === 'GET') {
      const lines = cart.map(([id, qty]) => ({ pr: rows(d, 'SELECT * FROM products WHERE id = ?', [id])[0], qty })).filter((l) => l.pr);
      const sub = lines.reduce((a, l) => a + l.pr.price * l.qty, 0);
      const ship = sub === 0 || sub >= 99 ? 0 : 9.99;
      const body = `<div class="wrap"><h1 style="margin-top:22px">Shopping cart</h1>${lines.length ? `<div class="row"><table class="tbl"><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th></tr>${lines.map((l) => `<tr><td>${ui.esc(l.pr.name)}</td><td>${ui.money(l.pr.price)}</td><td>${l.qty}</td><td>${ui.money(l.pr.price * l.qty)}</td></tr>`).join('')}</table>
<form class="box" method="post" action="/checkout"><h3>Order summary</h3><p>Subtotal: <b>${ui.money(sub)}</b><br>Shipping: <b>${ship ? ui.money(ship) : 'Free'}</b><br>Total: <b>${ui.money(sub + ship)}</b></p><label>Full name</label><input name="name" required><label>Email</label><input name="email" type="email" required><label>Shipping address</label><input name="address" required><p><button class="btn block">Place order</button></p><p class="note">Demo store: no payment is taken.</p></form></div>
<form method="post" action="/cart/clear" style="margin-top:12px"><button class="btn ghost sm">Empty cart</button></form>` : '<div class="box">Your cart is empty. <a href="/">Continue shopping</a>.</div>'}</div>`;
      return send(200, ui.shell({ title: 'Cart', body, cartCount }));
    }
    if (p === '/checkout' && req.method === 'POST') {
      const b = await readBody(req);
      const lines = cart.map(([id, qty]) => ({ pr: rows(d, 'SELECT * FROM products WHERE id = ?', [id])[0], qty })).filter((l) => l.pr);
      if (!lines.length) return send(303, '', { location: '/cart' });
      let last = 0;
      for (const l of lines) {
        d.run('INSERT INTO orders(customer,email,item,qty,total,status,created) VALUES(?,?,?,?,?,?,?)', [String(b.name || '').slice(0, 80), String(b.email || '').slice(0, 120), l.pr.name, l.qty, +(l.pr.price * l.qty).toFixed(2), 'processing', new Date().toISOString().slice(0, 10)]);
        d.run('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?', [l.qty, l.pr.id]);
        last = rows(d, 'SELECT MAX(id) AS m FROM orders')[0].m;
      }
      return send(200, ui.shell({ title: 'Order placed', cartCount: 0, body: `<div class="wrap"><div class="box" style="margin-top:22px"><h1>Thank you, ${ui.esc(String(b.name || 'customer').slice(0, 80))}</h1><p>Your order <b>#${last}</b> is being processed. A confirmation was sent to ${ui.esc(String(b.email || '').slice(0, 120))}.</p><a class="btn" href="/">Continue shopping</a></div></div>` }), { 'set-cookie': cartCookie([]) });
    }

    if (p === '/admin/login' || (p === '/admin' && req.method === 'POST')) {
      if (req.method === 'POST') {
        const b = await readBody(req);
        let found;
        try { found = login(d, String(b.username || ''), String(b.password || '')); } catch (e) { return send(500, ui.loginPage('Internal error. Please try again.')); }
        if (found.length) {
          const secure = process.env.VERCEL ? '; Secure' : '';
          return send(303, '', { location: '/admin', 'set-cookie': `hddshop=${encodeURIComponent(sign(found[0].username + ':' + found[0].role))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${secure}` });
        }
        return send(401, ui.loginPage('Invalid username or password.'));
      }
      return send(200, ui.loginPage(''));
    }
    if (p === '/admin/logout') return send(303, '', { location: '/admin/login', 'set-cookie': 'hddshop=; HttpOnly; Path=/; Max-Age=0' });
    if (p === '/admin' || p.startsWith('/admin/')) {
      const who = verify(req.headers.cookie);
      if (!who || !/:admin$/.test(who)) return send(303, '', { location: '/admin/login' });
      const name = who.split(':')[0];
      const tab = p === '/admin' ? '' : p.slice(7);
      const shell = (title, body) => send(200, ui.adminShell({ title, body, who: name, active: tab }));
      const orders = rows(d, 'SELECT * FROM orders ORDER BY id DESC');
      const pill = (s) => `<span class="pill ${ui.esc(s)}">${ui.esc(s)}</span>`;
      const otable = (list) => `<table class="tbl"><tr><th>Order</th><th>Date</th><th>Customer</th><th>Item</th><th>Qty</th><th>Total</th><th>Status</th></tr>${list.map((o) => `<tr><td>#${o.id}</td><td>${ui.esc(o.created)}</td><td>${ui.esc(o.customer)}<br><span class="note">${ui.esc(o.email)}</span></td><td>${ui.esc(o.item)}</td><td>${o.qty}</td><td>${ui.money(o.total)}</td><td>${pill(o.status)}</td></tr>`).join('')}</table>`;
      if (tab === '') {
        const live = orders.filter((o) => o.status !== 'cancelled');
        const revenue = live.reduce((a, o) => a + o.total, 0);
        const prods = rows(d, 'SELECT * FROM products ORDER BY stock');
        const low = prods.filter((x) => x.stock < 10);
        const st = ['processing', 'shipped', 'delivered', 'cancelled'].map((s) => [s, orders.filter((o) => o.status === s).length]);
        const max = Math.max(1, ...st.map((x) => x[1]));
        return shell('Dashboard', `<div class="ah"><h1>Dashboard</h1><span class="note">Demo data only</span></div><div class="kpis"><div class="kpi"><small>Revenue</small><b>${ui.money(revenue)}</b></div><div class="kpi"><small>Orders</small><b>${orders.length}</b></div><div class="kpi"><small>To fulfil</small><b>${st[0][1]}</b></div><div class="kpi"><small>Low stock items</small><b>${low.length}</b></div></div>
<div class="two"><div><h3>Recent orders</h3>${otable(orders.slice(0, 6))}</div><div class="box"><h3>Orders by status</h3>${st.map(([s, n]) => `<div>${pill(s)} <b>${n}</b></div><div class="bar"><i style="width:${Math.round(n / max * 100)}%"></i></div>`).join('')}<h3 style="margin-top:18px">Low stock</h3>${low.map((x) => `<div>${ui.esc(x.name)} <b class="${x.stock === 0 ? 'bad' : 'warn'}">${x.stock}</b></div>`).join('') || '<span class="note">All stocked.</span>'}</div></div>`);
      }
      if (tab === 'orders') return shell('Orders', `<div class="ah"><h1>Orders</h1><span class="note">${orders.length} orders</span></div>${otable(orders)}`);
      if (tab === 'products') {
        const prods = rows(d, 'SELECT * FROM products ORDER BY id');
        return shell('Products', `<div class="ah"><h1>Products</h1><span class="note">${prods.length} products</span></div><table class="tbl"><tr><th>SKU</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr>${prods.map((x) => `<tr><td>${ui.esc(x.sku)}</td><td>${ui.esc(x.name)}</td><td>${ui.esc(ui.catName(x.cat))}</td><td>${ui.money(x.price)}</td><td class="${x.stock === 0 ? 'bad' : x.stock < 10 ? 'warn' : 'ok'}"><b>${x.stock}</b></td></tr>`).join('')}</table>`);
      }
      if (tab === 'customers') {
        const cs = rows(d, 'SELECT customer, email, COUNT(*) AS n, SUM(total) AS spent, MAX(created) AS last FROM orders GROUP BY email ORDER BY spent DESC');
        return shell('Customers', `<div class="ah"><h1>Customers</h1><span class="note">${cs.length} customers</span></div><table class="tbl"><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Spent</th><th>Last order</th></tr>${cs.map((x) => `<tr><td>${ui.esc(x.customer)}</td><td>${ui.esc(x.email)}</td><td>${x.n}</td><td>${ui.money(x.spent)}</td><td>${ui.esc(x.last)}</td></tr>`).join('')}</table>`);
      }
      if (tab === 'team') {
        const us = rows(d, 'SELECT id, username, role FROM users');
        return shell('Team', `<div class="ah"><h1>Team</h1></div><table class="tbl"><tr><th>#</th><th>Username</th><th>Role</th></tr>${us.map((u) => `<tr><td>${u.id}</td><td>${ui.esc(u.username)}</td><td>${ui.esc(u.role)}</td></tr>`).join('')}</table>`);
      }
    }
    return send(404, ui.shell({ title: 'Not found', cartCount, body: '<div class="wrap"><div class="box" style="margin-top:22px">Page not found. <a href="/">Back to the shop</a>.</div></div>' }));
  } catch (e) {
    return send(500, ui.shell({ title: 'Error', body: '<div class="wrap"><div class="box" style="margin-top:22px">Something went wrong. Please try again.</div></div>' }));
  }
};
module.exports.hash = hash;

// Node front door — generated by HDD. Paste this at the very END of your handler file
// (the file Vercel runs, for example api/index.js). It wraps what the file exports: a request that
// carries HDD's secret header reaches the app unchanged, and every other request is forwarded to
// HDD first (HDD_GATE_URL) so HDD's Off / Monitor / Block decision applies before the app runs.
// The visitor keeps using this address. If HDD cannot be reached the request is refused with 503,
// never served uninspected, unless you set HDD_FAIL_OPEN=1: then the app answers directly while HDD is
// unreachable or HDD_GATE_URL is not set (the site stays usable, but those requests are NOT inspected).
// While HDD_ORIGIN_SECRET is empty or unset the front door is OFF and the app answers everyone (not
// protected). Nothing else in the file changes.
(function hddFrontDoor() {
  const crypto = require("crypto");
  const http = require("http");
  const https = require("https");

  const SECRET = process.env.HDD_ORIGIN_SECRET || "";
  const FAIL_OPEN = /^(1|true|yes)$/i.test(process.env.HDD_FAIL_OPEN || "");
  const HOP = new Set([
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
    "transfer-encoding", "upgrade", "host", "content-length", "x-forwarded-for",
    "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "forwarded", "x-hdd-gate-hop",
    "x-hdd-origin-secret",
  ]);
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 16 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 16 });
  const ATTEMPTS = 5;
  const MAX_BODY = 1024 * 1024;
  const TIMEOUT_MS = 20000;

  function fromHdd(req) {
    const supplied = Buffer.from(String(req.headers["x-hdd-origin-secret"] || ""));
    const expected = Buffer.from(SECRET);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  function parseGateUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch (error) { return null; }
  }

  const gateUrl = parseGateUrl(process.env.HDD_GATE_URL || "");

  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

  function refuse(res, code, headline, detail) {
    res.statusCode = code;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.end("<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + esc(headline) + "</title><style>body{font:16px/1.55 system-ui,Segoe UI,sans-serif;background:#f4f7fa;color:#14202b;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:520px;background:#fff;border:1px solid #d8e1e8;border-radius:14px;padding:28px;margin:16px}h1{font-size:22px;margin:0 0 8px}p{margin:.5em 0;color:#3d4f5f}</style><main><h1>" + esc(headline) + "</h1><p>" + esc(detail) + "</p><p>Protected by Hack Dev Defence (HDD)</p></main>");
  }

  async function readBody(req) {
    if (req.readable === false && req.body !== undefined) {
      const body = req.body;
      if (Buffer.isBuffer(body)) return body;
      if (typeof body === "string") return Buffer.from(body);
      const type = String(req.headers["content-type"] || "");
      return Buffer.from(/json/i.test(type) ? JSON.stringify(body) : new URLSearchParams(body).toString());
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) { const error = new Error("body too large"); error.code = "TOO_LARGE"; throw error; }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async function forward(req, res, target, serveDirectly) {
    let body;
    try { body = await readBody(req); } catch (error) {
      return refuse(res, error.code === "TOO_LARGE" ? 413 : 400, "Request refused", "The request could not be read.");
    }
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) if (!HOP.has(name.toLowerCase())) headers[name] = value;
    const client = String(req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "";
    // HDD (and any tunnel in front of it) routes by this Host, so it names HDD; the address the visitor typed travels in x-forwarded-host and x-hdd-gate-host.
    headers.host = target.host;
    if (req.headers.host) headers["x-hdd-gate-host"] = req.headers.host;
    if (req.headers.host) headers["x-forwarded-host"] = req.headers.host;
    headers["accept-encoding"] = "identity";
    headers["x-hdd-gate-hop"] = "1";
    headers["x-forwarded-proto"] = "https";
    if (client) headers["x-forwarded-for"] = client;
    if (body.length) headers["content-length"] = String(body.length);
    const destination = new URL(req.url || "/", target);
    const library = destination.protocol === "https:" ? https : http;
    const agent = destination.protocol === "https:" ? httpsAgent : httpAgent;
    const replayable = req.method === "GET" || req.method === "HEAD";
    // One attempt resolves "retry" only when HDD did not answer and trying again cannot deliver the request twice:
    // a GET/HEAD, or a request that failed on a reused socket the other side had already closed (it never reached HDD).
    const attempt = (number) => new Promise((resolveAttempt) => {
      let settled = false;
      const done = (outcome) => { if (!settled) { settled = true; resolveAttempt(outcome); } };
      const out = library.request({
        protocol: destination.protocol, hostname: destination.hostname, port: destination.port,
        path: destination.pathname + destination.search, method: req.method, headers, timeout: TIMEOUT_MS, agent,
      }, (back) => {
        // Every answer from HDD carries a Ray ID. A 502/503/504 without one came from something in front of HDD (for example
        // a tunnel with no HDD behind it), so HDD was not reached: treat it like a connection failure.
        if (!back.headers["hdd-ray-id"] && (back.statusCode === 502 || back.statusCode === 503 || back.statusCode === 504)) {
          back.resume();
          console.error("front door: answer without a Ray ID (HDD not reached), status " + back.statusCode + " (attempt " + number + ")");
          return done(number < ATTEMPTS ? "retry" : "fail");
        }
        res.statusCode = back.statusCode || 502;
        for (const [name, value] of Object.entries(back.headers)) if (!HOP.has(name.toLowerCase())) res.setHeader(name, value);
        back.on("end", () => done("ok"));
        back.on("error", () => { res.destroy(); done("ok"); });
        back.pipe(res);
      });
      out.on("timeout", () => { out.destroy(); });
      out.on("error", (error) => {
        console.error("front door: HDD request failed (attempt " + number + "):", error && (error.code || error.message));
        if (res.headersSent) { res.destroy(); return done("ok"); }
        done(number < ATTEMPTS && (replayable || out.reusedSocket) ? "retry" : "fail");
      });
      out.end(body);
    });
    for (let number = 1; number <= ATTEMPTS; number++) {
      const outcome = await attempt(number);
      if (outcome === "ok") return;
      if (outcome === "fail") break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 300 * number));
    }
    if (res.headersSent) return;
    if (FAIL_OPEN) {
      // Opt-in: keep the site usable while HDD is unreachable. The body was already read, so hand it back to the app.
      console.error("front door: HDD unreachable, serving the request directly (HDD_FAIL_OPEN is on, NOT inspected)");
      req[Symbol.asyncIterator] = async function* replayBody() { yield body; };
      return serveDirectly();
    }
    refuse(res, 503, "Protection is unavailable", "This site only answers through Hack Dev Defence, and HDD could not be reached. The request was not served. Try again shortly.");
  }

  const handler = module.exports;
  if (typeof handler !== "function") {
    throw new Error("HDD front door: this file must export a request handler function with module.exports");
  }
  const wrapped = async function (req, res) {
    if (SECRET.length === 0) return handler.apply(this, arguments);
    if (fromHdd(req)) return handler.apply(this, arguments);
    if (gateUrl && !req.headers["x-hdd-gate-hop"]) return forward(req, res, gateUrl, () => handler.apply(this, arguments));
    if (FAIL_OPEN) return handler.apply(this, arguments);
    res.statusCode = 403;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Forbidden: this site only answers through Hack Dev Defence (HDD).");
  };
  Object.assign(wrapped, handler);
  module.exports = wrapped;
})();

// Node function lock — generated by HDD. Paste this at the very END of your handler file
// (the file Vercel runs, for example api/index.js). It wraps what the file exports: a request that did
// not come through HDD is refused with 403. Nothing else in the file changes.
// While HDD_ORIGIN_SECRET is not set the lock is off and the app answers everyone (not protected).
(function hddLock() {
  const crypto = require("crypto");
  const SECRET = process.env.HDD_ORIGIN_SECRET || "";
  const handler = module.exports;
  if (typeof handler !== "function") {
    throw new Error("HDD lock: this file must export a request handler function with module.exports");
  }
  function fromHdd(req) {
    const supplied = Buffer.from(String(req.headers["x-hdd-origin-secret"] || ""));
    const expected = Buffer.from(SECRET);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }
  const locked = async function (req, res) {
    if (SECRET.length > 0 && !fromHdd(req)) {
      res.statusCode = 403;
      return res.end("Forbidden: this site only answers through Hack Dev Defence (HDD).");
    }
    return handler.apply(this, arguments);
  };
  Object.assign(locked, handler);
  module.exports = locked;
})();

