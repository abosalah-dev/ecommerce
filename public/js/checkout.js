/* صفحة إتمام الطلب */
(function () {
  'use strict';

  const { h } = KM;
  const root = document.getElementById('checkoutRoot');
  let store = null;
  let submitting = false;

  const CUSTOMER_KEY = 'km_customer';

  async function init() {
    try {
      store = await KM.loadStore();
    } catch (err) {
      root.className = '';
      root.replaceChildren(
        h(
          'div',
          { class: 'panel empty' },
          h('div', { class: 'empty-emoji', text: '😕' }),
          h('h3', { text: 'مقدرناش نحمّل البيانات' }),
          h('p', { text: err.message }),
          h('button', { type: 'button', class: 'btn btn-primary', text: 'جرب تاني', onclick: init })
        )
      );
      return;
    }
    KM.applySettings(store.settings);
    render();
  }

  function render(prefill) {
    root.className = '';
    const lines = KM.cart.lines(store);
    if (!lines.length) {
      document.getElementById('pageSub').hidden = true;
      root.replaceChildren(
        h(
          'div',
          { class: 'panel empty' },
          h('div', { class: 'empty-emoji', text: '🧺' }),
          h('h3', { text: 'السلة فاضية' }),
          h('p', { text: 'ضيف منتجات للسلة الأول وبعدين ارجع هنا' }),
          h('a', { href: '/', class: 'btn btn-primary', text: 'ابدأ التسوق' })
        )
      );
      return;
    }

    const saved = prefill || KM.storage.get(CUSTOMER_KEY, {}) || {};
    const form = h(
      'form',
      { id: 'checkoutForm', novalidate: true },
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'panel-title' }, h('span', { class: 'step-num', text: '1' }), 'بيانات التوصيل'),
        h(
          'div',
          { class: 'form-grid' },
          field({ name: 'name', label: 'الاسم بالكامل', value: saved.name, autocomplete: 'name', placeholder: 'مثال: محمد أحمد' }),
          field({
            name: 'phone',
            label: 'رقم الموبايل',
            value: saved.phone,
            type: 'tel',
            autocomplete: 'tel',
            inputmode: 'numeric',
            placeholder: '01xxxxxxxxx',
            dir: 'ltr',
            hint: 'هنكلمك عليه لتأكيد الطلب',
          }),
          field({ name: 'area', label: 'المنطقة / الحي', value: saved.area, autocomplete: 'address-level2', placeholder: 'مثال: مدينة نصر', full: true }),
          field({
            name: 'address',
            label: 'العنوان بالتفصيل',
            value: saved.address,
            textarea: true,
            autocomplete: 'street-address',
            placeholder: 'اسم الشارع، رقم العمارة، الدور، رقم الشقة، علامة مميزة',
            full: true,
          }),
          field({ name: 'notes', label: 'ملاحظات', value: saved.notes, optional: true, textarea: true, placeholder: 'أي حاجة عايز تقولها للمندوب (اختياري)', full: true })
        )
      ),
      h(
        'section',
        { class: 'panel' },
        h('h2', { class: 'panel-title' }, h('span', { class: 'step-num', text: '2' }), 'طريقة الدفع'),
        h(
          'div',
          { class: 'pay-options', role: 'radiogroup', 'aria-label': 'طريقة الدفع' },
          payOption('cash', 'كاش عند الاستلام', 'ادفع للمندوب لما الطلب يوصلك', saved.paymentMethod !== 'wallet'),
          payOption('wallet', 'محفظة / إنستاباي', 'فودافون كاش أو إنستاباي عند الاستلام', saved.paymentMethod === 'wallet')
        )
      )
    );

    const summary = h('aside', { class: 'summary' }, renderSummary(lines));
    root.replaceChildren(h('div', { class: 'checkout-layout' }, form, summary));

    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', (e) => {
      if (e.target.name === 'phone') {
        const latin = KM.toLatinDigits(e.target.value);
        if (latin !== e.target.value) e.target.value = latin;
      }
      const wrap = e.target.closest('.field');
      if (wrap && wrap.classList.contains('invalid')) validateField(e.target.name, form);
    });
  }

  function field({ name, label, value, textarea, optional, hint, full, ...attrs }) {
    const id = `f-${name}`;
    const control = h(textarea ? 'textarea' : 'input', {
      id,
      name,
      type: textarea ? undefined : attrs.type || 'text',
      autocomplete: attrs.autocomplete,
      inputmode: attrs.inputmode,
      placeholder: attrs.placeholder,
      dir: attrs.dir,
      rows: textarea ? 3 : undefined,
      required: !optional,
      'aria-describedby': `${id}-err`,
    });
    control.value = value || '';
    return h(
      'div',
      { class: `field${full ? ' full' : ''}` },
      h('label', { for: id }, label, optional ? h('span', { class: 'hint', text: ' (اختياري)' }) : null),
      control,
      hint ? h('span', { class: 'hint', text: hint }) : null,
      h('span', { class: 'field-error', id: `${id}-err`, role: 'alert' })
    );
  }

  function payOption(value, title, desc, checked) {
    return h(
      'label',
      { class: 'pay-option' },
      h('input', { type: 'radio', name: 'paymentMethod', value, checked }),
      h('span', { class: 'radio' }),
      h('span', null, h('strong', { text: title }), h('small', { text: desc }))
    );
  }

  function renderSummary(lines) {
    const totals = KM.totals(lines, store.settings);
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const nodes = [
      h('h2', { class: 'panel-title' }, `ملخص الطلب (${count})`),
      h(
        'div',
        { class: 'summary-items' },
        lines.map(({ product: p, qty, total }) =>
          h(
            'div',
            { class: 'summary-item' },
            h('img', { src: p.image, alt: '', width: 48, height: 48 }),
            h('div', null, h('div', { text: p.name }), h('div', { class: 'qty', text: `${qty} × ${KM.money(p.price)}` })),
            h('div', { class: 'amount', text: KM.money(total) })
          )
        )
      ),
      h('a', { href: '/?cart=1', class: 'btn btn-ghost btn-sm', text: 'تعديل السلة' }),
      h('div', { class: 'summary-row' }, h('span', { text: 'المنتجات' }), h('strong', { text: KM.money(totals.subtotal) })),
      h(
        'div',
        { class: 'summary-row' },
        h('span', { text: 'التوصيل' }),
        totals.deliveryFee ? h('strong', { text: KM.money(totals.deliveryFee) }) : h('strong', { class: 'free', text: 'مجاني' })
      ),
      h('div', { class: 'summary-row total' }, h('span', { text: 'الإجمالي' }), h('span', { text: KM.money(totals.total) })),
    ];
    if (!totals.freeDelivery && totals.remainingForFree) {
      nodes.push(h('p', { class: 'notice', text: `ضيف منتجات بـ ${KM.money(totals.remainingForFree)} كمان والتوصيل يبقى مجاني` }));
    }
    if (totals.belowMin) {
      nodes.push(h('p', { class: 'notice error', text: `الحد الأدنى للطلب ${KM.money(store.settings.minOrder)}` }));
    }
    nodes.push(
      h(
        'button',
        { type: 'submit', form: 'checkoutForm', class: 'btn btn-primary btn-lg btn-block', id: 'submitBtn', disabled: totals.belowMin },
        `تأكيد الطلب • ${KM.money(totals.total)}`
      ),
      h('p', { class: 'secure-note' }, KM.icon('lock'), 'مش هتدفع حاجة غير لما الطلب يوصلك'),
      h('p', { class: 'form-error notice error', id: 'formError', hidden: true })
    );
    return h('div', { class: 'panel' }, nodes);
  }

  /* ------------------------------- التحقق ------------------------------- */

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'اكتب اسمك' : ''),
    phone: (v) => (!v.trim() ? 'اكتب رقم الموبايل' : !KM.isValidPhone(v) ? 'الرقم لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015' : ''),
    area: (v) => (!v.trim() ? 'اكتب المنطقة' : ''),
    address: (v) => (v.trim().length < 5 ? 'اكتب العنوان بالتفصيل عشان المندوب يوصلك' : ''),
  };

  function validateField(name, form) {
    const input = form.elements[name];
    if (!input || !rules[name]) return true;
    const msg = rules[name](input.value);
    const wrap = input.closest('.field');
    wrap.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    wrap.querySelector('.field-error').textContent = msg;
    return !msg;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const form = e.target;
    const errorBox = document.getElementById('formError');
    errorBox.hidden = true;

    let firstInvalid = null;
    for (const name of Object.keys(rules)) {
      if (!validateField(name, form) && !firstInvalid) firstInvalid = form.elements[name];
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const customer = {
      name: form.elements.name.value.trim(),
      phone: KM.normalizePhone(form.elements.phone.value),
      area: form.elements.area.value.trim(),
      address: form.elements.address.value.trim(),
      notes: form.elements.notes.value.trim(),
    };
    const paymentMethod = form.elements.paymentMethod.value || 'cash';
    const items = KM.cart.lines(store).map((l) => ({ productId: l.product.id, qty: l.qty }));

    const btn = document.getElementById('submitBtn');
    const btnLabel = btn.textContent;
    submitting = true;
    btn.disabled = true;
    btn.replaceChildren(h('span', { class: 'spinner' }), 'جاري إرسال الطلب...');

    try {
      const { order } = await KM.api('/api/orders', { method: 'POST', body: { customer, paymentMethod, items } });
      const { notes, ...remember } = customer;
      KM.storage.set(CUSTOMER_KEY, remember);
      KM.myOrders.add(order);
      KM.cart.clear();
      location.href = `/order.html?n=${order.number}&new=1`;
      return;
    } catch (err) {
      if (err.status === 409 && Array.isArray(err.details)) {
        // نعدّل السلة على حسب المتاح فعلاً
        for (const d of err.details) KM.cart.set(d.productId, Math.max(0, d.available || 0));
        KM.toast('عدّلنا السلة على حسب الكميات المتاحة', 'error');
        try {
          store = await reloadStore();
        } catch {
          /* هنكمل بالبيانات القديمة */
        }
        render({ ...customer, paymentMethod });
        const box = document.getElementById('formError');
        if (box) {
          box.textContent = err.message;
          box.hidden = false;
        }
        submitting = false;
        return;
      }
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      KM.toast(err.message, 'error');
    }
    submitting = false;
    btn.disabled = false;
    btn.textContent = btnLabel;
  }

  async function reloadStore() {
    const data = await KM.api('/api/store');
    data.productMap = new Map(data.products.map((p) => [p.id, p]));
    data.categoryMap = new Map(data.categories.map((c) => [c.id, c]));
    return data;
  }

  init();
})();
