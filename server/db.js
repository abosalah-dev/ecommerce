'use strict';

const { createSeed, defaultSettings } = require('./seed');

// البيانات كلها بتتحمل في الذاكرة (store.data) والـ API بيشتغل عليها،
// وبعد أي تعديل بننادي save() عشان تتكتب في التخزين (ملف أو Redis).
class JsonStore {
  constructor(backend) {
    this.backend = backend;
    this.data = null;
    this.ordersLoaded = false;
    this.orderSnapshot = new Map();
  }

  get shared() {
    return this.backend.shared;
  }

  async load() {
    await this.backend.init();
    await this.refresh({ orders: true, force: true });
    return this;
  }

  // في Redis بنقرا آخر نسخة مع كل طلب، لأن ممكن نسخة تانية من السيرفر تكون عدّلت
  async refresh({ orders = true, force = false } = {}) {
    if (!force && !this.shared) return;
    const raw = await this.backend.read({ orders });
    if (!raw) {
      this.data = createSeed();
      this.normalize();
      this.ordersLoaded = true;
      this.orderSnapshot.clear();
      await this.save();
      return;
    }
    this.data = raw;
    this.ordersLoaded = orders;
    const changed = this.normalize();
    this.takeSnapshot();
    if (changed) await this.save();
  }

  // تحديث البيانات القديمة لشكل النسخة الجديدة. بيرجع true لو اتغير حاجة.
  normalize() {
    const d = this.data;
    let changed = false;
    // المتاجر القديمة كانت بتوصل لأي مكان، فمنقفلش عليهم المناطق فجأة
    const hadAreas = Boolean(d.settings && 'serviceAreas' in d.settings);
    const before = JSON.stringify(d.settings || {});
    // لو اتضافت إعدادات جديدة في نسخة أحدث من البرنامج
    d.settings = { ...defaultSettings, ...d.settings };
    if (!hadAreas) d.settings.serviceAreas = [];
    if (JSON.stringify(d.settings) !== before) changed = true;
    if (!d.admin) {
      d.admin = { passwordHash: null };
      changed = true;
    }
    if (!d.admin.sessions || typeof d.admin.sessions !== 'object') {
      d.admin.sessions = {};
      changed = true;
    }
    if (!d.counters) {
      d.counters = { order: 1000 };
      changed = true;
    }
    if (!Array.isArray(d.orders)) d.orders = [];
    for (const p of d.products) {
      if ('oldPrice' in p) {
        if (p.marketPrice === undefined) p.marketPrice = p.oldPrice;
        delete p.oldPrice;
        changed = true;
      }
      if (p.marketPrice === undefined) {
        p.marketPrice = null;
        changed = true;
      }
      if (p.unitCount === undefined) {
        p.unitCount = null;
        p.unitName = '';
        changed = true;
      }
    }
    if (!Array.isArray(d.bundles)) {
      d.bundles = [];
      changed = true;
    }
    return changed;
  }

  takeSnapshot() {
    this.orderSnapshot.clear();
    if (!this.ordersLoaded) return;
    for (const o of this.data.orders) this.orderSnapshot.set(o.id, JSON.stringify(o));
  }

  async save() {
    if (!this.shared) {
      await this.backend.write(this.data);
      return;
    }
    // في Redis بنكتب البيانات الأساسية + الطلبات اللي اتغيرت بس
    const { orders, ...main } = this.data;
    const changed = this.ordersLoaded ? orders.filter((o) => this.orderSnapshot.get(o.id) !== JSON.stringify(o)) : [];
    await this.backend.write(main, changed);
    for (const o of changed) this.orderSnapshot.set(o.id, JSON.stringify(o));
  }
}

module.exports = { JsonStore };
