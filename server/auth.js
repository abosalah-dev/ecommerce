'use strict';

const crypto = require('crypto');

const DEFAULT_PASSWORD = 'admin123';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'km_admin';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyHash(password, stored) {
  const [algo, salt, hash] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[key] = part.slice(i + 1).trim();
    }
  }
  return out;
}

// حماية بسيطة من تخمين كلمة السر / الطلبات المزعجة
// check: هل لسه مسموح؟  hit: سجّل محاولة.  reset: امسح العداد.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  const current = (key) => {
    const entry = hits.get(key);
    if (!entry || entry.reset <= Date.now()) return 0;
    return entry.count;
  };
  return {
    check: (key) => current(key) < max,
    hit(key) {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || entry.reset <= now) {
        entry = { count: 0, reset: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      if (hits.size > 10000) {
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      }
    },
    reset: (key) => hits.delete(key),
  };
}

class AdminAuth {
  constructor(store, { envPassword } = {}) {
    this.store = store;
    this.envPassword = envPassword || '';
    this.sessions = new Map();
  }

  // ترتيب الأولوية: كلمة السر اللي اتغيرت من لوحة التحكم ← متغير البيئة ← الافتراضية
  get usingDefaultPassword() {
    return !this.store.data.admin.passwordHash && !this.envPassword;
  }

  checkPassword(password) {
    if (typeof password !== 'string' || !password) return false;
    const stored = this.store.data.admin.passwordHash;
    if (stored) return verifyHash(password, stored);
    return safeEqual(password, this.envPassword || DEFAULT_PASSWORD);
  }

  setPassword(password) {
    this.store.data.admin.passwordHash = hashPassword(password);
    this.store.save();
    this.sessions.clear();
  }

  createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
  }

  isValid(token) {
    if (!token) return false;
    const exp = this.sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  destroy(token) {
    this.sessions.delete(token);
  }

  tokenFrom(req) {
    return parseCookies(req.headers.cookie)[COOKIE];
  }

  cookie(token, req, maxAgeMs = SESSION_TTL_MS) {
    const parts = [
      `${COOKIE}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    ];
    if (req.secure) parts.push('Secure');
    return parts.join('; ');
  }
}

module.exports = { AdminAuth, createRateLimiter, hashPassword, verifyHash, DEFAULT_PASSWORD };
