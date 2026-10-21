'use strict';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const bad = (message, details) => new HttpError(400, message, details);

function text(value, { field, max = 200, required = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') throw bad(`قيمة غير صحيحة: ${field}`);
  // نشيل أي control characters ونقص المسافات الزيادة
  const out = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !out) throw bad(`${field} مطلوب`);
  if (out.length > max) throw bad(`${field} طويل جداً (الحد الأقصى ${max} حرف)`);
  return out;
}

function number(value, { field, min = 0, max = 1e9, integer = false, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`${field} لازم يكون رقم`);
  if (integer && !Number.isInteger(n)) throw bad(`${field} لازم يكون رقم صحيح`);
  if (n < min || n > max) throw bad(`${field} لازم يكون بين ${min} و ${max}`);
  return integer ? n : Math.round(n * 100) / 100;
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on';
}

// أرقام الموبايل المصرية: 010 / 011 / 012 / 015 + 8 أرقام
function egyptianPhone(value) {
  const digits = toLatinDigits(String(value || '')).replace(/[\s-]/g, '');
  const normalized = digits.replace(/^(\+?20|0020)(?=1)/, '0');
  if (!/^01[0125]\d{8}$/.test(normalized)) throw bad('رقم الموبايل غير صحيح، لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015');
  return normalized;
}

function toLatinDigits(str) {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

module.exports = { HttpError, bad, text, number, bool, egyptianPhone, toLatinDigits };
