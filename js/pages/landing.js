// الصفحة الرئيسية — خدمة اجتماع بولس الرسول
import * as storeNS from '../store.js';
import * as uiNS from '../ui.js';
import * as cfgNS from '../config.js';

const store = storeNS.store || storeNS.default || storeNS;
const ui = uiNS.ui || uiNS.default || uiNS;
const APP = cfgNS.APP || (cfgNS.default && cfgNS.default.APP) || {};

let _unsub = null;

export function destroy() {
  if (typeof _unsub === 'function') {
    try { _unsub(); } catch (_) { /* ignore */ }
  }
  _unsub = null;
}

function esc(v) {
  if (typeof ui.esc === 'function') {
    try { return ui.esc(v == null ? '' : v); } catch (_) { /* fallback */ }
  }
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function readStats() {
  let s = null;
  try { if (typeof store.stats === 'function') s = store.stats(); } catch (_) { /* ignore */ }
  if (!s || typeof s !== 'object') s = {};

  const st = store.state || {};
  const count = (key) => Array.isArray(st[key]) ? st[key].length : 0;
  const pick = (...keys) => {
    for (const k of keys) {
      const v = s[k];
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return null;
  };

  return {
    members: pick('members', 'memberCount', 'totalMembers') ?? count('members'),
    meetings: pick('meetings', 'meetingCount', 'totalMeetings') ?? count('meetings'),
    visits: pick('visits', 'visitCount', 'totalVisits') ?? count('visits'),
    messages: pick('messages', 'messageCount', 'totalMessages') ?? count('messages'),
  };
}

const FEATURES = [
  { icon: '🗓️', title: 'حضور وغياب', text: 'تسجيل حضور الأعضاء في كل اجتماع، ومتابعة الغياب والأعذار بدقة.' },
  { icon: '🔳', title: 'QR خاص', text: 'بطاقة رقمية لكل عضو يُقرأ رمزها بالكاميرا في ثوانٍ دون بحث.' },
  { icon: '💬', title: 'رسائل وافتقاد', text: 'إرسال الرسائل للأعضاء وتسجيل الزيارات والمكالمات والمتابعة.' },
  { icon: '📊', title: 'إكسيل', text: 'تصدير الأعضاء والاجتماعات والحضور إلى ملفات Excel بضغطة زر.' },
];

function statsHTML() {
  const s = readStats();
  const items = [
    { value: s.members, label: 'عضو مسجّل' },
    { value: s.meetings, label: 'اجتماع' },
    { value: s.visits, label: 'زيارة افتقاد' },
    { value: s.messages, label: 'رسالة أُرسلت' },
  ];
  return items.map((it) => `
    <div class="card stat">
      <div class="stat-value">${esc(it.value)}</div>
      <div class="stat-label">${esc(it.label)}</div>
    </div>`).join('');
}

export function render(root, params) {
  destroy();
  if (!root) return;

  const name = APP.name || 'خدمة اجتماع بولس الرسول';
  const tagline = APP.tagline || 'خدمة تجمع القلوب على محبة المسيح وخدمته';
  const logo = APP.logo || 'assets/icon.png';

  root.innerHTML = `
    <div class="page landing" dir="rtl">
      <section class="hero">
        <div class="hero-card glass">
          <img class="brand-mark logo-img" src="${esc(logo)}" alt="شعار الخدمة" onerror="this.style.display='none'">
          <h1 class="page-title">${esc(name)}</h1>
          <p class="tagline">${esc(tagline)}</p>
          <div class="row center gap-2 mt-3">
            <a class="btn btn-primary" href="#/register">سجّل نفسك</a>
            <a class="btn btn-ghost" href="#/login">دخول الأدمن</a>
          </div>
          <p class="muted center mt-3">انضم إلى الخدمة وتابع حضورك ورسائلك وكل ما يخصك في مكان واحد.</p>
        </div>
      </section>

      <section class="section mt-4">
        <h2 class="section-title center">أرقامنا بالأرقام</h2>
        <div class="grid grid-4 mt-2" id="landingStats">${statsHTML()}</div>
      </section>

      <section class="section mt-4">
        <h2 class="section-title center">ماذا توفّر الخدمة؟</h2>
        <div class="grid grid-4 mt-2">
          ${FEATURES.map((f) => `
            <div class="card feature-card">
              <div class="card-body center">
                <div class="feature-icon" aria-hidden="true">${esc(f.icon)}</div>
                <h3 class="card-title">${esc(f.title)}</h3>
                <p class="muted">${esc(f.text)}</p>
              </div>
            </div>`).join('')}
        </div>
      </section>

      <section class="section mt-4">
        <div class="card glass">
          <div class="card-body center">
            <h2 class="card-title">ابدأ الآن</h2>
            <p class="muted">التسجيل بسيط وسريع، وستحصل على بطاقتك الرقمية فورًا.</p>
            <a class="btn btn-primary mt-2" href="#/register">سجّل نفسك الآن</a>
          </div>
        </div>
      </section>

      <footer class="footer mt-4 center">
        <div>© ${new Date().getFullYear()} ${esc(name)} — جميع الحقوق محفوظة.</div>
        <div class="muted">بُنيت بخدمة ومحبة ✝️</div>
      </footer>
    </div>`;

  const statsEl = root.querySelector('#landingStats');
  const paintStats = () => {
    if (statsEl && statsEl.isConnected) statsEl.innerHTML = statsHTML();
  };

  if (typeof store.subscribe === 'function') {
    try { _unsub = store.subscribe(paintStats) || null; } catch (_) { _unsub = null; }
  }
}
