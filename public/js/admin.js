/* لوحة التحكم */
(function () {
  'use strict';

  const { h } = KM;
  const $ = (id) => document.getElementById(id);

  const VIEWS = {
    dashboard: 'الرئيسية',
    orders: 'الطلبات',
    products: 'المنتجات',
    categories: 'الأقسام',
    settings: 'الإعدادات',
  };
  const NEXT_STEP = {
    new: ['preparing', 'ابدأ التجهيز'],
    preparing: ['delivering', 'خرج للتوصيل'],
    delivering: ['delivered', 'تم التوصيل'],
  };

  const state = {
    view: 'dashboard',
    orderStatus: '',
    orderQuery: '',
    productQuery: '',
    productCategory: '',
    newCount: null,
    pollTimer: null,
    renderToken: 0,
  };

  async function api(path, opts) {
    try {
      return await KM.api(path, opts);
    } catch (err) {
      if (err.status === 401) showLogin();
      throw err;
    }
  }

  const spinner = () => h('div', { class: 'center-load' }, h('div', { class: 'spinner dark' }));
  const errorBox = (err, retry) =>
    h(
      'div',
      { class: 'panel empty' },
      h('div', { class: 'empty-emoji', text: '😕' }),
      h('h3', { text: 'حصلت مشكلة' }),
      h('p', { text: err.message }),
      retry ? h('button', { type: 'button', class: 'btn btn-primary', text: 'جرب تاني', onclick: retry }) : null
    );

  /* ------------------------------- تسجيل الدخول ------------------------------- */

  async function boot() {
    try {
      const me = await KM.api('/api/admin/me');
      showApp(me);
    } catch (err) {
      if (err.status === 401) showLogin();
      else document.body.replaceChildren(h('div', { class: 'container page' }, errorBox(err, () => location.reload())));
    }
  }

  function showLogin() {
    stopPolling();
    if ($('adminModal').open) $('adminModal').close();
    $('appView').hidden = true;
    $('loginView').hidden = false;
    document.title = 'تسجيل الدخول | لوحة التحكم';
    setTimeout(() => $('password').focus(), 50);
  }

  function showApp(me) {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('sideStoreName').textContent = me.storeName;
    $('defaultPwBanner').hidden = !me.usingDefaultPassword;
    navigate(viewFromHash());
    startPolling();
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    $('loginError').textContent = '';
    btn.disabled = true;
    try {
      await KM.api('/api/admin/login', { method: 'POST', body: { password: $('password').value } });
      $('password').value = '';
      await boot();
    } catch (err) {
      $('loginError').textContent = err.message;
      $('password').select();
    } finally {
      btn.disabled = false;
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    try {
      await KM.api('/api/admin/logout', { method: 'POST' });
    } catch {
      /* حتى لو فشل، هنرجع لشاشة الدخول */
    }
    showLogin();
  });

  $('changePwShortcut').addEventListener('click', () => {
    if (state.view === 'settings') document.getElementById('in-current')?.focus();
    else location.hash = 'settings';
  });

  /* ---------------------------------- التنقل ---------------------------------- */

  function viewFromHash() {
    const v = location.hash.slice(1);
    return VIEWS[v] ? v : 'dashboard';
  }

  window.addEventListener('hashchange', () => {
    if (!$('appView').hidden) navigate(viewFromHash());
  });

  document.querySelectorAll('.side-link[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (location.hash.slice(1) === view) navigate(view);
      else location.hash = view;
    });
  });

  function navigate(view) {
    state.view = view;
    state.renderToken += 1;
    document.querySelectorAll('.side-link[data-view]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('viewTitle').textContent = VIEWS[view];
    $('viewActions').replaceChildren();
    $('view').replaceChildren(spinner());
    updateTitle();
    RENDERERS[view]();
  }

  function updateTitle() {
    const n = state.newCount || 0;
    document.title = `${n ? `(${n}) ` : ''}${VIEWS[state.view]} | لوحة التحكم`;
  }

  /* ---------------------------------- المودال ---------------------------------- */

  const modal = $('adminModal');
  function openModal(...children) {
    modal.replaceChildren(
      h('button', { type: 'button', class: 'icon-btn modal-close', 'aria-label': 'إغلاق', onclick: () => modal.close() }, KM.icon('close')),
      h('div', { class: 'modal-body' }, children)
    );
    if (!modal.open) modal.showModal();
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  /* --------------------------------- أدوات الفورم --------------------------------- */

  function input({ label, name, value, type = 'text', hint, full, required, textarea, options, ...attrs }) {
    const id = `in-${name}`;
    let control;
    if (options) {
      control = h(
        'select',
        { id, name, required },
        options.map(([v, text]) => h('option', { value: v, selected: String(v) === String(value ?? '') }, text))
      );
    } else {
      control = h(textarea ? 'textarea' : 'input', {
        id,
        name,
        type: textarea ? undefined : type,
        required,
        rows: textarea ? 3 : undefined,
        ...attrs,
      });
      control.value = value ?? '';
    }
    return h(
      'div',
      { class: `field${full ? ' full' : ''}` },
      h('label', { for: id, text: label }),
      control,
      hint ? h('span', { class: 'hint', text: hint }) : null
    );
  }

  function money(name, label, value, extra = {}) {
    return input({ name, label, value, type: 'number', step: '0.01', min: '0', inputmode: 'decimal', dir: 'ltr', ...extra });
  }

  function switchEl(name, label, checked) {
    return h(
      'label',
      { class: 'switch' },
      h('input', { type: 'checkbox', name, checked }),
      h('span', { class: 'track' }),
      label
    );
  }

  function setBusy(btn, busy, text) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.replaceChildren(h('span', { class: 'spinner' }), text || 'جاري الحفظ...');
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || btn.textContent;
    }
  }

  /* ---------------------------------- الرئيسية ---------------------------------- */

  async function renderDashboard() {
    const token = state.renderToken;
    let s;
    try {
      s = await api('/api/admin/stats');
    } catch (err) {
      if (token === state.renderToken) $('view').replaceChildren(errorBox(err, renderDashboard));
      return;
    }
    if (token !== state.renderToken) return;

    $('viewActions').replaceChildren(
      h('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => navigate('dashboard') }, KM.icon('refresh'), 'تحديث')
    );

    const stat = (label, value, hint, opts = {}) =>
      h(
        opts.onclick ? 'button' : 'div',
        { class: `stat${opts.highlight ? ' highlight' : ''}`, type: opts.onclick ? 'button' : undefined, onclick: opts.onclick },
        h('span', { class: 'stat-label', text: label }),
        h('span', { class: 'stat-value' }, value),
        hint ? h('span', { class: 'stat-hint', text: hint }) : null
      );
    const moneyValue = (n) => [KM.num(n), ' ', h('small', { text: 'ج.م' })];
    const goOrders = (status) => () => {
      state.orderStatus = status;
      state.orderQuery = '';
      location.hash = 'orders';
    };

    const stats = h(
      'div',
      { class: 'stats' },
      stat('طلبات جديدة', String(s.newOrders), 'محتاجة تأكيد وتجهيز', { highlight: s.newOrders > 0, onclick: goOrders('new') }),
      stat('طلبات النهارده', String(s.ordersToday), null, { onclick: goOrders('') }),
      stat('مبيعات النهارده', moneyValue(s.revenueToday), 'من غير الطلبات الملغية'),
      stat('طلبات جارية', String(s.pendingOrders), 'جديد + تجهيز + في الطريق', { onclick: goOrders('') }),
      stat('إجمالي الطلبات', String(s.totalOrders)),
      stat('مبيعات اتسلمت', moneyValue(s.deliveredRevenue), 'كل الطلبات اللي اتوصلت')
    );

    const recent = h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'آخر الطلبات' }),
      s.recentOrders.length
        ? ordersTable(s.recentOrders, { compact: true })
        : h('p', { class: 'muted', text: 'لسه مفيش طلبات. أول ما حد يطلب هتلاقيه هنا 👌' })
    );

    const low = h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'منتجات قربت تخلص' }),
      s.lowStock.length
        ? h(
            'ul',
            { class: 'list' },
            s.lowStock.map((p) =>
              h(
                'li',
                null,
                h('img', { src: p.image, alt: '' }),
                h('span', { class: 'grow' }, h('strong', { text: p.name }), ' ', h('small', { class: 'muted', text: p.unit })),
                h('span', { class: `stock ${p.stock === 0 ? 'out' : 'low'}`, text: p.stock })
              )
            )
          )
        : h('p', { class: 'muted', text: 'كل المنتجات مخزونها كويس ✅' })
    );

    const top = h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'الأكثر مبيعاً' }),
      s.topProducts.length
        ? h(
            'ul',
            { class: 'list' },
            s.topProducts.map((p, i) =>
              h(
                'li',
                null,
                h('span', { class: 'rank', text: i + 1 }),
                h('span', { class: 'grow', text: p.name }),
                h('span', { class: 'muted', text: `${p.qty} قطعة` }),
                h('strong', { text: KM.money(p.revenue) })
              )
            )
          )
        : h('p', { class: 'muted', text: 'هيظهر هنا أول ما يبقى في مبيعات' })
    );

    $('view').replaceChildren(
      stats,
      h(
        'div',
        { class: 'dash-grid' },
        h('div', { class: 'dash-col' }, salesChart(s.last7Days), recent),
        h('div', { class: 'dash-col' }, low, top)
      )
    );
  }

  function niceMax(value) {
    if (value <= 0) return 100;
    const pow = 10 ** Math.floor(Math.log10(value));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= value) return m * pow;
    return 10 * pow;
  }

  function salesChart(days) {
    const max = niceMax(Math.max(...days.map((d) => d.revenue)));
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'UTC' });
    const dayLabel = (d, i) => (i === days.length - 1 ? 'النهارده' : weekday.format(new Date(`${d.date}T12:00:00Z`)));

    const plot = h('div', { class: 'chart-plot', role: 'img', 'aria-label': 'مبيعات آخر 7 أيام' });
    for (const frac of [0.5, 1]) {
      const line = h('div', { class: 'chart-gridline' }, h('span', { text: KM.num(max * frac) }));
      line.style.bottom = `${frac * 100}%`;
      plot.appendChild(line);
    }
    days.forEach((d, i) => {
      const bar = h('div', { class: 'chart-bar' });
      bar.style.height = `${(d.revenue / max) * 100}%`;
      const label = `${dayLabel(d, i)} ${d.date}: ${d.orders} طلب • ${KM.money(d.revenue)}`;
      plot.appendChild(
        h(
          'div',
          { class: `chart-col${d.revenue ? '' : ' zero'}`, tabindex: '0', 'aria-label': label },
          h('span', { class: 'chart-tip', text: `${d.orders} طلب • ${KM.money(d.revenue)}` }),
          bar
        )
      );
    });

    const table = h(
      'table',
      { class: 'sr-only' },
      h('caption', { text: 'مبيعات آخر 7 أيام' }),
      h('thead', null, h('tr', null, h('th', { text: 'اليوم' }), h('th', { text: 'الطلبات' }), h('th', { text: 'المبيعات' }))),
      h(
        'tbody',
        null,
        days.map((d, i) => h('tr', null, h('td', { text: dayLabel(d, i) }), h('td', { text: d.orders }), h('td', { text: KM.money(d.revenue) })))
      )
    );

    const total = days.reduce((s, d) => s + d.revenue, 0);
    return h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'مبيعات آخر 7 أيام', h('span', { class: 'muted', text: `(${KM.money(total)})` })),
      h(
        'div',
        { class: 'chart' },
        plot,
        h('div', { class: 'chart-x', 'aria-hidden': 'true' }, days.map((d, i) => h('span', { class: i === days.length - 1 ? 'today' : '', text: dayLabel(d, i) }))),
        table
      )
    );
  }

  /* ---------------------------------- الطلبات ---------------------------------- */

  function ordersTable(orders, { compact } = {}) {
    return h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { text: 'رقم الطلب' }),
            h('th', { text: 'العميل' }),
            compact ? null : h('th', { text: 'المنطقة' }),
            compact ? null : h('th', { text: 'التاريخ' }),
            h('th', { text: 'الإجمالي' }),
            h('th', { text: 'الحالة' })
          )
        ),
        h(
          'tbody',
          null,
          orders.map((o) =>
            h(
              'tr',
              {
                class: 'clickable',
                tabindex: '0',
                onclick: () => openOrder(o.id),
                onkeydown: (e) => {
                  if (e.key === 'Enter') openOrder(o.id);
                },
              },
              h('td', { 'data-label': 'رقم الطلب' }, h('strong', { text: `#${o.number}` })),
              h('td', { 'data-label': 'العميل' }, h('span', { class: 'name-cell' }, h('strong', { text: o.customer.name }), h('small', { class: 'ltr', text: o.customer.phone }))),
              compact ? null : h('td', { 'data-label': 'المنطقة', text: o.customer.area }),
              compact ? null : h('td', { 'data-label': 'التاريخ', class: 'num', text: KM.date(o.createdAt) }),
              h('td', { 'data-label': 'الإجمالي', class: 'num' }, h('strong', { text: KM.money(o.total) })),
              h('td', { 'data-label': 'الحالة' }, KM.statusBadge(o.status))
            )
          )
        )
      )
    );
  }

  async function renderOrders() {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'فلترة بالحالة' });
    const search = h('input', {
      class: 'input',
      type: 'search',
      placeholder: 'بحث برقم الطلب أو الاسم أو الموبايل',
      'aria-label': 'بحث في الطلبات',
    });
    search.value = state.orderQuery;
    const tableBox = h('div', null, spinner());
    $('view').replaceChildren(h('div', { class: 'filters' }, chips, search), tableBox);

    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.orderQuery = search.value.trim();
        load();
      }, 250);
    });

    $('viewActions').replaceChildren(h('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => load() }, KM.icon('refresh'), 'تحديث'));

    const token = state.renderToken;
    async function load() {
      let data;
      try {
        const qs = new URLSearchParams({ status: state.orderStatus, q: state.orderQuery });
        data = await api(`/api/admin/orders?${qs}`);
      } catch (err) {
        if (token === state.renderToken) tableBox.replaceChildren(errorBox(err, load));
        return;
      }
      if (token !== state.renderToken) return;
      const chip = (status, label, count) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(state.orderStatus === status),
            onclick: () => {
              state.orderStatus = status;
              load();
            },
          },
          label,
          h('span', { class: 'chip-count', text: `(${count})` })
        );
      chips.replaceChildren(
        chip('', 'الكل', data.all),
        ...Object.entries(KM.STATUS).map(([key, label]) => chip(key, label, data.counts[key] || 0))
      );
      if (!data.orders.length) {
        tableBox.replaceChildren(
          h(
            'div',
            { class: 'panel empty' },
            h('div', { class: 'empty-emoji', text: '📭' }),
            h('h3', { text: data.all ? 'مفيش طلبات مطابقة' : 'لسه مفيش طلبات' }),
            h('p', { text: data.all ? 'جرب فلتر أو بحث تاني' : 'أول ما عميل يطلب من المتجر هيظهر هنا' })
          )
        );
      } else {
        tableBox.replaceChildren(ordersTable(data.orders));
      }
    }
    state.reloadOrders = load;
    load();
  }

  async function openOrder(id) {
    openModal(spinner());
    let order;
    try {
      ({ order } = await api(`/api/admin/orders/${encodeURIComponent(id)}`));
    } catch (err) {
      openModal(errorBox(err));
      return;
    }
    renderOrderModal(order);
  }

  function renderOrderModal(order) {
    const c = order.customer;
    const waNumber = `2${c.phone}`;
    const statusButtons = [];
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      const next = NEXT_STEP[order.status];
      if (next) statusButtons.push(h('button', { type: 'button', class: 'btn btn-primary', onclick: (e) => setStatus(order, next[0], e.currentTarget) }, KM.icon('check'), next[1]));
      statusButtons.push(h('button', { type: 'button', class: 'btn btn-outline', onclick: (e) => setStatus(order, 'cancelled', e.currentTarget), text: 'إلغاء الطلب' }));
    }
    if (order.status === 'delivered') {
      statusButtons.push(h('span', { class: 'muted', text: 'الطلب ده اتسلم خلاص ✅' }));
    }
    if (order.status === 'cancelled') {
      statusButtons.push(h('span', { class: 'muted', text: 'الطلب ده ملغي، والكميات رجعت للمخزن.' }));
    }

    openModal(
      h(
        'div',
        { class: 'modal-head' },
        h('div', null, h('h2', { text: `طلب #${order.number}` }), h('span', { class: 'muted', text: KM.date(order.createdAt) })),
        KM.statusBadge(order.status)
      ),
      h(
        'div',
        { class: 'two-col' },
        h(
          'div',
          null,
          h('h3', { class: 'panel-title', text: 'العميل' }),
          h(
            'dl',
            { class: 'info-list' },
            h('dt', { text: 'الاسم' }),
            h('dd', { text: c.name }),
            h('dt', { text: 'الموبايل' }),
            h('dd', null, h('span', { class: 'ltr', text: c.phone })),
            h('dt', { text: 'المنطقة' }),
            h('dd', { text: c.area }),
            h('dt', { text: 'العنوان' }),
            h('dd', { text: c.address }),
            c.notes ? h('dt', { text: 'ملاحظات' }) : null,
            c.notes ? h('dd', { text: c.notes }) : null,
            h('dt', { text: 'الدفع' }),
            h('dd', { text: KM.PAYMENT[order.paymentMethod] || order.paymentMethod })
          ),
          h(
            'div',
            { class: 'contact-actions' },
            h('a', { class: 'btn btn-outline btn-sm', href: `tel:${c.phone}` }, KM.icon('phone'), 'اتصال'),
            h('a', { class: 'btn btn-whatsapp btn-sm', href: `https://wa.me/${waNumber}`, target: '_blank', rel: 'noopener' }, KM.icon('whatsapp'), 'واتساب')
          )
        ),
        h(
          'div',
          null,
          h('h3', { class: 'panel-title', text: `المنتجات (${order.items.reduce((s, it) => s + it.qty, 0)})` }),
          order.items.map((it) =>
            h(
              'div',
              { class: 'summary-item' },
              h('img', { src: it.image, alt: '', width: 48, height: 48 }),
              h('div', null, h('div', { text: `${it.name} - ${it.unit}` }), h('div', { class: 'qty', text: `${it.qty} × ${KM.money(it.price)}` })),
              h('div', { class: 'amount', text: KM.money(it.total) })
            )
          ),
          h('div', { class: 'summary-row' }, h('span', { text: 'المنتجات' }), h('strong', { text: KM.money(order.subtotal) })),
          h('div', { class: 'summary-row' }, h('span', { text: 'التوصيل' }), h('strong', { text: order.deliveryFee ? KM.money(order.deliveryFee) : 'مجاني' })),
          h('div', { class: 'summary-row total' }, h('span', { text: 'الإجمالي' }), h('span', { text: KM.money(order.total) }))
        )
      ),
      h(
        'div',
        { class: 'modal-section' },
        h('h3', { text: 'سجل الحالة' }),
        h('ul', { class: 'history' }, order.history.map((x) => h('li', { text: `${KM.STATUS[x.status] || x.status} — ${KM.date(x.at)}` })))
      ),
      h('div', { class: 'modal-foot' }, h('div', { class: 'status-actions' }, statusButtons))
    );
  }

  async function setStatus(order, status, btn) {
    if (status === 'cancelled' && !confirm(`متأكد إنك عايز تلغي طلب #${order.number}؟ الكميات هترجع للمخزن.`)) return;
    setBusy(btn, true, 'جاري التحديث...');
    try {
      const { order: updated } = await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: { status } });
      KM.toast(`طلب #${updated.number}: ${KM.STATUS[updated.status]}`);
      renderOrderModal(updated);
      refreshAfterChange();
      checkNewOrders();
    } catch (err) {
      setBusy(btn, false);
      KM.toast(err.message, 'error');
    }
  }

  function refreshAfterChange() {
    if (state.view === 'orders' && state.reloadOrders) state.reloadOrders();
    else if (state.view === 'dashboard') renderDashboard();
  }

  /* ---------------------------------- المنتجات ---------------------------------- */

  async function renderProducts() {
    const token = state.renderToken;
    let data;
    try {
      data = await api('/api/admin/products');
    } catch (err) {
      if (token === state.renderToken) $('view').replaceChildren(errorBox(err, renderProducts));
      return;
    }
    if (token !== state.renderToken) return;
    const { products, categories } = data;
    const catMap = new Map(categories.map((c) => [c.id, c]));

    $('viewActions').replaceChildren(
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => productForm(null, categories) }, KM.icon('plus'), 'منتج جديد')
    );

    const search = h('input', { class: 'input', type: 'search', placeholder: 'بحث باسم المنتج', 'aria-label': 'بحث في المنتجات' });
    search.value = state.productQuery;
    const catSelect = h(
      'select',
      { class: 'input', 'aria-label': 'القسم' },
      h('option', { value: '', text: 'كل الأقسام' }),
      categories.map((c) => h('option', { value: c.id, selected: state.productCategory === c.id, text: `${c.icon} ${c.name}` }))
    );
    const tableBox = h('div');
    const summary = h('p', { class: 'muted' });

    function draw() {
      const q = state.productQuery.trim();
      const list = products.filter(
        (p) => (!state.productCategory || p.categoryId === state.productCategory) && (!q || `${p.name} ${p.unit}`.includes(q))
      );
      const hiddenCount = products.filter((p) => !p.active).length;
      summary.textContent = `${list.length} منتج${hiddenCount ? ` • ${hiddenCount} مخفي من المتجر` : ''}`;
      if (!list.length) {
        tableBox.replaceChildren(h('div', { class: 'panel empty' }, h('div', { class: 'empty-emoji', text: '📦' }), h('h3', { text: 'مفيش منتجات' })));
        return;
      }
      tableBox.replaceChildren(
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'table' },
            h(
              'thead',
              null,
              h('tr', null, h('th', { text: 'المنتج' }), h('th', { text: 'القسم' }), h('th', { text: 'السعر' }), h('th', { text: 'المخزون' }), h('th', { text: 'ظاهر في المتجر' }), h('th', null, h('span', { class: 'sr-only', text: 'إجراءات' })))
            ),
            h(
              'tbody',
              null,
              list.map((p) => {
                const cat = catMap.get(p.categoryId);
                const toggle = h('input', { type: 'checkbox', checked: p.active, 'aria-label': `إظهار ${p.name}` });
                toggle.addEventListener('change', async () => {
                  toggle.disabled = true;
                  try {
                    const { product } = await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'PUT', body: { active: toggle.checked } });
                    Object.assign(p, product);
                    KM.toast(product.active ? 'المنتج ظاهر في المتجر' : 'المنتج اتخفى من المتجر');
                    draw();
                  } catch (err) {
                    toggle.checked = !toggle.checked;
                    KM.toast(err.message, 'error');
                  } finally {
                    toggle.disabled = false;
                  }
                });
                const stockCls = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : '';
                return h(
                  'tr',
                  { class: p.active ? '' : 'inactive-row' },
                  h(
                    'td',
                    null,
                    h('div', { class: 'product-cell' }, h('img', { class: 'thumb', src: p.image, alt: '', loading: 'lazy' }), h('span', { class: 'name-cell' }, h('strong', { text: p.name }), h('small', { text: p.unit })))
                  ),
                  h('td', { 'data-label': 'القسم', text: cat ? `${cat.icon} ${cat.name}` : '—' }),
                  h(
                    'td',
                    { 'data-label': 'السعر', class: 'num' },
                    h('strong', { text: KM.money(p.price) }),
                    p.oldPrice ? h('div', { class: 'old-price', text: KM.money(p.oldPrice) }) : null
                  ),
                  h('td', { 'data-label': 'المخزون' }, h('span', { class: `stock ${stockCls}`, text: p.stock })),
                  h('td', { 'data-label': 'ظاهر في المتجر' }, h('label', { class: 'switch' }, toggle, h('span', { class: 'track' }))),
                  h(
                    'td',
                    null,
                    h(
                      'div',
                      { class: 'actions' },
                      h('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => productForm(p, categories), text: 'تعديل' }),
                      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `حذف ${p.name}`, onclick: () => deleteProduct(p) }, KM.icon('trash'))
                    )
                  )
                );
              })
            )
          )
        )
      );
    }

    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.productQuery = search.value;
        draw();
      }, 150);
    });
    catSelect.addEventListener('change', () => {
      state.productCategory = catSelect.value;
      draw();
    });

    $('view').replaceChildren(h('div', { class: 'filters' }, search, catSelect, summary), tableBox);
    draw();
  }

  async function deleteProduct(p) {
    if (!confirm(`متأكد إنك عايز تمسح "${p.name}"؟ الطلبات القديمة مش هتتأثر.`)) return;
    try {
      await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      KM.toast('المنتج اتمسح');
      renderProducts();
    } catch (err) {
      KM.toast(err.message, 'error');
    }
  }

  function productForm(product, categories) {
    const p = product || { active: true, featured: false, stock: 0, image: '/images/products/placeholder.svg', categoryId: state.productCategory || categories[0]?.id };
    if (!categories.length) {
      KM.toast('ضيف قسم الأول قبل ما تضيف منتجات', 'error');
      location.hash = 'categories';
      return;
    }
    const preview = h('img', { src: p.image, alt: 'صورة المنتج' });
    const imageInput = h('input', { type: 'hidden', name: 'image' });
    imageInput.value = p.image || '';
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    const uploadLabel = h('span', { text: 'ارفع صورة' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploadLabel.textContent = 'جاري الرفع...';
      try {
        const dataUrl = await resizeImage(file);
        const { url } = await api('/api/admin/upload', { method: 'POST', body: { dataUrl } });
        imageInput.value = url;
        preview.src = url;
        KM.toast('الصورة اترفعت');
      } catch (err) {
        KM.toast(err.message || 'مقدرناش نرفع الصورة', 'error');
      } finally {
        uploadLabel.textContent = 'ارفع صورة';
        fileInput.value = '';
      }
    });

    const form = h(
      'form',
      { novalidate: true },
      h(
        'div',
        { class: 'form-grid' },
        input({ name: 'name', label: 'اسم المنتج', value: p.name, required: true, full: true, maxlength: 80, placeholder: 'مثال: سكر أبيض ناعم' }),
        input({ name: 'unit', label: 'الوزن / الحجم', value: p.unit, maxlength: 40, placeholder: 'مثال: 1 كيلو' }),
        input({ name: 'categoryId', label: 'القسم', value: p.categoryId, options: categories.map((c) => [c.id, `${c.icon} ${c.name}`]) }),
        money('price', 'السعر (ج.م)', p.price, { required: true }),
        money('oldPrice', 'السعر قبل الخصم (اختياري)', p.oldPrice, { hint: 'لو حطيته هيظهر خصم على المنتج' }),
        input({ name: 'stock', label: 'الكمية في المخزن', value: p.stock, type: 'number', min: '0', step: '1', inputmode: 'numeric', dir: 'ltr' }),
        input({ name: 'sort', label: 'الترتيب', value: p.sort ?? '', type: 'number', min: '0', step: '1', inputmode: 'numeric', dir: 'ltr', hint: 'الرقم الأصغر يظهر الأول' }),
        input({ name: 'description', label: 'الوصف', value: p.description, textarea: true, full: true, maxlength: 500 }),
        h(
          'div',
          { class: 'field full' },
          h('span', { class: 'field-label', text: 'صورة المنتج' }),
          h(
            'div',
            { class: 'image-field' },
            preview,
            h(
              'div',
              { class: 'controls' },
              h('span', { class: 'btn btn-outline btn-sm file-btn' }, uploadLabel, fileInput),
              h('span', { class: 'hint', text: 'PNG أو JPG أو WEBP • يفضل خلفية بيضاء أو شفافة' })
            ),
            imageInput
          )
        ),
        h('div', { class: 'field full' }, h('div', { class: 'status-actions' }, switchEl('active', 'ظاهر في المتجر', p.active), switchEl('featured', 'من الأكثر طلباً', p.featured)))
      ),
      h('p', { class: 'notice error', hidden: true }),
      h(
        'div',
        { class: 'modal-foot' },
        h('button', { type: 'button', class: 'btn btn-ghost', text: 'إلغاء', onclick: () => modal.close() }),
        h('button', { type: 'submit', class: 'btn btn-primary', text: product ? 'حفظ التعديلات' : 'إضافة المنتج' })
      )
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const errBox = form.querySelector('.notice.error');
      errBox.hidden = true;
      if (!f.name.value.trim()) {
        errBox.textContent = 'اكتب اسم المنتج';
        errBox.hidden = false;
        f.name.focus();
        return;
      }
      if (f.price.value === '') {
        errBox.textContent = 'اكتب السعر';
        errBox.hidden = false;
        f.price.focus();
        return;
      }
      const body = {
        name: f.name.value,
        unit: f.unit.value,
        categoryId: f.categoryId.value,
        price: f.price.value,
        oldPrice: f.oldPrice.value === '' ? null : f.oldPrice.value,
        stock: f.stock.value === '' ? 0 : f.stock.value,
        description: f.description.value,
        image: f.image.value,
        active: f.active.checked,
        featured: f.featured.checked,
      };
      if (f.sort.value !== '') body.sort = f.sort.value;
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true);
      try {
        if (product) await api(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'PUT', body });
        else await api('/api/admin/products', { method: 'POST', body });
        modal.close();
        KM.toast(product ? 'التعديلات اتحفظت' : 'المنتج اتضاف');
        renderProducts();
      } catch (err) {
        setBusy(btn, false);
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });

    openModal(h('div', { class: 'modal-head' }, h('h2', { text: product ? 'تعديل منتج' : 'منتج جديد' })), form);
    setTimeout(() => form.elements.name.focus(), 50);
  }

  // بنصغّر الصورة قبل الرفع عشان المتجر يفضل سريع
  async function resizeImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('الصورة لازم تكون PNG أو JPG أو WEBP');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('مقدرناش نقرا الصورة'));
        el.src = url;
      });
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let dataUrl = canvas.toDataURL('image/webp', 0.85);
      if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > 2.6e6) {
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------------------------------- الأقسام ---------------------------------- */

  async function renderCategories() {
    const token = state.renderToken;
    let data;
    try {
      data = await api('/api/admin/categories');
    } catch (err) {
      if (token === state.renderToken) $('view').replaceChildren(errorBox(err, renderCategories));
      return;
    }
    if (token !== state.renderToken) return;

    $('viewActions').replaceChildren(h('button', { type: 'button', class: 'btn btn-primary', onclick: () => categoryForm(null) }, KM.icon('plus'), 'قسم جديد'));

    if (!data.categories.length) {
      $('view').replaceChildren(h('div', { class: 'panel empty' }, h('div', { class: 'empty-emoji', text: '🗂️' }), h('h3', { text: 'مفيش أقسام' }), h('p', { text: 'ضيف قسم عشان تقدر تضيف منتجات' })));
      return;
    }

    $('view').replaceChildren(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', null, h('tr', null, h('th', { text: 'القسم' }), h('th', { text: 'الترتيب' }), h('th', { text: 'عدد المنتجات' }), h('th', null, h('span', { class: 'sr-only', text: 'إجراءات' })))),
          h(
            'tbody',
            null,
            data.categories.map((c) =>
              h(
                'tr',
                null,
                h('td', null, h('strong', { class: 'cat-name' }, h('span', { class: 'chip-emoji', text: c.icon }), ' ', c.name)),
                h('td', { 'data-label': 'الترتيب', class: 'num', text: c.sort }),
                h('td', { 'data-label': 'عدد المنتجات', class: 'num', text: c.productsCount }),
                h(
                  'td',
                  null,
                  h(
                    'div',
                    { class: 'actions' },
                    h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'تعديل', onclick: () => categoryForm(c) }),
                    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `حذف ${c.name}`, onclick: () => deleteCategory(c) }, KM.icon('trash'))
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  function categoryForm(category) {
    const c = category || { icon: '🛒' };
    const form = h(
      'form',
      { novalidate: true },
      h(
        'div',
        { class: 'form-grid' },
        input({ name: 'name', label: 'اسم القسم', value: c.name, required: true, maxlength: 50, full: true, placeholder: 'مثال: المعلبات' }),
        input({ name: 'icon', label: 'أيقونة (إيموجي)', value: c.icon, maxlength: 8, hint: 'مثال: 🥫 🧃 🧀 🍫' }),
        input({ name: 'sort', label: 'الترتيب', value: c.sort ?? '', type: 'number', min: '0', step: '1', dir: 'ltr' })
      ),
      h('p', { class: 'notice error', hidden: true }),
      h(
        'div',
        { class: 'modal-foot' },
        h('button', { type: 'button', class: 'btn btn-ghost', text: 'إلغاء', onclick: () => modal.close() }),
        h('button', { type: 'submit', class: 'btn btn-primary', text: category ? 'حفظ' : 'إضافة القسم' })
      )
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const errBox = form.querySelector('.notice.error');
      const body = { name: f.name.value, icon: f.icon.value };
      if (f.sort.value !== '') body.sort = f.sort.value;
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true);
      try {
        if (category) await api(`/api/admin/categories/${encodeURIComponent(category.id)}`, { method: 'PUT', body });
        else await api('/api/admin/categories', { method: 'POST', body });
        modal.close();
        KM.toast('اتحفظ');
        renderCategories();
      } catch (err) {
        setBusy(btn, false);
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
    openModal(h('div', { class: 'modal-head' }, h('h2', { text: category ? 'تعديل قسم' : 'قسم جديد' })), form);
    setTimeout(() => form.elements.name.focus(), 50);
  }

  async function deleteCategory(c) {
    if (!confirm(`متأكد إنك عايز تمسح قسم "${c.name}"؟`)) return;
    try {
      await api(`/api/admin/categories/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      KM.toast('القسم اتمسح');
      renderCategories();
    } catch (err) {
      KM.toast(err.message, 'error');
    }
  }

  /* --------------------------------- الإعدادات --------------------------------- */

  async function renderSettings() {
    const token = state.renderToken;
    let data;
    try {
      data = await api('/api/admin/settings');
    } catch (err) {
      if (token === state.renderToken) $('view').replaceChildren(errorBox(err, renderSettings));
      return;
    }
    if (token !== state.renderToken) return;
    const s = data.settings;

    const form = h(
      'form',
      { novalidate: true, class: 'settings-grid' },
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'panel-title', text: 'بيانات المتجر' }),
        h(
          'div',
          { class: 'form-grid' },
          input({ name: 'storeName', label: 'اسم المتجر', value: s.storeName, required: true, maxlength: 60 }),
          input({ name: 'tagline', label: 'الشعار', value: s.tagline, maxlength: 120 }),
          input({ name: 'phone', label: 'رقم التليفون', value: s.phone, type: 'tel', dir: 'ltr', maxlength: 20 }),
          input({ name: 'whatsapp', label: 'رقم الواتساب', value: s.whatsapp, type: 'tel', dir: 'ltr', maxlength: 20, hint: 'بكود الدولة من غير + (مثال: 201012345678)' }),
          input({ name: 'address', label: 'العنوان', value: s.address, maxlength: 200, full: true }),
          input({ name: 'workingHours', label: 'مواعيد العمل', value: s.workingHours, maxlength: 100, full: true }),
          input({ name: 'announcement', label: 'شريط الإعلان (أعلى الصفحة)', value: s.announcement, maxlength: 200, full: true, hint: 'سيبه فاضي لو مش عايز شريط إعلان' })
        )
      ),
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'panel-title', text: 'التوصيل والطلبات' }),
        h(
          'div',
          { class: 'form-grid' },
          money('deliveryFee', 'رسوم التوصيل (ج.م)', s.deliveryFee),
          money('freeDeliveryThreshold', 'توصيل مجاني للطلبات فوق (ج.م)', s.freeDeliveryThreshold, { hint: 'خليه 0 لو مفيش توصيل مجاني' }),
          money('minOrder', 'الحد الأدنى للطلب (ج.م)', s.minOrder),
          input({ name: 'maxQtyPerItem', label: 'أقصى كمية من المنتج في الطلب', value: s.maxQtyPerItem, type: 'number', min: '1', step: '1', dir: 'ltr' })
        ),
        h('p', { class: 'notice error', hidden: true }),
        h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary btn-lg', text: 'حفظ الإعدادات' }))
      )
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const errBox = form.querySelector('.notice.error');
      errBox.hidden = true;
      const body = {};
      for (const key of ['storeName', 'tagline', 'phone', 'whatsapp', 'address', 'workingHours', 'announcement', 'deliveryFee', 'freeDeliveryThreshold', 'minOrder', 'maxQtyPerItem']) {
        body[key] = f[key].value;
      }
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true);
      try {
        const { settings } = await api('/api/admin/settings', { method: 'PUT', body });
        $('sideStoreName').textContent = settings.storeName;
        KM.toast('الإعدادات اتحفظت');
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      } finally {
        setBusy(btn, false);
      }
    });

    const pwForm = h(
      'form',
      { novalidate: true, class: 'panel' },
      h('h2', { class: 'panel-title', text: 'تغيير كلمة السر' }),
      h(
        'div',
        { class: 'form-grid' },
        input({ name: 'current', label: 'كلمة السر الحالية', type: 'password', autocomplete: 'current-password' }),
        input({ name: 'next', label: 'كلمة السر الجديدة', type: 'password', autocomplete: 'new-password', minlength: '6', hint: '6 حروف أو أرقام على الأقل' })
      ),
      h('p', { class: 'notice error', hidden: true }),
      h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary', text: 'تغيير كلمة السر' }))
    );
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = pwForm.elements;
      const errBox = pwForm.querySelector('.notice.error');
      errBox.hidden = true;
      const btn = pwForm.querySelector('button[type=submit]');
      setBusy(btn, true);
      try {
        await api('/api/admin/password', { method: 'PUT', body: { current: f.current.value, next: f.next.value } });
        f.current.value = '';
        f.next.value = '';
        $('defaultPwBanner').hidden = true;
        KM.toast('كلمة السر اتغيرت');
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      } finally {
        setBusy(btn, false);
      }
    });

    $('view').replaceChildren(h('div', { class: 'settings-grid' }, form, pwForm));
  }

  /* ------------------------------ متابعة الطلبات الجديدة ------------------------------ */

  async function checkNewOrders() {
    let data;
    try {
      data = await KM.api('/api/admin/orders?status=new');
    } catch (err) {
      if (err.status === 401) showLogin();
      return;
    }
    const count = data.counts.new || 0;
    if (state.newCount !== null && count > state.newCount) {
      KM.toast(`🔔 وصلك ${count - state.newCount === 1 ? 'طلب جديد' : `${count - state.newCount} طلبات جديدة`}!`);
      beep();
      if (state.view === 'dashboard') renderDashboard();
      else if (state.view === 'orders' && state.reloadOrders) state.reloadOrders();
    }
    state.newCount = count;
    $('newOrdersBadge').textContent = count;
    $('newOrdersBadge').hidden = count === 0;
    updateTitle();
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => ctx.close();
    } catch {
      /* المتصفح مانع الصوت */
    }
  }

  function startPolling() {
    stopPolling();
    state.newCount = null;
    checkNewOrders();
    state.pollTimer = setInterval(checkNewOrders, 30000);
  }

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  const RENDERERS = {
    dashboard: renderDashboard,
    orders: renderOrders,
    products: renderProducts,
    categories: renderCategories,
    settings: renderSettings,
  };

  boot();
})();
