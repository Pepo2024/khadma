// بوابة الشباب — الملف الشخصي، الحضور، الرسائل، الزيارات
import * as storeNS from '../store.js';
import * as uiNS from '../ui.js';
import * as utilsNS from '../utils.js';
import * as cfgNS from '../config.js';

const store = storeNS.store || storeNS.default || storeNS;
const ui = uiNS.ui || uiNS.default || uiNS;
const U = utilsNS.utils || utilsNS.default || utilsNS;
const APP = cfgNS.APP || (cfgNS.default && cfgNS.default.APP) || {};

const TABS = [
  { id: 'profile', label: 'الملف الشخصي', icon: '👤' },
  { id: 'attendance', label: 'حضوري', icon: '✅' },
  { id: 'messages', label: 'رسائلي', icon: '✉️' },
  { id: 'visits', label: 'زياراتي', icon: '🏠' },
];

let activeTab = 'profile';
let _root = null;
let _content = null;
let _unsub = null;
let _onClick = null;
let _onChange = null;

export function destroy() {
  if (_root) {
    if (_onClick) _root.removeEventListener('click', _onClick);
    if (_onChange) _root.removeEventListener('change', _onChange);
  }
  if (typeof _unsub === 'function') {
    try { _unsub(); } catch (_) { /* ignore */ }
  }
  _root = null;
  _content = null;
  _unsub = null;
  _onClick = null;
  _onChange = null;
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

function fmtDate(v) {
  if (!v) return '—';
  try {
    if (typeof U.fmtDate === 'function') {
      const s = U.fmtDate(v);
      if (s) return String(s);
    }
  } catch (_) { /* fallback */ }
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('ar-EG');
}

function fmtDT(v) {
  if (!v) return '—';
  try {
    if (typeof U.fmtDateTime === 'function') {
      const s = U.fmtDateTime(v);
      if (s) return String(s);
    }
  } catch (_) { /* fallback */ }
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('ar-EG');
}

function badge(text, tone) {
  if (typeof ui.badge === 'function') {
    try {
      const h = ui.badge(text, tone);
      if (typeof h === 'string' && h) return h;
    } catch (_) { /* fallback */ }
  }
  return `<span class="badge ${tone ? 'badge-' + esc(tone) : ''}">${esc(text)}</span>`;
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

function pageHead(title, sub, actions) {
  if (typeof ui.pageHead === 'function') {
    try {
      const h = ui.pageHead(title, sub, actions || '');
      if (typeof h === 'string' && h) return h;
    } catch (_) { /* fallback */ }
  }
  return `
    <div class="page-head">
      <div><h1 class="page-title">${esc(title)}</h1><p class="page-sub">${esc(sub)}</p></div>
      <div class="toolbar">${actions || ''}</div>
    </div>`;
}

function tableHTML(headers, rows) {
  if (typeof ui.tableHTML === 'function') {
    try {
      const h = ui.tableHTML(headers, rows);
      if (typeof h === 'string' && h) return h;
    } catch (_) { /* fallback below */ }
  }
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead class="t-head"><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((cells) => `<tr class="t-row">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function getUser() {
  try {
    let u = store.currentUser;
    if (typeof u === 'function') u = u();
    if (u) return u;
  } catch (_) { /* ignore */ }
  const st = store.state || {};
  return st.currentUser || null;
}

function findMember(user) {
  const list = (store.state && store.state.members) || [];
  if (!Array.isArray(list)) return null;
  if (!user) return null;
  const uid = user.uid || user.id || user.userUid;
  return list.find((m) => (
    uid && (m.uid === uid || m.id === uid || m.userUid === uid)
  )) || (user.email ? list.find((m) => m.email === user.email) : null) || null;
}

function firstName(user, member) {
  const raw = (member && member.name) || (user && (user.displayName || user.name)) || '';
  const first = String(raw).trim().split(/\s+/)[0];
  if (first) return first;
  const mail = user && user.email ? String(user.email).split('@')[0] : '';
  return mail || 'أهلًا';
}

function cardHash(token) {
  return '#/card/' + encodeURIComponent(token || '');
}

function cardURL(token) {
  return (location.origin || '') + (location.pathname || '') + cardHash(token);
}

function qrSVG(text, size) {
  if (typeof U.qrSVG !== 'function') return '<div class="muted">تعذّر توليد رمز QR</div>';
  try {
    const s = U.qrSVG(text, size || 180);
    return s ? String(s) : '<div class="muted">تعذّر توليد رمز QR</div>';
  } catch (_) {
    return '<div class="muted">تعذّر توليد رمز QR</div>';
  }
}

function photoOf(member) {
  const src = member && (member.photoURL || member.photo);
  return src ? `<img src="${esc(src)}" alt="صورة ${esc(member.name || 'العضو')}">` : '👤';
}

function profileView(user, member) {
  const token = member.qrToken || '';
  const link = cardHash(token);
  const full = cardURL(token);
  const defs = [
    ['الاسم', member.name],
    ['رقم الهاتف', member.phone],
    ['العنوان', member.address],
    ['العمر', member.age],
    ['تاريخ الميلاد', fmtDate(member.birthDate)],
    ['اسم أب الاعتراف', member.confessorName || '—'],
    ['الكلية', member.college || '—'],
    ['المستوى', member.level || '—'],
    ['البريد الإلكتروني', (user && user.email) || member.email],
    ['تاريخ الانضمام', fmtDate(member.joinedAt || member.createdAt)],
  ];

  return `
    <div class="grid grid-2 profile-grid">
      <div class="card glass">
        <div class="card-body">
          <h2 class="card-title">بياناتي الشخصية</h2>
          <div class="row gap-3 profile-top mt-2">
            <div class="avatar avatar-lg" id="youthAvatar">${photoOf(member)}</div>
            <div class="stack gap-1">
              <div class="field-label">الصورة الشخصية</div>
              <input class="input" id="youthPhoto" type="file" accept="image/*">
              <div class="muted">تظهر صورتك في بطاقتك الرقمية فقط.</div>
            </div>
          </div>
          <div class="divider"></div>
          <div class="data-list">
            ${defs.map(([label, value]) => `
              <div class="row between data-row">
                <span class="muted">${esc(label)}</span>
                <span class="right" dir="auto">${esc(value == null || value === '' ? '—' : value)}</span>
              </div>`).join('')}
          </div>
          ${member.notes ? `<div class="divider"></div><div class="muted">ملاحظات: ${esc(member.notes)}</div>` : ''}
          <div class="row between center mt-3">
            ${badge(member.active === false ? 'غير نشط' : 'عضو نشط', member.active === false ? 'gray' : 'green')}
            ${member.joinedAt ? `<span class="muted">عضو منذ ${esc(fmtDate(member.joinedAt))}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="card glass">
        <div class="card-body center">
          <h2 class="card-title">بطاقتي الرقمية</h2>
          <p class="muted">اعرض هذا الرمز عند تسجيل الحضور أو شاركه مع مسؤولي الخدمة.</p>
          <div class="qr-box mt-2">
            ${qrSVG(full, 180)}
          </div>
          <div class="muted mt-2">رابط البطاقة:</div>
          <a class="chip" href="${esc(link)}" dir="ltr">${esc(link)}</a>
          <div class="row center gap-2 mt-3 wrap">
            <button type="button" class="btn btn-sm btn-primary" data-action="copy-link">نسخ الرابط</button>
            <button type="button" class="btn btn-sm btn-ghost" data-action="download-qr">تنزيل رمز QR</button>
            <a class="btn btn-sm btn-ghost" href="${esc(link)}">عرض البطاقة</a>
          </div>
        </div>
      </div>
    </div>`;
}

function attendanceView(user, member) {
  const st = store.state || {};
  const meetings = Array.isArray(st.meetings) ? st.meetings : [];
  const meetingMap = {};
  meetings.forEach((m) => { if (m && m.id != null) meetingMap[String(m.id)] = m; });

  const recs = (Array.isArray(st.attendance) ? st.attendance : [])
    .filter((r) => r && r.memberId === member.id)
    .sort((a, b) => String(b.recordedAt || b.date || '').localeCompare(String(a.recordedAt || a.date || '')));

  if (!recs.length) return emptyState('لا يوجد سجل حضور بعد.');

  const rows = recs.map((r) => {
    const m = meetingMap[String(r.meetingId)] || {};
    const status = r.status || '';
    const label = status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : status === 'excused' ? 'بعذر' : 'غير محدد';
    const tone = status === 'present' ? 'green' : status === 'absent' ? 'red' : 'gray';
    return [
      esc(m.title || 'اجتماع'),
      esc(fmtDate(m.date || r.date || r.recordedAt)),
      badge(label, tone),
      esc(r.note || '—'),
    ];
  });

  return tableHTML(['الاجتماع', 'التاريخ', 'الحالة', 'ملاحظة'], rows);
}

function messagesView(user, member) {
  let list = null;
  try {
    if (typeof store.messagesFor === 'function') list = store.messagesFor(user.uid || user.id);
  } catch (_) { /* ignore */ }

  if (!Array.isArray(list)) {
    list = ((store.state && store.state.messages) || []).filter((m) => (
      m && (m.scope === 'group' || m.toAll || (member && m.toMemberId === member.id))
    ));
  }

  list = list.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  if (!list.length) return emptyState('لا توجد رسائل حتى الآن.');

  const uid = user.uid || user.id;
  return `<div class="msg-list">${list.map((m) => {
    const readBy = Array.isArray(m.readBy) ? m.readBy : [];
    const unread = !readBy.includes(uid) && !(member && readBy.includes(member.uid));
    const isDirect = m.scope === 'direct' || (!m.toAll && m.toMemberId);
    return `
      <div class="card msg-item ${unread ? 'unread' : ''}" data-msg-id="${esc(m.id || '')}" tabindex="0">
        <div class="msg-meta">
          <span class="msg-title">${esc(m.title || 'رسالة من الخدمة')}</span>
          ${badge(isDirect ? 'خاص' : 'عام', isDirect ? 'gold' : 'gray')}
          <span class="muted">${esc(fmtDT(m.createdAt))}</span>
        </div>
        <div class="msg-body">${esc(m.body || '')}</div>
      </div>`;
  }).join('')}</div>`;
}

function visitsView(user, member) {
  let list = null;
  try {
    if (typeof store.visitsFor === 'function') list = store.visitsFor(member.id);
  } catch (_) { /* ignore */ }

  if (!Array.isArray(list)) {
    list = ((store.state && store.state.visits) || []).filter((v) => v && v.memberId === member.id);
  }

  list = list.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!list.length) return emptyState('لا توجد زيارات أو افتقاد مسجل بعد.');

  const typeLabel = { visit: 'زيارة', call: 'مكالمة', followup: 'متابعة' };
  return `
    <div class="timeline">
      ${list.map((v) => `
        <div class="timeline-item">
          <div class="row between center">
            <strong>${esc(typeLabel[v.type] || v.type || 'زيارة')}</strong>
            <span class="muted">${esc(fmtDate(v.date || v.createdAt))}</span>
          </div>
          <div class="msg-body">${esc(v.notes || '—')}</div>
          ${v.doneBy ? `<div class="muted">بواسطة: ${esc(v.doneBy)}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function paint() {
  if (!_root || !_content || !_content.isConnected) return;

  _root.querySelectorAll('[data-tab]').forEach((el) => {
    el.classList.toggle('tab-active', el.dataset.tab === activeTab);
  });

  const user = getUser();
  const member = findMember(user);

  if (!user) {
    _content.innerHTML = `
      <div class="card glass"><div class="card-body">
        ${emptyState('يجب تسجيل الدخول أولاً لعرض بياناتك.')}
        <a class="btn btn-primary btn-block mt-2" href="#/login">تسجيل الدخول</a>
      </div></div>`;
    return;
  }

  if (!member) {
    _content.innerHTML = `
      <div class="card glass"><div class="card-body center">
        <h2 class="card-title">لم نعثر على ملفك الشخصي</h2>
        <p class="muted">قد لا يكون حسابك مرتبطًا ببيانات عضو بعد. تواصل مع مسؤول الخدمة.</p>
        ${emptyState('لا توجد بيانات لعرضها حاليًا.')}
        <button type="button" class="btn btn-ghost btn-block mt-2" data-action="refresh">إعادة المحاولة</button>
        <button type="button" class="btn btn-danger btn-block mt-2" data-logout>تسجيل الخروج</button>
      </div></div>`;
    return;
  }

  switch (activeTab) {
    case 'attendance': _content.innerHTML = attendanceView(user, member); break;
    case 'messages': _content.innerHTML = messagesView(user, member); break;
    case 'visits': _content.innerHTML = visitsView(user, member); break;
    case 'profile':
    default: _content.innerHTML = profileView(user, member); break;
  }
}

async function uploadPhoto(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('يرجى اختيار ملف صورة', 'err'); return; }
  const member = findMember(getUser());
  if (!member) { toast('تعذر تحديد ملفك الشخصي', 'err'); return; }

  toast('جارٍ رفع الصورة...');
  try {
    const url = await store.uploadPhoto(file, member.id);
    if (url) {
      const avatar = _root && _root.querySelector('#youthAvatar');
      if (avatar) avatar.innerHTML = `<img src="${esc(url)}" alt="صورة ${esc(member.name || 'العضو')}">`;
      toast('تم تحديث الصورة بنجاح', 'ok');
    } else {
      toast('لم يتم الحصول على رابط الصورة', 'err');
    }
  } catch (err) {
    toast((err && err.message) || 'تعذر رفع الصورة', 'err');
  }
}

function downloadQR() {
  const member = findMember(getUser());
  if (!member || !member.qrToken) { toast('رمز QR غير متاح', 'err'); return; }
  const svg = qrSVG(cardURL(member.qrToken), 360);
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const name = 'qr-' + String(member.qrToken).replace(/[^\w\-]/g, '') + '.svg';
    if (typeof U.download === 'function') {
      U.download(blob, name);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    toast('تم تنزيل رمز QR', 'ok');
  } catch (_) {
    toast('تعذر تنزيل رمز QR', 'err');
  }
}

async function copyLink() {
  const member = findMember(getUser());
  if (!member) return;
  const link = cardURL(member.qrToken);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('تم نسخ رابط البطاقة', 'ok');
  } catch (_) {
    toast('تعذر نسخ الرابط', 'err');
  }
}

async function doLogout() {
  try { await store.logout(); } catch (_) { /* ignore */ }
  toast('تم تسجيل الخروج', 'ok');
  try { location.hash = '#/login'; } catch (_) { /* ignore */ }
}

export function render(root, params) {
  destroy();
  if (!root) return;
  _root = root;
  activeTab = 'profile';

  const user = getUser();
  const member = findMember(user);
  const greet = firstName(user, member);

  root.innerHTML = `
    <div class="app-shell youth-shell" dir="rtl">
      <aside class="sidebar youth-sidebar">
        <div class="brand">
          <span class="brand-mark"><img src="assets/icon.png" alt=""></span>
          <span>${esc((APP && APP.shortName) || 'الخدمة')}</span>
        </div>
        <nav class="tabs sidebar-tabs">
          ${TABS.map((t) => `
            <button type="button" class="tab nav-link" data-tab="${esc(t.id)}">
              <span aria-hidden="true">${esc(t.icon)}</span> ${esc(t.label)}
            </button>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <button type="button" class="btn btn-danger btn-block" data-logout>تسجيل الخروج</button>
        </div>
      </aside>

      <main class="page youth-main">
        ${pageHead('مرحبًا، ' + greet, 'هذه مساحتك الخاصة في الخدمة.', '<button type="button" class="btn btn-sm btn-ghost" data-action="refresh">تحديث</button>')}
        <div id="youthContent" class="mt-3"></div>
      </main>
    </div>`;

  _content = root.querySelector('#youthContent');

  _onClick = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    const tabEl = t.closest('[data-tab]');
    if (tabEl) { activeTab = tabEl.dataset.tab; paint(); return; }

    if (t.closest('[data-logout]')) { doLogout(); return; }
    if (t.closest('[data-action="refresh"]')) { paint(); return; }
    if (t.closest('[data-action="copy-link"]')) { copyLink(); return; }
    if (t.closest('[data-action="download-qr"]')) { downloadQR(); return; }

    const msgEl = t.closest('[data-msg-id]');
    if (msgEl) {
      const id = msgEl.dataset.msgId;
      if (id) {
        msgEl.classList.remove('unread');
        try { Promise.resolve(store.markMessageRead(id)).catch(() => {}); } catch (_) { /* ignore */ }
      }
    }
  };

  _onChange = (e) => {
    if (e.target && e.target.id === 'youthPhoto' && e.target.files && e.target.files[0]) {
      uploadPhoto(e.target.files[0]);
    }
  };

  root.addEventListener('click', _onClick);
  root.addEventListener('change', _onChange);

  paint();

  if (typeof store.subscribe === 'function') {
    try { _unsub = store.subscribe(paint) || null; } catch (_) { _unsub = null; }
  }
}
