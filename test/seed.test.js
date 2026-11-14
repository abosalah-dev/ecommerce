'use strict';

// بيتأكد إن بيانات المتجر الحقيقية (server/seed.js) مطابقة لعرض "شنطة التوفير".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');

async function withStore(fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-seed-'));
  const { app, ready } = createApp({ dataDir });
  await ready;
  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test('أسعار المنتجات وأرقام التليفون من عرض شنطة التوفير', async () => {
  await withStore(async (base) => {
    const data = await (await fetch(base + '/api/store')).json();
    const price = Object.fromEntries(data.products.map((p) => [p.id, p.price]));
    assert.deepEqual(price, {
      'pasta-malika': 16,
      'sugar-bahia': 27,
      'rice-zad': 27,
      'flour-habouba': 27,
      'salt-malika': 4,
      'oil-frying': 94.5,
      'vinegar-zad': 12.5,
      'milk-juhayna-1l': 39.5,
      'milk-juhayna-half': 22.5,
      'tea-arousa': 9,
      'tissues-softpro': 73,
    });

    const s = data.settings;
    assert.equal(s.phone, '01097979228');
    assert.equal(s.whatsapp, '201097979228');
    assert.equal(s.salesPhone, '01112914300');
    assert.equal(s.salesName, 'جابر');
    assert.equal(s.freeDeliveryThreshold, 1000);
    assert.equal(s.mapUrl, 'https://www.google.com/maps/search/?api=1&query=29.983306,31.144972');

    const [bag] = data.bundles;
    assert.equal(data.bundles.length, 1);
    assert.equal(bag.name, 'شنطة التوفير');
    assert.equal(bag.total, 550.5);
    assert.ok(bag.total >= s.minOrder, 'الشنطة لازم تعدّي الحد الأدنى للطلب');

    const categoryIds = new Set(data.categories.map((c) => c.id));
    for (const p of data.products) {
      assert.ok(categoryIds.has(p.categoryId), `${p.id}: القسم موجود`);
      const res = await fetch(base + p.image);
      assert.equal(res.status, 200, `${p.id}: الصورة موجودة`);
    }
  });
});

test('رقم مسؤول المبيعات بيتعدل من الإعدادات', async () => {
  await withStore(async (base) => {
    const login = await fetch(base + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await fetch(base + '/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ salesPhone: '٠١٢٣٤٥٦٧٨٩٠', salesName: 'أحمد' }),
    });
    assert.equal(res.status, 200);
    const { settings } = await res.json();
    assert.equal(settings.salesPhone, '01234567890');
    assert.equal(settings.salesName, 'أحمد');
  });
});

test('رابط الخريطة لازم يكون https', async () => {
  await withStore(async (base) => {
    const login = await fetch(base + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const put = (mapUrl) =>
      fetch(base + '/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ mapUrl }),
      });
    assert.equal((await put('javascript:alert(1)')).status, 400);
    const ok = await put('https://maps.app.goo.gl/abc123');
    assert.equal(ok.status, 200);
    const store = await (await fetch(base + '/api/store')).json();
    assert.equal(store.settings.mapUrl, 'https://maps.app.goo.gl/abc123');
  });
});
