/* أدوات مشتركة بين كل صفحات المتجر */
(function () {
  'use strict';

  const KM = (window.KM = {});

  /* ------------------------------ DOM helper ------------------------------ */
  // بنبني العناصر بـ textContent بدل innerHTML عشان نمنع أي XSS من بيانات المستخدم
  KM.h = function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, value);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  };

  /* -------------------------------- أيقونات -------------------------------- */
  const ICONS = {
    cart: '<path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z"/>',
    box: '<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  };
  KM.icon = function icon(name, cls = 'icon') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  };
  // أي عنصر فيه data-icon="cart" بيتحط جواه الأيقونة
  KM.hydrateIcons = function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.prepend(KM.icon(el.dataset.icon, el.dataset.iconClass || 'icon'));
      el.removeAttribute('data-icon');
    });
  };

  /* -------------------------------- تنسيق --------------------------------- */
  const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  KM.num = (n) => numberFmt.format(Number(n) || 0);
  KM.money = (n) => `${KM.num(n)} ج.م`;
  KM.moneyEl = (n) => KM.h('span', { class: 'price' }, KM.num(n), ' ', KM.h('small', { text: 'ج.م' }));
  KM.date = (iso) =>
    new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Cairo',
      numberingSystem: 'latn',
    }).format(new Date(iso));
  KM.toLatinDigits = (s) =>
    String(s)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  KM.normalizePhone = (s) => KM.toLatinDigits(s).replace(/[\s-]/g, '').replace(/^(\+?20|0020)(?=1)/, '0');
  KM.isValidPhone = (s) => /^01[0125]\d{8}$/.test(KM.normalizePhone(s));
  const cents = (n) => Math.round(Number(n) * 100);

  KM.STATUS = {
    new: 'جديد',
    preparing: 'قيد التجهيز',
    delivering: 'في الطريق',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي',
  };
  KM.PAYMENT = { cash: 'كاش عند الاستلام', wallet: 'محفظة إلكترونية / إنستاباي عند الاستلام' };
  KM.statusBadge = (status) => KM.h('span', { class: `status-badge st-${status}`, text: KM.STATUS[status] || status });

  /* ---------------------------------- API ---------------------------------- */
  KM.api = async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch {
      const err = new Error('مفيش اتصال بالإنترنت، اتأكد من الشبكة وجرب تاني');
      err.status = 0;
      throw err;
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'حصلت مشكلة، جرب تاني');
      err.status = res.status;
      err.details = data && data.details;
      throw err;
    }
    return data;
  };

  let storePromise = null;
  KM.loadStore = function loadStore() {
    if (!storePromise) {
      storePromise = KM.api('/api/store').then((data) => {
        data.productMap = new Map(data.products.map((p) => [p.id, p]));
        data.categoryMap = new Map(data.categories.map((c) => [c.id, c]));
        return data;
      });
      storePromise.catch(() => (storePromise = null));
    }
    return storePromise;
  };

  /* ------------------------------ التخزين المحلي ------------------------------ */
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* التخزين مقفول (وضع التصفح الخفي مثلاً) */
      }
    },
  };
  KM.storage = storage;

  /* ---------------------------------- السلة ---------------------------------- */
  const CART_KEY = 'km_cart';
  KM.cart = {
    items() {
      const raw = storage.get(CART_KEY, {});
      return raw && typeof raw === 'object' ? raw : {};
    },
    qty(id) {
      return this.items()[id] || 0;
    },
    count() {
      return Object.values(this.items()).reduce((s, q) => s + q, 0);
    },
    set(id, qty) {
      const items = this.items();
      if (qty > 0) items[id] = qty;
      else delete items[id];
      storage.set(CART_KEY, items);
      window.dispatchEvent(new CustomEvent('cart:change', { detail: { id, qty } }));
    },
    add(id, qty = 1) {
      this.set(id, this.qty(id) + qty);
    },
    clear() {
      storage.set(CART_KEY, {});
      window.dispatchEvent(new CustomEvent('cart:change', { detail: {} }));
    },
    // بيرجع سطور السلة مع بيانات المنتجات الحالية، وبيشيل أي منتج اتمسح أو خلص
    lines(store) {
      const items = this.items();
      const lines = [];
      let changed = false;
      for (const [id, qty] of Object.entries(items)) {
        const product = store.productMap.get(id);
        const max = product ? Math.min(product.stock, store.settings.maxQtyPerItem) : 0;
        if (!product || max <= 0) {
          delete items[id];
          changed = true;
          continue;
        }
        const q = Math.min(Math.max(1, Math.floor(qty) || 1), max);
        if (q !== qty) {
          items[id] = q;
          changed = true;
        }
        lines.push({ product, qty: q, total: (cents(product.price) * q) / 100 });
      }
      if (changed) storage.set(CART_KEY, items);
      return lines;
    },
  };

  KM.maxQty = (product, settings) => Math.max(0, Math.min(product.stock, settings.maxQtyPerItem));

  KM.totals = function totals(lines, settings) {
    const subtotalCents = lines.reduce((s, l) => s + cents(l.product.price) * l.qty, 0);
    const threshold = cents(settings.freeDeliveryThreshold);
    const free = threshold > 0 && subtotalCents >= threshold;
    const deliveryCents = lines.length === 0 || free ? 0 : cents(settings.deliveryFee);
    return {
      subtotal: subtotalCents / 100,
      deliveryFee: deliveryCents / 100,
      total: (subtotalCents + deliveryCents) / 100,
      freeDelivery: free,
      remainingForFree: threshold > 0 ? Math.max(0, threshold - subtotalCents) / 100 : null,
      progress: threshold > 0 ? Math.min(1, subtotalCents / threshold) : 1,
      belowMin: subtotalCents < cents(settings.minOrder),
      remainingForMin: Math.max(0, cents(settings.minOrder) - subtotalCents) / 100,
    };
  };

  /* --------------------------- طلبات العميل المحفوظة --------------------------- */
  KM.myOrders = {
    list() {
      const list = storage.get('km_orders', []);
      return Array.isArray(list) ? list : [];
    },
    add(order) {
      const list = this.list().filter((o) => o.number !== order.number);
      list.unshift({ number: order.number, phone: order.customer.phone, createdAt: order.createdAt, total: order.total });
      storage.set('km_orders', list.slice(0, 20));
    },
    find(number) {
      return this.list().find((o) => String(o.number) === String(number));
    },
  };

  /* ---------------------------------- توست ---------------------------------- */
  KM.toast = function toast(message, type = 'success') {
    let wrap = document.querySelector('.toasts');
    if (!wrap) {
      wrap = KM.h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(wrap);
    }
    const el = KM.h(
      'div',
      { class: `toast ${type}` },
      KM.icon(type === 'error' ? 'close' : 'check', 'icon toast-icon'),
      KM.h('span', { text: message })
    );
    wrap.appendChild(el);
    // ميظهرش أكتر من توستين في نفس الوقت
    while (wrap.children.length > 2) wrap.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('hide');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2600);
  };

  /* --------------------------- بيانات المتجر في الصفحة --------------------------- */
  KM.applySettings = function applySettings(settings) {
    document.querySelectorAll('[data-store-name]').forEach((el) => (el.textContent = settings.storeName));
    document.querySelectorAll('[data-tagline]').forEach((el) => (el.textContent = settings.tagline));
    const announce = document.getElementById('announce');
    if (announce) {
      announce.textContent = settings.announcement;
      announce.hidden = !settings.announcement;
    }
    const base = document.body.dataset.title;
    document.title = base ? `${base} | ${settings.storeName}` : `${settings.storeName} | ${settings.tagline}`;
    KM.renderFooter(settings);
  };

  KM.renderFooter = function renderFooter(s) {
    const footer = document.getElementById('footer');
    if (!footer) return;
    const h = KM.h;
    const contact = [];
    if (s.phone) contact.push(h('li', null, h('a', { href: `tel:${s.phone}`, class: 'ltr' }, s.phone)));
    if (s.whatsapp) {
      contact.push(
        h('li', null, h('a', { href: `https://wa.me/${s.whatsapp}`, target: '_blank', rel: 'noopener' }, 'كلمنا على واتساب'))
      );
    }
    if (s.address) contact.push(h('li', { text: s.address }));
    if (s.workingHours) contact.push(h('li', { text: s.workingHours }));

    footer.replaceChildren(
      h(
        'div',
        { class: 'container footer-inner' },
        h(
          'div',
          null,
          h('a', { href: '/', class: 'logo' }, h('img', { src: '/images/logo.svg', alt: '', width: 40, height: 40 }), s.storeName),
          h('p', { text: `${s.tagline}. منتجات أصلية بأسعار مناسبة، والدفع عند الاستلام.` })
        ),
        h(
          'div',
          null,
          h('h3', { text: 'روابط سريعة' }),
          h(
            'ul',
            null,
            h('li', null, h('a', { href: '/#products', text: 'كل المنتجات' })),
            h('li', null, h('a', { href: '/checkout.html', text: 'إتمام الطلب' })),
            h('li', null, h('a', { href: '/order.html', text: 'تتبع طلبك' }))
          )
        ),
        h('div', null, h('h3', { text: 'تواصل معانا' }), h('ul', null, contact))
      ),
      h('div', { class: 'footer-bottom', text: `© ${new Date().getFullYear()} ${s.storeName} - كل الحقوق محفوظة` })
    );
  };

  KM.updateCartBadge = function updateCartBadge() {
    const count = KM.cart.count();
    document.querySelectorAll('[data-cart-count]').forEach((el) => (el.textContent = count));
  };

  KM.waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  document.addEventListener('DOMContentLoaded', () => {
    KM.hydrateIcons();
    KM.updateCartBadge();
  });
  window.addEventListener('cart:change', () => KM.updateCartBadge());
  // لو السلة اتغيرت من تاب تاني
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) window.dispatchEvent(new CustomEvent('cart:change', { detail: {} }));
  });
})();
