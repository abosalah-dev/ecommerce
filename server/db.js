'use strict';

const fs = require('fs');
const path = require('path');
const { createSeed, defaultSettings } = require('./seed');

// تخزين بسيط في ملف JSON واحد.
// الكتابة بتتم في ملف مؤقت وبعدين rename عشان الملف ميبوظش لو السيرفر وقف فجأة.
class JsonStore {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.uploadsDir = path.join(dir, 'uploads');
    this.data = null;
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      // المتاجر القديمة كانت بتوصل لأي مكان، فمنقفلش عليهم المناطق فجأة
      const hadAreas = Boolean(this.data.settings && 'serviceAreas' in this.data.settings);
      // لو اتضافت إعدادات جديدة في نسخة أحدث من البرنامج
      this.data.settings = { ...defaultSettings, ...this.data.settings };
      if (!hadAreas) this.data.settings.serviceAreas = [];
      this.data.admin = this.data.admin || { passwordHash: null };
      this.data.counters = this.data.counters || { order: 1000 };
      this.migrate();
    } else {
      this.data = createSeed();
      this.save();
    }
    return this;
  }

  // تحديث البيانات القديمة لشكل النسخة الجديدة
  migrate() {
    const d = this.data;
    let changed = false;
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
    if (changed) this.save();
  }

  save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { JsonStore };
