'use strict';

const path = require('path');

function parseTrustProxy(value) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  return value;
}

// الإعدادات من متغيرات البيئة.
// لو في بيانات Upstash Redis (بتتضاف لوحدها لما تربطه بـ Vercel) بنخزن فيه،
// غير كده بنخزن في ملفات في DATA_DIR.
function configFromEnv(env = process.env) {
  const onVercel = Boolean(env.VERCEL);
  const redisUrl = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return {
    onVercel,
    dataDir: env.DATA_DIR || (onVercel ? '/tmp/gomlet-beitak' : path.join(__dirname, '..', 'data')),
    adminPassword: env.ADMIN_PASSWORD,
    trustProxy: parseTrustProxy(env.TRUST_PROXY) ?? (onVercel ? 1 : undefined),
    redis: redisUrl && redisToken ? { url: redisUrl, token: redisToken, prefix: env.REDIS_PREFIX || 'gb:' } : null,
  };
}

module.exports = { configFromEnv, parseTrustProxy };
