// صفحة تسجيل الدخول
import * as storeNS from '../store.js';
import * as uiNS from '../ui.js';

const store = storeNS.store || storeNS.default || storeNS;
const ui = uiNS.ui || uiNS.default || uiNS;

let _root = null;

export function destroy() {
  if (_root) {
    if (_onClick) _root.removeEventListener('click', _onClick);
    if (_onSubmit) _root.removeEventListener('submit', _onSubmit);
  }
  _root = null;
  _onClick = null;
  _onSubmit = null;
}

let _onClick = null;
let _onSubmit = null;

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

function navigate(hash) {
  const p = String(hash || '').startsWith('#') ? hash : '#' + hash;
  try { location.hash = p; } catch (_) { /* ignore */ }
}

function isCloudMode() {
  return !!(store.state && store.state.mode === 'firebase');
}

function msgOf(err, fallback) {
  return (err && (err.message || err.error?.message)) || fallback;
}

function isAdminNow(user, email) {
  const uid = user && (user.uid || user.id);
  const roles = (store.state && store.state.roles) || null;
  const role = roles && uid && roles[uid] && roles[uid].role;

  if (role) return role === 'admin';

  let flag = null;
  try { flag = store.isAdmin; } catch (_) { flag = null; }
  if (typeof flag === 'function') {
    try { flag = flag(); } catch (_) { flag = false; }
  }

  if (typeof flag === 'boolean') return flag;
  if (flag && typeof flag === 'object') return !!(flag.isAdmin || flag.role === 'admin');
  if (user) return !!(user.role === 'admin' || user.isAdmin === true);
  return String(email || '').toLowerCase() === 'admin@demo.local';
}

export function render(root, params) {
  destroy();
  if (!root) return;
  _root = root;

  root.innerHTML = `
    <div class="page login-page" dir="rtl">
      <div class="grid grid-2 login-grid">
        <div class="card glass login-intro">
          <div class="card-body center">
            <div class="brand"><img src="assets/icon.png" alt="شعار الخدمة"></div>
            <h1 class="page-title">مرحبًا بعودتك</h1>
            <p class="muted">سجّل دخولك لمتابعة حضورك ورسائلك وبيانات الخدمة.</p>
            <div class="divider"></div>
            <p class="tagline">«حيثما اجتمع اثنان أو ثلاثة باسمي، فهناك أكون في وسطهم»</p>
          </div>
        </div>

        <div class="card login-card">
          <div class="card-body">
            <h2 class="card-title">تسجيل الدخول</h2>
            <p class="muted">أدخل بريدك الإلكتروني وكلمة المرور للمتابعة.</p>

            <form id="loginForm" novalidate>
              <div class="field mt-3">
                <label class="field-label" for="loginEmail">البريد الإلكتروني</label>
                <input class="input" id="loginEmail" name="email" type="email" dir="ltr"
                       autocomplete="username" placeholder="name@example.com" required>
              </div>

              <div class="field mt-2">
                <label class="field-label" for="loginPass">كلمة المرور</label>
                <input class="input" id="loginPass" name="password" type="password" dir="ltr"
                       autocomplete="current-password" placeholder="••••••••" required>
              </div>

              <div class="row between center mt-2">
                <a href="#/register" class="muted">ليس لديك حساب؟ سجّل نفسك</a>
                <button type="button" class="btn btn-sm btn-ghost" data-action="forgot">نسيت كلمة المرور؟</button>
              </div>

              <button type="submit" class="btn btn-primary btn-block mt-3" id="loginSubmit">دخول</button>
            </form>

            ${isCloudMode()
              ? '<p class="muted mt-3">استخدم بريد الخدمة وكلمة المرور اللتين أنشأهما الأدمن.</p>'
              : `
            <div class="divider"></div>
            <div class="section-title">حسابات تجريبية</div>
            <p class="muted">اضغط لأ تعبئة الحقول تلقائيًا لتجربة الواجهة.</p>
            <div class="row gap-2 mt-2 wrap">
              <button type="button" class="btn btn-sm btn-ghost" data-demo="admin"
                      data-email="admin@demo.local" data-pass="Admin@123">دخول الأدمن</button>
              <button type="button" class="btn btn-sm btn-ghost" data-demo="member"
                      data-email="demo@demo.local" data-pass="Member@123">دخول عضو</button>
            </div>`}
          </div>
        </div>
      </div>
    </div>`;

  const form = root.querySelector('#loginForm');
  const emailEl = root.querySelector('#loginEmail');
  const passEl = root.querySelector('#loginPass');
  const submitEl = root.querySelector('#loginSubmit');

  const setLoading = (on) => {
    if (!submitEl) return;
    submitEl.disabled = !!on;
    submitEl.textContent = on ? 'جارٍ الدخول...' : 'دخول';
  };

  const submitReset = async (email) => {
    const value = String(email || '').trim();
    if (!value) { toast('أدخل بريدك الإلكتروني أولاً', 'err'); return; }
    try {
      await store.resetPassword(value);
      toast('تم إرسال رابط إعادة تعيين كلمة المرور', 'ok');
    } catch (err) {
      toast(msgOf(err, 'تعذر إرسال رابط الإعادة'), 'err');
    }
  };

  const forgot = () => {
    const current = emailEl ? emailEl.value.trim() : '';
    const body = `
      <div class="field">
        <label class="field-label" for="resetMail">البريد الإلكتروني</label>
        <input class="input" id="resetMail" type="email" dir="ltr"
               value="${esc(current)}" placeholder="name@example.com">
      </div>`;
    try {
      if (typeof ui.modal === 'function') {
        ui.modal({
          title: 'نسيت كلمة المرور؟',
          body,
          okText: 'إرسال الرابط',
          onOk: () => {
            const el = document.getElementById('resetMail');
            submitReset(el ? el.value : '');
          },
        });
        return;
      }
    } catch (_) { /* fallback below */ }
    submitReset(window.prompt('أدخل بريدك الإلكتروني:', current) || '');
  };

  _onSubmit = async (e) => {
    if (!e.target || e.target.id !== 'loginForm') return;
    e.preventDefault();
    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';

    if (!email || !pass) { toast('يرجى إدخال البريد وكلمة المرور', 'err'); return; }

    setLoading(true);
    try {
      const user = await store.login(email, pass);
      const admin = isAdminNow(user, email);
      toast('تم تسجيل الدخول بنجاح', 'ok');
      navigate(admin ? '#/admin' : '#/app');
    } catch (err) {
      toast(msgOf(err, 'البريد أو كلمة المرور غير صحيحة'), 'err');
    } finally {
      setLoading(false);
    }
  };

  _onClick = (e) => {
    const target = e.target;
    if (!target || !target.closest) return;

    const demo = target.closest('[data-demo]');
    if (demo) {
      if (emailEl) emailEl.value = demo.dataset.email || '';
      if (passEl) passEl.value = demo.dataset.pass || '';
      toast('تم تعبئة الحقول بالحساب التجريبي', 'ok');
      return;
    }

    if (target.closest('[data-action="forgot"]')) {
      e.preventDefault();
      forgot();
    }
  };

  root.addEventListener('submit', _onSubmit);
  root.addEventListener('click', _onClick);
}
