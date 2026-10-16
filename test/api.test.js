'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');

function startServer({ prepare, ...options } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-test-'));
  if (prepare) prepare(dataDir);
  const { app, store } = createApp({ dataDir, ...options });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        store,
        base,
        dataDir,
        product: (id) => store.data.products.find((p) => p.id === id),
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

  test('بيرجع الإعدادات والأقسام ومنتجات الجملة', async () => {
    const { status, data } = await req('GET', '/api/store');
    assert.equal(status, 200);
    assert.equal(data.settings.storeName, 'خيرات ماركت');
    assert.equal(data.settings.minOrder, 1000);
    assert.ok(data.categories.length >= 6);
    assert.ok(data.products.length >= 25);
    const sugar = data.products.find((p) => p.id === 'sugar-10kg');
    assert.equal(sugar.price, 350);
    assert.equal(sugar.marketPrice, 400);
    assert.equal(sugar.unitCount, 10);
    assert.equal(sugar.unitName, 'كيلو');
    assert.equal(sugar.active, undefined, 'مش المفروض نرجع حقول داخلية');
  });

  test('الخزين الجاهز بيتحسب من أسعار المنتجات الحالية', async () => {
    const { data } = await req('GET', '/api/store');
    assert.equal(data.bundles.length, 3);
    const prices = new Map(data.products.map((p) => [p.id, p]));
    for (const b of data.bundles) {
      const total = b.items.reduce((s, it) => s + prices.get(it.productId).price * it.qty, 0);
      const market = b.items.reduce((s, it) => s + (prices.get(it.productId).marketPrice || prices.get(it.productId).price) * it.qty, 0);
      assert.equal(b.total, total, b.name);
      assert.equal(b.marketTotal, market, b.name);
      assert.ok(b.savings > 0, b.name);
      assert.ok(b.total >= data.settings.minOrder, `${b.name} لازم يعدّي الحد الأدنى`);
    }
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

  test('الطلب بيتحسب من أسعار السيرفر وبيخصم من المخزون وبيحسب التوفير', async () => {
    const before = srv.product('sugar-10kg').stock;
    const { status, data } = await req('POST', '/api/orders', {
      customer,
      paymentMethod: 'cash',
      items: [
        { productId: 'sugar-10kg', qty: 2, price: 1 },
        { productId: 'rice-10kg', qty: 1 },
        { productId: 'sugar-10kg', qty: 1 },
      ],
    });
    assert.equal(status, 201);
    const o = data.order;
    assert.equal(o.status, 'new');
    assert.ok(o.number > 1000);
    const sugar = o.items.find((i) => i.productId === 'sugar-10kg');
    assert.equal(sugar.qty, 3, 'المنتج المكرر بيتجمع');
    assert.equal(sugar.price, 350);
    assert.equal(sugar.marketPrice, 400);
    assert.equal(o.subtotal, 350 * 3 + 380);
    assert.equal(o.deliveryFee, 50);
    assert.equal(o.total, 350 * 3 + 380 + 50);
    assert.equal(o.savings, 50 * 3 + 60);
    assert.equal(srv.product('sugar-10kg').stock, before - 3);
  });

  test('توصيل مجاني فوق الحد', async () => {
    const { status, data } = await req('POST', '/api/orders', {
      customer,
      items: [{ productId: 'oil-carton', qty: 3 }],
    });
    assert.equal(status, 201);
    assert.equal(data.order.subtotal, 3060);
    assert.equal(data.order.deliveryFee, 0);
    assert.equal(data.order.total, 3060);
  });

  test('بيقبل الأرقام العربية في الموبايل', async () => {
    const { status, data } = await req('POST', '/api/orders', {
      customer: { ...customer, phone: '٠١١٢٣٤٥٦٧٨٩' },
      items: [{ productId: 'tea-loose-1kg', qty: 3 }],
    });
    assert.equal(status, 201);
    assert.equal(data.order.customer.phone, '01123456789');
  });

  test('بيرفض البيانات الغلط', async () => {
    const ok = [{ productId: 'salt-pack', qty: 20 }];
    const cases = [
      [{ customer: { ...customer, phone: '12345' }, items: ok }, 400],
      [{ customer: { ...customer, name: '' }, items: ok }, 400],
      [{ customer: { ...customer, address: '' }, items: ok }, 400],
      [{ customer, items: [] }, 400],
      [{ customer, items: [{ productId: 'salt-pack', qty: 0 }] }, 400],
      [{ customer, items: [{ productId: 'salt-pack', qty: 1.5 }] }, 400],
      [{ customer, items: [{ productId: 'salt-pack', qty: 21 }] }, 400], // أكتر من أقصى كمية
      [{ customer, items: [{ productId: 'salt-pack', qty: 1 }] }, 400], // أقل من الحد الأدنى للطلب
      [{ customer, items: [null] }, 400],
      [{ customer, items: ok, paymentMethod: 'bitcoin' }, 400],
    ];
    for (const [body, expected] of cases) {
      const { status, data } = await req('POST', '/api/orders', body);
      assert.equal(status, expected, JSON.stringify(body));
      assert.ok(data.error);
    }
  });

  test('بيرفض منتج مش موجود أو كمية أكبر من المخزون', async () => {
    const res1 = await req('POST', '/api/orders', { customer, items: [{ productId: 'nope', qty: 1 }, { productId: 'rice-10kg', qty: 3 }] });
    assert.equal(res1.status, 409);
    assert.deepEqual(res1.data.details, [{ productId: 'nope', reason: 'unavailable', available: 0 }]);

    const coffee = srv.product('coffee-1kg');
    const stock = coffee.stock;
    assert.ok(stock < 20);
    const res2 = await req('POST', '/api/orders', { customer, items: [{ productId: 'coffee-1kg', qty: stock + 1 }] });
    assert.equal(res2.status, 409);
    assert.equal(res2.data.details[0].available, stock);
    assert.equal(coffee.stock, stock, 'المخزون ميتغيرش لو الطلب اترفض');
  });

  test('تتبع الطلب برقم الطلب والموبايل بس', async () => {
    const { data } = await req('POST', '/api/orders', { customer, items: [{ productId: 'coffee-1kg', qty: 2 }] });
    const number = data.order.number;
    const ok = await req('POST', '/api/orders/track', { number: String(number), phone: '+201012345678' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.order.number, number);
    assert.equal(ok.data.order.id, undefined);
    assert.equal(ok.data.order.savings, 200);
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
      ['GET', '/api/admin/bundles'],
      ['POST', '/api/admin/bundles'],
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
    const product = srv.product('oil-5l');
    const startStock = product.stock;
    const { data } = await req('POST', '/api/orders', { customer, items: [{ productId: 'oil-5l', qty: 4 }] });
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
    await req('POST', '/api/orders', { customer, items: [{ productId: 'tea-bags-carton', qty: 2 }] });
    const { status, data } = await req('GET', '/api/admin/stats');
    assert.equal(status, 200);
    assert.equal(data.ordersToday, 1, 'الطلب الملغي مش محسوب');
    assert.equal(data.revenueToday, 1430);
    assert.equal(data.avgOrderValue, 1430);
    assert.equal(data.last7Days.length, 7);
    assert.equal(data.last7Days.at(-1).revenue, 1430);
    assert.equal(data.topProducts[0].productId, 'tea-bags-carton');
  });

  test('إضافة وتعديل وإخفاء وحذف منتج', async () => {
    const created = await req('POST', '/api/admin/products', {
      name: 'فول مدمس معلب',
      categoryId: 'legumes',
      unit: 'كرتونة 12 علبة × 400 جرام',
      price: '240.5',
      marketPrice: '200',
      unitCount: '12',
      unitName: 'علبة',
      stock: '10',
    });
    assert.equal(created.status, 201);
    const p = created.data.product;
    assert.equal(p.price, 240.5);
    assert.equal(p.marketPrice, null, 'سعر السوق لازم يكون أكبر من سعر الجملة');
    assert.equal(p.unitCount, 12);
    assert.equal(p.unitName, 'علبة');
    assert.equal(p.image, '/images/products/placeholder.svg');

    const noName = await req('PUT', `/api/admin/products/${p.id}`, { unitName: '' });
    assert.equal(noName.data.product.unitCount, null, 'من غير اسم الوحدة مفيش سعر للوحدة');

    let store = await req('GET', '/api/store');
    assert.ok(store.data.products.some((x) => x.id === p.id));

    const hidden = await req('PUT', `/api/admin/products/${p.id}`, { active: false });
    assert.equal(hidden.data.product.active, false);
    assert.equal(hidden.data.product.name, 'فول مدمس معلب', 'التعديل الجزئي ميمسحش باقي البيانات');
    store = await req('GET', '/api/store');
    assert.ok(!store.data.products.some((x) => x.id === p.id));
    const order = await req('POST', '/api/orders', { customer, items: [{ productId: p.id, qty: 5 }] });
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

  test('الخزين الجاهز: إضافة وتعديل وإخفاء وحذف', async () => {
    const list = await req('GET', '/api/admin/bundles');
    assert.equal(list.status, 200);
    assert.equal(list.data.bundles.length, 3);
    assert.ok(list.data.products.length >= 25);

    assert.equal((await req('POST', '/api/admin/bundles', { name: 'فاضي', items: [] })).status, 400);
    assert.equal((await req('POST', '/api/admin/bundles', { name: 'غلط', items: [{ productId: 'nope', qty: 1 }] })).status, 400);
    assert.equal((await req('POST', '/api/admin/bundles', { name: 'كتير', items: [{ productId: 'salt-pack', qty: 99 }] })).status, 400);

    const created = await req('POST', '/api/admin/bundles', {
      name: 'خزين عزّاب',
      description: 'لفرد واحد',
      icon: '🧑',
      items: [
        { productId: 'sugar-5kg', qty: 1 },
        { productId: 'sugar-5kg', qty: 1 },
        { productId: 'pasta-carton', qty: 1 },
        { productId: 'tea-loose-1kg', qty: 1 },
      ],
    });
    assert.equal(created.status, 201);
    const b = created.data.bundle;
    assert.deepEqual(b.items[0], { productId: 'sugar-5kg', qty: 2 }, 'المنتج المكرر بيتجمع');

    let store = await req('GET', '/api/store');
    const shown = store.data.bundles.find((x) => x.id === b.id);
    assert.equal(shown.total, 178 * 2 + 320 + 360);

    await req('PUT', `/api/admin/bundles/${b.id}`, { active: false });
    store = await req('GET', '/api/store');
    assert.ok(!store.data.bundles.some((x) => x.id === b.id), 'الخزين المخفي ميظهرش');

    // لو منتج اتمسح بيتشال من الخزين
    await req('DELETE', '/api/admin/products/pasta-carton');
    const after = await req('GET', '/api/admin/bundles');
    const updated = after.data.bundles.find((x) => x.id === b.id);
    assert.ok(!updated.items.some((it) => it.productId === 'pasta-carton'));
    assert.equal(updated.name, 'خزين عزّاب');

    assert.equal((await req('DELETE', `/api/admin/bundles/${b.id}`)).status, 200);
    assert.equal((await req('PUT', `/api/admin/bundles/${b.id}`, { active: true })).status, 404);
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
    srv.product('salt-pack').stock = 1000;
  });
  after(() => srv.close());

  test('أكتر من 10 طلبات لنفس الموبايل في الساعة بتترفض', async () => {
    const req = client(srv.base);
    const items = [{ productId: 'salt-pack', qty: 20 }];
    for (let i = 0; i < 10; i++) {
      const { status } = await req('POST', '/api/orders', { customer, items });
      assert.equal(status, 201);
    }
    const blocked = await req('POST', '/api/orders', { customer, items });
    assert.equal(blocked.status, 429);
    const otherPhone = await req('POST', '/api/orders', { customer: { ...customer, phone: '01512345678' }, items });
    assert.equal(otherPhone.status, 201, 'عميل تاني من نفس الشبكة يقدر يطلب');
  });

  test('الدخول بيتقفل بعد 10 محاولات غلط', async () => {
    const req = client(srv.base);
    for (let i = 0; i < 10; i++) assert.equal((await req('POST', '/api/admin/login', { password: 'x' })).status, 401);
    assert.equal((await req('POST', '/api/admin/login', { password: 'admin123' })).status, 429);
  });
});

describe('تحديث البيانات القديمة', () => {
  let srv;
  before(async () => {
    srv = await startServer({
      prepare(dir) {
        const old = {
          version: 1,
          settings: { storeName: 'متجري' },
          admin: { passwordHash: null },
          categories: [{ id: 'basics', name: 'أساسيات', icon: '🍚', sort: 1 }],
          products: [
            { id: 'old-sugar', name: 'سكر', categoryId: 'basics', unit: '1 كيلو', price: 38, oldPrice: 42, stock: 5, featured: false, description: '', image: '/images/products/sugar-1kg.svg', active: true, sort: 1 },
          ],
          orders: [],
          counters: { order: 1000 },
        };
        fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(old));
      },
    });
  });
  after(() => srv.close());

  test('oldPrice بيتحول لسعر السوق والخزين الجاهز بيتضاف', async () => {
    const p = srv.product('old-sugar');
    assert.equal(p.marketPrice, 42);
    assert.equal('oldPrice' in p, false);
    assert.equal(p.unitCount, null);
    assert.deepEqual(srv.store.data.bundles, []);
    assert.equal(srv.store.data.settings.storeName, 'متجري', 'الإعدادات القديمة متتمسحش');
    const { data } = await client(srv.base)('GET', '/api/store');
    assert.equal(data.products[0].marketPrice, 42);
    assert.deepEqual(data.bundles, []);
  });
});
