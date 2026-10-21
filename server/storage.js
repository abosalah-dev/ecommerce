'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------------- */
/* التخزين في ملفات (سيرفر عادي / Render / Docker / جهازك)                  */
/* ----------------------------------------------------------------------- */
// كل البيانات في ملف JSON واحد، والكتابة في ملف مؤقت وبعدين rename
// عشان الملف ميبوظش لو السيرفر وقف فجأة.
class FileBackend {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.uploadsDir = path.join(dir, 'uploads');
    this.shared = false; // سيرفر واحد شايل البيانات في الذاكرة
  }

  init() {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  read() {
    if (!fs.existsSync(this.file)) return null;
    return JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }

  write(data) {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  putUpload(name, buffer) {
    fs.writeFileSync(path.join(this.uploadsDir, name), buffer);
  }

  getUpload(name) {
    const file = path.join(this.uploadsDir, name);
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
}

/* ----------------------------------------------------------------------- */
/* التخزين في Upstash Redis (لـ Vercel والاستضافات اللي ملهاش هارد ثابت)     */
/* ----------------------------------------------------------------------- */
// البيانات الأساسية (المنتجات والإعدادات...) في مفتاح واحد،
// وكل طلب في خانة لوحده جوه hash عشان حجم كل كتابة يفضل صغير.
const UNLOCK_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

class RedisBackend {
  constructor({ url, token, prefix = 'gb:', fetchImpl = fetch }) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.prefix = prefix;
    this.fetch = fetchImpl;
    this.shared = true; // أكتر من نسخة من السيرفر بتقرا وتكتب نفس البيانات
  }

  async request(pathname, body) {
    const res = await this.fetch(this.url + pathname, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error(`Redis HTTP ${res.status}: ${json && json.error ? json.error : 'bad response'}`);
    return json;
  }

  async cmd(...args) {
    const json = await this.request('', args.map(String));
    if (json.error) throw new Error(`Redis: ${json.error}`);
    return json.result;
  }

  // multi-exec = كل الأوامر بتتنفذ مرة واحدة (محدش يشوف نص تعديل)
  async pipeline(commands) {
    if (!commands.length) return [];
    const results = await this.request('/multi-exec', commands.map((c) => c.map(String)));
    for (const r of results) if (r.error) throw new Error(`Redis: ${r.error}`);
    return results.map((r) => r.result);
  }

  init() {}

  async read({ orders = true } = {}) {
    const main = await this.cmd('GET', `${this.prefix}main`);
    if (!main) return null;
    const data = JSON.parse(main);
    data.orders = [];
    if (orders) {
      const flat = (await this.cmd('HGETALL', `${this.prefix}orders`)) || [];
      for (let i = 1; i < flat.length; i += 2) data.orders.push(JSON.parse(flat[i]));
      data.orders.sort((a, b) => a.number - b.number);
    }
    return data;
  }

  async write(main, changedOrders) {
    await this.pipeline([
      ['SET', `${this.prefix}main`, JSON.stringify(main)],
      ...changedOrders.map((o) => ['HSET', `${this.prefix}orders`, o.id, JSON.stringify(o)]),
    ]);
  }

  // قفل بسيط عشان طلبين في نفس اللحظة ميكتبوش فوق بعض
  async lock({ ttlMs = 8000, waitMs = 6000 } = {}) {
    const token = crypto.randomBytes(12).toString('hex');
    const started = Date.now();
    for (;;) {
      const ok = await this.cmd('SET', `${this.prefix}lock`, token, 'NX', 'PX', ttlMs);
      if (ok === 'OK') return token;
      if (Date.now() - started > waitMs) return null;
      await sleep(60 + Math.random() * 60);
    }
  }

  async unlock(token) {
    await this.cmd('EVAL', UNLOCK_SCRIPT, 1, `${this.prefix}lock`, token);
  }

  async putUpload(name, buffer) {
    await this.cmd('SET', `${this.prefix}upload:${name}`, buffer.toString('base64'));
  }

  async getUpload(name) {
    const b64 = await this.cmd('GET', `${this.prefix}upload:${name}`);
    return b64 ? Buffer.from(b64, 'base64') : null;
  }
}

module.exports = { FileBackend, RedisBackend };
