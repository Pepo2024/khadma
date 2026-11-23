// تسجيل عضو جديد (عامة)
import * as storeNS from '../store.js';
import * as uiNS from '../ui.js';
import * as utilsNS from '../utils.js';
import * as cfgNS from '../config.js';

const store = storeNS.store || storeNS.default || storeNS;
const ui = uiNS.ui || uiNS.default || uiNS;
const U = utilsNS.utils || utilsNS.default || utilsNS;
const APP = cfgNS.APP || (cfgNS.default && cfgNS.default.APP) || {};

let _root = null;
let _previewURL = null;

export function destroy() {
  if (_root) {
    if (_onSubmit) _root.removeEventListener('submit', _onSubmit);
    if (_onChange) _root.removeEventListener('change', _onChange);
  }
  _root = null;
  _onSubmit = null;
  _onChange = null;
  _previewURL = null;
}

let _onSubmit = null;
let _onChange = null;

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

function row(label, control, hint) {
  if (typeof ui.formRow === 'function') {
    try {
      const html = ui.formRow(label, control, hint);
      if (typeof html === 'string' && html) return html;
    } catch (_) { /* fallback below */ }
  }
  return `
    <div class="field">
      <label class="field-label">${esc(label)}</label>
      ${control || ''}
      ${hint ? `<div class="muted">${esc(hint)}</div>` : ''}
    </div>`;
}

function calcAge(birthDate) {
  if (!birthDate) return '';
  if (typeof U.age === 'function') {
    try {
      const a = U.age(birthDate);
      if (a !== null && a !== undefined && !isNaN(Number(a))) return Number(a);
    } catch (_) { /* fallback below */ }
  }
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : '';
}

function normalizeEgyptPhone(raw) {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  const code = String((APP && APP.countryCode) || '20');
  if (digits.startsWith(code) && digits.length === code.length + 10) {
    digits = '0' + digits.slice(code.length);
  }
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits;
  if (!/^01[0-9]{9}$/.test(digits)) return null;
  return digits;
}

function qrFor(token) {
  const hash = '#/card/' + encodeURIComponent(token || 'khadma');
  const full = (location.origin || '') + (location.pathname || '') + hash;
  if (typeof U.qrSVG === 'function') {
    try {
      const svg = U.qrSVG(full, 180);
      if (svg) return String(svg);
    } catch (_) { /* fallback below */ }
  }
  return '<div class="qr-box muted">تعذّر توليد رمز QR</div>';
}

function successScreen(member, name) {
  let found = member && typeof member === 'object' ? member : null;
  const uidVal = found && (found.uid || found.id || (found.user && found.user.uid));

  if (!found || !found.qrToken) {
    const list = (store.state && store.state.members) || [];
    const match = list.find((m) => (
      uidVal && (m.uid === uidVal || m.id === uidVal || m.userUid === uidVal)
    )) || (name && list.find((m) => m.name === name && m.email === found?.email));
    if (match) found = match;
  }

  const token = found && found.qrToken ? String(found.qrToken) : '';

  _root.innerHTML = `
    <div class="page register-page" dir="rtl">
      <div class="grid grid-2 register-grid">
        <div class="card glass register-success">
          <div class="card-body center">
            <div class="success-icon" aria-hidden="true">✅</div>
            <h1 class="page-title">تم تسجيلك بنجاح</h1>
            <p class="tagline">أهلًا بك في الخدمة${name ? '، ' + esc(name) : ''}!</p>
            <div class="divider"></div>
            <p class="muted">هذه بطاقتك الرقمية، احتفظ بها لاستخدامها في تسجيل الحضور.</p>
            <div class="qr-box mt-2">${qrFor(token)}</div>
            <p class="muted mt-2">يمكنك الدخول إلى حسابك لمتابعة حضورك ورسائلك.</p>
            <a class="btn btn-primary btn-block mt-2" href="#/app">الذهاب إلى حسابي</a>
            <a class="btn btn-ghost btn-block mt-2" href="#/">العودة للرئيسية</a>
          </div>
        </div>
        <div class="card register-tips">
          <div class="card-body">
            <h2 class="card-title">خطواتك التالية</h2>
            <ol class="stack gap-2 mt-2">
              <li>ادخل إلى حسابك من الزر المجاور.</li>
              <li>تعرّف على ملفك الشخصي وتأكد من بياناتك.</li>
              <li>استخدم رمز QR عند حضور الاجتماعات.</li>
              <li>تابع رسائلك وزيارات الخدمة من لوحة الشخصية.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>`;
}

export function render(root, params) {
  destroy();
  if (!root) return;
  _root = root;

  root.innerHTML = `
    <div class="page register-page" dir="rtl">
      <div class="card register-card">
        <div class="card-body">
          <form id="registerForm" novalidate>
            <div class="grid grid-2">
              ${row('الاسم', '<input class="input" id="regName" name="name" type="text" autocomplete="name" placeholder="الاسم الكامل" required>', 'مطلوب')}
              ${row('رقم الهاتف', '<input class="input" id="regPhone" name="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx" required>', 'رقم مصري صحيح: 01xxxxxxxxx')}
              ${row('العنوان', '<input class="input" id="regAddress" name="address" type="text" autocomplete="street-address" placeholder="العنوان" required>', 'مطلوب')}
              ${row('العمر', '<input class="input" id="regAge" name="age" type="number" min="1" max="120" readonly placeholder="يُحسب تلقائيًا">', 'يُحسب تلقائيًا من تاريخ الميلاد')}
              ${row('تاريخ الميلاد', '<input class="input" id="regBirth" name="birthDate" type="date" required>', 'مطلوب')}
              ${row('اسم أب الاعتراف', '<input class="input" id="regConfessor" name="confessorName" type="text" placeholder="اسم الأب" required>', 'مطلوب')}
              ${row('الكلية', '<input class="input" id="regCollege" name="college" type="text" placeholder="مثال: ايوي">')}
              ${row('المستوى', '<input class="input" id="regLevel" name="level" type="text" placeholder="مثال: الكامل">')}
              ${row('البريد الإلكتروني', '<input class="input" id="regEmail" name="email" type="email" dir="ltr" autocomplete="email" placeholder="name@example.com" required>', 'مطلوب')}
              ${row('كلمة المرور', '<input class="input" id="regPass" name="password" type="password" dir="ltr" autocomplete="new-password" placeholder="••••••••" required>', '6 أحرف على الأقل')}
              ${row('تأكيد كلمة المرور', '<input class="input" id="regPass2" name="confirm" type="password" dir="ltr" autocomplete="new-password" placeholder="••••••••" required>', 'أعد كتابة كلمة المرور')}
            </div>

            <div class="field mt-3">
              <label class="field-label" for="regPhoto">صورة شخصية (اختياري)</label>
              <div class="row gap-3 photo-row">
                <div class="avatar avatar-lg" id="photoPreview" aria-label="معاينة الصورة">👤</div>
                <div class="stack gap-1">
                  <input class="input" id="regPhoto" name="photo" type="file" accept="image/*">
                  <div class="muted">بحد أقصى صورة من جهازك، ستظهر في بطاقتك الشخصية.</div>
                </div>
              </div>
            </div>

            <label class="check mt-3">
              <input type="checkbox" id="regAgree" required>
              <span>أقر بأن البيانات صحيحة وأوافق على استخدامها في الخدمة.</span>
            </label>

            <button type="submit" class="btn btn-primary btn-block mt-3" id="regSubmit">إنشاء الحساب</button>
            <p class="center mt-2"><a href="#/login" class="muted">لديك حساب بالفعل؟ سجّل الدخول</a></p>
          </form>
        </div>
      </div>
    </div>`;

  const $ = (id) => root.querySelector('#' + id);
  const birthEl = $('regBirth');
  const ageEl = $('regAge');
  const photoEl = $('regPhoto');
  const previewEl = $('photoPreview');
  const submitEl = $('regSubmit');

  const updateAge = () => {
    if (!ageEl) return;
    const a = calcAge(birthEl ? birthEl.value : '');
    ageEl.value = a === '' ? '' : String(a);
  };
  updateAge();

  _onChange = (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'regBirth') updateAge();

    if (t.id === 'regPhoto' && t.files && t.files[0]) {
      const file = t.files[0];
      if (!/^image\//.test(file.type)) { toast('يرجى اختيار ملف صورة', 'err'); return; }
      try {
        const reader = new FileReader();
        reader.onload = () => {
          _previewURL = String(reader.result || '');
          if (previewEl) previewEl.innerHTML = `<img src="${esc(_previewURL)}" alt="معاينة الصورة">`;
        };
        reader.readAsDataURL(file);
      } catch (_) {
        toast('تعذر عرض معاينة الصورة', 'err');
      }
    }
  };

  _onSubmit = async (e) => {
    if (!e.target || e.target.id !== 'registerForm') return;
    e.preventDefault();

    const name = ($('regName')?.value || '').trim();
    const phoneRaw = ($('regPhone')?.value || '').trim();
    const address = ($('regAddress')?.value || '').trim();
    const birthDate = ($('regBirth')?.value || '').trim();
    const confessorName = ($('regConfessor')?.value || '').trim();
    const college = ($('regCollege')?.value || '').trim();
    const level = ($('regLevel')?.value || '').trim();
    const email = ($('regEmail')?.value || '').trim();
    const pass = $('regPass')?.value || '';
    const pass2 = $('regPass2')?.value || '';
    const agreed = !!$('regAgree')?.checked;
    const file = photoEl && photoEl.files && photoEl.files[0] ? photoEl.files[0] : null;

    const phone = normalizeEgyptPhone(phoneRaw);
    if (!name) { toast('يرجى إدخال الاسم', 'err'); return; }
    if (!phone) { toast('يرجى إدخال رقم هاتف مصري صحيح', 'err'); return; }
    if (!address) { toast('يرجى إدخال العنوان', 'err'); return; }
    if (!birthDate) { toast('يرجى اختيار تاريخ الميلاد', 'err'); return; }
    if (!confessorName) { toast('يرجى إدخال اسم أب الاعتراف', 'err'); return; }
    if (new Date(birthDate) > new Date()) { toast('تاريخ الميلاد لا يمكن أن يكون في المستقبل', 'err'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('يرجى إدخال بريد إلكتروني صحيح', 'err'); return; }
    if (!pass || pass.length < 6) { toast('كلمة المرور يجب ألا تقل عن 6 أحرف', 'err'); return; }
    if (pass !== pass2) { toast('تأكيد كلمة المرور غير مطابق', 'err'); return; }
    if (!agreed) { toast('يرجى الموافقة على استخدام البيانات', 'err'); return; }

    const age = calcAge(birthDate);
    const data = {
      name, phone, address, age, birthDate, confessorName, college, level, email, password: pass,
      photo: file || null,
      photoFile: file || null,
      // لا نمرّر المعاينة الخام (قد تتجاوز 1 ميجابايت وتفشل التسجيل)؛
      // الصورة تُضغط وتُحفظ بعد إنشاء الحساب.
      photoURL: '',
    };

    if (submitEl) { submitEl.disabled = true; submitEl.textContent = 'جارٍ إنشاء الحساب...'; }
    try {
      const result = await store.register(data);
      if (file) {
        try {
          await store.uploadPhoto(file, result && (result.uid || result.id));
        } catch (photoErr) {
          toast('تم التسجيل، لكن تعذّر حفظ الصورة. تقدر ترفعها من ملفك الشخصي', 'err');
        }
      }
      toast('تم التسجيل بنجاح 🎉', 'ok');
      successScreen(result, name);
    } catch (err) {
      toast((err && err.message) || 'تعذر إكمال التسجيل، حاول مرة أخرى', 'err');
      if (submitEl) { submitEl.disabled = false; submitEl.textContent = 'إنشاء الحساب'; }
    }
  };

  root.addEventListener('change', _onChange);
  root.addEventListener('submit', _onSubmit);
}
