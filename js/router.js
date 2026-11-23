// توجيه بسيط بالهاش — خدمة اجتماع بولس الرسول
import { store } from './store.js';
import { spin } from './ui.js';

let rootEl = null;
let current = null;
let tokenId = 0;

export function go(path) {
  const clean = `${path || '/'}`.replace(/^#/, '');
  if (location.hash === `#${clean}`) {
    handleRoute();
    return;
  }
  location.hash = `#${clean}`;
}

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathname, queryString = ''] = raw.split('?');
  const segments = pathname.split('/').filter(Boolean);
  const params = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((v, k) => { params[k] = v; });
  }
  return { pathname: `/${segments.join('/')}`, segments, params };
}

const PAGES = {
  // الصفحة اللي بتظهر أول ما البرنامج يفتح هي تسجيل الدخول
  '': 'login',
  welcome: 'landing',
  login: 'login',
  register: 'register',
  app: 'youth',
  card: 'card',
  admin: 'admin',
};

function pageName(segments) {
  return PAGES[segments[0] || ''] || 'landing';
}

function protectedRoute(segments) {
  return segments[0] === 'admin' || segments[0] === 'app';
}

async function handleRoute() {
  if (!rootEl) return;
  const { pathname, segments, params } = parse();
  const id = ++tokenId;

  if (protectedRoute(segments) && !store.state.ready) {
    rootEl.innerHTML = `<div class="center loading-page">${spin()}</div>`;
    const unsub = store.subscribe(() => {
      if (store.state.ready) { unsub(); handleRoute(); }
    });
    return;
  }
  if (segments[0] === 'admin' && !store.state.isAdmin) {
    if (!store.state.currentUser) { go('/login'); return; }
    // دور الأدمن قد يوصل من Firestore بعد الدخول بجزء من الثانية،
    // فبنستنى شوية قبل ما نرمي المستخدم على صفحة العضو.
    rootEl.innerHTML = `<div class="center loading-page">${spin()}</div>`;
    let settled = false;
    const unsub = store.subscribe(() => {
      if (!settled && store.state.isAdmin) {
        settled = true;
        unsub();
        if (tokenId === id) handleRoute();
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!settled) {
      settled = true;
      unsub();
      if (tokenId === id && !store.state.isAdmin) go('/app');
    }
    return;
  }
  if (segments[0] === 'app' && !store.state.currentUser) {
    go('/login');
    return;
  }
  // صفحة المزايا خاصة بالتطبيق والإدارة فقط — الزائر العادي يروح لتسجيل الدخول.
  if (segments[0] === 'welcome' && !store.state.currentUser) {
    go('/login');
    return;
  }

  try {
    if (current?.destroy) current.destroy();
    current = null;
    const name = pageName(segments);
    rootEl.innerHTML = `<div class="center loading-page">${spin()}</div>`;
    const mod = await import(`./pages/${name}.js`);
    if (id !== tokenId) return;
    if (typeof mod.destroy === 'function') current = { destroy: mod.destroy };
    rootEl.innerHTML = '';
    const result = mod.render(rootEl, segments.slice(1), params);
    if (result?.destroy) current = result;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const section = segments[0] === 'admin' ? 'الإدارة'
      : segments[0] === 'app' ? 'حسابي'
      : (segments[0] === 'login' || !segments[0]) ? 'تسجيل الدخول' : 'الرئيسية';
    document.title = `${store.state.settings?.serviceName || 'خدمة اجتماع بولس الرسول'} · ${section}`;
  } catch (error) {
    console.error('Route error', error);
    if (id !== tokenId) return;
    const detail = String(error?.message || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    rootEl.innerHTML = `<div class="center loading-page"><h2>تعذّر تحميل الصفحة</h2><p class="muted">${detail}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div>`;
  }
}

export function startRouter(root) {
  rootEl = root;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
