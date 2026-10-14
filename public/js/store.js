/* الصفحة الرئيسية: المنتجات + البحث + السلة */
(function () {
  'use strict';

  const { h } = KM;
  const $ = (id) => document.getElementById(id);

  const state = { store: null, category: 'all', query: '', sort: 'default', modalProduct: null };
  let lastFocus = null;

  // توحيد الحروف العربية في البحث: أ/إ/آ = ا ، ة = ه ، ى = ي ، ومن غير تشكيل
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim();

  /* ------------------------------ تحميل البيانات ------------------------------ */

  function renderSkeleton() {
    const cards = [];
    for (let i = 0; i < 8; i++) {
      cards.push(
        h('div', { class: 'skeleton', 'aria-hidden': 'true' }, h('div', { class: 'sk-media' }), h('div', { class: 'sk-line' }), h('div', { class: 'sk-line short' }))
      );
    }
    $('productGrid').replaceChildren(...cards);
  }

  async function init() {
    renderSkeleton();
    try {
      state.store = await KM.loadStore();
    } catch (err) {
      $('productGrid').replaceChildren(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty-emoji', text: '😕' }),
          h('h3', { text: 'مقدرناش نحمّل المنتجات' }),
          h('p', { text: err.message }),
          h('button', { type: 'button', class: 'btn btn-primary', text: 'جرب تاني', onclick: init })
        )
      );
      return;
    }
    KM.applySettings(state.store.settings);

    const params = new URLSearchParams(location.search);
    if (params.get('cat') && state.store.categoryMap.has(params.get('cat'))) state.category = params.get('cat');
    if (params.get('q')) {
      state.query = params.get('q');
      $('searchInput').value = state.query;
    }

    renderChips();
    renderGrid();
    renderCart();
    if (params.get('cart') === '1') openCart();
  }

  /* --------------------------------- الأقسام --------------------------------- */

  function renderChips() {
    const { categories, products } = state.store;
    const countBy = (id) => products.filter((p) => p.categoryId === id).length;
    const chip = (id, label, emoji, count) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(state.category === id),
          onclick: () => {
            state.category = id;
            renderChips();
            renderGrid();
          },
        },
        emoji ? h('span', { class: 'chip-emoji', text: emoji }) : null,
        label,
        h('span', { class: 'chip-count', text: `(${count})` })
      );
    $('categoryChips').replaceChildren(
      chip('all', 'كل المنتجات', '🛒', products.length),
      ...categories.filter((c) => countBy(c.id) > 0).map((c) => chip(c.id, c.name, c.icon, countBy(c.id)))
    );
  }

  /* --------------------------------- المنتجات -------------------------------- */

  function filteredProducts() {
    const { products, categoryMap } = state.store;
    const q = norm(state.query);
    let list = products.filter((p) => state.category === 'all' || p.categoryId === state.category);
    if (q) {
      const words = q.split(/\s+/);
      list = list.filter((p) => {
        const hay = norm([p.name, p.unit, p.description, categoryMap.get(p.categoryId)?.name].join(' '));
        return words.every((w) => hay.includes(w));
      });
    }
    const discount = (p) => (p.oldPrice ? 1 - p.price / p.oldPrice : 0);
    const inStock = (p) => (p.stock > 0 ? 0 : 1);
    const sorters = {
      default: (a, b) => inStock(a) - inStock(b) || Number(b.featured) - Number(a.featured),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      discount: (a, b) => discount(b) - discount(a),
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
    };
    return [...list].sort(sorters[state.sort] || sorters.default);
  }

  function renderGrid() {
    const list = filteredProducts();
    $('productGrid').replaceChildren(...list.map(productCard));
    $('emptyState').hidden = list.length > 0;
    $('resultsCount').textContent = list.length ? `${list.length} منتج` : '';
  }

  const discountPercent = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

  function productCard(p) {
    const out = p.stock <= 0;
    const discount = discountPercent(p);
    const open = () => openProduct(p);
    return h(
      'article',
      { class: `card${out ? ' out' : ''}`, dataset: { id: p.id } },
      h(
        'button',
        { type: 'button', class: 'card-media', 'aria-label': `تفاصيل ${p.name}`, onclick: open },
        out ? h('span', { class: 'tag tag-out', text: 'نفدت الكمية' }) : discount ? h('span', { class: 'tag', text: `خصم ${discount}%` }) : null,
        p.featured && !out ? h('span', { class: 'tag tag-featured', text: 'الأكثر طلباً' }) : null,
        h('img', { src: p.image, alt: p.name, loading: 'lazy', width: 400, height: 400 })
      ),
      h(
        'div',
        { class: 'card-body' },
        h('button', { type: 'button', class: 'card-title', text: p.name, onclick: open }),
        h('span', { class: 'card-unit', text: p.unit }),
        h(
          'div',
          { class: 'price-row' },
          KM.moneyEl(p.price),
          discount ? h('span', { class: 'old-price', text: KM.money(p.oldPrice) }) : null,
          !out && p.stock <= 5 ? h('span', { class: 'low-stock', text: `باقي ${p.stock} بس` }) : null
        ),
        h('div', { class: 'card-actions' }, cartControl(p))
      )
    );
  }

  function cartControl(p, { size } = {}) {
    const max = KM.maxQty(p, state.store.settings);
    if (max <= 0) return h('button', { type: 'button', class: 'btn btn-outline', disabled: true, text: 'غير متوفر حالياً' });
    const qty = KM.cart.qty(p.id);
    if (!qty) {
      const btn = h('button', { type: 'button', class: 'btn btn-soft', onclick: () => addToCart(p) }, KM.icon('cart'), 'أضف للسلة');
      if (size === 'lg') btn.classList.add('btn-lg');
      return btn;
    }
    return stepper(p, qty, max, size === 'sm' ? 'sm' : '');
  }

  function stepper(p, qty, max, extra = '') {
    return h(
      'div',
      { class: `stepper ${extra}`.trim(), role: 'group', 'aria-label': `كمية ${p.name}` },
      h('button', { type: 'button', 'aria-label': 'زوّد واحد', disabled: qty >= max, onclick: () => changeQty(p, 1) }, KM.icon('plus')),
      h('output', { text: qty, 'aria-live': 'polite' }),
      h(
        'button',
        { type: 'button', 'aria-label': qty === 1 ? 'شيل من السلة' : 'قلل واحد', onclick: () => changeQty(p, -1) },
        KM.icon(qty === 1 ? 'trash' : 'minus')
      )
    );
  }

  function addToCart(p) {
    KM.cart.add(p.id, 1);
    KM.toast(`اتضاف "${p.name}" للسلة`);
    const btn = $('cartBtn');
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  }

  function changeQty(p, delta) {
    const max = KM.maxQty(p, state.store.settings);
    const next = KM.cart.qty(p.id) + delta;
    if (delta > 0 && next > max) {
      KM.toast(`أقصى كمية متاحة ${max}`, 'error');
      return;
    }
    KM.cart.set(p.id, Math.max(0, next));
  }

  function refreshCardControls(id) {
    const cards = id ? document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`) : document.querySelectorAll('.card[data-id]');
    cards.forEach((card) => {
      const p = state.store.productMap.get(card.dataset.id);
      if (p) card.querySelector('.card-actions').replaceChildren(cartControl(p));
    });
  }

  /* ------------------------------ تفاصيل المنتج ------------------------------ */

  function renderModal() {
    const p = state.modalProduct;
    if (!p) return;
    const category = state.store.categoryMap.get(p.categoryId);
    const discount = discountPercent(p);
    const max = KM.maxQty(p, state.store.settings);
    const qty = KM.cart.qty(p.id);
    let actions;
    if (max <= 0) actions = [h('button', { type: 'button', class: 'btn btn-outline btn-lg', disabled: true, text: 'غير متوفر حالياً' })];
    else if (!qty) actions = [cartControl(p, { size: 'lg' })];
    else actions = [stepper(p, qty, max), h('button', { type: 'button', class: 'btn btn-primary', text: 'عرض السلة', onclick: () => { $('productModal').close(); openCart(); } })];

    $('productModal').replaceChildren(
      h('button', { type: 'button', class: 'icon-btn modal-close', 'aria-label': 'إغلاق', onclick: () => $('productModal').close() }, KM.icon('close')),
      h(
        'div',
        { class: 'product-detail' },
        h('div', { class: 'media' }, h('img', { src: p.image, alt: p.name, width: 400, height: 400 })),
        h(
          'div',
          { class: 'info' },
          category ? h('span', { class: 'cat', text: `${category.icon} ${category.name}` }) : null,
          h('h2', { id: 'modalTitle', text: p.name }),
          h('span', { class: 'muted', text: p.unit }),
          h(
            'div',
            { class: 'price-row' },
            KM.moneyEl(p.price),
            discount ? h('span', { class: 'old-price', text: KM.money(p.oldPrice) }) : null,
            discount ? h('span', { class: 'save-badge', text: `وفّر ${KM.money(p.oldPrice - p.price)}` }) : null
          ),
          p.description ? h('p', { class: 'desc', text: p.description }) : null,
          max > 0 && p.stock <= 5 ? h('span', { class: 'low-stock', text: `باقي ${p.stock} بس في المخزن` }) : null,
          h('div', { class: 'actions' }, actions)
        )
      )
    );
  }

  function openProduct(p) {
    state.modalProduct = p;
    renderModal();
    const dialog = $('productModal');
    if (!dialog.open) dialog.showModal();
  }

  /* ---------------------------------- السلة ---------------------------------- */

  function openCart() {
    lastFocus = document.activeElement;
    const overlay = $('overlay');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    const drawer = $('cartDrawer');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('closeCart').focus(), 50);
  }

  function closeCart() {
    const overlay = $('overlay');
    overlay.classList.remove('show');
    setTimeout(() => (overlay.hidden = true), 200);
    const drawer = $('cartDrawer');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function renderCart() {
    if (!state.store) return;
    const { settings } = state.store;
    const lines = KM.cart.lines(state.store);
    const totals = KM.totals(lines, settings);
    const count = lines.reduce((s, l) => s + l.qty, 0);

    $('cartTitle').textContent = count ? `سلة المشتريات (${count})` : 'سلة المشتريات';

    if (!lines.length) {
      $('cartItems').replaceChildren(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty-emoji', text: '🧺' }),
          h('h3', { text: 'السلة فاضية' }),
          h('p', { text: 'ضيف منتجات وهتلاقيها هنا' }),
          h('button', { type: 'button', class: 'btn btn-primary', text: 'ابدأ التسوق', onclick: closeCart })
        )
      );
      $('cartSummary').hidden = true;
    } else {
      $('cartItems').replaceChildren(
        ...lines.map(({ product: p, qty, total }) =>
          h(
            'div',
            { class: 'cart-line' },
            h('img', { src: p.image, alt: '', width: 64, height: 64 }),
            h(
              'div',
              null,
              h('div', { class: 'cart-line-name', text: p.name }),
              h('div', { class: 'cart-line-meta', text: `${p.unit} • ${KM.money(p.price)}` }),
              h('div', { class: 'cart-line-total', text: KM.money(total) })
            ),
            h(
              'div',
              { class: 'cart-line-side' },
              stepper(p, qty, KM.maxQty(p, settings), 'sm light'),
              h('button', { type: 'button', class: 'link-btn', text: 'حذف', onclick: () => KM.cart.set(p.id, 0) })
            )
          )
        )
      );

      const foot = [];
      if (totals.remainingForFree !== null) {
        foot.push(
          h(
            'div',
            { class: `free-progress${totals.freeDelivery ? ' done' : ''}` },
            totals.freeDelivery ? '🎉 مبروك! التوصيل عليك مجاني' : `باقي ${KM.money(totals.remainingForFree)} والتوصيل يبقى مجاني 🚚`,
            h('div', { class: 'progress' }, progressBar(totals.progress))
          )
        );
      }
      foot.push(
        h('div', { class: 'summary-row' }, h('span', { text: 'المنتجات' }), h('strong', { text: KM.money(totals.subtotal) })),
        h(
          'div',
          { class: 'summary-row' },
          h('span', { text: 'التوصيل' }),
          totals.deliveryFee ? h('strong', { text: KM.money(totals.deliveryFee) }) : h('strong', { class: 'free', text: 'مجاني' })
        ),
        h('div', { class: 'summary-row total' }, h('span', { text: 'الإجمالي' }), h('span', { text: KM.money(totals.total) }))
      );
      if (totals.belowMin) {
        foot.push(h('p', { class: 'notice', text: `الحد الأدنى للطلب ${KM.money(settings.minOrder)} - ضيف منتجات بـ ${KM.money(totals.remainingForMin)} كمان` }));
      }
      const checkout = h('a', { href: '/checkout.html', class: 'btn btn-primary btn-lg btn-block' }, 'إتمام الطلب', KM.icon('arrow'));
      if (totals.belowMin) {
        checkout.setAttribute('aria-disabled', 'true');
        checkout.classList.add('disabled');
        checkout.addEventListener('click', (e) => e.preventDefault());
      }
      foot.push(h('div', { class: 'drawer-cta' }, checkout));
      $('cartSummary').replaceChildren(...foot);
      $('cartSummary').hidden = false;
    }

    const bar = $('mobileCartBar');
    bar.classList.toggle('show', count > 0);
    document.body.classList.toggle('has-cart-bar', count > 0);
    $('mobileCartTotal').textContent = count ? KM.money(totals.total) : '';
  }

  function progressBar(ratio) {
    const span = h('span');
    span.style.width = `${Math.round(ratio * 100)}%`;
    return span;
  }

  /* -------------------------------- الأحداث -------------------------------- */

  let searchTimer;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value;
      if (state.query && state.category !== 'all') {
        state.category = 'all';
        renderChips();
      }
      if (state.store) renderGrid();
    }, 150);
  });
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    $('searchInput').blur();
    $('products').scrollIntoView({ behavior: 'smooth' });
  });
  $('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderGrid();
  });
  $('clearFilters').addEventListener('click', () => {
    state.query = '';
    state.category = 'all';
    $('searchInput').value = '';
    renderChips();
    renderGrid();
  });

  $('cartBtn').addEventListener('click', openCart);
  $('mobileCartBar').addEventListener('click', openCart);
  $('closeCart').addEventListener('click', closeCart);
  $('overlay').addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('cartDrawer').classList.contains('open')) closeCart();
  });

  const modal = $('productModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
  modal.addEventListener('close', () => (state.modalProduct = null));

  window.addEventListener('cart:change', (e) => {
    if (!state.store) return;
    refreshCardControls(e.detail && e.detail.id);
    renderCart();
    if (state.modalProduct) renderModal();
  });

  init();
})();
