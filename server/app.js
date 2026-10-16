'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { JsonStore } = require('./db');
const { AdminAuth, createRateLimiter } = require('./auth');
const v = require('./validate');

const { HttpError, bad } = v;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATUSES = ['new', 'preparing', 'delivering', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['cash', 'wallet'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_PRODUCT_IMAGES = 8;
const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg';
const IMAGE_URL = /^\/(images|uploads)\/[\w./-]+$/;
const TIME_ZONE = 'Africa/Cairo';

const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(date)
  );

const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => Math.round(c) / 100;
const randomId = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
}

function publicSettings(s) {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    phone: s.phone,
    whatsapp: s.whatsapp,
    address: s.address,
    workingHours: s.workingHours,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    minOrder: s.minOrder,
    maxQtyPerItem: s.maxQtyPerItem,
    announcement: s.announcement,
  };
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    unit: p.unit,
    price: p.price,
    oldPrice: p.oldPrice,
    stock: p.stock,
    featured: p.featured,
    description: p.description,
    image: p.image,
    images: productImages(p),
  };
}

// المنتجات القديمة كان ليها صورة واحدة بس في image
function productImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  return [p.image || PLACEHOLDER_IMAGE];
}

function publicOrder(o) {
  return {
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    history: o.history,
    customer: o.customer,
    paymentMethod: o.paymentMethod,
    items: o.items,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
  };
}

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

function createApp({ dataDir, adminPassword, trustProxy } = {}) {
  if (!dataDir) throw new Error('dataDir is required');
  const store = new JsonStore(dataDir).load();
  const auth = new AdminAuth(store, { envPassword: adminPassword });
  const db = () => store.data;

  // محاولات الدخول الغلط بس هي اللي بتتحسب
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  // الطلبات الناجحة بس هي اللي بتتحسب، لكل IP ولكل رقم موبايل
  const orderIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
  const orderPhoneLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
  const trackLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', trustProxy);

  app.use(securityHeaders);
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  function requireAdmin(req, res, next) {
    if (!auth.isValid(auth.tokenFrom(req))) return next(new HttpError(401, 'لازم تسجل دخول الأول'));
    next();
  }

  // رفع الصور محتاج حجم أكبر، ومسموح بيه بس بعد التأكد من تسجيل الدخول
  app.use('/api/admin/upload', requireAdmin, express.json({ limit: '3mb' }));
  app.use('/api', express.json({ limit: '100kb' }));

  /* ------------------------------------------------------------------ */
  /* واجهة المتجر                                                        */
  /* ------------------------------------------------------------------ */

  app.get('/api/store', (req, res) => {
    const d = db();
    res.json({
      settings: publicSettings(d.settings),
      categories: [...d.categories].sort(bySort),
      products: d.products.filter((p) => p.active).sort(bySort).map(publicProduct),
    });
  });

  app.post('/api/orders', (req, res) => {
    const tooMany = () => new HttpError(429, 'طلبات كتير في وقت قصير، جرب كمان شوية');
    if (!orderIpLimiter.check(req.ip)) throw tooMany();
    const d = db();
    const s = d.settings;
    const body = req.body || {};
    const c = body.customer || {};

    const customer = {
      name: v.text(c.name, { field: 'الاسم', max: 80, required: true }),
      phone: v.egyptianPhone(c.phone),
      area: v.text(c.area, { field: 'المنطقة', max: 80, required: true }),
      address: v.text(c.address, { field: 'العنوان', max: 300, required: true }),
      notes: v.text(c.notes, { field: 'الملاحظات', max: 500 }),
    };
    if (!orderPhoneLimiter.check(customer.phone)) throw tooMany();
    if (customer.name.length < 2) throw bad('اكتب اسمك بالكامل');
    if (customer.address.length < 5) throw bad('اكتب العنوان بالتفصيل');

    const paymentMethod = body.paymentMethod ?? 'cash';
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw bad('طريقة الدفع غير صحيحة');

    if (!Array.isArray(body.items) || body.items.length === 0) throw bad('السلة فاضية');
    if (body.items.length > 100) throw bad('عدد المنتجات كبير جداً');

    const wanted = new Map();
    for (const raw of body.items) {
      const item = raw && typeof raw === 'object' ? raw : {};
      const productId = v.text(item.productId, { field: 'المنتج', max: 60, required: true });
      const qty = v.number(item.qty, { field: 'الكمية', min: 1, max: s.maxQtyPerItem, integer: true });
      wanted.set(productId, (wanted.get(productId) || 0) + qty);
    }

    const problems = [];
    const lines = [];
    for (const [productId, qty] of wanted) {
      const product = d.products.find((p) => p.id === productId && p.active);
      if (!product) {
        problems.push({ productId, reason: 'unavailable', available: 0 });
      } else if (qty > s.maxQtyPerItem) {
        problems.push({ productId, name: product.name, reason: 'limit', available: s.maxQtyPerItem });
      } else if (product.stock < qty) {
        problems.push({ productId, name: product.name, reason: 'stock', available: product.stock });
      } else {
        lines.push({ product, qty });
      }
    }
    if (problems.length) {
      throw new HttpError(409, 'بعض المنتجات مش متوفرة بالكمية المطلوبة، راجع السلة', problems);
    }

    const items = lines.map(({ product, qty }) => ({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      image: product.image,
      price: product.price,
      qty,
      total: fromCents(toCents(product.price) * qty),
    }));
    const subtotalCents = items.reduce((sum, it) => sum + toCents(it.price) * it.qty, 0);
    if (subtotalCents < toCents(s.minOrder)) {
      throw bad(`الحد الأدنى للطلب ${s.minOrder} جنيه`);
    }
    const freeDelivery = s.freeDeliveryThreshold > 0 && subtotalCents >= toCents(s.freeDeliveryThreshold);
    const deliveryCents = freeDelivery ? 0 : toCents(s.deliveryFee);

    for (const { product, qty } of lines) {
      product.stock -= qty;
    }

    const now = new Date().toISOString();
    d.counters.order += 1;
    const order = {
      id: crypto.randomUUID(),
      number: d.counters.order,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'new', at: now }],
      customer,
      paymentMethod,
      items,
      subtotal: fromCents(subtotalCents),
      deliveryFee: fromCents(deliveryCents),
      total: fromCents(subtotalCents + deliveryCents),
    };
    d.orders.push(order);
    store.save();
    orderIpLimiter.hit(req.ip);
    orderPhoneLimiter.hit(customer.phone);
    res.status(201).json({ order: publicOrder(order) });
  });

  app.post('/api/orders/track', (req, res) => {
    if (!trackLimiter.check(req.ip)) throw new HttpError(429, 'محاولات كتير، جرب كمان دقيقة');
    trackLimiter.hit(req.ip);
    const body = req.body || {};
    const number = v.number(v.toLatinDigits(String(body.number ?? '')), {
      field: 'رقم الطلب',
      min: 1,
      max: 1e9,
      integer: true,
    });
    const phone = v.egyptianPhone(body.phone);
    const order = db().orders.find((o) => o.number === number && o.customer.phone === phone);
    if (!order) throw new HttpError(404, 'مفيش طلب بالرقم ده ورقم الموبايل ده');
    res.json({ order: publicOrder(order) });
  });

  /* ------------------------------------------------------------------ */
  /* لوحة التحكم                                                          */
  /* ------------------------------------------------------------------ */

  app.post('/api/admin/login', (req, res) => {
    if (!loginLimiter.check(req.ip)) throw new HttpError(429, 'محاولات كتير غلط، استنى ربع ساعة وجرب تاني');
    const password = (req.body || {}).password;
    if (!auth.checkPassword(password)) {
      loginLimiter.hit(req.ip);
      throw new HttpError(401, 'كلمة السر غلط');
    }
    loginLimiter.reset(req.ip);
    const token = auth.createSession();
    res.setHeader('Set-Cookie', auth.cookie(token, req));
    res.json({ ok: true, usingDefaultPassword: auth.usingDefaultPassword });
  });

  app.post('/api/admin/logout', (req, res) => {
    auth.destroy(auth.tokenFrom(req));
    res.setHeader('Set-Cookie', auth.cookie('', req, 0));
    res.json({ ok: true });
  });

  app.use('/api/admin', requireAdmin);

  app.get('/api/admin/me', (req, res) => {
    res.json({ ok: true, usingDefaultPassword: auth.usingDefaultPassword, storeName: db().settings.storeName });
  });

  app.get('/api/admin/stats', (req, res) => {
    const d = db();
    const today = dayKey(Date.now());
    const active = d.orders.filter((o) => o.status !== 'cancelled');

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = dayKey(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push({ date: key, orders: 0, revenue: 0 });
    }
    const dayMap = new Map(days.map((x) => [x.date, x]));
    for (const o of active) {
      const bucket = dayMap.get(dayKey(o.createdAt));
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue = fromCents(toCents(bucket.revenue) + toCents(o.total));
      }
    }

    const sold = new Map();
    for (const o of active) {
      for (const it of o.items) {
        const entry = sold.get(it.productId) || { productId: it.productId, name: it.name, qty: 0, revenue: 0 };
        entry.qty += it.qty;
        entry.revenue = fromCents(toCents(entry.revenue) + toCents(it.total));
        sold.set(it.productId, entry);
      }
    }

    const todays = active.filter((o) => dayKey(o.createdAt) === today);
    res.json({
      ordersToday: todays.length,
      revenueToday: fromCents(todays.reduce((s, o) => s + toCents(o.total), 0)),
      newOrders: d.orders.filter((o) => o.status === 'new').length,
      pendingOrders: d.orders.filter((o) => ['new', 'preparing', 'delivering'].includes(o.status)).length,
      totalOrders: d.orders.length,
      deliveredRevenue: fromCents(
        d.orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + toCents(o.total), 0)
      ),
      productsCount: d.products.length,
      lowStock: d.products
        .filter((p) => p.active && p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .map((p) => ({ id: p.id, name: p.name, unit: p.unit, stock: p.stock, image: p.image })),
      last7Days: days,
      topProducts: [...sold.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      recentOrders: [...d.orders].reverse().slice(0, 6),
    });
  });

  // ---- الطلبات ----

  app.get('/api/admin/orders', (req, res) => {
    const d = db();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const q = typeof req.query.q === 'string' ? v.toLatinDigits(req.query.q.trim()).toLowerCase() : '';
    const counts = Object.fromEntries(STATUSES.map((st) => [st, 0]));
    for (const o of d.orders) counts[o.status] = (counts[o.status] || 0) + 1;

    let list = [...d.orders].reverse();
    if (status && STATUSES.includes(status)) list = list.filter((o) => o.status === status);
    if (q) {
      list = list.filter((o) =>
        [String(o.number), o.customer.name, o.customer.phone, o.customer.area, o.customer.address]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    res.json({ orders: list.slice(0, 500), total: list.length, counts, all: d.orders.length });
  });

  function findOrder(id) {
    const order = db().orders.find((o) => o.id === id);
    if (!order) throw new HttpError(404, 'الطلب مش موجود');
    return order;
  }

  app.get('/api/admin/orders/:id', (req, res) => {
    res.json({ order: findOrder(req.params.id) });
  });

  app.patch('/api/admin/orders/:id', (req, res) => {
    const d = db();
    const order = findOrder(req.params.id);
    const status = (req.body || {}).status;
    if (!STATUSES.includes(status)) throw bad('حالة غير صحيحة');
    if (order.status === 'cancelled') throw bad('الطلب ده ملغي ومينفعش تغير حالته');
    if (order.status !== status) {
      if (status === 'cancelled') {
        // نرجع الكميات للمخزون
        for (const it of order.items) {
          const product = d.products.find((p) => p.id === it.productId);
          if (product) product.stock += it.qty;
        }
      }
      const now = new Date().toISOString();
      order.status = status;
      order.updatedAt = now;
      order.history.push({ status, at: now });
      store.save();
    }
    res.json({ order });
  });

  // ---- المنتجات ----

  // أول صورة في القائمة هي الصورة الرئيسية اللي بتظهر في الكارت والسلة
  function parseImages(body, base) {
    let list;
    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) throw bad('الصور لازم تكون قائمة');
      list = body.images;
    } else {
      // تعديل قديم بيبعت image بس: نغيّر الرئيسية ونسيب باقي الصور زي ما هي
      const current = Array.isArray(base.images) ? base.images : [base.image];
      list = [body.image !== undefined ? body.image : current[0], ...current.slice(1)];
    }
    const images = [];
    for (const item of list) {
      const url = v.text(item, { field: 'الصورة', max: 300 });
      if (!url || url === PLACEHOLDER_IMAGE) continue;
      if (!IMAGE_URL.test(url)) throw bad('رابط الصورة غير صحيح');
      if (!images.includes(url)) images.push(url);
    }
    if (images.length > MAX_PRODUCT_IMAGES) throw bad(`أقصى عدد صور للمنتج ${MAX_PRODUCT_IMAGES}`);
    return images;
  }

  function parseProduct(body, base = {}) {
    const d = db();
    const src = { ...base, ...(body || {}) };
    const categoryId = v.text(src.categoryId, { field: 'القسم', max: 60, required: true });
    if (!d.categories.some((c) => c.id === categoryId)) throw bad('القسم مش موجود');
    const price = v.number(src.price, { field: 'السعر', min: 0, max: 1e6 });
    let oldPrice = v.number(src.oldPrice, { field: 'السعر قبل الخصم', min: 0, max: 1e6, nullable: true });
    if (oldPrice !== null && oldPrice <= price) oldPrice = null;
    const images = parseImages(body || {}, base);
    return {
      name: v.text(src.name, { field: 'اسم المنتج', max: 80, required: true }),
      categoryId,
      unit: v.text(src.unit, { field: 'الوزن / الحجم', max: 40 }),
      price,
      oldPrice,
      stock: v.number(src.stock ?? 0, { field: 'المخزون', min: 0, max: 1e6, integer: true }),
      description: v.text(src.description, { field: 'الوصف', max: 500 }),
      image: images[0] || PLACEHOLDER_IMAGE,
      images,
      active: src.active === undefined ? true : v.bool(src.active),
      featured: v.bool(src.featured),
      sort: v.number(src.sort ?? 0, { field: 'الترتيب', min: 0, max: 1e6, integer: true }),
    };
  }

  function findProduct(id) {
    const product = db().products.find((p) => p.id === id);
    if (!product) throw new HttpError(404, 'المنتج مش موجود');
    return product;
  }

  app.get('/api/admin/products', (req, res) => {
    res.json({ products: [...db().products].sort(bySort), categories: [...db().categories].sort(bySort) });
  });

  app.post('/api/admin/products', (req, res) => {
    const d = db();
    const data = parseProduct(req.body);
    if (!req.body || req.body.sort === undefined) {
      data.sort = d.products.reduce((m, p) => Math.max(m, p.sort || 0), 0) + 1;
    }
    const now = new Date().toISOString();
    const product = { id: randomId('p'), ...data, createdAt: now, updatedAt: now };
    d.products.push(product);
    store.save();
    res.status(201).json({ product });
  });

  app.put('/api/admin/products/:id', (req, res) => {
    const product = findProduct(req.params.id);
    Object.assign(product, parseProduct(req.body, product), { updatedAt: new Date().toISOString() });
    store.save();
    res.json({ product });
  });

  app.delete('/api/admin/products/:id', (req, res) => {
    const d = db();
    const product = findProduct(req.params.id);
    d.products = d.products.filter((p) => p !== product);
    store.save();
    res.json({ ok: true });
  });

  // ---- الأقسام ----

  function parseCategory(body, base = {}) {
    const src = { ...base, ...(body || {}) };
    return {
      name: v.text(src.name, { field: 'اسم القسم', max: 50, required: true }),
      icon: v.text(src.icon, { field: 'الأيقونة', max: 8 }) || '🛒',
      sort: v.number(src.sort ?? 0, { field: 'الترتيب', min: 0, max: 1e6, integer: true }),
    };
  }

  function findCategory(id) {
    const category = db().categories.find((c) => c.id === id);
    if (!category) throw new HttpError(404, 'القسم مش موجود');
    return category;
  }

  app.get('/api/admin/categories', (req, res) => {
    const d = db();
    res.json({
      categories: [...d.categories]
        .sort(bySort)
        .map((c) => ({ ...c, productsCount: d.products.filter((p) => p.categoryId === c.id).length })),
    });
  });

  app.post('/api/admin/categories', (req, res) => {
    const d = db();
    const data = parseCategory(req.body);
    if (!req.body || req.body.sort === undefined) {
      data.sort = d.categories.reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1;
    }
    const category = { id: randomId('c'), ...data };
    d.categories.push(category);
    store.save();
    res.status(201).json({ category });
  });

  app.put('/api/admin/categories/:id', (req, res) => {
    const category = findCategory(req.params.id);
    Object.assign(category, parseCategory(req.body, category));
    store.save();
    res.json({ category });
  });

  app.delete('/api/admin/categories/:id', (req, res) => {
    const d = db();
    const category = findCategory(req.params.id);
    const count = d.products.filter((p) => p.categoryId === category.id).length;
    if (count) throw bad(`القسم فيه ${count} منتج، انقلهم لقسم تاني أو امسحهم الأول`);
    d.categories = d.categories.filter((c) => c !== category);
    store.save();
    res.json({ ok: true });
  });

  // ---- الإعدادات ----

  app.get('/api/admin/settings', (req, res) => {
    res.json({ settings: db().settings, usingDefaultPassword: auth.usingDefaultPassword });
  });

  app.put('/api/admin/settings', (req, res) => {
    const d = db();
    const src = { ...d.settings, ...(req.body || {}) };
    const whatsapp = v.toLatinDigits(v.text(src.whatsapp, { field: 'رقم الواتساب', max: 20 })).replace(/\D/g, '');
    d.settings = {
      ...d.settings,
      storeName: v.text(src.storeName, { field: 'اسم المتجر', max: 60, required: true }),
      tagline: v.text(src.tagline, { field: 'الشعار', max: 120 }),
      phone: v.toLatinDigits(v.text(src.phone, { field: 'رقم التليفون', max: 20 })),
      whatsapp,
      address: v.text(src.address, { field: 'العنوان', max: 200 }),
      workingHours: v.text(src.workingHours, { field: 'مواعيد العمل', max: 100 }),
      deliveryFee: v.number(src.deliveryFee, { field: 'رسوم التوصيل', min: 0, max: 10000 }),
      freeDeliveryThreshold: v.number(src.freeDeliveryThreshold, { field: 'حد التوصيل المجاني', min: 0, max: 1e6 }),
      minOrder: v.number(src.minOrder, { field: 'الحد الأدنى للطلب', min: 0, max: 1e6 }),
      maxQtyPerItem: v.number(src.maxQtyPerItem, { field: 'أقصى كمية للمنتج', min: 1, max: 999, integer: true }),
      announcement: v.text(src.announcement, { field: 'شريط الإعلان', max: 200 }),
    };
    store.save();
    res.json({ settings: d.settings });
  });

  app.put('/api/admin/password', (req, res) => {
    const { current, next } = req.body || {};
    if (!auth.checkPassword(current)) throw bad('كلمة السر الحالية غلط');
    if (typeof next !== 'string' || next.length < 6 || next.length > 100) {
      throw bad('كلمة السر الجديدة لازم تكون 6 حروف أو أرقام على الأقل');
    }
    auth.setPassword(next);
    const token = auth.createSession();
    res.setHeader('Set-Cookie', auth.cookie(token, req));
    res.json({ ok: true });
  });

  // ---- رفع الصور ----

  app.post('/api/admin/upload', (req, res) => {
    const dataUrl = String((req.body || {}).dataUrl || '');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw bad('الصورة لازم تكون PNG أو JPG أو WEBP');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) throw bad('حجم الصورة أكبر من 2 ميجا');
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
    const ext = { png: isPng && 'png', jpeg: isJpeg && 'jpg', webp: isWebp && 'webp' }[match[1]];
    if (!ext) throw bad('ملف الصورة غير صالح');
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(store.uploadsDir, name), buffer);
    res.status(201).json({ url: `/uploads/${name}` });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'مش موجود' });
  });

  /* ------------------------------------------------------------------ */
  /* الملفات الثابتة                                                      */
  /* ------------------------------------------------------------------ */

  app.use('/uploads', express.static(store.uploadsDir, { maxAge: '30d', index: false }));
  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ['html'],
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        else res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    })
  );

  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'البيانات المبعوتة غير صحيحة' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'حجم البيانات كبير جداً' });
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    console.error(err);
    res.status(500).json({ error: 'حصلت مشكلة في السيرفر، جرب تاني' });
  });

  return { app, store, auth };
}

module.exports = { createApp, STATUSES };
