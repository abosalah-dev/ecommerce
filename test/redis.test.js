'use strict';

// بنجرب وضع Vercel: نسختين من السيرفر بيشتغلوا على نفس Redis
// (Redis وهمي بيقلّد Upstash REST API).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createApp } = require('../server/app');

const TOKEN = 'test-token';

function startMockRedis() {
  const kv = new Map();
  const expiry = new Map();
  const hashes = new Map();
  let requests = 0;

  const alive = (k) => {
    const e = expiry.get(k);
    if (e && e < Date.now()) {
      kv.delete(k);
      expiry.delete(k);
    }
    return kv.has(k);
  };

  function exec([op, ...a]) {
    switch (String(op).toUpperCase()) {
      case 'GET':
        return alive(a[0]) ? kv.get(a[0]) : null;
      case 'SET': {
        const [k, v, ...opts] = a;
        const up = opts.map((o) => String(o).toUpperCase());
        if (up.includes('NX') && alive(k)) return null;
        kv.set(k, v);
        const px = up.indexOf('PX');
        if (px >= 0) expiry.set(k, Date.now() + Number(opts[px + 1]));
        else expiry.delete(k);
        return 'OK';
      }
      case 'HSET': {
        const h = hashes.get(a[0]) || new Map();
        for (let i = 1; i < a.length; i += 2) h.set(a[i], a[i + 1]);
        hashes.set(a[0], h);
        return (a.length - 1) / 2;
      }
      case 'HGETALL': {
        const h = hashes.get(a[0]);
        return h ? [...h].flat() : [];
      }
      case 'EVAL': {
        // سكريبت فك القفل بس: لو القيمة = التوكن امسحها
        const [, , key, token] = a;
        if (alive(key) && kv.get(key) === token) {
          kv.delete(key);
          return 1;
        }
        return 0;
      }
      default:
        throw new Error(`unsupported ${op}`);
    }
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests += 1;
      // تأخير بسيط عشان الطلبات المتزامنة تتداخل فعلاً
      setTimeout(() => {
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== `Bearer ${TOKEN}`) {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: 'Unauthorized' }));
        }
        try {
          const parsed = JSON.parse(body);
          if (req.url === '/') return res.end(JSON.stringify({ result: exec(parsed) }));
          if (req.url === '/multi-exec' || req.url === '/pipeline') {
            return res.end(JSON.stringify(parsed.map((c) => ({ result: exec(c) }))));
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'not found' }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      }, 2);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        kv,
        hashes,
        requests: () => requests,
        close: () => new Promise((r) => server.close(r)),
      })
    );
  });
}

async function startInstance(redisUrl) {
  const { app, ready } = createApp({ redis: { url: redisUrl, token: TOKEN, prefix: 'gb:' } });
  await ready;
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })
    );
  });
}

function client(base) {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : null;
    return { status: res.status, data };
  };
}

const customer = { name: 'منى علي', phone: '01012345678', area: 'فيصل', address: 'شارع العشرين، عمارة 3، الدور 2' };

describe('التخزين في Redis (وضع Vercel)', () => {
  let redis;
  let a;
  let b;
  before(async () => {
    redis = await startMockRedis();
    a = await startInstance(redis.url);
    b = await startInstance(redis.url);
  });
  after(async () => {
    await a.close();
    await b.close();
    await redis.close();
  });

  test('أول تشغيل بيحط البيانات المبدئية في Redis', async () => {
    assert.ok(redis.kv.get('gb:main'), 'البيانات الأساسية اتكتبت');
    const { data } = await client(a.base)('GET', '/api/store');
    assert.equal(data.settings.storeName, 'جملة بيتك');
    assert.ok(data.products.length >= 25);
    assert.equal(data.bundles.length, 3);
  });

  test('طلب على نسخة بيظهر في لوحة التحكم على النسخة التانية', async () => {
    const order = await client(a.base)('POST', '/api/orders', { customer, items: [{ productId: 'sugar-10kg', qty: 3 }] });
    assert.equal(order.status, 201);
    assert.equal(redis.hashes.get('gb:orders').size, 1, 'كل طلب في خانة لوحده');

    const adminB = client(b.base);
    assert.equal((await adminB('POST', '/api/admin/login', { password: 'admin123' })).status, 200);
    const list = await adminB('GET', '/api/admin/orders');
    assert.equal(list.status, 200);
    assert.equal(list.data.orders.length, 1);
    assert.equal(list.data.orders[0].number, order.data.order.number);

    const track = await client(b.base)('POST', '/api/orders/track', { number: order.data.order.number, phone: customer.phone });
    assert.equal(track.status, 200);
  });

  test('الدخول على نسخة شغال على النسخة التانية، والخروج بيقفله في الاتنين', async () => {
    const login = await fetch(`${a.base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const session = login.headers.get('set-cookie').split(';')[0];
    const onB = await fetch(`${b.base}/api/admin/me`, { headers: { Cookie: session } });
    assert.equal(onB.status, 200, 'الجلسة متخزنة في Redis مش في ذاكرة نسخة واحدة');
    await fetch(`${b.base}/api/admin/logout`, { method: 'POST', headers: { Cookie: session } });
    const afterLogout = await fetch(`${a.base}/api/admin/me`, { headers: { Cookie: session } });
    assert.equal(afterLogout.status, 401);
  });

  test('طلبات في نفس اللحظة على النسختين متكتبش فوق بعض', async () => {
    const admin = client(a.base);
    await admin('POST', '/api/admin/login', { password: 'admin123' });
    const set = await admin('PUT', '/api/admin/products/salt-pack', { stock: 1000 });
    assert.equal(set.data.product.stock, 1000);

    const phones = ['01011111111', '01022222222', '01033333333', '01044444444', '01055555555'];
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      const base = i % 2 ? b.base : a.base;
      jobs.push(
        client(base)('POST', '/api/orders', {
          customer: { ...customer, phone: phones[i % phones.length] },
          items: [{ productId: 'salt-pack', qty: 20 }],
        })
      );
    }
    const results = await Promise.all(jobs);
    assert.deepEqual(results.map((r) => r.status), Array(10).fill(201));
    const numbers = results.map((r) => r.data.order.number);
    assert.equal(new Set(numbers).size, 10, 'كل طلب ليه رقم مختلف');

    const store = await client(b.base)('GET', '/api/store');
    assert.equal(store.data.products.find((p) => p.id === 'salt-pack').stock, 1000 - 10 * 20, 'المخزون اتخصم صح');
    assert.equal(redis.hashes.get('gb:orders').size, 11);
  });

  test('الصور المرفوعة بتتخزن في Redis وتتقري من أي نسخة', async () => {
    const admin = client(a.base);
    await admin('POST', '/api/admin/login', { password: 'admin123' });
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const up = await admin('POST', '/api/admin/upload', { dataUrl: `data:image/png;base64,${png}` });
    assert.equal(up.status, 201);
    const file = await fetch(b.base + up.data.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await file.arrayBuffer()).toString('base64'), png);
    assert.equal((await fetch(`${b.base}/uploads/missing.png`)).status, 404);
  });

  test('القفل بيتفك بعد كل طلب', async () => {
    assert.equal(redis.kv.has('gb:lock'), false);
  });
});
