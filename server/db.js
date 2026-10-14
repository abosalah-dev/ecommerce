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
      // لو اتضافت إعدادات جديدة في نسخة أحدث من البرنامج
      this.data.settings = { ...defaultSettings, ...this.data.settings };
      this.data.admin = this.data.admin || { passwordHash: null };
      this.data.counters = this.data.counters || { order: 1000 };
    } else {
      this.data = createSeed();
      this.save();
    }
    return this;
  }

  save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { JsonStore };
