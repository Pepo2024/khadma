// بطاقة العضو العامة للمشاركة — #/card/:token
import * as storeNS from '../store.js';
import * as uiNS from '../ui.js';
import * as utilsNS from '../utils.js';
import * as cfgNS from '../config.js';

const store = storeNS.store || storeNS.default || storeNS;
const ui = uiNS.ui || uiNS.default || uiNS;
const U = utilsNS.utils || utilsNS.default || utilsNS;
const APP = cfgNS.APP || (cfgNS.default && cfgNS.default.APP) || {};

let _root = null;
let _token = '';
let _member = null;
let _settings = {};
let _unsub = null;
let _onClick = null;
let _printStyle = false;

export function destroy() {
  if (_root && _onClick) _root.removeEventListener('click', _onClick);
  if (typeof _unsub === 'function') {
    try { _unsub(); } catch (_) { /* ignore */ }
  }
  _root = null;
  _unsub = null;
  _onClick = null;
  _member = null;
}

function esc(v) {
  if (typeof ui.esc === 'function') {
    try { return ui.esc(v == null ? '' : v); } catch (_) { /* fallback */ }
  }
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(msg, type) {
  try { if (typeof ui.toast === 'function') ui.toast(msg, type); } catch (_) { /* ignore */ }
}

function emptyState(text) {
  if (typeof ui.empty === 'function') {
    try {
      const h = ui.empty(text);
      if (typeof h === 'string' && h) return `<div class="empty-state">${h}</div>`;
    } catch (_) { /* fallback */ }
  }
  return `<div class="empty-state center">${esc(text)}</div>`;
}

function extractToken(params) {
  const p = params || {};
  let t = p.token || p.id || p.qrToken || p.slug || p[0];
  if (!t) {
    try {
      const m = String(location.hash || '').match(/^#\/card\/([^/?#]+)/);
      if (m) t = decodeURIComponent(m[1]);
    } catch (_) { /* ignore */ }
  }
  return t ? String(t) : '';
}

function findMember(token) {
  const list = (store.state && store.state.members) || [];
  if (!Array.isArray(list) || !token) return null;
  return list.find((m) => m && m.qrToken === token)
    || list.find((m) => m && (String(m.id) === token || String(m.uid) === token))
    || null;
}

function settings() {
  const s = (store.state && store.state.settings) || {};
  if (Array.isArray(s)) return s[0] || {};
  return s && typeof s === 'object' ? s : {};
}

function cardURL(token) {
  return (location.origin || '') + (location.pathname || '') + '#/card/' + encodeURIComponent(token || '');
}

function codeOf(m) {
  return typeof U.memberCodeOf === 'function' ? U.memberCodeOf(m) : (m && m.memberCode) || 'KH-000000';
}

function qrSVG(text) {
  if (typeof U.qrSVG !== 'function') return '<div class="muted">تعذّر توليد رمز QR</div>';
  try {
    const s = U.qrSVG(text, 200);
    return s ? String(s) : '<div class="muted">تعذّر توليد رمز QR</div>';
  } catch (_) {
    return '<div class="muted">تعذّر توليد رمز QR</div>';
  }
}

function addPrintStyle() {
  if (_printStyle || !document.head) return;
  _printStyle = true;
  const style = document.createElement('style');
  style.setAttribute('data-page', 'card');
  style.textContent = `
    @media print {
      @page { size: A4 portrait; margin: 14mm; }
      body { background: #fff !important; }
      body * { visibility: hidden !important; }
      .id-card, .id-card * { visibility: visible !important; }
      .id-card {
        position: absolute !important;
        inset-block-start: 0 !important;
        inset-inline-start: 0 !important;
        inline-size: 170mm !important;
        box-shadow: none !important;
        margin: 0 !important;
        break-inside: avoid;
      }
      .no-print { display: none !important; }
    }`;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/* تحميل البطاقة كصورة PNG جاهزة للطباعة                              */
/* ------------------------------------------------------------------ */

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function svgImage(svg) {
  if (!svg || typeof svg !== 'string') return Promise.resolve(null);
  return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}

async function loadLogo(src) {
  try {
    const resp = await fetch(src, { cache: 'force-cache' });
    if (resp.ok) {
      const text = await resp.text();
      if (/<svg[\s>]/i.test(text)) {
        const img = await svgImage(text);
        if (img) return img;
      }
    }
  } catch (_) { /* نجرب التحميل المباشر */ }
  return loadImage(src);
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function downloadCardPNG() {
  const m = _member;
  if (!m) return;
  try {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) { /* ignore */ }

    const code = codeOf(m);
    const token = String(m.qrToken || _token);
    const st = _settings || {};
    const serviceName = st.serviceName || (APP && APP.name) || 'خدمة اجتماع بولس الرسول';
    const photo = m.photoURL || m.photo || '';
    const initial = String(m.name || 'ع').trim().charAt(0);

    const [logoImg, qrImg, photoImg] = await Promise.all([
      loadLogo((APP && APP.logo) || 'assets/icon.png'),
      svgImage(typeof U.qrSVG === 'function' ? U.qrSVG(cardURL(token), 512) : ''),
      loadImage(photo),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1010;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas غير متاح');
    ctx.scale(canvas.width / 1000, canvas.height / 631);

    // الخلفية والإطار
    const grad = ctx.createLinearGradient(0, 0, 1000, 631);
    grad.addColorStop(0, '#fffbf5');
    grad.addColorStop(1, '#f1ddc7');
    ctx.fillStyle = grad;
    rounded(ctx, 0, 0, 1000, 631, 26);
    ctx.fill();
    ctx.strokeStyle = '#d6b494';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(148,88,63,0.07)';
    ctx.beginPath();
    ctx.arc(890, 30, 225, 0, Math.PI * 2);
    ctx.fill();

    // الترويسة
    if (logoImg) ctx.drawImage(logoImg, 890, 36, 62, 62);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3d2c22';
    ctx.font = '800 30px Tajawal, Arial, sans-serif';
    ctx.fillText(serviceName, 872, 68);
    ctx.fillStyle = '#75614f';
    ctx.font = '500 17px Tajawal, Arial, sans-serif';
    ctx.fillText('بطاقة عضوية — خدمة الشباب', 872, 95);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#75614f';
    ctx.font = '500 15px Tajawal, Arial, sans-serif';
    ctx.fillText('رقم العضو', 48, 62);
    ctx.fillStyle = '#94583f';
    ctx.font = '800 34px Tajawal, Arial, sans-serif';
    ctx.fillText(code, 48, 102);

    ctx.strokeStyle = 'rgba(148,88,63,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(48, 140); ctx.lineTo(952, 140); ctx.stroke();

    // صورة العضو
    const px = 868, py = 322, pr = 84;
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
    if (photoImg) {
      ctx.drawImage(photoImg, px - pr, py - pr, pr * 2, pr * 2);
    } else {
      ctx.fillStyle = '#ead7c1';
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      ctx.fillStyle = '#94583f';
      ctx.font = '800 76px Tajawal, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, px, py + 5);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.strokeStyle = '#d6b494';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();

    // بيانات العضو
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#75614f';
    ctx.font = '500 18px Tajawal, Arial, sans-serif';
    ctx.fillText('الاسم', 760, 268);
    ctx.fillStyle = '#3d2c22';
    ctx.font = '800 46px Tajawal, Arial, sans-serif';
    ctx.fillText(String(m.name || 'عضو الخدمة'), 760, 330);
    ctx.fillStyle = '#75614f';
    ctx.font = '500 20px Tajawal, Arial, sans-serif';
    ctx.fillText(
      (m.active === false ? 'عضو غير نشط' : 'عضو نشط') + (m.phone ? ' · ' + m.phone : ''),
      760, 375,
    );

    // رمز QR
    if (qrImg) {
      ctx.fillStyle = '#ffffff';
      rounded(ctx, 48, 232, 190, 190, 14);
      ctx.fill();
      ctx.drawImage(qrImg, 58, 242, 170, 170);
    }

    // التذييل
    ctx.strokeStyle = 'rgba(148,88,63,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(48, 480); ctx.lineTo(952, 480); ctx.stroke();
    ctx.direction = 'rtl';
    ctx.fillStyle = '#75614f';
    ctx.font = '500 20px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'right';
    const meeting = [st.serviceDay, st.serviceTime].filter(Boolean).join(' · ');
    ctx.fillText(meeting || 'حضور وغياب — خدمة الشباب', 952, 545);
    ctx.font = '500 17px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('امسح QR لفتح بطاقتك', 48, 545);

    const save = (blob) => {
      if (blob && typeof U.download === 'function') {
        U.download(blob, `بطاقة-${code}.png`);
        toast('تم تحميل البطاقة — جاهزة للطباعة', 'ok');
      } else {
        toast('تعذّر تحميل البطاقة', 'err');
      }
    };
    if (typeof canvas.toBlob === 'function') canvas.toBlob(save, 'image/png');
    else {
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = data; a.download = `بطاقة-${code}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    }
  } catch (err) {
    toast('تعذّر تحميل البطاقة: ' + (err && err.message ? err.message : err), 'err');
  }
}

/* ------------------------------------------------------------------ */

function paint() {
  if (!_root) return;
  const member = findMember(_token);
  _member = member;
  _settings = settings();

  if (!_token || !member) {
    _root.innerHTML = `
      <div class="page card-page" dir="rtl">
        <div class="card glass"><div class="card-body center">
          <h1 class="page-title">البطاقة غير متاحة</h1>
          <p class="muted">لم نعثر على عضو بهذا الرمز، أو أن الرابط غير صالح.</p>
          ${emptyState('تأكد من رمز البطاقة أو تواصل مع مسؤول الخدمة.')}
          <a class="btn btn-ghost btn-block mt-2" href="#/">العودة للرئيسية</a>
        </div></div>
      </div>`;
    return;
  }

  const st = _settings;
  const serviceName = st.serviceName || (APP && APP.name) || 'خدمة اجتماع بولس الرسول';
  const logo = (APP && APP.logo) || 'assets/icon.png';
  const photo = member.photoURL || member.photo;
  const initial = String(member.name || 'ع').trim().charAt(0);
  const token = String(member.qrToken || _token);
  const code = codeOf(member);
  const meeting = [st.serviceDay, st.serviceTime].filter(Boolean).join(' · ');
  const s = store.state || {};
  const cu = s.currentUser || store.currentUser || null;
  const isOwner = !!cu && (
    String(cu.uid || '') === String(member.uid || '')
    || String(cu.uid || '') === String(member.id || '')
    || String(cu.email || '').toLowerCase() === String(member.email || '').toLowerCase()
  );
  const canSeePhone = isOwner || !!s.isAdmin;
  const publicSub = canSeePhone
    ? ((member.active === false ? 'عضو غير نشط' : 'عضو نشط') + (member.phone ? ' · ' + member.phone : ''))
    : (member.active === false ? 'عضو غير نشط' : 'عضو نشط');

  _root.innerHTML = `
    <div class="page card-page" dir="rtl">
      <div class="card-intro center">
        <span class="eyebrow">بطاقة العضوية</span>
        <h1 class="page-title">بطاقة ${esc(member.name || 'العضو')}</h1>
        <p class="muted">بطاقة جاهزة للطباعة أو التحميل بصورة عالية الجودة، ومعها رقم العضو ورمز QR.</p>
      </div>

      <div class="id-card-stage">
        <div class="id-card" id="idCard">
          <div class="id-card__header">
            <div class="id-card__brand">
              <img class="id-card__logo" src="${esc(logo)}" alt="شعار الخدمة" onerror="this.style.display='none'">
              <div class="id-card__brand-text">
                <strong>${esc(serviceName)}</strong>
                <span>بطاقة عضوية — خدمة الشباب</span>
              </div>
            </div>
            <div class="id-card__serial">
              <span>رقم العضو</span>
              <strong dir="ltr">${esc(code)}</strong>
            </div>
          </div>

          <div class="id-card__body">
            <div class="id-card__photo">
              ${photo ? `<img src="${esc(photo)}" alt="صورة ${esc(member.name || 'العضو')}">` : `<span>${esc(initial)}</span>`}
            </div>
            <div class="id-card__info">
              <span class="id-card__label">الاسم</span>
              <strong class="id-card__name">${esc(member.name || 'عضو الخدمة')}</strong>
              <span class="id-card__sub">${esc(publicSub)}</span>
            </div>
            <div class="id-card__qr">${qrSVG(cardURL(token))}</div>
          </div>

          <div class="id-card__footer">
            <span>${esc(meeting || 'حضور وغياب — خدمة الشباب')}</span>
            <span>امسح QR لفتح بطاقتك</span>
          </div>
        </div>
      </div>

      <div class="row center gap-2 mt-3 wrap no-print">
        <button type="button" class="btn btn-primary" data-action="download">⬇️ تحميل البطاقة (PNG)</button>
        <button type="button" class="btn btn-ghost" data-action="print">🖨️ طباعة</button>
        <a class="btn btn-ghost" href="#/">الرئيسية</a>
      </div>
      <p class="muted center mt-2 no-print">الصورة بجودة طباعة — يمكنك إدراجها في ملف أو طباعتها مباشرة.</p>
    </div>`;
}

export function render(root, params) {
  destroy();
  if (!root) return;
  _root = root;
  _token = extractToken(params);
  addPrintStyle();

  _root.innerHTML = '<div class="page card-page"><div class="loading center">جارٍ تحميل البطاقة...</div></div>';

  _onClick = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-action="download"]')) {
      downloadCardPNG();
      return;
    }
    if (t.closest('[data-action="print"]')) {
      try { window.print(); } catch (_) { /* ignore */ }
    }
  };
  _root.addEventListener('click', _onClick);

  paint();

  if (typeof store.subscribe === 'function') {
    try { _unsub = store.subscribe(paint) || null; } catch (_) { _unsub = null; }
  }
}
