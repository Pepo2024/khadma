// أدوات مساعدة عامة — خدمة اجتماع بولس الرسول

export function uid() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch (_) { /* تجاهل */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function token(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const c = globalThis.crypto;
  let bytes = [];
  if (c && typeof c.getRandomValues === 'function') {
    bytes = Array.from(c.getRandomValues(new Uint8Array(len)));
  }
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const b = bytes.length ? bytes[i] : Math.floor(Math.random() * 256);
    out += chars[b % chars.length];
  }
  return out;
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayISO() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isoDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function fmtDate(value, withYear = false) {
  if (!value) return '—';
  const parts = `${value}`.slice(0, 10).split('-');
  if (parts.length !== 3) return `${value}`;
  const y = +parts[0], m = +parts[1], d = +parts[2];
  if (!y || !m || !d) return `${value}`;
  return `${d} ${AR_MONTHS[m - 1] || ''}${withYear ? ` ${y}` : ''}`;
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(+d)) return `${value}`;
  const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return `${fmtDate(value, true)} · ${time}`;
}

export function age(birthDate) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}`.slice(0, 10));
  if (Number.isNaN(+b)) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const md = (now.getMonth() - b.getMonth()) * 32 + now.getDate() - b.getDate();
  if (md < 0) a -= 1;
  return a >= 0 && a < 120 ? a : null;
}

export function daysUntil(date, from = new Date()) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(+target)) return null;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / 86400000);
}

export function normalizePhone(phone, countryCode = '20') {
  let digits = `${phone || ''}`.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(countryCode) && digits.length >= 10) return digits;
  // 01012345678 → 1012345678 → 201012345678
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  // 1012345678 → 201012345678
  if (digits.length === 10 && digits.startsWith('1')) digits = `${countryCode}${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && !digits.startsWith(countryCode)) return `${countryCode}${digits}`;
  return digits;
}

export function waLink(phone, text = '') {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function openWa(phone, text) {
  const url = waLink(phone, text);
  if (!url) return false;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) window.location.href = url;
  return true;
}

export function esc(value) {
  return `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * كود عضو قصير وثابت للطباعة على البطاقة.
 * لو العضو له memberCode محفوظ نرجّعه، وإلا نولّده من QR/المعرّف
 * بنفس النتيجة في كل مرة حتى لو اختلف ترتيب الأعضاء.
 */
export function memberCodeOf(member) {
  if (member && member.memberCode) return String(member.memberCode);
  const seed = String((member && (member.qrToken || member.uid || member.id)) || 'khadma');
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'KH-' + String(((h >>> 0) % 900000) + 100000);
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text, name, type = 'application/json;charset=utf-8') {
  download(new Blob([text], { type }), name);
}

// توليد QR كـ SVG باستخدام المكتبة المحلية vendor/qrcode-generator.js
export function qrSVG(text, size = 180) {
  try {
    const factory = globalThis.qrcode || globalThis.QRCode;
    if (!factory) return '<div class="qr-box">QR غير متاح</div>';
    const qr = factory(0, 'M');
    qr.addData(String(text || ''));
    qr.make();
    let svg;
    if (qr.createSvgTag) {
      svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } else {
      const count = qr.getModuleCount();
      const cells = [];
      for (let r = 0; r < count; r += 1) {
        for (let c = 0; c < count; c += 1) {
          if (qr.isDark(r, c)) cells.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);
        }
      }
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${count + 4} ${count + 4}"><rect x="-2" y="-2" width="${count + 4}" height="${count + 4}" fill="#fff"/><g fill="#0b1b33">${cells.join('')}</g></svg>`;
    }
    if (size) svg = svg.replace(/<svg/, `<svg width="${size}" height="${size}"`);
    return svg;
  } catch (error) {
    console.warn('QR generation failed', error);
    return '<div class="qr-box">تعذّر توليد QR</div>';
  }
}

export function qrDataURL(text, size = 512) {
  const svg = qrSVG(text, size);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function groupBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item?.[key];
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function initials(name) {
  return `${name || '?'}`.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function compressImage(file, maxSize = 600, quality = 0.82) {
  return readFileAsDataURL(file).then((dataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  }));
}
