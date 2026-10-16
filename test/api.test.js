'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');

function startServer(options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-test-'));
  const { app, store } = createApp({ dataDir, ...options });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        store,
        base,
        dataDir,
        close: () =>
          new Promise((r) => {
            server.close(() => {
              fs.rmSync(dataDir, { recursive: true, force: true });
              r();
            });
          }),
      });
    });
  });
}

function client(base) {
  let cookie = '';
  return async function request(method, url, body) {
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
    let data = null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) data = await res.json();
    return { status: res.status, data, headers: res.headers };
  };
}

const customer = {
  name: 'محمد أحمد',
  phone: '01012345678',
  area: 'مدينة نصر',
  address: 'شارع عباس العقاد، عمارة 5، الدور 2',
};

describe('واجهة المتجر', () => {
  let srv;
  let req;
  before(async () => {
    srv = await startServer();
    req = client(srv.base);
  });
  after(() => srv.close());

  test('بيرجع الإعدادات والأقسام والمنتجات', async () => {
    const { status, data } = await req('GET', '/api/store');
    assert.equal(status, 200);
    assert.equal(data.settings.storeName, 'خيرات ماركت');
    assert.ok(data.categories.length >= 6);
    assert.ok(data.products.length >= 20);
    assert.ok(data.products.some((p) => p.id === 'sugar-1kg'));
    assert.equal(data.products[0].active, undefined, 'مش المفروض نرجع حقول داخلية');
  });

  test('الصفحات والملفات الثابتة شغالة مع security headers', async () => {
    for (const page of ['/', '/checkout.html', '/order.html', '/admin.html', '/css/style.css', '/js/store.js', '/images/products/rice-1kg.svg']) {
      const res = await fetch(srv.base + page);
      assert.equal(res.status, 200, page);
    }
    const res = await fetch(srv.base + '/');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const missing = await fetch(srv.base + '/nope');
    assert.equal(missing.status, 404);
  });

  test('الطلب بيتحسب من أسعار السيرفر وبيخصم من المخزون', async () => {
    const before = srv.store.data.products.find((p) => p.id === 'sugar-1kg').stock;
    const { status, data } = await req('POST', '/api/orders', {
      customer,
      paymentMethod: 'cash',
      items: [
        { productId: 'sugar-1kg', qty: 2, price: 1 },
        { productId: 'rice-1kg', qty: 1 },
        { productId: 'sugar-1kg', qty: 1 },
      ],
    });
    assert.equal(status, 201);
    const o = data.order;
    assert.equal(o.status, 'new');
    assert.ok(o.number > 1000);
    const sugar = o.items.find((i) => i.productId === 'sugar-1kg');
    assert.equal(sugar.qty, 3, 'المنتج المكرر بيتجمع');
    assert.equal(sugar.price, 38);
    assert.equal(o.subtotal, 38 * 3 + 42);
    assert.equal(o.deliveryFee, 20);
    assert.equal(o.total, 38 * 3 + 42 + 20);
    assert.equal(srv.store.data.products.find((p) => p.id === 'sugar-1kg').stock, before - 3);
  });

  test('توصيل مجاني فوق الحد', async () => {
    const { status, data } = await req('POST', '/api/orders', {
      customer,
      items: [{ productId: 'rice-5kg', qty: 3 }],
    });
    assert.equal(status, 201);
    assert.equal(data.order.subtotal, 597);
    assert.equal(data.order.deliveryFee, 0);
    assert.equal(data.order.total, 597);
  });

  test('بيقبل الأرقام العربية في الموبايل', async () => {
    const { status, data } = await req('POST', '/api/orders', {
      customer: { ...customer, phone: '٠١١٢٣٤٥٦٧٨٩' },
      items: [{ productId: 'tea-loose', qty: 1 }],
    });
    assert.equal(status, 201);
    assert.equal(data.order.customer.phone, '01123456789');
  });

  test('بيرفض البيانات الغلط', async () => {
    const cases = [
      [{ customer: { ...customer, phone: '12345' }, items: [{ productId: 'salt', qty: 5 }] }, 400],
      [{ customer: { ...customer, name: '' }, items: [{ productId: 'salt', qty: 5 }] }, 400],
      [{ customer: { ...customer, address: '' }, items: [{ productId: 'salt', qty: 5 }] }, 400],
      [{ customer, items: [] }, 400],
      [{ customer, items: [{ productId: 'salt', qty: 0 }] }, 400],
      [{ customer, items: [{ productId: 'salt', qty: 1.5 }] }, 400],
      [{ customer, items: [{ productId: 'salt', qty: 1 }] }, 400], // أقل من الحد الأدنى
      [{ customer, items: [null] }, 400],
      [{ customer, items: [{ productId: 'salt', qty: 5 }], paymentMethod: 'bitcoin' }, 400],
    ];
    for (const [body, expected] of cases) {
      const { status, data } = await req('POST', '/api/orders', body);
      assert.equal(status, expected, JSON.stringify(body));
      assert.ok(data.error);
    }
  });

  test('بيرفض منتج مش موجود أو كمية أكبر من المخزون', async () => {
    const ghee = srv.store.data.products.find((p) => p.id === 'ghee');
    const res1 = await req('POST', '/api/orders', { customer, items: [{ productId: 'nope', qty: 1 }, { productId: 'rice-1kg', qty: 2 }] });
    assert.equal(res1.status, 409);
    assert.deepEqual(res1.data.details, [{ productId: 'nope', reason: 'unavailable', available: 0 }]);

    const stock = ghee.stock;
    const res2 = await req('POST', '/api/orders', { customer, items: [{ productId: 'ghee', qty: stock + 1 }] });
    assert.equal(res2.status, 409);
    assert.equal(res2.data.details[0].available, stock);
    assert.equal(ghee.stock, stock, 'المخزون ميتغيرش لو الطلب اترفض');
  });

  test('تتبع الطلب برقم الطلب والموبايل بس', async () => {
    const { data } = await req('POST', '/api/orders', { customer, items: [{ productId: 'coffee', qty: 1 }] });
    const number = data.order.number;
    const ok = await req('POST', '/api/orders/track', { number: String(number), phone: '+201012345678' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.order.number, number);
    assert.equal(ok.data.order.id, undefined);
    const wrong = await req('POST', '/api/orders/track', { number, phone: '01099999999' });
    assert.equal(wrong.status, 404);
  });

  test('البيانات بتتحفظ على الهارد', async () => {
    const saved = JSON.parse(fs.readFileSync(path.join(srv.dataDir, 'db.json'), 'utf8'));
    assert.ok(saved.orders.length >= 3);
  });

  test('JSON بايظ بيرجع 400', async () => {
    const res = await fetch(srv.base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
  });
});

describe('لوحة التحكم', () => {
  let srv;
  let req;
  before(async () => {
    srv = await startServer();
    req = client(srv.base);
  });
  after(() => srv.close());

  test('محتاجة تسجيل دخول', async () => {
    for (const [m, u] of [
      ['GET', '/api/admin/me'],
      ['GET', '/api/admin/orders'],
      ['GET', '/api/admin/stats'],
      ['POST', '/api/admin/products'],
      ['PUT', '/api/admin/settings'],
      ['POST', '/api/admin/upload'],
    ]) {
      const { status } = await req(m, u, m === 'GET' ? undefined : {});
      assert.equal(status, 401, `${m} ${u}`);
    }
  });

  test('كلمة السر الغلط مرفوضة والصح بتدخل', async () => {
    const bad = await req('POST', '/api/admin/login', { password: 'wrong' });
    assert.equal(bad.status, 401);
    const ok = await req('POST', '/api/admin/login', { password: 'admin123' });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
    assert.match(ok.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal(ok.data.usingDefaultPassword, true);
    const me = await req('GET', '/api/admin/me');
    assert.equal(me.status, 200);
  });

  test('تغيير حالة الطلب والإلغاء بيرجع المخزون', async () => {
    const product = srv.store.data.products.find((p) => p.id === 'oil-sunflower');
    const startStock = product.stock;
    const { data } = await req('POST', '/api/orders', { customer, items: [{ productId: 'oil-sunflower', qty: 4 }] });
    assert.equal(product.stock, startStock - 4);

    const list = await req('GET', '/api/admin/orders?status=new');
    const order = list.data.orders.find((o) => o.number === data.order.number);
    assert.ok(order);
    assert.equal(list.data.counts.new, 1);

    const s1 = await req('PATCH', `/api/admin/orders/${order.id}`, { status: 'preparing' });
    assert.equal(s1.status, 200);
    assert.equal(s1.data.order.status, 'preparing');
    assert.equal(s1.data.order.history.length, 2);

    const bad = await req('PATCH', `/api/admin/orders/${order.id}`, { status: 'flying' });
    assert.equal(bad.status, 400);

    const cancel = await req('PATCH', `/api/admin/orders/${order.id}`, { status: 'cancelled' });
    assert.equal(cancel.data.order.status, 'cancelled');
    assert.equal(product.stock, startStock, 'الكمية رجعت للمخزن');

    const again = await req('PATCH', `/api/admin/orders/${order.id}`, { status: 'new' });
    assert.equal(again.status, 400, 'الطلب الملغي ميتغيرش');

    const search = await req('GET', `/api/admin/orders?q=${encodeURIComponent('محمد')}`);
    assert.equal(search.data.orders.length, 1);
  });

  test('الإحصائيات', async () => {
    await req('POST', '/api/orders', { customer, items: [{ productId: 'tea-bags', qty: 2 }] });
    const { status, data } = await req('GET', '/api/admin/stats');
    assert.equal(status, 200);
    assert.equal(data.ordersToday, 1, 'الطلب الملغي مش محسوب');
    assert.equal(data.revenueToday, 260);
    assert.equal(data.last7Days.length, 7);
    assert.equal(data.last7Days.at(-1).revenue, 260);
    assert.equal(data.topProducts[0].productId, 'tea-bags');
  });

  test('إضافة وتعديل وإخفاء وحذف منتج', async () => {
    const created = await req('POST', '/api/admin/products', {
      name: 'فول مدمس معلب',
      categoryId: 'legumes',
      unit: '400 جرام',
      price: '22.5',
      oldPrice: '20',
      stock: '10',
    });
    assert.equal(created.status, 201);
    const p = created.data.product;
    assert.equal(p.price, 22.5);
    assert.equal(p.oldPrice, null, 'السعر القديم لازم يكون أكبر من الحالي');
    assert.equal(p.image, '/images/products/placeholder.svg');

    let store = await req('GET', '/api/store');
    assert.ok(store.data.products.some((x) => x.id === p.id));

    const hidden = await req('PUT', `/api/admin/products/${p.id}`, { active: false });
    assert.equal(hidden.data.product.active, false);
    assert.equal(hidden.data.product.name, 'فول مدمس معلب', 'التعديل الجزئي ميمسحش باقي البيانات');
    store = await req('GET', '/api/store');
    assert.ok(!store.data.products.some((x) => x.id === p.id));
    const order = await req('POST', '/api/orders', { customer, items: [{ productId: p.id, qty: 3 }] });
    assert.equal(order.status, 409, 'المنتج المخفي ميتطلبش');

    const badCat = await req('PUT', `/api/admin/products/${p.id}`, { categoryId: 'nope' });
    assert.equal(badCat.status, 400);
    const badImg = await req('PUT', `/api/admin/products/${p.id}`, { image: 'javascript:alert(1)' });
    assert.equal(badImg.status, 400);

    const del = await req('DELETE', `/api/admin/products/${p.id}`);
    assert.equal(del.status, 200);
    const gone = await req('PUT', `/api/admin/products/${p.id}`, { active: true });
    assert.equal(gone.status, 404);
  });

  test('الأقسام', async () => {
    const blocked = await req('DELETE', '/api/admin/categories/basics');
    assert.equal(blocked.status, 400, 'ميتمسحش قسم فيه منتجات');
    const created = await req('POST', '/api/admin/categories', { name: 'المعلبات', icon: '🥫' });
    assert.equal(created.status, 201);
    const id = created.data.category.id;
    const renamed = await req('PUT', `/api/admin/categories/${id}`, { name: 'معلبات' });
    assert.equal(renamed.data.category.name, 'معلبات');
    assert.equal(renamed.data.category.icon, '🥫');
    const del = await req('DELETE', `/api/admin/categories/${id}`);
    assert.equal(del.status, 200);
  });

  test('الإعدادات', async () => {
    const bad = await req('PUT', '/api/admin/settings', { deliveryFee: -5 });
    assert.equal(bad.status, 400);
    const ok = await req('PUT', '/api/admin/settings', { storeName: 'بقالة الخير', deliveryFee: '15', whatsapp: '+20 100 000 0000' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.settings.deliveryFee, 15);
    assert.equal(ok.data.settings.whatsapp, '201000000000');
    const store = await req('GET', '/api/store');
    assert.equal(store.data.settings.storeName, 'بقالة الخير');
  });

  test('رفع الصور', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const ok = await req('POST', '/api/admin/upload', { dataUrl: `data:image/png;base64,${png.toString('base64')}` });
    assert.equal(ok.status, 201);
    assert.match(ok.data.url, /^\/uploads\/[\w-]+\.png$/);
    const file = await fetch(srv.base + ok.data.url);
    assert.equal(file.status, 200);

    const svg = await req('POST', '/api/admin/upload', { dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' });
    assert.equal(svg.status, 400);
    const fake = await req('POST', '/api/admin/upload', { dataUrl: 'data:image/png;base64,aGVsbG8=' });
    assert.equal(fake.status, 400, 'لازم يكون ملف صورة حقيقي');
  });

  test('أكتر من صورة للمنتج', async () => {
    const created = await req('POST', '/api/admin/products', {
      name: 'تونة',
      categoryId: 'basics',
      price: 40,
      images: ['/uploads/a.webp', '/uploads/b.webp', '/uploads/a.webp', ''],
    });
    assert.equal(created.status, 201);
    const p = created.data.product;
    assert.deepEqual(p.images, ['/uploads/a.webp', '/uploads/b.webp'], 'بيشيل المكرر والفاضي');
    assert.equal(p.image, '/uploads/a.webp', 'أول صورة هي الرئيسية');

    const reordered = await req('PUT', `/api/admin/products/${p.id}`, { images: ['/uploads/b.webp', '/uploads/a.webp', '/uploads/c.webp'] });
    assert.equal(reordered.data.product.image, '/uploads/b.webp');

    const mainOnly = await req('PUT', `/api/admin/products/${p.id}`, { image: '/uploads/d.webp' });
    assert.deepEqual(mainOnly.data.product.images, ['/uploads/d.webp', '/uploads/a.webp', '/uploads/c.webp'], 'تغيير الرئيسية بس ميمسحش باقي الصور');
    const untouched = await req('PUT', `/api/admin/products/${p.id}`, { stock: 5 });
    assert.equal(untouched.data.product.images.length, 3);

    const store = await req('GET', '/api/store');
    assert.deepEqual(store.data.products.find((x) => x.id === p.id).images, ['/uploads/d.webp', '/uploads/a.webp', '/uploads/c.webp']);
    const seeded = store.data.products.find((x) => x.id !== p.id);
    assert.deepEqual(seeded.images, [seeded.image], 'المنتجات القديمة بترجع صورتها في القائمة');

    const cleared = await req('PUT', `/api/admin/products/${p.id}`, { images: [] });
    assert.equal(cleared.data.product.image, '/images/products/placeholder.svg');

    const tooMany = await req('PUT', `/api/admin/products/${p.id}`, { images: Array.from({ length: 9 }, (_, i) => `/uploads/${i}.webp`) });
    assert.equal(tooMany.status, 400);
    const badUrl = await req('PUT', `/api/admin/products/${p.id}`, { images: ['/uploads/ok.webp', 'https://evil.example/x.png'] });
    assert.equal(badUrl.status, 400);
    const notList = await req('PUT', `/api/admin/products/${p.id}`, { images: '/uploads/a.webp' });
    assert.equal(notList.status, 400);
  });

  test('تغيير كلمة السر', async () => {
    const wrong = await req('PUT', '/api/admin/password', { current: 'nope', next: 'secret99' });
    assert.equal(wrong.status, 400);
    const short = await req('PUT', '/api/admin/password', { current: 'admin123', next: '123' });
    assert.equal(short.status, 400);
    const ok = await req('PUT', '/api/admin/password', { current: 'admin123', next: 'secret99' });
    assert.equal(ok.status, 200);
    const me = await req('GET', '/api/admin/me');
    assert.equal(me.status, 200, 'الجلسة الحالية لسه شغالة');
    assert.equal(me.data.usingDefaultPassword, false);

    const other = client(srv.base);
    assert.equal((await other('POST', '/api/admin/login', { password: 'admin123' })).status, 401);
    assert.equal((await other('POST', '/api/admin/login', { password: 'secret99' })).status, 200);
    assert.match(srv.store.data.admin.passwordHash, /^scrypt\$/);
  });

  test('تسجيل الخروج', async () => {
    await req('POST', '/api/admin/logout');
    const me = await req('GET', '/api/admin/me');
    assert.equal(me.status, 401);
  });
});

describe('كلمة السر من متغير البيئة', () => {
  let srv;
  before(async () => {
    srv = await startServer({ adminPassword: 'from-env-123' });
  });
  after(() => srv.close());

  test('بتستخدم ADMIN_PASSWORD بدل الافتراضية', async () => {
    const req = client(srv.base);
    assert.equal((await req('POST', '/api/admin/login', { password: 'admin123' })).status, 401);
    const ok = await req('POST', '/api/admin/login', { password: 'from-env-123' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.usingDefaultPassword, false);
  });
});

describe('الحماية من الطلبات المزعجة', () => {
  let srv;
  before(async () => {
    srv = await startServer();
  });
  after(() => srv.close());

  test('أكتر من 10 طلبات لنفس الموبايل في الساعة بتترفض', async () => {
    const req = client(srv.base);
    for (let i = 0; i < 10; i++) {
      const { status } = await req('POST', '/api/orders', { customer, items: [{ productId: 'salt', qty: 5 }] });
      assert.equal(status, 201);
    }
    const blocked = await req('POST', '/api/orders', { customer, items: [{ productId: 'salt', qty: 5 }] });
    assert.equal(blocked.status, 429);
    const otherPhone = await req('POST', '/api/orders', { customer: { ...customer, phone: '01512345678' }, items: [{ productId: 'salt', qty: 5 }] });
    assert.equal(otherPhone.status, 201, 'عميل تاني من نفس الشبكة يقدر يطلب');
  });

  test('الدخول بيتقفل بعد 10 محاولات غلط', async () => {
    const req = client(srv.base);
    for (let i = 0; i < 10; i++) assert.equal((await req('POST', '/api/admin/login', { password: 'x' })).status, 401);
    assert.equal((await req('POST', '/api/admin/login', { password: 'admin123' })).status, 429);
  });
});
