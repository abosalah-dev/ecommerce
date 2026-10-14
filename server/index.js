'use strict';

const fs = require('fs');
const path = require('path');
const { createApp } = require('./app');
const { DEFAULT_PASSWORD } = require('./auth');

// قراءة ملف .env لو موجود (من غير مكتبات إضافية)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function parseTrustProxy(value) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  return value;
}

const { app, auth, store } = createApp({
  dataDir: DATA_DIR,
  adminPassword: process.env.ADMIN_PASSWORD,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
});

app.listen(PORT, () => {
  console.log(`🛒 ${store.data.settings.storeName} شغال على http://localhost:${PORT}`);
  console.log(`🔐 لوحة التحكم: http://localhost:${PORT}/admin.html`);
  console.log(`💾 البيانات محفوظة في: ${store.file}`);
  if (auth.usingDefaultPassword) {
    console.warn(
      `⚠️  بتستخدم كلمة السر الافتراضية للوحة التحكم (${DEFAULT_PASSWORD}). غيّرها من الإعدادات أو حط ADMIN_PASSWORD.`
    );
  }
});
