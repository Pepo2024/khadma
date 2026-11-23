/**
 * إعدادات التطبيق العامّة وإعدادات الربط بـ Firebase.
 * الوضع الافتراضي الآن سحابي (Firebase) بإعدادات مشروع الكنيسة المدمجة.
 * يمكن تعديلها من لوحة الأدمن ← الإعدادات أو عبر localStorage.
 */

const CONFIG_KEY = 'khadma.fb.config';
const ENABLED_KEY = 'khadma.fb.enabled';

/** بيانات تعريف الخدمة وتفاصيلها العامة. */
export const APP = {
  name: 'خدمة اجتماع بولس الرسول',
  shortName: 'خدمة بولس',
  tagline: 'إدارة الأعضاء والحضور والافتقاد والرسائل — بكل يسر',
  countryCode: '20',
  logo: 'assets/icon.png',
};

/** إعدادات مشروع Firebase المدمجة — لا حاجة لإدخالها يدويًا. */
const DEFAULT_FB_CONFIG = {
  apiKey: 'AIzaSyBqHTALvxkIYc9mN2XEqPLvo5tRVHlbipE',
  authDomain: 'khadma-d8854.firebaseapp.com',
  projectId: 'khadma-d8854',
  storageBucket: 'khadma-d8854.firebasestorage.app',
  messagingSenderId: '208893575465',
  appId: '1:208893575465:web:413617f23213c4d4de3738',
  measurementId: 'G-6GJTX7X9KQ',
};

/**
 * كائن الإعدادات الحيّ. يتم تحديثه من localStorage عند تحميل الوحدة،
 * وتبقى خصائصه متزامنة مع الدوال setFirebaseConfig / setFirebaseEnabled.
 */
export const FIREBASE = {
  enabled: true,
  config: { ...DEFAULT_FB_CONFIG },
};

/* ------------------------------------------------------------------ */
/* مساعدات تخزين آمنة (قد لا يتوفر localStorage في بعض السياقات)      */
/* ------------------------------------------------------------------ */

function hasStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

function readRaw(key) {
  if (!hasStorage()) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function readObject(key) {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readFlag(key) {
  if (!hasStorage()) return false;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return false;
    return raw === 'true' || raw === '1';
  } catch {
    return false;
  }
}

function write(key, value) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* التخزين قد يكون ممتلئًا أو محظورًا؛ نكمل في الذاكرة */
  }
}

/* تهيئة الكائن من التخزين المحفوظ عند أول تحميل */
const storedEnabled = readRaw(ENABLED_KEY);
FIREBASE.config = { ...DEFAULT_FB_CONFIG, ...(readObject(CONFIG_KEY) || {}) };
FIREBASE.enabled = storedEnabled === null ? true : readFlag(ENABLED_KEY);
if (storedEnabled === null) write(ENABLED_KEY, '1');

/**
 * يُعيد إعدادات Firebase بعد دمج الإعداد المحفوظ فوق القيم الافتراضية.
 * @returns {{apiKey:string,authDomain:string,projectId:string,storageBucket:string,messagingSenderId:string,appId:string,measurementId?:string}}
 */
export function getFirebaseConfig() {
  const saved = readObject(CONFIG_KEY) || {};
  const clean = Object.fromEntries(
    Object.entries(saved).filter(([, value]) => typeof value === 'string' && value.trim())
  );
  return { ...DEFAULT_FB_CONFIG, ...FIREBASE.config, ...clean };
}

/**
 * يحفظ إعدادات Firebase في localStorage ويحدّث FIREBASE.config.
 * @param {object} cfg
 * @returns {object} الإعدادات المدمجة
 */
export function setFirebaseConfig(cfg) {
  const next = { ...DEFAULT_FB_CONFIG, ...(cfg || {}) };
  FIREBASE.config = next;
  write(CONFIG_KEY, JSON.stringify(next));
  return getFirebaseConfig();
}

/**
 * يفعّل أو يعطّل وضع Firebase ويحفظ القرار في localStorage.
 * @param {boolean} enabled
 * @returns {boolean} الحالة الجديدة
 */
export function setFirebaseEnabled(enabled) {
  FIREBASE.enabled = Boolean(enabled);
  // '1' / '0' لأن طبقة store تقرأ هذه القيمة مباشرةً من localStorage
  write(ENABLED_KEY, FIREBASE.enabled ? '1' : '0');
  return FIREBASE.enabled;
}
