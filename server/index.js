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

const { configFromEnv } = require('./config');

const PORT = Number(process.env.PORT) || 3000;
const config = configFromEnv();
const { app, auth, store, ready } = createApp(config);

ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🛒 ${store.data.settings.storeName} شغال على http://localhost:${PORT}`);
      console.log(`🔐 لوحة التحكم: http://localhost:${PORT}/admin.html`);
      console.log(config.redis ? '💾 البيانات محفوظة في Upstash Redis' : `💾 البيانات محفوظة في: ${config.dataDir}`);
      if (auth.usingDefaultPassword) {
        console.warn(
          `⚠️  بتستخدم كلمة السر الافتراضية للوحة التحكم (${DEFAULT_PASSWORD}). غيّرها من الإعدادات أو حط ADMIN_PASSWORD.`
        );
      }
    });
  })
  .catch((err) => {
    console.error('❌ مقدرناش نحمّل البيانات:', err);
    process.exit(1);
  });
