/* ==========================================================================
   admin.js — لوحة إدارة خدمة اجتماع بولس الرسول
   واجهة عربية RTL بالكامل، مبنية على العقود الموضّحة في SPEC.md
   ========================================================================== */

import { store } from '../store.js';
import * as uiNS from '../ui.js';
import * as utilsNS from '../utils.js';
import * as config from '../config.js';

/* نقبل الصيغ المختلفة للتصدير (كائن ui / دوال مسماة / default) */
const ui = uiNS.ui || uiNS.default || uiNS;
const utils = utilsNS.utils || utilsNS.default || utilsNS;

/* --------------------------------------------------------------------------
   طبقة توافق مع ui.js و utils.js
   -------------------------------------------------------------------------- */
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(v) {
  if (v === null || v === undefined) return '';
  if (typeof ui.esc === 'function') return ui.esc(v);
  return String(v).replace(/[&<>"']/g, (c) => ENT[c]);
}
function toast(msg, type) {
  try {
    if (typeof ui.toast === 'function') ui.toast(msg, type);
    else console.log((type ? '[' + type + '] ' : '') + msg);
  } catch (_) { /* التنبيه لا يجب أن يكسر الواجهة */ }
}
function modal(opts) {
  if (typeof ui.modal === 'function') return ui.modal(opts);
  console.warn('ui.modal غير متوفر', opts && opts.title);
  return null;
}
async function confirmBox(msg) {
  try {
    if (typeof ui.confirmBox === 'function') return await ui.confirmBox(msg);
  } catch (_) { /* نكمل بالتأكيد الأصلي */ }
  return typeof window !== 'undefined' ? window.confirm(msg) : false;
}
function empty(text) {
  if (typeof ui.empty === 'function') return ui.empty(text);
  return '<div class="empty-state">' + esc(text) + '</div>';
}
function pageHead(title, subtitle, actions) {
  if (typeof ui.pageHead === 'function') return ui.pageHead(title, subtitle, actions || '');
  return '<div class="page-head"><div><h1 class="page-title">' + esc(title) + '</h1>' +
    (subtitle ? '<p class="page-sub">' + esc(subtitle) + '</p>' : '') + '</div>' +
    '<div class="row gap-2">' + (actions || '') + '</div></div>';
}
function tableHTML(headers, rows) {
  /* نبني الجدول بأنفسنا لأن الصفوف تحمل بيانات بحث وتصنيف على عنصر tr */
  if (!rows || !rows.length) return empty('لا توجد بيانات');
  return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
    headers.map((h) => '<th class="t-head">' + esc(h) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}
function badge(text, tone) {
  if (typeof ui.badge === 'function') return ui.badge(text, tone);
  return '<span class="badge badge-' + esc(tone || 'gray') + '">' + esc(text) + '</span>';
}
function formRow(label, control, hint) {
  if (typeof ui.formRow === 'function') return ui.formRow(label, control, hint);
  return '<div class="field"><label class="field-label">' + esc(label) + '</label>' + control +
    (hint ? '<div class="muted mt-1">' + esc(hint) + '</div>' : '') + '</div>';
}
function uid() {
  if (typeof utils.uid === 'function') return utils.uid();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
function nowISO() {
  if (typeof utils.nowISO === 'function') return utils.nowISO();
  return new Date().toISOString();
}
function todayISO() {
  if (typeof utils.todayISO === 'function') return utils.todayISO();
  return localISO(new Date());
}
function localISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function fmtDate(v) {
  if (!v) return '—';
  try { if (typeof utils.fmtDate === 'function') return utils.fmtDate(v); } catch (_) { /* fallback */ }
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d.getTime())) return esc(s);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(v) {
  if (!v) return '—';
  try { if (typeof utils.fmtDateTime === 'function') return utils.fmtDateTime(v); } catch (_) { /* fallback */ }
  const d = new Date(v);
  if (isNaN(d.getTime())) return esc(String(v));
  return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}
function normalizePhone(p) {
  if (!p) return '';
  try {
    if (typeof utils.normalizePhone === 'function') return utils.normalizePhone(p, config.APP && config.APP.countryCode) || p;
  } catch (_) { /* fallback */ }
  return String(p).replace(/[^\d+]/g, '');
}
function waLink(phone, text) {
  try { if (typeof utils.waLink === 'function') return utils.waLink(phone, text); } catch (_) { /* fallback */ }
  const code = (config.APP && config.APP.countryCode) || '20';
  let num = String(phone || '').replace(/[^\d]/g, '');
  if (num.startsWith(code)) { /* مضبوط بالفعل */ }
  else if (num.startsWith('0')) num = code + num.slice(1);
  return 'https://wa.me/' + code + num + '?text=' + encodeURIComponent(text || '');
}
function download(blob, name) {
  try { if (typeof utils.download === 'function') { utils.download(blob, name); return; } } catch (_) { /* fallback */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function ageOf(m) {
  if (m.age) return Number(m.age);
  if (!m.birthDate) return '—';
  if (typeof utils.age === 'function') {
    try { const a = utils.age(m.birthDate); if (a !== undefined && a !== null) return a; } catch (_) { /* fallback */ }
  }
  const b = new Date(String(m.birthDate).length === 10 ? m.birthDate + 'T00:00:00' : m.birthDate);
  if (isNaN(b.getTime())) return '—';
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
function val(id) {
  const el = document.getElementById(id);
  return el ? String(el.value == null ? '' : el.value).trim() : '';
}
function checked(id) {
  const el = document.getElementById(id);
  return !!(el && el.checked);
}

/* --------------------------------------------------------------------------
   الوصول للبيانات
   -------------------------------------------------------------------------- */
function snap() { return store.state || {}; }
function allMembers() { return Array.isArray(snap().members) ? snap().members : []; }
function allMeetings() { return Array.isArray(snap().meetings) ? snap().meetings : []; }
function allAttendance() { return Array.isArray(snap().attendance) ? snap().attendance : []; }
function allVisits() { return Array.isArray(snap().visits) ? snap().visits : []; }
function allMessages() { return Array.isArray(snap().messages) ? snap().messages : []; }
function settingsOf() { return snap().settings || {}; }
function currentUid() {
  const u = snap().currentUser;
  if (u && u.uid) return u.uid;
  const su = store.currentUser;
  return (su && typeof su === 'object' && su.uid) ? su.uid : '';
}
function currentEmail() {
  const u = snap().currentUser;
  if (u && u.email) return u.email;
  const su = store.currentUser;
  return (su && typeof su === 'object' && su.email) ? su.email : '';
}
function byName(arr) {
  return [...arr].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
}
function byDateDesc(arr) {
  return [...arr].sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
}
function patchState(collection, rec) {
  const s = store.state;
  if (!s) return;
  if (!Array.isArray(s[collection])) s[collection] = [];
  const i = s[collection].findIndex((x) => x && x.id === rec.id);
  if (i >= 0) s[collection][i] = { ...s[collection][i], ...rec };
  else s[collection].push(rec);
}
function dropState(collection, id) {
  const s = store.state;
  if (s && Array.isArray(s[collection])) s[collection] = s[collection].filter((x) => x && x.id !== id);
}
function attendanceFor(meetingId) {
  if (typeof store.attendanceFor === 'function') {
    try { const r = store.attendanceFor(meetingId); if (Array.isArray(r)) return r; } catch (_) { /* fallback */ }
  }
  return allAttendance().filter((a) => a.meetingId === meetingId);
}
function isLocalMode() {
  let local;
  try {
    if (typeof store.isLocal === 'function') local = store.isLocal();
    else if (typeof store.isLocal === 'boolean') local = store.isLocal;
  } catch (_) { /* fallback */ }
  if (local === undefined || local === null) {
    if (typeof snap().isLocal === 'boolean') local = snap().isLocal;
    else if (snap().mode === 'local' || snap().mode === 'cloud') local = snap().mode === 'local';
    else local = !(config.FIREBASE && config.FIREBASE.enabled);
  }
  return !!local;
}

/* --------------------------------------------------------------------------
   تصدير أوراق Excel عبر XLSX العام
   -------------------------------------------------------------------------- */
function exportSheet(rows, sheetName, fileName) {
  if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
    toast('مكتبة التصدير (XLSX) غير متاحة', 'err');
    return false;
  }
  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    toast('تم تصدير الملف بنجاح', 'ok');
    return true;
  } catch (e) {
    toast('تعذّر التصدير: ' + (e && e.message ? e.message : e), 'err');
    return false;
  }
}
function membersSheetRows(list) {
  return (list || allMembers()).map((m) => ({
    'الاسم': m.name || '', 'الهاتف': m.phone || '', 'العمر': ageOf(m),
    'تاريخ الميلاد': m.birthDate || '', 'أب الاعتراف': m.confessorName || '',
    'الكلية': m.college || '', 'المستوى': m.level || '',
    'العنوان': m.address || '', 'الحضور': attendanceForAllCount(m.id),
    'تاريخ الانضمام': m.joinedAt || '', 'نشط': m.active === false ? 'لا' : 'نعم',
    'ملاحظات': m.notes || ''
  }));
}
function attendanceForAllCount(memberId) {
  return allAttendance().filter((a) => a.memberId === memberId && a.status === 'present').length;
}

/* --------------------------------------------------------------------------
   ربط الأحداث (تفويض عام) — يعمل أيضًا مع الأزرار داخل النوافذ المنبثقة
   -------------------------------------------------------------------------- */
let CTX = { root: null, params: [] };
let clickActions = {};
let changeActions = {};
let inputActions = {};

function bind(map) {
  clickActions = {};
  changeActions = {};
  inputActions = {};
  Object.assign(clickActions, commonActions());
  Object.entries(map || {}).forEach(([key, fn]) => {
    if (key.indexOf('change:') === 0) changeActions[key.slice(7)] = fn;
    else if (key.indexOf('input:') === 0) inputActions[key.slice(6)] = fn;
    else clickActions[key] = fn;
  });
}
function rerender() { render(CTX.root, CTX.params); }

if (typeof document !== 'undefined' && !document.__khadmaAdminBound) {
  document.__khadmaAdminBound = true;
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    const fn = clickActions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    try { fn(el, el.dataset); }
    catch (err) { toast('حدث خطأ: ' + (err && err.message ? err.message : err), 'err'); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.act) return;
    const fn = changeActions[el.dataset.act];
    if (!fn) return;
    try { fn(el, el.dataset); }
    catch (err) { toast('حدث خطأ: ' + (err && err.message ? err.message : err), 'err'); }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.act) return;
    const fn = inputActions[el.dataset.act];
    if (!fn) return;
    try { fn(el, el.dataset); }
    catch (err) { toast('حدث خطأ: ' + (err && err.message ? err.message : err), 'err'); }
  });
}

function commonActions() {
  return {
    logout: async () => {
      try { await store.logout(); } catch (_) { /* نترك التوجيه يتكفل */ }
      location.hash = '#/login';
    },
    go: (el) => { location.hash = el.dataset.href || '#/admin'; },
    reloadPage: () => { location.reload(); }
  };
}

/* --------------------------------------------------------------------------
   الهيكل العام (الشريط العلوي + التبويبات)
   -------------------------------------------------------------------------- */
function shell(active, title, subtitle, actions, content) {
  const svc = settingsOf().serviceName || (config.APP && config.APP.name) || 'خدمة اجتماع بولس الرسول';
  const email = currentEmail() || 'مدير الخدمة';
  const navs = [
    ['', 'لوحة التحكم'], ['members', 'الأعضاء'], ['meetings', 'الاجتماعات'],
    ['visits', 'الافتقاد'], ['messages', 'الرسائل'], ['settings', 'الإعدادات']
  ];
  const navHTML = navs.map(([path, label]) => {
    const on = path === active || (active === 'attendance' && path === 'meetings');
    return '<a class="nav-link' + (on ? ' tab-active active' : '') + '" href="#/admin' +
      (path ? '/' + path : '') + '">' + esc(label) + '</a>';
  }).join('');
  return '<div class="app-shell">' +
    '<header class="topbar">' +
      '<a class="brand" href="#/admin"><span class="brand-mark"><img src="assets/icon.png" alt=""></span><span>' + esc(svc) + '</span></a>' +
      '<nav class="nav">' + navHTML + '</nav>' +
      '<div class="row gap-2 topbar-user">' +
        '<span class="muted">' + esc(email) + '</span>' +
        '<button class="btn btn-ghost btn-sm" data-act="logout">خروج</button>' +
      '</div>' +
    '</header>' +
    '<main class="page">' + pageHead(title, subtitle, actions || '') + content + '</main>' +
  '</div>';
}

/* --------------------------------------------------------------------------
   التوجيه الداخلي
   -------------------------------------------------------------------------- */
let activeScanMeeting = '';

export function render(root, params) {
  if (!root) return;
  const p = Array.isArray(params) ? params.map(String) : (params == null ? [] : [String(params)]);
  const raw = p[0] || '';
  const slash = raw.indexOf('/');
  const tab = slash >= 0 ? raw.slice(0, slash) : raw;
  const embedded = slash >= 0 ? raw.slice(slash + 1) : '';
  const meetingId = p[1] || embedded || '';
  CTX = { root, params: p };
  if (tab !== 'attendance' || meetingId !== activeScanMeeting) stopScanner();

  switch (tab) {
    case 'members': renderMembers(root); break;
    case 'meetings': renderMeetings(root); break;
    case 'attendance': renderAttendance(root, meetingId); break;
    case 'visits': renderVisits(root); break;
    case 'messages': renderMessages(root); break;
    case 'settings': renderSettings(root); break;
    default: renderDashboard(root);
  }
}

/* --------------------------------------------------------------------------
   لوحة التحكم
   -------------------------------------------------------------------------- */
function nextBirthday(member) {
  if (!member.birthDate) return null;
  const b = new Date(String(member.birthDate).length === 10 ? member.birthDate + 'T00:00:00' : member.birthDate);
  if (isNaN(b.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return { member, date: localISO(next), days: Math.round((next - today) / 86400000) };
}
function unreadCount() {
  const uid0 = currentUid();
  const mine = allMembers().find((m) => m.uid === uid0 || m.id === uid0);
  const memberId = mine ? mine.id : uid0;
  return allMessages().filter((m) =>
    !(Array.isArray(m.readBy) && m.readBy.includes(uid0)) &&
    (m.scope !== 'direct' || m.toMemberId === memberId)).length;
}

function renderDashboard(root) {
  const ms = allMembers();
  const mt = byDateDesc(allMeetings());
  const vs = allVisits();
  const activeCount = ms.filter((m) => m.active !== false).length;
  const pastMeetings = mt.filter((m) => String(m.date || '') <= todayISO());
  const last = pastMeetings[0] || mt[mt.length - 1];
  let rate = 0, lastPresent = 0;
  if (last) {
    const recs = attendanceFor(last.id);
    lastPresent = recs.filter((a) => a.status === 'present').length;
    rate = ms.length ? Math.round((lastPresent / ms.length) * 100) : 0;
  }
  const month = todayISO().slice(0, 7);
  const visitsMonth = vs.filter((v) => String(v.date || '').startsWith(month)).length;

  const stats = [
    { label: 'عدد الشباب', value: activeCount, tone: 'green' },
    { label: 'اجتماعات', value: mt.length, tone: '' },
    { label: 'نسبة الحضور في آخر اجتماع', value: rate + '%', tone: 'gold' },
    { label: 'رسائل غير مقروءة', value: unreadCount(), tone: 'red' },
    { label: 'افتقادات هذا الشهر', value: visitsMonth, tone: '' }
  ];
  const statsHTML = '<div class="grid grid-4 mb-3">' + stats.map((s) =>
    '<div class="card stat"><div class="stat-value">' + esc(s.value) + '</div>' +
    '<div class="stat-label">' + esc(s.label) + '</div></div>').join('') + '</div>';

  const actionsHTML = '<button class="btn btn-ghost btn-sm" data-act="exportAll">تصدير شامل</button>' +
    '<button class="btn btn-primary btn-sm" data-act="newMeeting">اجتماع جديد</button>';
  bind({
    exportAll: () => {
      if (typeof store.exportXlsx === 'function') {
        try { store.exportXlsx(); toast('تم تصدير البيانات', 'ok'); return; } catch (e) { /* fallback */ }
      }
      exportSheet(membersSheetRows(), 'الأعضاء', 'khadma-members-' + todayISO() + '.xlsx');
    },
    newMeeting: () => meetingModal(),
    addMember: () => memberModal(),
    newVisit: () => visitModal(),
    newMessage: () => composeModal(),
    goAttendance: (el) => { location.hash = '#/admin/attendance/' + encodeURIComponent(el.dataset.id || ''); }
  });

  const quick = '<div class="card mb-3"><div class="card-head"><h3 class="card-title">إجراءات سريعة</h3></div>' +
    '<div class="card-body row gap-2" style="flex-wrap:wrap">' +
    '<button class="btn btn-primary btn-sm" data-act="addMember">إضافة عضو</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="newMeeting">تسجيل اجتماع</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="newVisit">تسجيل افتقاد</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="newMessage">رسالة جديدة</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/admin/members">عرض الأعضاء</button>' +
    '</div></div>';

  const meetingRows = mt.slice(0, 5).map((m) => {
    const recs = attendanceFor(m.id);
    const present = recs.filter((a) => a.status === 'present').length;
    return '<tr class="t-row"><td><strong>' + esc(m.title || 'اجتماع') + '</strong></td>' +
      '<td>' + esc(fmtDate(m.date)) + '</td><td>' + esc(m.time || '—') + '</td>' +
      '<td>' + badge(present + ' / ' + ms.length, present > 0 ? 'green' : 'gray') + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" data-act="goAttendance" data-id="' + esc(m.id) + '">الحضور</button></td></tr>';
  });
  const meetingsCard = '<div class="card mb-3"><div class="card-head"><h3 class="card-title">آخر الاجتماعات</h3>' +
    '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/admin/meetings">عرض الكل</button></div>' +
    '<div class="card-body">' +
    (meetingRows.length ? tableHTML(['الاجتماع', 'التاريخ', 'الوقت', 'الحضور', 'إجراءات'], meetingRows) : empty('لا توجد اجتماعات بعد')) +
    '</div></div>';

  const birthdays = allMembers().map(nextBirthday).filter(Boolean).sort((a, b) => a.days - b.days).slice(0, 5);
  const birthdayHTML = birthdays.length
    ? '<div class="timeline">' + birthdays.map((b) =>
      '<div class="timeline-item"><div class="row gap-2" style="justify-content:space-between">' +
      '<div><strong>' + esc(b.member.name) + '</strong><div class="muted">' + esc(fmtDate(b.date)) + '</div></div>' +
      '<span class="badge badge-gold">' + (b.days === 0 ? 'اليوم' : 'بعد ' + b.days + ' يوم') + '</span>' +
      '</div></div>').join('') + '</div>'
    : empty('لا توجد تواريخ ميلاد مسجلة');
  const birthdayCard = '<div class="card"><div class="card-head"><h3 class="card-title">أعياد الميلاد القادمة</h3></div>' +
    '<div class="card-body">' + birthdayHTML + '</div></div>';

  root.innerHTML = shell('', 'لوحة التحكم', 'نظرة سريعة على خدمة اجتماع بولس الرسول', actionsHTML,
    statsHTML + quick + meetingsCard + birthdayCard);
}

/* --------------------------------------------------------------------------
   الأعضاء
   -------------------------------------------------------------------------- */
function renderMembers(root) {
  const ms = byName(allMembers());
  const meetingCount = allMeetings().length;
  const att = allAttendance();

  const rows = ms.map((m) => {
    const present = att.filter((a) => a.memberId === m.id && a.status === 'present').length;
    const pct = meetingCount ? Math.round((present / meetingCount) * 100) : 0;
    const photo = m.photoURL
      ? '<img class="avatar" src="' + esc(m.photoURL) + '" alt="">'
      : '<span class="avatar">' + esc(String(m.name || '?').slice(0, 1)) + '</span>';
    const code = typeof utils.memberCodeOf === 'function' ? utils.memberCodeOf(m) : (m.memberCode || '');
    const searchBlob = [m.name, m.phone, m.address, m.notes, m.qrToken, code].join(' ').toLowerCase();
    return '<tr class="t-row" data-search="' + esc(searchBlob) + '" data-active="' + (m.active === false ? '0' : '1') + '">' +
      '<td><div class="row gap-2">' + photo + '<div><strong>' + esc(m.name || '—') + '</strong>' +
        (m.active === false ? '<div>' + badge('غير نشط', 'gray') + '</div>' : '') + '</div></div></td>' +
      '<td dir="ltr"><span class="member-code">' + esc(code) + '</span></td>' +
      '<td dir="ltr">' + esc(m.phone || '—') + '</td>' +
      '<td>' + esc(ageOf(m)) + '</td>' +
      '<td>' + esc(fmtDate(m.birthDate)) + '</td>' +
      '<td>' + esc(m.confessorName || '—') + '</td>' +
      '<td>' + badge(pct + '%', pct >= 75 ? 'green' : (pct >= 40 ? 'gold' : 'red')) + '</td>' +
      '<td><div class="row gap-1" style="flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" data-act="editMember" data-id="' + esc(m.id) + '">تعديل</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="qrMember" data-id="' + esc(m.id) + '">QR</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="cardMember" data-id="' + esc(m.id) + '">🪪 بطاقة</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="waMember" data-id="' + esc(m.id) + '">واتساب</button>' +
        '<button class="btn btn-danger btn-sm" data-act="deleteMember" data-id="' + esc(m.id) + '">حذف</button>' +
      '</div></td></tr>';
  });

  const toolbar = '<div class="toolbar mb-3">' +
    '<input class="input" id="memberSearch" data-act="input:searchMembers" placeholder="ابحث بالاسم أو الهاتف..." style="max-width:320px">' +
    '<select class="select" id="memberFilter" data-act="change:filterMembers" style="max-width:180px">' +
      '<option value="">كل الأعضاء</option><option value="active">النشطون</option><option value="inactive">غير النشطين</option>' +
    '</select>' +
    '<button class="btn btn-primary btn-sm" data-act="addMember">إضافة عضو</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="printCards">🖨️ طباعة البطاقات</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="exportMembers">تصدير Excel</button>' +
    '</div>';

  const content = toolbar + (rows.length ? tableHTML(
    ['الاسم', 'رقم العضو', 'الهاتف', 'العمر', 'تاريخ الميلاد', 'أب الاعتراف', 'الحضور', 'إجراءات'], rows)
    : empty('لا يوجد أعضاء. ابدأ بإضافة عضو جديد.'));

  root.innerHTML = shell('members', 'الأعضاء', 'إدارة بيانات الشباب ورموز الحضور',
    '<button class="btn btn-primary btn-sm" data-act="addMember">إضافة عضو</button>', content);

  const filterRows = () => {
    const q = val('memberSearch').toLowerCase();
    const f = val('memberFilter');
    document.querySelectorAll('.data-table tbody tr').forEach((tr) => {
      const okText = !q || String(tr.dataset.search || '').includes(q);
      const okActive = !f || (f === 'active' ? tr.dataset.active === '1' : tr.dataset.active === '0');
      const show = okText && okActive;
      tr.hidden = !show;
      tr.style.display = show ? '' : 'none';
    });
  };
  bind({
    'input:searchMembers': filterRows,
    'change:filterMembers': filterRows,
    addMember: () => memberModal(),
    editMember: (el) => { const m = allMembers().find((x) => x.id === el.dataset.id); if (m) memberModal(m); },
    deleteMember: async (el) => {
      const m = allMembers().find((x) => x.id === el.dataset.id);
      if (!m) return;
      const ok = await confirmBox('هل تريد حذف العضو «' + m.name + '» نهائيًا؟');
      if (!ok) return;
      try { await store.deleteMember(m.id); dropState('members', m.id); toast('تم حذف العضو', 'ok'); rerender(); }
      catch (e) { toast('تعذّر الحذف: ' + (e && e.message ? e.message : e), 'err'); }
    },
    qrMember: (el) => { const m = allMembers().find((x) => x.id === el.dataset.id); if (m) qrModal(m); },
    cardMember: (el) => {
      const m = allMembers().find((x) => x.id === el.dataset.id);
      if (m && m.qrToken) { location.hash = '#/card/' + encodeURIComponent(m.qrToken); }
      else toast('رمز البطاقة غير متاح لهذا العضو', 'err');
    },
    printCards: () => printCards(),
    waMember: (el) => {
      const m = allMembers().find((x) => x.id === el.dataset.id);
      if (!m) return;
      if (!m.phone) { toast('لا يوجد رقم هاتف لهذا العضو', 'err'); return; }
      const text = 'السلام عليكم ' + (m.name || '') + '، تحية طيبة من ' +
        (settingsOf().serviceName || 'خدمة اجتماع بولس الرسول');
      window.open(waLink(m.phone, text), '_blank', 'noopener,noreferrer');
    },
    exportMembers: () => exportSheet(membersSheetRows(ms), 'الأعضاء', 'khadma-members-' + todayISO() + '.xlsx')
  });
}

/* طباعة كل البطاقات دفعة واحدة — بطاقتان في كل سطر على A4 */
function printCards() {
  const ms = byName(allMembers());
  if (!ms.length) { toast('لا يوجد أعضاء لطباعة البطاقات', 'err'); return; }
  const st = settingsOf();
  const serviceName = st.serviceName || (config.APP && config.APP.name) || 'خدمة اجتماع بولس الرسول';
  const logoURL = new URL((config.APP && config.APP.logo) || 'assets/icon.png', location.href).href;
  const meeting = [st.serviceDay, st.serviceTime].filter(Boolean).join(' · ');

  const cards = ms.map((m) => {
    const code = typeof utils.memberCodeOf === 'function' ? utils.memberCodeOf(m) : (m.memberCode || '');
    const token = m.qrToken || m.id;
    const url = location.origin + location.pathname + '#/card/' + encodeURIComponent(token);
    const qr = typeof utils.qrDataURL === 'function' ? utils.qrDataURL(url, 320) : '';
    const photo = m.photoURL || m.photo;
    const initial = String(m.name || 'ع').trim().charAt(0);
    const who = photo
      ? '<img class="pc-photo" src="' + esc(photo) + '" alt="">'
      : '<div class="pc-photo pc-initial">' + esc(initial) + '</div>';
    return '<div class="pc">' +
      '<div class="pc-head"><div class="pc-brand"><img src="' + esc(logoURL) + '" alt=""><div><strong>' + esc(serviceName) + '</strong><span>بطاقة عضوية — خدمة الشباب</span></div></div>' +
      '<div class="pc-code"><span>رقم العضو</span><b dir="ltr">' + esc(code) + '</b></div></div>' +
      '<div class="pc-body">' + who +
      '<div class="pc-info"><span>الاسم</span><strong>' + esc(m.name || 'عضو الخدمة') + '</strong><small>' + esc(m.active === false ? 'عضو غير نشط' : 'عضو نشط') + '</small></div>' +
      '<div class="pc-qr">' + (qr ? '<img src="' + esc(qr) + '" alt="QR">' : '') + '</div></div>' +
      '<div class="pc-foot"><span>' + esc(meeting || 'حضور وغياب — خدمة الشباب') + '</span><span>امسح QR لفتح بطاقتك</span></div>' +
      '</div>';
  }).join('');

  const css = [
    '@page{size:A4 portrait;margin:10mm}',
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:Tajawal,Arial,sans-serif;background:#fff}',
    '.pages{display:grid;grid-template-columns:repeat(2,85.6mm);gap:6mm;justify-content:center}',
    '.pc{inline-size:85.6mm;block-size:54mm;padding:3mm;border:0.5mm solid #d6b494;border-radius:3mm;',
    'background:linear-gradient(135deg,#fffbf5,#f1ddc7);display:flex;flex-direction:column;overflow:hidden;',
    'page-break-inside:avoid;break-inside:avoid}',
    '.pc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm}',
    '.pc-brand{display:flex;align-items:center;gap:1.6mm;min-inline-size:0}',
    '.pc-brand img{inline-size:9mm;block-size:9mm;object-fit:contain}',
    '.pc-brand strong{display:block;font-size:3.2mm;color:#3d2c22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pc-brand span{display:block;font-size:2mm;color:#75614f}',
    '.pc-code{text-align:start;flex:0 0 auto}.pc-code span{display:block;font-size:1.8mm;color:#75614f}',
    '.pc-code b{font-size:3.8mm;color:#94583f;letter-spacing:.08em}',
    '.pc-body{flex:1;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:2.5mm;padding-block:1.5mm}',
    '.pc-photo{inline-size:17mm;block-size:17mm;border-radius:50%;object-fit:cover;border:.5mm solid #d6b494;background:#ead7c1}',
    '.pc-initial{display:grid;place-items:center;font-size:8mm;font-weight:800;color:#94583f}',
    '.pc-info{display:flex;flex-direction:column;min-inline-size:0}.pc-info span{font-size:2mm;color:#75614f}',
    '.pc-info strong{font-size:5mm;color:#3d2c22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pc-info small{font-size:2mm;color:#75614f}',
    '.pc-qr{inline-size:18mm;block-size:18mm;padding:1mm;background:#fff;border-radius:2mm;display:grid;place-items:center}',
    '.pc-qr img{inline-size:100%;block-size:100%}',
    '.pc-foot{display:flex;justify-content:space-between;gap:2mm;padding-block-start:1.4mm;border-block-start:.2mm dashed rgba(148,88,63,.35);font-size:1.9mm;color:#75614f}',
  ].join('');

  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقات الأعضاء</title><style>' + css + '</style></head><body><div class="pages">' + cards + '</div></body></html>';

  let iframe = document.getElementById('khadma-print-cards');
  if (iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = 'khadma-print-cards';
  iframe.style.cssText = 'position:fixed;inset-inline-start:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
  if (!doc) { toast('تعذّر فتح نافذة الطباعة', 'err'); iframe.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  const doPrint = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
    catch (_) { toast('تعذّر بدء الطباعة', 'err'); }
    setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 60000);
  };
  if (doc.readyState === 'complete') setTimeout(doPrint, 400);
  else iframe.onload = doPrint;
}

function qrMarkup(text, size) {
  const s = size || 220;
  try {
    if (typeof utils.qrSVG === 'function') return utils.qrSVG(text, s);
    if (typeof qrcode === 'function') {
      const qr = qrcode(0, 'M'); qr.addData(String(text)); qr.make();
      return qr.createSvgTag(4, 4);
    }
    if (typeof QRCode === 'function') {
      const qr = QRCode(0, 'M'); qr.addData(String(text)); qr.make();
      return qr.createSvgTag(4, 4);
    }
  } catch (_) { /* نعرض رسالة بديلة */ }
  return '<div class="muted">تعذّر إنشاء رمز QR</div>';
}

function qrModal(member) {
  const token = member.qrToken || member.id;
  const cardURL = location.href.split('#')[0] + '#/card/' + encodeURIComponent(token || '');
  const body = '<div class="center stack gap-2">' +
    '<h3 class="card-title">' + esc(member.name || 'العضو') + '</h3>' +
    '<div class="qr-box">' + qrMarkup(cardURL, 240) + '</div>' +
    '<div class="muted" dir="ltr">' + esc(token || '') + '</div>' +
    '<div class="muted">امسح الرمز أو افتح بطاقة العضو لحساب الحضور</div>' +
    '<a class="btn btn-ghost btn-sm" href="' + esc(cardURL) + '" target="_blank" rel="noopener">فتح البطاقة</a>' +
    '</div>';
  modal({ title: 'رمز QR للعضو', body, okText: 'إغلاق', size: 'sm', onOk: () => true });
}

function memberModal(member) {
  const m = member || {};
  const editing = !!m.id;
  const defaultCode = editing
    ? (typeof utils.memberCodeOf === 'function' ? utils.memberCodeOf(m) : (m.memberCode || ''))
    : '';
  let pendingPhoto = null;
  const body = '<div class="grid grid-2 gap-3">' +
    formRow('الاسم *', '<input class="input" id="fName" value="' + esc(m.name || '') + '" required>') +
    formRow('الهاتف *', '<input class="input" id="fPhone" dir="ltr" value="' + esc(m.phone || '') + '" required>') +
    formRow('رقم العضو', '<input class="input" id="fCode" dir="ltr" value="' + esc(defaultCode) + '">', 'يُطبع على البطاقة — اتركه فارغًا لتوليده تلقائيًا') +
    formRow('العمر', '<input class="input" id="fAge" type="number" min="1" max="120" value="' + esc(m.age || '') + '">') +
    formRow('تاريخ الميلاد', '<input class="input" id="fBirth" type="date" value="' + esc(m.birthDate || '') + '">') +
    formRow('اسم أب الاعتراف', '<input class="input" id="fConfessor" type="text" placeholder="اسم الأب" value="' + esc(m.confessorName || '') + '">') +
    formRow('الكلية', '<input class="input" id="fCollege" type="text" placeholder="مثال: ايوي" value="' + esc(m.college || '') + '">') +
    formRow('المستوى', '<input class="input" id="fLevel" type="text" placeholder="مثال: الكامل" value="' + esc(m.level || '') + '">') +
    formRow('العنوان', '<input class="input" id="fAddress" value="' + esc(m.address || '') + '">') +
    '</div>' +
    formRow('ملاحظات', '<textarea class="textarea" id="fNotes" rows="3">' + esc(m.notes || '') + '</textarea>') +
    formRow('الصورة الشخصية',
      '<div class="row gap-2" style="align-items:center">' +
        '<img id="photoPreview" class="avatar-lg" src="' + esc(m.photoURL || '') + '" alt="">' +
        '<input type="file" id="fPhoto" accept="image/*" data-act="change:photoChange">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="removePhoto">إزالة الصورة</button>' +
      '</div>', 'صورة JPG أو PNG حتى 5 ميجابايت') +
    '<label class="check"><input type="checkbox" id="fActive"' + (m.active === false ? '' : ' checked') + '> عضو نشط</label>';

  changeActions.photoChange = (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('حجم الصورة أكبر من 5 ميجابايت', 'err'); el.value = ''; return; }
    pendingPhoto = file;
    const reader = new FileReader();
    reader.onload = () => { const img = document.getElementById('photoPreview'); if (img) img.src = reader.result; };
    reader.readAsDataURL(file);
  };
  clickActions.removePhoto = () => {
    pendingPhoto = null;
    const input = document.getElementById('fPhoto'); if (input) input.value = '';
    const img = document.getElementById('photoPreview'); if (img) img.removeAttribute('src');
  };

  modal({
    title: editing ? 'تعديل بيانات العضو' : 'إضافة عضو جديد',
    body, okText: 'حفظ', size: 'lg',
    onOk: async () => {
      const name = val('fName'), phone = val('fPhone');
      if (!name) { toast('الاسم مطلوب', 'err'); return false; }
      if (!phone) { toast('رقم الهاتف مطلوب', 'err'); return false; }
      const ageRaw = val('fAge');
      let age = 0;
      if (ageRaw) {
        age = Number(ageRaw);
        if (isNaN(age) || age < 1 || age > 120) { toast('العمر غير صالح', 'err'); return false; }
      }
      const qrToken = m.qrToken || (typeof utils.token === 'function' ? utils.token(10) : uid());
      const payload = {
        name, phone: normalizePhone(phone), address: val('fAddress'), age,
        birthDate: val('fBirth'), confessorName: val('fConfessor'), college: val('fCollege'), level: val('fLevel'), notes: val('fNotes'),
        active: checked('fActive'), photoURL: m.photoURL || '',
        qrToken,
        memberCode: val('fCode').trim() || (typeof utils.memberCodeOf === 'function' ? utils.memberCodeOf({ qrToken }) : ''),
        joinedAt: m.joinedAt || nowISO()
      };
      if (editing) payload.id = m.id;
      if (m.uid) payload.uid = m.uid;
      try {
        const savedId = await store.saveMember(payload);
        const finalId = payload.id || savedId || uid();
        payload.id = finalId;
        if (pendingPhoto) {
          const url = await store.uploadPhoto(pendingPhoto, finalId);
          if (url) { payload.photoURL = url; await store.saveMember(payload); }
        }
        patchState('members', payload);
        toast(editing ? 'تم تعديل بيانات العضو' : 'تم إضافة العضو', 'ok');
        rerender();
      } catch (e) {
        toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err');
      }
      return true;
    }
  });
}

/* --------------------------------------------------------------------------
   الاجتماعات
   -------------------------------------------------------------------------- */
function renderMeetings(root) {
  const mt = byDateDesc(allMeetings());
  const membersCount = allMembers().length;
  const rows = mt.map((m) => {
    const recs = attendanceFor(m.id);
    const present = recs.filter((a) => a.status === 'present').length;
    return '<tr class="t-row">' +
      '<td><strong>' + esc(m.title || 'اجتماع') + '</strong>' +
        (m.description ? '<div class="muted">' + esc(String(m.description).slice(0, 80)) + '</div>' : '') + '</td>' +
      '<td>' + esc(fmtDate(m.date)) + '</td>' +
      '<td>' + esc(m.time || '—') + '</td>' +
      '<td>' + badge(present + ' / ' + membersCount, present ? 'green' : 'gray') + '</td>' +
      '<td><div class="row gap-1" style="flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" data-act="goAttendance" data-id="' + esc(m.id) + '">الحضور</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="exportMeeting" data-id="' + esc(m.id) + '">تصدير</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="editMeeting" data-id="' + esc(m.id) + '">تعديل</button>' +
        '<button class="btn btn-danger btn-sm" data-act="deleteMeeting" data-id="' + esc(m.id) + '">حذف</button>' +
      '</div></td></tr>';
  });

  const content = '<div class="toolbar mb-3">' +
    '<button class="btn btn-primary btn-sm" data-act="newMeeting">اجتماع جديد</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="exportMeetings">تصدير الاجتماعات</button>' +
    '</div>' + (rows.length ? tableHTML(['الاجتماع', 'التاريخ', 'الوقت', 'الحضور', 'إجراءات'], rows)
      : empty('لا توجد اجتماعات مسجلة بعد.'));

  root.innerHTML = shell('meetings', 'الاجتماعات', 'إنشاء الاجتماعات ومتابعة الحضور',
    '<button class="btn btn-primary btn-sm" data-act="newMeeting">اجتماع جديد</button>', content);

  bind({
    newMeeting: () => meetingModal(),
    editMeeting: (el) => { const m = allMeetings().find((x) => x.id === el.dataset.id); if (m) meetingModal(m); },
    goAttendance: (el) => { location.hash = '#/admin/attendance/' + encodeURIComponent(el.dataset.id || ''); },
    deleteMeeting: async (el) => {
      const m = allMeetings().find((x) => x.id === el.dataset.id);
      if (!m) return;
      const ok = await confirmBox('هل تريد حذف الاجتماع «' + (m.title || '') + '» وكل سجلات حضوره؟');
      if (!ok) return;
      try {
        await store.deleteMeeting(m.id);
        dropState('meetings', m.id);
        if (Array.isArray(store.state.attendance)) {
          store.state.attendance = store.state.attendance.filter((a) => a.meetingId !== m.id);
        }
        toast('تم حذف الاجتماع', 'ok'); rerender();
      } catch (e) { toast('تعذّر الحذف: ' + (e && e.message ? e.message : e), 'err'); }
    },
    exportMeeting: (el) => exportMeeting(el.dataset.id),
    exportMeetings: () => exportSheet(allMeetings().map((m) => ({
      'الاجتماع': m.title || '', 'التاريخ': m.date || '', 'الوقت': m.time || '', 'الوصف': m.description || ''
    })), 'الاجتماعات', 'khadma-meetings-' + todayISO() + '.xlsx')
  });
}

function exportMeeting(meetingId) {
  const m = allMeetings().find((x) => x.id === meetingId);
  if (!m) { toast('الاجتماع غير موجود', 'err'); return; }
  if (typeof store.exportMeetingXlsx === 'function') {
    try { store.exportMeetingXlsx(meetingId); toast('تم تصدير كشف الحضور', 'ok'); return; }
    catch (_) { /* نكمل بالتصدير المحلي */ }
  }
  const byId = new Map(allMembers().map((x) => [x.id, x]));
  const rows = attendanceFor(meetingId).map((a) => ({
    'العضو': byId.get(a.memberId) ? byId.get(a.memberId).name : a.memberId,
    'الهاتف': byId.get(a.memberId) ? byId.get(a.memberId).phone : '',
    'الحالة': a.status === 'present' ? 'حاضر' : (a.status === 'excused' ? 'مذور' : 'غائب'),
    'ملاحظة': a.note || '', 'التاريخ': fmtDate(m.date)
  }));
  exportSheet(rows, 'حضور ' + String(m.title || 'اجتماع').slice(0, 25), 'khadma-attendance-' + meetingId + '.xlsx');
}

function meetingModal(meeting) {
  const m = meeting || {};
  const editing = !!m.id;
  const body =
    formRow('عنوان الاجتماع *', '<input class="input" id="mTitle" value="' + esc(m.title || '') + '">') +
    '<div class="grid grid-2 gap-3">' +
      formRow('التاريخ *', '<input class="input" id="mDate" type="date" value="' + esc(m.date || todayISO()) + '">') +
      formRow('الوقت', '<input class="input" id="mTime" type="time" value="' + esc(m.time || settingsOf().serviceTime || '') + '">') +
    '</div>' +
    formRow('الوصف', '<textarea class="textarea" id="mDesc" rows="4">' + esc(m.description || '') + '</textarea>');
  modal({
    title: editing ? 'تعديل الاجتماع' : 'اجتماع جديد', body, okText: 'حفظ', size: 'md',
    onOk: async () => {
      const title = val('mTitle'), date = val('mDate');
      if (!title) { toast('عنوان الاجتماع مطلوب', 'err'); return false; }
      if (!date) { toast('تاريخ الاجتماع مطلوب', 'err'); return false; }
      const payload = { title, date, time: val('mTime'), description: val('mDesc') };
      if (editing) payload.id = m.id;
      else { payload.id = uid(); payload.createdAt = nowISO(); }
      try {
        await store.saveMeeting(payload);
        patchState('meetings', payload);
        toast(editing ? 'تم تعديل الاجتماع' : 'تم إنشاء الاجتماع', 'ok');
        rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
      return true;
    }
  });
}

/* --------------------------------------------------------------------------
   الحضور
   -------------------------------------------------------------------------- */
let scanState = { stream: null, raf: 0, active: false };

function stopScanner() {
  if (scanState.raf) { try { cancelAnimationFrame(scanState.raf); } catch (_) { /* تجاهل */ } }
  if (scanState.stream) {
    try { scanState.stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* تجاهل */ }
  }
  scanState = { stream: null, raf: 0, active: false };
  activeScanMeeting = '';
  const v = document.getElementById('scanVideo');
  if (v) { try { v.pause(); } catch (_) { /* تجاهل */ } v.srcObject = null; v.style.display = 'none'; }
  const r = document.getElementById('scanResult');
  if (r) r.textContent = '';
}
function findMemberByToken(raw) {
  const token = String(raw || '').trim();
  if (!token) return null;
  const list = allMembers();
  return list.find((m) => m.qrToken && m.qrToken === token) ||
    list.find((m) => m.id === token) ||
    list.find((m) => m.qrToken && token.indexOf(m.qrToken) >= 0) ||
    list.find((m) => m.qrToken && token.indexOf('/card/' + encodeURIComponent(m.qrToken)) >= 0) ||
    list.find((m) => m.qrToken && token.indexOf('/card/' + m.qrToken) >= 0) || null;
}
async function setAttendance(meetingId, memberId, status) {
  const existing = allAttendance().find((a) => a.meetingId === meetingId && a.memberId === memberId);
  const rec = {
    id: existing && existing.id ? existing.id : uid(),
    meetingId, memberId, status,
    note: existing ? (existing.note || '') : '',
    recordedAt: nowISO()
  };
  try {
    await store.saveAttendance(rec);
    patchState('attendance', rec);
    toast('تم تسجيل الحضور', 'ok');
  } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
  rerender();
}
async function startScanner(meetingId) {
  if (typeof jsQR !== 'function') {
    toast('مكتبة مسح QR غير متاحة، استخدم إدخال الرمز يدويًا', 'err'); return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('الكاميرا غير متاحة في هذا المتصفح، استخدم إدخال الرمز يدويًا', 'err'); return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('scanVideo');
    if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
    scanState.stream = stream;
    activeScanMeeting = meetingId;
    video.srcObject = stream;
    video.style.display = 'block';
    await video.play();
    const canvas = document.getElementById('scanCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    scanState.active = true;
    const resultEl = document.getElementById('scanResult');
    if (resultEl) resultEl.textContent = 'وجّه الكاميرا نحو رمز العضو...';
    const tick = () => {
      if (!scanState.active) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let code = null;
        try { code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' }); }
        catch (_) { /* نكمل المحاولة */ }
        if (code && code.data) { onScanResult(code.data, meetingId); return; }
      }
      scanState.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    toast('تعذّر تشغيل الكاميرا: ' + (err && err.message ? err.message : err) + ' — استخدم الإدخال اليدوي', 'err');
    stopScanner();
  }
}
function onScanResult(raw, meetingId) {
  stopScanner();
  const m = findMemberByToken(raw);
  if (!m) { toast('لم يتم العثور على عضو بهذا الرمز: ' + raw, 'err'); return; }
  setAttendance(meetingId, m.id, 'present');
}

function renderAttendance(root, meetingId) {
  const meeting = allMeetings().find((x) => x.id === meetingId);
  const headerActions = '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/admin/meetings">العودة للاجتماعات</button>' +
    (meeting ? '<button class="btn btn-ghost btn-sm" data-act="exportAtt" data-id="' + esc(meeting.id) + '">تصدير</button>' : '');

  if (!meeting) {
    root.innerHTML = shell('attendance', 'الحضور', 'الاجتماع غير موجود', headerActions,
      empty('لم يتم العثور على الاجتماع المطلوب.'));
    bind({});
    return;
  }

  const ms = byName(allMembers());
  const recs = attendanceFor(meeting.id);
  const byMember = new Map(recs.map((r) => [r.memberId, r]));
  const counts = { present: 0, absent: 0, excused: 0, none: 0 };
  ms.forEach((m) => {
    const st = byMember.get(m.id) && byMember.get(m.id).status;
    counts[st === 'present' || st === 'absent' || st === 'excused' ? st : 'none']++;
  });
  const total = ms.length || 1;
  const pPresent = Math.round((counts.present / total) * 100);
  const pAbsent = Math.round((counts.absent / total) * 100);
  const pExcused = Math.round((counts.excused / total) * 100);
  const pNone = Math.max(0, 100 - pPresent - pAbsent - pExcused);

  const bar = '<div class="card mb-3"><div class="card-head"><h3 class="card-title">نسب الحضور</h3></div>' +
    '<div class="card-body">' +
      '<div class="att-bar" style="display:flex;height:14px;border-radius:8px;overflow:hidden;background:#e9eef2">' +
        '<div style="width:' + pPresent + '%;background:#2e7d32" title="حاضر"></div>' +
        '<div style="width:' + pAbsent + '%;background:#c62828" title="غائب"></div>' +
        '<div style="width:' + pExcused + '%;background:#f9a825" title="مذور"></div>' +
        '<div style="width:' + pNone + '%;background:#b0bec5" title="لم يسجل"></div>' +
      '</div>' +
      '<div class="row gap-3 mt-2" style="flex-wrap:wrap">' +
        badge('حاضر: ' + counts.present + ' (' + pPresent + '%)', 'green') +
        badge('غائب: ' + counts.absent + ' (' + pAbsent + '%)', 'red') +
        badge('مذور: ' + counts.excused + ' (' + pExcused + '%)', 'gold') +
        badge('لم يسجل: ' + counts.none, 'gray') +
      '</div>' +
    '</div></div>';

  const cells = ms.map((m) => {
    const st = byMember.get(m.id) && byMember.get(m.id).status;
    const photo = m.photoURL
      ? '<img class="avatar" src="' + esc(m.photoURL) + '" alt="">'
      : '<span class="avatar">' + esc(String(m.name || '?').slice(0, 1)) + '</span>';
    const btn = (key, label, cls) => '<button class="btn btn-sm ' + (st === key ? cls : 'btn-ghost') + '" ' +
      'data-act="setAtt" data-id="' + esc(m.id) + '" data-status="' + key + '">' + label + '</button>';
    return '<div class="att-cell" data-search="' + esc([m.name, m.phone].join(' ').toLowerCase()) + '">' +
      '<div class="row gap-2">' + photo + '<div><strong>' + esc(m.name || '—') + '</strong>' +
      '<div class="muted" dir="ltr" style="font-size:.8em">' + esc(m.phone || '') + '</div></div></div>' +
      '<div class="row gap-1 mt-2" style="flex-wrap:wrap">' +
        btn('present', 'حاضر', 'att-present') +
        btn('absent', 'غائب', 'att-absent') +
        btn('excused', 'مذور', 'att-excused') +
      '</div></div>';
  }).join('');

  const toolbar = '<div class="toolbar mb-3">' +
    '<input class="input" id="attSearch" data-act="input:searchAtt" placeholder="ابحث عن عضو..." style="max-width:300px">' +
    '<button class="btn btn-primary btn-sm" data-act="markAll">تحديد الكل حاضر</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="exportAtt" data-id="' + esc(meeting.id) + '">تصدير الحضور</button>' +
    '</div>';

  const scan = '<div class="card mt-3"><div class="card-head"><h3 class="card-title">ماسح رمز QR</h3></div>' +
    '<div class="card-body scan-box">' +
      '<div class="row gap-2" style="flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" data-act="startScan">تشغيل الكاميرا</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="stopScan">إيقاف الكاميرا</button>' +
      '</div>' +
      '<video id="scanVideo" playsinline muted style="width:100%;max-height:260px;display:none;margin-top:10px"></video>' +
      '<canvas id="scanCanvas" hidden></canvas>' +
      '<div id="scanResult" class="muted mt-2"></div>' +
      '<div class="divider"></div>' +
      '<div><label class="field-label">إدخال الرمز يدويًا (بديل عن الكاميرا)</label>' +
      '<div class="row gap-2">' +
        '<input class="input" id="manualToken" dir="ltr" placeholder="ألصق رمز العضو هنا">' +
        '<button class="btn btn-primary btn-sm" data-act="manualToken">تسجيل الحضور</button>' +
      '</div></div>' +
    '</div></div>';

  const content = '<div class="card mb-3"><div class="card-body">' +
    '<h3 class="card-title">' + esc(meeting.title || 'اجتماع') + '</h3>' +
    '<div class="muted">' + esc(fmtDate(meeting.date)) + (meeting.time ? ' — ' + esc(meeting.time) : '') + '</div>' +
    (meeting.description ? '<div class="mt-2">' + esc(meeting.description) + '</div>' : '') +
    '</div></div>' + bar + toolbar +
    (ms.length ? '<div class="att-grid">' + cells + '</div>' : empty('لا يوجد أعضاء لتسجيل حضورهم.')) + scan;

  root.innerHTML = shell('attendance', 'الحضور', 'تسجيل حضور أعضاء الاجتماع', headerActions, content);

  bind({
    setAtt: (el) => setAttendance(meeting.id, el.dataset.id, el.dataset.status),
    markAll: async () => {
      const list = allMembers().map((m) => {
        const existing = allAttendance().find((a) => a.meetingId === meeting.id && a.memberId === m.id);
        return {
          id: existing && existing.id ? existing.id : uid(),
          meetingId: meeting.id, memberId: m.id, status: 'present',
          note: existing ? (existing.note || '') : '', recordedAt: nowISO()
        };
      }).filter((r) => {
        const cur = allAttendance().find((a) => a.meetingId === meeting.id && a.memberId === r.memberId);
        return !cur || cur.status !== 'present';
      });
      if (!list.length) { toast('جميع الأعضاء مسجلون كحاضرين بالفعل'); return; }
      try {
        await store.saveAttendanceBulk(list);
        list.forEach((r) => patchState('attendance', r));
        toast('تم تحديد الكل حاضر', 'ok'); rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
    },
    exportAtt: (el) => exportMeeting(el.dataset.id),
    startScan: () => startScanner(meeting.id),
    stopScan: () => { stopScanner(); toast('تم إيقاف الكاميرا'); },
    manualToken: () => {
      const m = findMemberByToken(val('manualToken'));
      if (!m) { toast('لم يتم العثور على عضو بهذا الرمز', 'err'); return; }
      setAttendance(meeting.id, m.id, 'present');
    },
    'input:searchAtt': () => {
      const q = val('attSearch').toLowerCase();
      document.querySelectorAll('.att-grid .att-cell').forEach((cell) => {
        const show = !q || String(cell.dataset.search || '').indexOf(q) >= 0;
        cell.hidden = !show;
        cell.style.display = show ? '' : 'none';
      });
    }
  });
}

/* --------------------------------------------------------------------------
   الافتقاد (زيارات / مكالمات / متابعة)
   -------------------------------------------------------------------------- */
let visitsView = 'list';
const VISIT_TYPES = { visit: 'زيارة', call: 'مكالمة', followup: 'متابعة' };
function visitTypeName(t) { return VISIT_TYPES[t] || t || '—'; }

function renderVisits(root) {
  const vs = byDateDesc(allVisits());
  const memberById = new Map(allMembers().map((m) => [m.id, m]));
  const tabs = '<div class="tabs mb-3">' +
    '<button class="tab' + (visitsView === 'list' ? ' tab-active' : '') + '" data-act="visitsView" data-view="list">القائمة</button>' +
    '<button class="tab' + (visitsView === 'timeline' ? ' tab-active' : '') + '" data-act="visitsView" data-view="timeline">الخط الزمني</button>' +
    '</div>';

  let content = tabs;
  if (!vs.length) {
    content += empty('لا توجد افتقادات مسجلة بعد.');
  } else if (visitsView === 'list') {
    const rows = vs.map((v) => {
      const member = memberById.get(v.memberId);
      return '<tr class="t-row" data-search="' + esc([member && member.name, v.notes, v.doneBy].join(' ').toLowerCase()) + '">' +
        '<td><strong>' + esc(member ? member.name : 'عضو محذوف') + '</strong></td>' +
        '<td>' + esc(fmtDate(v.date)) + '</td>' +
        '<td>' + badge(visitTypeName(v.type), v.type === 'visit' ? 'green' : (v.type === 'call' ? 'gold' : '')) + '</td>' +
        '<td>' + esc(String(v.notes || '').slice(0, 120)) + '</td>' +
        '<td>' + esc(v.doneBy || '—') + '</td>' +
        '<td><div class="row gap-1">' +
          '<button class="btn btn-ghost btn-sm" data-act="editVisit" data-id="' + esc(v.id) + '">تعديل</button>' +
          '<button class="btn btn-danger btn-sm" data-act="deleteVisit" data-id="' + esc(v.id) + '">حذف</button>' +
        '</div></td></tr>';
    });
    content += '<div class="toolbar mb-3"><input class="input" id="visitSearch" data-act="input:searchVisits" placeholder="ابحث في الافتقادات..." style="max-width:300px"></div>';
    content += tableHTML(['العضو', 'التاريخ', 'النوع', 'الملاحظات', 'قام به', 'إجراءات'], rows);
  } else {
    content += '<div class="timeline">' + vs.map((v) => {
      const member = memberById.get(v.memberId);
      return '<div class="timeline-item">' +
        '<div class="row gap-2" style="justify-content:space-between">' +
          '<strong>' + esc(member ? member.name : 'عضو محذوف') + '</strong>' +
          '<span class="muted">' + esc(fmtDate(v.date)) + '</span>' +
        '</div>' +
        '<div class="mt-1">' + badge(visitTypeName(v.type), v.type === 'visit' ? 'green' : '') + '</div>' +
        (v.notes ? '<div class="mt-1">' + esc(v.notes) + '</div>' : '') +
        '<div class="muted mt-1">قام به: ' + esc(v.doneBy || '—') + '</div>' +
        '<div class="row gap-1 mt-2">' +
          '<button class="btn btn-ghost btn-sm" data-act="editVisit" data-id="' + esc(v.id) + '">تعديل</button>' +
          '<button class="btn btn-danger btn-sm" data-act="deleteVisit" data-id="' + esc(v.id) + '">حذف</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  root.innerHTML = shell('visits', 'الافتقاد', 'زيارة ومتابعة الشباب',
    '<button class="btn btn-primary btn-sm" data-act="newVisit">تسجيل افتقاد</button>', content);

  bind({
    visitsView: (el) => { visitsView = el.dataset.view || 'list'; rerender(); },
    newVisit: () => visitModal(),
    editVisit: (el) => { const v = allVisits().find((x) => x.id === el.dataset.id); if (v) visitModal(v); },
    deleteVisit: async (el) => {
      const ok = await confirmBox('هل تريد حذف هذا الافتقاد؟');
      if (!ok) return;
      try { await store.deleteVisit(el.dataset.id); dropState('visits', el.dataset.id); toast('تم حذف الافتقاد', 'ok'); rerender(); }
      catch (e) { toast('تعذّر الحذف: ' + (e && e.message ? e.message : e), 'err'); }
    },
    'input:searchVisits': () => {
      const q = val('visitSearch').toLowerCase();
      document.querySelectorAll('.data-table tbody tr').forEach((tr) => {
        const show = !q || String(tr.dataset.search || '').indexOf(q) >= 0;
        tr.hidden = !show;
        tr.style.display = show ? '' : 'none';
      });
    }
  });
}

function visitModal(visit) {
  const v = visit || {};
  const editing = !!v.id;
  const options = byName(allMembers()).map((m) =>
    '<option value="' + esc(m.id) + '"' + (v.memberId === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('');
  const body =
    formRow('العضو *', '<select class="select" id="vMember"><option value="">اختر العضو</option>' + options + '</select>') +
    '<div class="grid grid-2 gap-3">' +
      formRow('التاريخ *', '<input class="input" id="vDate" type="date" value="' + esc(v.date || todayISO()) + '">') +
      formRow('النوع', '<select class="select" id="vType">' +
        Object.entries(VISIT_TYPES).map(([k, label]) =>
          '<option value="' + k + '"' + ((v.type || 'visit') === k ? ' selected' : '') + '>' + label + '</option>').join('') +
      '</select>') +
    '</div>' +
    formRow('الملاحظات', '<textarea class="textarea" id="vNotes" rows="4">' + esc(v.notes || '') + '</textarea>') +
    formRow('قام به', '<input class="input" id="vBy" value="' + esc(v.doneBy || currentEmail() || '') + '">');
  modal({
    title: editing ? 'تعديل الافتقاد' : 'تسجيل افتقاد جديد', body, okText: 'حفظ', size: 'md',
    onOk: async () => {
      const memberId = val('vMember'), date = val('vDate');
      if (!memberId) { toast('يرجى اختيار العضو', 'err'); return false; }
      if (!date) { toast('التاريخ مطلوب', 'err'); return false; }
      const payload = { memberId, date, type: val('vType') || 'visit', notes: val('vNotes'), doneBy: val('vBy') };
      if (editing) payload.id = v.id;
      else payload.id = uid();
      try {
        await store.saveVisit(payload);
        patchState('visits', payload);
        toast('تم حفظ الافتقاد', 'ok'); rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
      return true;
    }
  });
}

/* --------------------------------------------------------------------------
   الرسائل
   -------------------------------------------------------------------------- */
let messagesView = 'inbox';
function messageText(m) { return (m.title ? m.title + '\n\n' : '') + (m.body || ''); }
function messageRecipients(m) {
  return m.scope === 'group' || m.toAll ? allMembers().filter((x) => x.active !== false).length : 1;
}

async function broadcastWhatsApp(membersList, text, note) {
  const links = (membersList || []).filter((m) => m && m.phone).map((m) => ({
    name: m.name || 'عضو', url: waLink(m.phone, text)
  }));
  if (!links.length) { toast('لا توجد أرقام واتساب صالحة', 'err'); return; }
  const ok = await confirmBox('سيتم فتح ' + links.length + ' رابط واتساب. قد تحجب المتصفحات النوافذ المنبثقة؛ ' +
    'ستظهر قائمة بالروابط يمكن النقر عليها يدويًا بعد الإرسال. هل تريد المتابعة؟');
  if (!ok) return;
  for (const link of links) {
    try { window.open(link.url, '_blank', 'noopener,noreferrer'); }
    catch (_) { /* المتصفح قد يمنع النافذة */ }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  const fallback = '<p class="muted">' + esc(note || 'إذا لم تُفتح النوافذ تلقائيًا بسبب حجب المتصفح، انقر على الروابط أدناه:') + '</p>' +
    '<div class="stack gap-2">' + links.map((l) =>
      '<a class="btn btn-ghost btn-sm" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a>').join('') + '</div>';
  modal({ title: 'روابط واتساب', body: fallback, okText: 'إغلاق', size: 'md', onOk: () => true });
}

function renderMessages(root) {
  const all = [...allMessages()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const uid0 = currentUid();
  const inbox = all.filter((m) => m.scope !== 'group' && !m.toAll && uid0 && m.toMemberId === uid0);
  const sent = all.filter((m) => inbox.indexOf(m) < 0);
  const list = messagesView === 'inbox' ? inbox : sent;
  const memberById = new Map(allMembers().map((m) => [m.id, m]));

  const tabs = '<div class="tabs mb-3">' +
    '<button class="tab' + (messagesView === 'inbox' ? ' tab-active' : '') + '" data-act="msgView" data-view="inbox">الواردة (' + inbox.length + ')</button>' +
    '<button class="tab' + (messagesView === 'sent' ? ' tab-active' : '') + '" data-act="msgView" data-view="sent">المرسلة (' + sent.length + ')</button>' +
    '</div>';

  const items = list.map((m) => {
    const unread = !(Array.isArray(m.readBy) && m.readBy.includes(uid0));
    const member = m.toMemberId ? memberById.get(m.toMemberId) : null;
    const recipients = messageRecipients(m);
    const read = Array.isArray(m.readBy) ? m.readBy.length : 0;
    return '<div class="msg-item' + (unread ? ' unread' : '') + '">' +
      '<div class="msg-meta">' +
        '<strong>' + esc(m.title || 'رسالة') + '</strong> ' +
        badge(m.scope === 'group' ? 'رسالة جماعية' : 'رسالة فردية', m.scope === 'group' ? 'gold' : '') + ' ' +
        '<span class="muted">' + esc(fmtDateTime(m.createdAt)) + '</span>' +
      '</div>' +
      (member ? '<div class="muted mt-1">إلى: ' + esc(member.name) + '</div>' : '') +
      '<div class="msg-body mt-2">' + esc(m.body || '') + '</div>' +
      '<div class="msg-meta mt-2">' + badge('قرأها ' + read + ' من ' + recipients, read >= recipients && recipients > 0 ? 'green' : 'gray') + '</div>' +
      '<div class="row gap-2 mt-2" style="flex-wrap:wrap">' +
        (unread ? '<button class="btn btn-ghost btn-sm" data-act="readMsg" data-id="' + esc(m.id) + '">تحديد كمقروءة</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-act="waMsg" data-id="' + esc(m.id) + '">إرسال واتساب</button>' +
        '<button class="btn btn-danger btn-sm" data-act="deleteMsg" data-id="' + esc(m.id) + '">حذف</button>' +
      '</div></div>';
  }).join('');

  const content = tabs + '<div class="card"><div class="card-body">' +
    (items || '<div class="t-empty">' + esc(messagesView === 'inbox' ? 'لا توجد رسائل واردة' : 'لم ترسل أي رسالة بعد') + '</div>') +
    '</div></div>';

  root.innerHTML = shell('messages', 'الرسائل', 'إرسال الرسائل ومتابعة قراءتها',
    '<button class="btn btn-primary btn-sm" data-act="newMessage">رسالة جديدة</button>', content);

  bind({
    msgView: (el) => { messagesView = el.dataset.view || 'inbox'; rerender(); },
    newMessage: () => composeModal(),
    readMsg: async (el) => {
      try { await store.markMessageRead(el.dataset.id); toast('تم تحديد الرسالة كمقروءة', 'ok'); rerender(); }
      catch (e) { toast('تعذّر التحديث: ' + (e && e.message ? e.message : e), 'err'); }
    },
    deleteMsg: async (el) => {
      const ok = await confirmBox('هل تريد حذف هذه الرسالة؟');
      if (!ok) return;
      try { await store.deleteMessage(el.dataset.id); dropState('messages', el.dataset.id); toast('تم حذف الرسالة', 'ok'); rerender(); }
      catch (e) { toast('تعذّر الحذف: ' + (e && e.message ? e.message : e), 'err'); }
    },
    waMsg: (el) => {
      const m = allMessages().find((x) => x.id === el.dataset.id);
      if (!m) return;
      const text = messageText(m);
      if (m.scope === 'group' || m.toAll) {
        broadcastWhatsApp(allMembers().filter((x) => x.active !== false), text);
      } else {
        const member = m.toMemberId && allMembers().find((x) => x.id === m.toMemberId);
        if (!member || !member.phone) { toast('رقم العضو غير متاح', 'err'); return; }
        window.open(waLink(member.phone, text), '_blank', 'noopener,noreferrer');
      }
    }
  });
}

function composeModal() {
  let mode = 'direct';
  const members = byName(allMembers());
  const options = members.map((m) =>
    '<option value="' + esc(m.id) + '">' + esc(m.name) + (m.phone ? ' — ' + esc(m.phone) : '') + '</option>').join('');
  const checks = members.map((m) =>
    '<label class="check"><input type="checkbox" class="groupCheck" value="' + esc(m.id) + '" checked> ' + esc(m.name) + '</label>').join('');

  const body =
    '<div class="tabs mb-3" id="composeTabs">' +
      '<button type="button" class="tab tab-active" data-act="composeMode" data-mode="direct">رسالة فردية</button>' +
      '<button type="button" class="tab" data-act="composeMode" data-mode="group">رسالة جماعية</button>' +
    '</div>' +
    formRow('العنوان', '<input class="input" id="cTitle" placeholder="عنوان الرسالة">') +
    formRow('نص الرسالة *', '<textarea class="textarea" id="cBody" rows="5" placeholder="اكتب نص الرسالة هنا..."></textarea>') +
    '<div id="directPane">' +
      formRow('العضو', '<select class="select" id="cMember"><option value="">اختر العضو</option>' + options + '</select>') +
    '</div>' +
    '<div id="groupPane" hidden>' +
      '<div class="muted mb-2">اختر الأعضاء الذين سيستلمون الرسالة:</div>' +
      '<div class="row gap-2 mb-2">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="checkAll">تحديد الكل</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="uncheckAll">إلغاء التحديد</button>' +
      '</div>' +
      '<div class="grid grid-2" id="groupChecks">' + (checks || '<span class="muted">لا يوجد أعضاء</span>') + '</div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="row gap-2">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="composeWA">إرسال عبر واتساب الآن</button>' +
      '<span class="muted">سيتم فتح رابط لكل عضو مع قائمة روابط بديلة.</span>' +
    '</div>';

  const setMode = (next) => {
    mode = next;
    document.querySelectorAll('#composeTabs .tab').forEach((t) => {
      t.classList.toggle('tab-active', t.dataset.mode === mode);
    });
    const dp = document.getElementById('directPane'), gp = document.getElementById('groupPane');
    if (dp) dp.hidden = mode !== 'direct';
    if (gp) gp.hidden = mode !== 'group';
  };
  const selectedMembers = () => {
    if (mode === 'direct') {
      const m = allMembers().find((x) => x.id === val('cMember'));
      return m ? [m] : [];
    }
    return allMembers().filter((m) => {
      const box = Array.from(document.querySelectorAll('.groupCheck')).find((x) => x.value === m.id);
      return box && box.checked;
    });
  };

  clickActions.composeMode = (el) => setMode(el.dataset.mode || 'direct');
  clickActions.checkAll = () => document.querySelectorAll('.groupCheck').forEach((b) => { b.checked = true; });
  clickActions.uncheckAll = () => document.querySelectorAll('.groupCheck').forEach((b) => { b.checked = false; });
  clickActions.composeWA = () => {
    const text = messageText({ title: val('cTitle'), body: val('cBody') });
    if (!val('cBody')) { toast('اكتب نص الرسالة أولًا', 'err'); return; }
    const list = selectedMembers();
    if (!list.length) { toast('اختر عضوًا واحدًا على الأقل', 'err'); return; }
    broadcastWhatsApp(list, text);
  };

  modal({
    title: 'رسالة جديدة', body, okText: 'حفظ الرسالة', size: 'lg',
    onOk: async () => {
      const title = val('cTitle'), text = val('cBody');
      if (!text) { toast('نص الرسالة مطلوب', 'err'); return false; }
      if (mode === 'direct' && !val('cMember')) { toast('يرجى اختيار العضو', 'err'); return false; }
      if (mode === 'group' && !selectedMembers().length) { toast('اختر عضوًا واحدًا على الأقل', 'err'); return false; }
      const payload = {
        id: uid(), scope: mode, title, body: text,
        toMemberId: mode === 'direct' ? val('cMember') : null,
        toAll: mode === 'group',
        createdAt: nowISO(), readBy: []
      };
      try {
        await store.saveMessage(payload);
        patchState('messages', payload);
        toast('تم حفظ الرسالة', 'ok');
        rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
      return true;
    }
  });
}

/* --------------------------------------------------------------------------
   الإعدادات
   -------------------------------------------------------------------------- */
let adminHelpersPromise = null;
let adminHelpers = {};
let adminEmailsCache = [];

function loadAdminHelpers() {
  if (!adminHelpersPromise) {
    adminHelpersPromise = import('../backend-firebase.js')
      .then((mod) => ({
        getAdminEmails: mod.getAdminEmails || (mod.backend && mod.backend.getAdminEmails),
        setAdminEmails: mod.setAdminEmails || (mod.backend && mod.backend.setAdminEmails)
      }))
      .catch(() => ({}));
  }
  return adminHelpersPromise;
}
function getFBConfig() {
  try {
    const c = typeof config.getFirebaseConfig === 'function' ? config.getFirebaseConfig() : null;
    if (c && typeof c === 'object') return c;
  } catch (_) { /* fallback */ }
  return (config.FIREBASE && config.FIREBASE.config) || {};
}
function fbEnabledNow() {
  if (typeof config.FIREBASE === 'object' && config.FIREBASE) return !!config.FIREBASE.enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('khadma_firebase_enabled');
      if (raw !== null) return raw === 'true' || raw === '1';
    }
  } catch (_) { /* fallback */ }
  return false;
}
function renderAdminEmailsBox() {
  const box = document.getElementById('adminEmailsBox');
  if (!box) return;
  if (typeof adminHelpers.getAdminEmails !== 'function') {
    box.innerHTML = '<p class="muted">إدارة صلاحيات الأدمن تتم من لوحة Firebase أو من الوضع المحلي.</p>';
    return;
  }
  Promise.resolve(adminHelpers.getAdminEmails()).then((list) => {
    adminEmailsCache = Array.isArray(list) ? list.slice() : [];
    box.innerHTML = adminEmailsCache.length
      ? '<div class="stack gap-2">' + adminEmailsCache.map((email) =>
        '<div class="row gap-2" style="justify-content:space-between">' +
        '<span dir="ltr">' + esc(email) + '</span>' +
        '<button class="btn btn-danger btn-sm" data-act="removeAdminEmail" data-email="' + esc(email) + '">إزالة</button>' +
        '</div>').join('') + '</div>'
      : '<p class="muted">لا توجد رسائل بريد إضافية بصلاحية أدمن.</p>';
  }).catch(() => {
    box.innerHTML = '<p class="muted">تعذّر تحميل قائمة الأدمن.</p>';
  });
}

function settingsCard(title, body) {
  return '<div class="card mb-3"><div class="card-head"><h3 class="card-title">' + esc(title) + '</h3></div>' +
    '<div class="card-body">' + body + '</div></div>';
}

function serviceSettingsModal() {
  const s = settingsOf();
  const body = '<div class="grid grid-2 gap-3">' +
    formRow('اسم الخدمة', '<input class="input" id="sName" value="' + esc(s.serviceName || '') + '">') +
    formRow('يوم الاجتماع', '<input class="input" id="sDay" value="' + esc(s.serviceDay || '') + '" placeholder="مثال: الأحد">') +
    formRow('وقت الاجتماع', '<input class="input" id="sTime" value="' + esc(s.serviceTime || '') + '" placeholder="19:00">') +
    formRow('العنوان', '<input class="input" id="sAddress" value="' + esc(s.address || '') + '">') +
    '</div>' +
    formRow('رابط مجموعة واتساب', '<input class="input" id="sWhatsapp" dir="ltr" value="' + esc(s.whatsappGroup || '') + '" placeholder="https://chat.whatsapp.com/...">') +
    formRow('إعلان الخدمة', '<textarea class="textarea" id="sAnnouncement" rows="3">' + esc(s.announcement || '') + '</textarea>');
  modal({
    title: 'تعديل بيانات الخدمة', body, okText: 'حفظ', size: 'lg',
    onOk: async () => {
      const payload = {
        serviceName: val('sName'), serviceDay: val('sDay'), serviceTime: val('sTime'),
        address: val('sAddress'), whatsappGroup: val('sWhatsapp'), announcement: val('sAnnouncement'),
        updatedAt: nowISO()
      };
      try {
        await store.saveSettings(payload);
        if (store.state) store.state.settings = { ...settingsOf(), ...payload };
        toast('تم حفظ الإعدادات', 'ok'); rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
      return true;
    }
  });
}

function firebaseSettingsModal() {
  const fb = getFBConfig();
  const enabled = fbEnabledNow();
  const body = '<p class="muted mb-3">تنبيه: تغيير إعدادات Firebase أو التبديل بين الوضع المحلي والسحابي يتطلب إعادة تحميل الصفحة ليصبح ساريًا.</p>' +
    '<div class="grid grid-2 gap-3">' +
      formRow('API Key', '<input class="input" id="fbApiKey" dir="ltr" value="' + esc(fb.apiKey || '') + '">') +
      formRow('Auth Domain', '<input class="input" id="fbAuthDomain" dir="ltr" value="' + esc(fb.authDomain || '') + '">') +
      formRow('Project ID', '<input class="input" id="fbProjectId" dir="ltr" value="' + esc(fb.projectId || '') + '">') +
      formRow('Storage Bucket', '<input class="input" id="fbBucket" dir="ltr" value="' + esc(fb.storageBucket || '') + '">') +
      formRow('Messaging Sender ID', '<input class="input" id="fbSender" dir="ltr" value="' + esc(fb.messagingSenderId || '') + '">') +
      formRow('App ID', '<input class="input" id="fbAppId" dir="ltr" value="' + esc(fb.appId || '') + '">') +
    '</div>' +
    '<label class="check mt-2"><input type="checkbox" id="fbEnabled"' + (enabled ? ' checked' : '') + '> تفعيل الوضع السحابي (Firebase)</label>';
  modal({
    title: 'إعدادات Firebase', body, okText: 'حفظ', size: 'lg',
    onOk: async () => {
      const cfg = {
        apiKey: val('fbApiKey'), authDomain: val('fbAuthDomain'), projectId: val('fbProjectId'),
        storageBucket: val('fbBucket'), messagingSenderId: val('fbSender'), appId: val('fbAppId')
      };
      const wantEnabled = checked('fbEnabled');
      if (wantEnabled !== enabled) {
        const ok = await confirmBox('سيتم التبديل إلى ' + (wantEnabled ? 'الوضع السحابي' : 'الوضع المحلي') +
          '. يجب إعادة تحميل الصفحة بعد الحفظ. هل تريد المتابعة؟');
        if (!ok) return false;
      }
      try {
        if (typeof config.setFirebaseConfig === 'function') config.setFirebaseConfig(cfg);
        if (typeof config.setFirebaseEnabled === 'function') config.setFirebaseEnabled(wantEnabled);
        /* store يقرأ علم التفعيل بصيغة 1/0، ونضمن هنا تطابق القيمتين */
        try { localStorage.setItem('khadma.fb.enabled', wantEnabled ? '1' : '0'); } catch (_) { /* تجاهل */ }
        toast('تم حفظ إعدادات Firebase — يلزم إعادة تحميل الصفحة', 'ok');
        rerender();
      } catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
      return true;
    }
  });
}

function adminEmailsModal() {
  const body = '<p class="muted">رسائل البريد الإضافية التي تحصل على صلاحية الأدمن.</p>' +
    '<div class="row gap-2 mb-3">' +
      '<input class="input" id="newAdminEmail" dir="ltr" placeholder="admin@example.com" style="max-width:320px">' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="addAdminEmail">إضافة أدمن</button>' +
    '</div>' +
    '<div id="adminEmailsBox"><span class="muted">جارٍ التحميل...</span></div>';
  clickActions.addAdminEmail = async () => {
    const email = val('newAdminEmail');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('بريد إلكتروني غير صالح', 'err'); return; }
    if (adminEmailsCache.indexOf(email) >= 0) { toast('البريد مضاف بالفعل', 'err'); return; }
    if (typeof adminHelpers.setAdminEmails !== 'function') { toast('إدارة الأدمن غير متاحة حاليًا', 'err'); return; }
    adminEmailsCache.push(email);
    try { await adminHelpers.setAdminEmails(adminEmailsCache); toast('تمت إضافة الأدمن', 'ok'); renderAdminEmailsBox(); }
    catch (e) { adminEmailsCache.pop(); toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
  };
  clickActions.removeAdminEmail = async (el) => {
    if (typeof adminHelpers.setAdminEmails !== 'function') return;
    const ok = await confirmBox('إزالة صلاحية الأدمن عن ' + el.dataset.email + '؟');
    if (!ok) return;
    adminEmailsCache = adminEmailsCache.filter((x) => x !== el.dataset.email);
    try { await adminHelpers.setAdminEmails(adminEmailsCache); toast('تمت الإزالة', 'ok'); renderAdminEmailsBox(); }
    catch (e) { toast('تعذّر الحفظ: ' + (e && e.message ? e.message : e), 'err'); }
  };
  modal({ title: 'إدارة صلاحيات الأدمن', body, okText: 'إغلاق', size: 'md', onOk: () => true });
  loadAdminHelpers().then((h) => { adminHelpers = h; renderAdminEmailsBox(); });
}

function exportBackup() {
  const s = snap();
  const data = {
    version: 1, exportedAt: nowISO(),
    members: s.members || [], meetings: s.meetings || [], attendance: s.attendance || [],
    visits: s.visits || [], messages: s.messages || [], settings: settingsOf()
  };
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    'khadma-backup-' + todayISO() + '.json');
  toast('تم تصدير النسخة الاحتياطية', 'ok');
}
async function importBackup() {
  const input = document.getElementById('backupFile');
  const file = input && input.files && input.files[0];
  if (!file) { toast('اختر ملف JSON أولًا', 'err'); return; }
  const ok = await confirmBox('سيتم دمج بيانات الملف مع البيانات الحالية. هل تريد المتابعة؟');
  if (!ok) return;
  try {
    const data = JSON.parse(await file.text());
    const map = {
      members: 'saveMember', meetings: 'saveMeeting', attendance: 'saveAttendance',
      visits: 'saveVisit', messages: 'saveMessage'
    };
    for (const key of Object.keys(map)) {
      for (const rec of (Array.isArray(data[key]) ? data[key] : [])) {
        if (typeof store[map[key]] === 'function') {
          await store[map[key]](rec);
          patchState(key, rec);
        }
      }
    }
    if (data.settings && typeof store.saveSettings === 'function') {
      await store.saveSettings(data.settings);
      if (store.state) store.state.settings = data.settings;
    }
    toast('تم استيراد النسخة الاحتياطية', 'ok');
    rerender();
  } catch (e) { toast('تعذّر الاستيراد: ' + (e && e.message ? e.message : e), 'err'); }
}

function backupModal() {
  const resetFn = store.resetDemoData || store.resetDemo || store.resetDemoDataLocal ||
    (typeof store.resetData === 'function' ? store.resetData : null);
  const body = '<p class="muted">تصدير أو استيراد نسخة JSON من البيانات (للوضع المحلي). الاستيراد يدمج البيانات مع الموجودة.</p>' +
    '<div class="row gap-2 mb-3" style="flex-wrap:wrap">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="exportBackup">تصدير نسخة احتياطية</button>' +
      (typeof resetFn === 'function' ? '<button type="button" class="btn btn-danger btn-sm" data-act="resetDemo">إعادة بيانات التجربة</button>' : '') +
    '</div>' +
    formRow('ملف النسخة الاحتياطية', '<input type="file" id="backupFile" accept="application/json,.json">', 'اختر ملف JSON الذي تم تصديره مسبقًا');
  clickActions.exportBackup = exportBackup;
  clickActions.resetDemo = async () => {
    if (typeof resetFn !== 'function') return;
    const ok = await confirmBox('سيتم استبدال البيانات الحالية ببيانات التجربة. هل أنت متأكد؟');
    if (!ok) return;
    try { await resetFn(); toast('تمت إعادة بيانات التجربة', 'ok'); rerender(); }
    catch (e) { toast('تعذّر إعادة البيانات: ' + (e && e.message ? e.message : e), 'err'); }
  };
  modal({
    title: 'النسخة الاحتياطية', body, okText: 'استيراد', size: 'md',
    onOk: async () => { await importBackup(); return true; }
  });
}

function renderSettings(root) {
  const s = settingsOf();
  const fb = getFBConfig();
  const local = isLocalMode();

  const modeBody = '<div class="row gap-2">' + badge('وضع التشغيل: ' + (local ? 'محلي' : 'سحابي'), local ? 'green' : 'gold') +
    badge('المستخدم: ' + (currentEmail() || 'مدير الخدمة'), '') + '</div>' +
    '<button class="btn btn-ghost btn-sm mt-2" data-act="reloadPage">إعادة تحميل الصفحة</button>';

  const serviceBody = '<p class="muted">اسم الخدمة: ' + esc(s.serviceName || '—') + '<br>' +
    'يوم الاجتماع: ' + esc(s.serviceDay || '—') + ' — الوقت: ' + esc(s.serviceTime || '—') + '<br>' +
    'العنوان: ' + esc(s.address || '—') + '</p>' +
    (s.announcement ? '<div class="muted">' + esc(String(s.announcement).slice(0, 120)) + '</div>' : '') +
    '<button class="btn btn-primary btn-sm mt-2" data-act="editService">تعديل بيانات الخدمة</button>';

  const firebaseBody = '<p class="muted">المشروع: ' + esc(fb.projectId || 'غير مضبط') + '<br>' +
    'الحالة: ' + (fbEnabledNow() ? 'سحابي (Firebase)' : 'محلي') + '</p>' +
    '<button class="btn btn-ghost btn-sm" data-act="editFirebase">إعدادات Firebase</button>';

  const adminsBody = '<p class="muted">إضافة أو إزالة رسائل البريد الإدارية.</p>' +
    '<button class="btn btn-ghost btn-sm" data-act="manageAdmins">إدارة الأدمن</button>';

  const backupBody = '<p class="muted">تصدير واستيراد نسخة JSON وبيانات التجربة.</p>' +
    '<button class="btn btn-ghost btn-sm" data-act="openBackup">فتح النسخ الاحتياطي</button>';

  root.innerHTML = shell('settings', 'الإعدادات', 'إعدادات الخدمة وقاعدة البيانات والصلاحيات', '',
    settingsCard('وضع التشغيل', modeBody) + settingsCard('بيانات الخدمة', serviceBody) +
    settingsCard('إعدادات Firebase', firebaseBody) + settingsCard('صلاحيات الأدمن', adminsBody) +
    settingsCard('النسخ الاحتياطي', backupBody));

  bind({
    editService: () => serviceSettingsModal(),
    editFirebase: () => firebaseSettingsModal(),
    manageAdmins: () => adminEmailsModal(),
    openBackup: () => backupModal()
  });

  loadAdminHelpers().then((h) => { adminHelpers = h; });
}

