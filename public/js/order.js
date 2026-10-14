/* صفحة تأكيد الطلب وتتبعه */
(function () {
  'use strict';

  const { h } = KM;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let settings = null;
  let current = null; // { number, phone }

  const STEPS = [
    ['new', 'استلمنا طلبك', '📝'],
    ['preparing', 'بنجهزه', '📦'],
    ['delivering', 'في الطريق', '🛵'],
    ['delivered', 'وصل', '✅'],
  ];

  async function init() {
    try {
      const store = await KM.loadStore();
      settings = store.settings;
      KM.applySettings(settings);
    } catch {
      /* الصفحة تشتغل حتى لو الإعدادات محملتش */
    }

    renderMyOrders();

    const number = params.get('n');
    if (number) {
      $('trackNumber').value = number;
      const saved = KM.myOrders.find(number);
      if (saved) {
        $('trackPhone').value = saved.phone;
        await track(number, saved.phone);
      }
    }
  }

  async function track(number, phone) {
    $('trackError').hidden = true;
    $('orderRoot').replaceChildren(h('div', { class: 'center-load' }, h('div', { class: 'spinner dark' })));
    try {
      const { order } = await KM.api('/api/orders/track', { method: 'POST', body: { number, phone } });
      current = { number: order.number, phone: order.customer.phone };
      renderOrder(order);
      if (!KM.myOrders.find(order.number)) {
        KM.myOrders.add(order);
        renderMyOrders();
      }
      const url = new URL(location.href);
      url.searchParams.set('n', order.number);
      history.replaceState(null, '', url);
    } catch (err) {
      $('orderRoot').replaceChildren();
      $('trackError').textContent = err.message;
      $('trackError').hidden = false;
    }
  }

  function renderOrder(order) {
    const isNew = params.get('new') === '1' && String(order.number) === params.get('n');
    const nodes = [];

    if (isNew) {
      nodes.push(
        h(
          'div',
          { class: 'success-banner' },
          h('div', { class: 'check' }, KM.icon('check', 'icon icon-lg')),
          h('h1', { text: 'تم استلام طلبك بنجاح 🎉' }),
          h('p', { text: `رقم طلبك ${order.number} - هنكلمك على ${order.customer.phone} قريب لتأكيد الطلب.` })
        )
      );
    }

    // الحالة
    const statusPanel = h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'order-head' },
        h('div', null, h('div', { class: 'order-number', text: `طلب رقم #${order.number}` }), h('div', { class: 'order-date', text: KM.date(order.createdAt) })),
        h(
          'div',
          { class: 'no-print' },
          h('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => current && track(current.number, current.phone) }, KM.icon('refresh'), 'تحديث')
        )
      ),
      order.status === 'cancelled' ? h('div', { class: 'status-cancelled', text: 'الطلب ده اتلغى. لو عندك أي استفسار كلمنا.' }) : timeline(order)
    );
    nodes.push(statusPanel);

    // المنتجات
    const items = h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'المنتجات' }),
      h(
        'div',
        null,
        order.items.map((it) =>
          h(
            'div',
            { class: 'summary-item' },
            h('img', { src: it.image, alt: '', width: 48, height: 48 }),
            h('div', null, h('div', { text: `${it.name} - ${it.unit}` }), h('div', { class: 'qty', text: `${it.qty} × ${KM.money(it.price)}` })),
            h('div', { class: 'amount', text: KM.money(it.total) })
          )
        )
      ),
      h('div', { class: 'summary-row' }, h('span', { text: 'المنتجات' }), h('strong', { text: KM.money(order.subtotal) })),
      h(
        'div',
        { class: 'summary-row' },
        h('span', { text: 'التوصيل' }),
        order.deliveryFee ? h('strong', { text: KM.money(order.deliveryFee) }) : h('strong', { class: 'free', text: 'مجاني' })
      ),
      h('div', { class: 'summary-row total' }, h('span', { text: 'الإجمالي' }), h('span', { text: KM.money(order.total) }))
    );

    const c = order.customer;
    const info = h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'بيانات التوصيل' }),
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
      )
    );
    nodes.push(h('div', { class: 'two-col' }, items, info));

    // أزرار
    const actions = h('div', { class: 'hero-actions no-print' });
    if (settings && settings.whatsapp && order.status !== 'cancelled') {
      actions.appendChild(
        h('a', { class: 'btn btn-whatsapp btn-lg', href: KM.waLink(settings.whatsapp, whatsappText(order)), target: '_blank', rel: 'noopener' }, KM.icon('whatsapp'), 'ابعت الطلب على واتساب')
      );
    }
    if (settings && settings.phone) {
      actions.appendChild(h('a', { class: 'btn btn-outline btn-lg', href: `tel:${settings.phone}` }, KM.icon('phone'), 'اتصل بينا'));
    }
    actions.appendChild(h('a', { class: 'btn btn-primary btn-lg', href: '/' }, 'كمّل تسوق'));
    nodes.push(h('div', { class: 'panel' }, actions));

    $('orderRoot').replaceChildren(...nodes);
    $('orderRoot').classList.add('order-view');
    if (isNew) window.scrollTo({ top: 0 });
  }

  function timeline(order) {
    const reached = new Set(order.history.map((x) => x.status));
    const currentIndex = STEPS.findIndex(([key]) => key === order.status);
    return h(
      'ol',
      { class: 'timeline', 'aria-label': 'حالة الطلب' },
      STEPS.map(([key, label, emoji], i) => {
        const done = i <= currentIndex || reached.has(key);
        const cls = ['timeline-step', done ? 'done' : '', i === currentIndex ? 'current' : ''].join(' ').trim();
        return h(
          'li',
          { class: cls, 'aria-current': i === currentIndex ? 'step' : undefined },
          h('span', { class: 'dot', text: done ? emoji : String(i + 1) }),
          label
        );
      })
    );
  }

  function whatsappText(order) {
    const lines = [
      `السلام عليكم، ده طلبي من ${settings.storeName}`,
      `رقم الطلب: ${order.number}`,
      '',
      ...order.items.map((it) => `• ${it.name} (${it.unit}) × ${it.qty} = ${KM.money(it.total)}`),
      '',
      `الإجمالي: ${KM.money(order.total)}`,
      `الاسم: ${order.customer.name}`,
      `الموبايل: ${order.customer.phone}`,
      `العنوان: ${order.customer.area} - ${order.customer.address}`,
    ];
    return lines.join('\n');
  }

  function renderMyOrders() {
    const list = KM.myOrders.list();
    $('myOrdersPanel').hidden = list.length === 0;
    $('myOrdersList').replaceChildren(
      ...list.map((o) =>
        h(
          'li',
          null,
          h(
            'a',
            {
              href: `/order.html?n=${o.number}`,
              onclick: (e) => {
                e.preventDefault();
                $('trackNumber').value = o.number;
                $('trackPhone').value = o.phone;
                track(o.number, o.phone);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              },
            },
            h('span', { text: `طلب #${o.number}` }),
            h('span', { class: 'muted', text: `${o.createdAt ? KM.date(o.createdAt) : ''} • ${KM.money(o.total || 0)}` })
          )
        )
      )
    );
  }

  $('trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const number = KM.toLatinDigits($('trackNumber').value.trim()).replace(/[^\d]/g, '');
    const phone = $('trackPhone').value;
    if (!number) {
      $('trackError').textContent = 'اكتب رقم الطلب';
      $('trackError').hidden = false;
      return;
    }
    if (!KM.isValidPhone(phone)) {
      $('trackError').textContent = 'رقم الموبايل غير صحيح';
      $('trackError').hidden = false;
      return;
    }
    track(number, KM.normalizePhone(phone));
  });

  init();
})();
