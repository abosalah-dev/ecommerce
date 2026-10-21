'use strict';

// نقطة الدخول على Vercel: كل طلبات /api و /uploads بتيجي هنا،
// والصفحات والصور والخطوط بتتقدم من فولدر public مباشرة.
const { createApp } = require('../server/app');
const { configFromEnv } = require('../server/config');

const config = configFromEnv();
if (!config.redis) {
  console.warn(
    '⚠️  مفيش Upstash Redis مربوط، فالبيانات هتتمسح مع كل إعادة تشغيل. اربطه من Vercel ← Storage ← Upstash for Redis.'
  );
}
const { app } = createApp(config);

module.exports = (req, res) => app(req, res);
