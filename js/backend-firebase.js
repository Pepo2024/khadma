/**
 * الواجهة السحابية (Firebase Modular SDK) لعقد backend.
 * يتم استيراد SDK ديناميكيًا من أسماء الـ import map في index.html:
 * firebase/app, firebase/auth, firebase/firestore, firebase/storage
 */

import { FIREBASE, getFirebaseConfig } from './config.js';
import { memberCodeOf, compressImage, readFileAsDataURL } from './utils.js';

const ADMIN_EMAILS_KEY = 'khadma.admin.emails';
const DEFAULT_ADMIN_EMAILS = ['admin@khadma.local'];
const COLLECTIONS = ['members', 'meetings', 'attendance', 'visits', 'messages'];
const REQUIRED_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId'];

/* ------------------------------------------------------------------ */
/* رسائل الخطأ العربية                                                  */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES = {
  // المصادقة
  'auth/invalid-email': 'البريد الإلكتروني غير صالح',
  'auth/user-disabled': 'تم تعطيل هذا الحساب، تواصل مع الإدارة',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
  'auth/wrong-password': 'كلمة المرور غير صحيحة',
  'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
  'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
  'auth/weak-password': 'كلمة المرور ضعيفة، استخدم 6 أحرف على الأقل',
  'auth/too-many-requests': 'محاولات كثيرة، حاول مرة أخرى لاحقًا',
  'auth/network-request-failed': 'تعذّر الاتصال بالشبكة، تحقق من الإنترنت',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد والكلمة غير مفعّل في إعدادات Firebase',
  'auth/missing-password': 'يرجى إدخال كلمة المرور',
  'auth/requires-recent-login': 'يرجى تسجيل الدخول مرة أخرى لإتمام العملية',
  // Firestore
  'permission-denied': 'ليست لديك صلاحية لتنفيذ هذا الإجراء',
  'unauthenticated': 'يجب تسجيل الدخول أولًا',
  'unavailable': 'الخدمة غير متاحة حاليًا، حاول لاحقًا',
  'not-found': 'البيانات المطلوبة غير موجودة',
  'already-exists': 'البيانات موجودة بالفعل',
  'invalid-argument': 'البيانات المدخلة غير صالحة',
  'failed-precondition': 'تعذّر إتمام العملية على البيانات الحالية',
  // Storage
  'storage/unauthorized': 'ليست لديك صلاحية لرفع الصورة',
  'storage/quota-exceeded': 'مساحة التخزين ممتلئة',
  'storage/invalid-format': 'صيغة الصورة غير مدعومة',
  'storage/canceled': 'تم إلغاء رفع الصورة',
  // التهيئة
  'app/invalid-credential': 'إعدادات Firebase غير صالحة، راجع بيانات المشروع',
};

/** يحوّل أي خطأ من Firebase إلى رسالة عربية واضحة مع الاحتفاظ بالكود الأصلي. */
export function arabicError(err) {
  const code = String((err && (err.code || err.name)) || '');
  const message = ERROR_MESSAGES[code] || 'حدث خطأ غير متوقع، حاول مرة أخرى';
  const error = new Error(message);
  error.code = code;
  error.original = err;
  return error;
}

/* ------------------------------------------------------------------ */
/* مساعدات                                                              */
/* ------------------------------------------------------------------ */

function uid() {
  const c = typeof crypto !== 'undefined' && crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function genQR() {
  return `KH-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function storageOK() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

function assertCollection(collection) {
  if (!COLLECTIONS.includes(collection) && collection !== 'settings') {
    throw new Error(`مجموعة بيانات غير معروفة: ${collection}`);
  }
}

/* ------------------------------------------------------------------ */
/* قائمة البريد الإداري (إضافة إلى دور roles/{uid})                     */
/* ------------------------------------------------------------------ */

function readAdminEmails() {
  if (!storageOK()) return [...DEFAULT_ADMIN_EMAILS];
  try {
    const raw = localStorage.getItem(ADMIN_EMAILS_KEY);
    if (raw == null) return [...DEFAULT_ADMIN_EMAILS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_ADMIN_EMAILS];
    return parsed
      .filter((x) => typeof x === 'string')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [...DEFAULT_ADMIN_EMAILS];
  }
}

/** يُعيد قائمة الصناديق الإدارية المحفوظة محليًا. */
export function getAdminEmails() {
  return readAdminEmails();
}

/** يحفظ قائمة الصناديق الإدارية ويحدّث حالة الأدمن فورًا. */
export function setAdminEmails(list) {
  adminEmails = Array.isArray(list)
    ? [...new Set(list.filter((x) => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean))]
    : [];
  if (storageOK()) {
    try {
      localStorage.setItem(ADMIN_EMAILS_KEY, JSON.stringify(adminEmails));
    } catch {
      /* تجاهل */
    }
  }
  ensureMembersListener();
  notify();
  return [...adminEmails];
}

/* ------------------------------------------------------------------ */
/* الحالة الداخلية                                                      */
/* ------------------------------------------------------------------ */

let api = null; // دوال Firebase المستوردة ديناميكيًا
let app = null;
let auth = null;
let firestore = null;
let storage = null;
let ready = false;
let initPromise = null;

let roleUnsub = null;
let roleIsAdmin = false;
let currentUser = null;
let adminEmails = readAdminEmails();

/* دور الأدمن بيوصل من Firestore بعد الدخول بجزء من الثانية.
   بنتابع لحظة وصوله عشان signIn ما يرجعش قبل ما الصلاحية تتحدد،
   فصفحة الدخول ما ترميش الأدمن على صفحة العضو بالغلط. */
let roleWatchUser = null;
let roleWatchDone = true;

const data = {
  members: [],
  meetings: [],
  attendance: [],
  visits: [],
  messages: [],
  settings: {},
};

const subscribers = new Set();
const listenerUnsubs = [];

let membersUnsub = null;
let membersIsFull = false;
let resolveMembersReady = null;

/**
 * الأعضاء بيانات خاصة: الأدمن يسمع المجموعة كاملة، والشاب يسمع مستند نفسه فقط،
 * تماشيًا مع قاعدة Firestore التي تسمح بقراءة المالك أو الأدمن فقط.
 */
function ensureMembersListener() {
  if (!firestore || !api) return;

  if (!currentUser) {
    if (membersUnsub) {
      membersUnsub();
      membersUnsub = null;
    }
    data.members = [];
    if (resolveMembersReady) {
      resolveMembersReady();
      resolveMembersReady = null;
    }
    notify();
    return;
  }

  const wantFull = isAdminNow();
  if (membersUnsub && membersIsFull === wantFull) return;
  if (membersUnsub) {
    membersUnsub();
    membersUnsub = null;
  }

  membersIsFull = wantFull;
  try {
    const base = api.collection(firestore, 'members');
    // الاستعلام المقيّد بمعرّف المستند مطلوب حتى تسمح القواعد بقراءة مستند الشاب نفسه.
    const source = wantFull
      ? base
      : api.query(base, api.where(api.documentId(), '==', currentUser.uid));
    membersUnsub = api.onSnapshot(
      source,
      (snap) => {
        data.members = snap.docs.map(docFromSnapshot);
        if (resolveMembersReady) {
          resolveMembersReady();
          resolveMembersReady = null;
        }
        notify();
      },
      (err) => {
        console.error('[khadma] خطأ في الاستماع للأعضاء:', arabicError(err));
        data.members = [];
        if (resolveMembersReady) {
          resolveMembersReady();
          resolveMembersReady = null;
        }
        notify();
      },
    );
    listenerUnsubs.push(membersUnsub);
  } catch (err) {
    console.error('[khadma] خطأ في الاستماع للأعضاء:', arabicError(err));
    if (resolveMembersReady) {
      resolveMembersReady();
      resolveMembersReady = null;
    }
  }
}

function isAdminNow() {
  if (!currentUser) return false;
  // في السحابة، مصدر الصلاحية الوحيد هو roles/{uid}؛ قائمة البريد المحلية
  // للعرض في الإعدادات فقط لأن قواعد Firestore لا تعترف بها.
  return roleIsAdmin;
}

function getSnapshot() {
  const user = currentUser
    ? {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        photoURL: currentUser.photoURL || '',
      }
    : null;

  const profile = user
    ? data.members.find((m) => m.id === user.uid || m.uid === user.uid) || null
    : null;

  return {
    members: clone(data.members),
    meetings: clone(data.meetings),
    attendance: clone(data.attendance),
    visits: clone(data.visits),
    messages: clone(data.messages),
    settings: { ...clone(data.settings), id: 'single' },
    currentUser: user,
    profile: profile ? clone(profile) : null,
    isAdmin: isAdminNow(),
    ready,
  };
}

function notify() {
  const snapshot = getSnapshot();
  subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('[khadma] خطأ في مستمع حالة Firebase:', err);
    }
  });
  return snapshot;
}

function ensureReady() {
  if (!FIREBASE.enabled) {
    throw new Error('وضع Firebase غير مفعّل. فعّله أولًا من إعدادات الربط');
  }
  if (!app || !auth || !firestore || !api) {
    throw new Error('لم يتم تهيئة الاتصال بـ Firebase بعد');
  }
}

function docFromSnapshot(snap) {
  return { id: snap.id, ...snap.data() };
}

/* ------------------------------------------------------------------ */
/* المستمعون المباشرون                                                  */
/* ------------------------------------------------------------------ */

function beginRoleWatch(user) {
  roleWatchUser = user || null;
  roleWatchDone = false;
}

function endRoleWatch() {
  roleWatchDone = true;
}

/** ينتظر حتى يتحدد دور المستخدم الحالي (أو تنتهي المهلة) قبل إكمال الدخول. */
async function waitForAdminDecision(maxMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (currentUser && roleWatchUser && roleWatchUser.uid === currentUser.uid && roleWatchDone) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

function attachAuth(firsts) {
  let resolveAuth = null;
  firsts.push(new Promise((resolve) => { resolveAuth = resolve; }));

  listenerUnsubs.push(
    api.onAuthStateChanged(
      auth,
      (user) => {
        const previousUid = currentUser && currentUser.uid;
        currentUser = user || null;
        roleIsAdmin = false;
        beginRoleWatch(currentUser);
        // ما نعرضش بيانات المستخدم السابق لمستخدم تاني على نفس الجهاز.
        if (!currentUser || (previousUid && previousUid !== currentUser.uid)) {
          data.meetings = [];
          data.attendance = [];
          data.visits = [];
          data.messages = [];
          data.settings = {};
        }

        if (roleUnsub) {
          roleUnsub();
          roleUnsub = null;
        }

        if (currentUser && firestore) {
          try {
            roleUnsub = api.onSnapshot(
              api.doc(firestore, 'roles', currentUser.uid),
              (roleSnap) => {
                roleIsAdmin = Boolean(roleSnap.exists() && roleSnap.data().role === 'admin');
                ensureMembersListener();
                notify();
                endRoleWatch();
              },
              () => {
                roleIsAdmin = false;
                ensureMembersListener();
                notify();
                endRoleWatch();
              },
            );
          } catch {
            roleIsAdmin = false;
            endRoleWatch();
          }
        } else {
          endRoleWatch();
        }

        ensureMembersListener();
        if (resolveAuth) {
          resolveAuth(currentUser);
          resolveAuth = null;
        }
        notify();
      },
      (err) => {
        console.error('[khadma] خطأ في حالة الدخول:', arabicError(err));
        currentUser = null;
        endRoleWatch();
        ensureMembersListener();
        if (resolveAuth) {
          resolveAuth(null);
          resolveAuth = null;
        }
        notify();
      },
    ),
  );
}

function attachCollectionListeners(firsts) {
  // الأعضاء يُدارون في ensureMembersListener بحسب صلاحية المستخدم.
  COLLECTIONS.filter((name) => name !== 'members').forEach((name) => {
    firsts.push(
      new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        try {
          const unsub = api.onSnapshot(
            api.collection(firestore, name),
            (snap) => {
              data[name] = snap.docs.map(docFromSnapshot);
              done();
              notify();
            },
            (err) => {
              console.error(`[khadma] خطأ في الاستماع لمجموعة ${name}:`, arabicError(err));
              done();
            },
          );
          listenerUnsubs.push(unsub);
        } catch (err) {
          console.error(`[khadma] خطأ في الاستماع لمجموعة ${name}:`, arabicError(err));
          done();
        }
      }),
    );
  });

  firsts.push(
    new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      try {
        const unsub = api.onSnapshot(
          api.doc(firestore, 'settings', 'single'),
          (snap) => {
            data.settings = snap.exists() ? docFromSnapshot(snap) : {};
            done();
            notify();
          },
          (err) => {
            console.error('[khadma] خطأ في الاستماع للإعدادات:', arabicError(err));
            done();
          },
        );
        listenerUnsubs.push(unsub);
      } catch (err) {
        console.error('[khadma] خطأ في الاستماع للإعدادات:', arabicError(err));
        done();
      }
    }),
  );
}

/* ------------------------------------------------------------------ */
/* التهيئة                                                              */
/* ------------------------------------------------------------------ */

async function initialize() {
  if (!FIREBASE.enabled) {
    // الوضع المحلي هو الافتراضي؛ لا نمنع تحميل التطبيق عند تعطيل Firebase.
    ready = false;
    notify();
    return getSnapshot();
  }

  const config = getFirebaseConfig();
  const missing = REQUIRED_CONFIG.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(
      `إعدادات Firebase غير مكتملة. يرجى إدخال: ${missing.join('، ')} من إعدادات مشروع Firebase.`,
    );
  }

  try {
    if (!api) {
      const [appMod, authMod, firestoreMod, storageMod] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
        import('firebase/storage'),
      ]);
      api = {
        initializeApp: appMod.initializeApp,
        getApps: appMod.getApps,
        getApp: appMod.getApp,

        getAuth: authMod.getAuth,
        onAuthStateChanged: authMod.onAuthStateChanged,
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
        signOut: authMod.signOut,
        sendPasswordResetEmail: authMod.sendPasswordResetEmail,
        updateProfile: authMod.updateProfile,

        getFirestore: firestoreMod.getFirestore,
        collection: firestoreMod.collection,
        doc: firestoreMod.doc,
        query: firestoreMod.query,
        where: firestoreMod.where,
        documentId: firestoreMod.documentId,
        setDoc: firestoreMod.setDoc,
        updateDoc: firestoreMod.updateDoc,
        arrayUnion: firestoreMod.arrayUnion,
        deleteDoc: firestoreMod.deleteDoc,
        onSnapshot: firestoreMod.onSnapshot,

        getStorage: storageMod.getStorage,
        ref: storageMod.ref,
        uploadBytes: storageMod.uploadBytes,
        getDownloadURL: storageMod.getDownloadURL,
      };
    }

    app = api.getApps().length ? api.getApp() : api.initializeApp(config);
    auth = api.getAuth(app);
    firestore = api.getFirestore(app);
    storage = api.getStorage(app);

    const firsts = [];
    const membersFirst = new Promise((resolve) => {
      resolveMembersReady = resolve;
    });
    firsts.push(membersFirst);
    attachAuth(firsts);
    attachCollectionListeners(firsts);
    await Promise.all(firsts);

    ready = true;
    notify();
    return getSnapshot();
  } catch (err) {
    throw arabicError(err);
  }
}

/* ------------------------------------------------------------------ */
/* الواجهة العامة                                                       */
/* ------------------------------------------------------------------ */

export const backend = {
  init() {
    if (initPromise) return initPromise;
    initPromise = initialize().catch((err) => {
      initPromise = null; // للسماح بإعادة المحاولة بعد تعديل الإعدادات
      throw err;
    });
    return initPromise;
  },

  isLocal() {
    return false;
  },

  getSnapshot,

  subscribe(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.add(cb);
    try {
      cb(getSnapshot());
    } catch {
      /* لا نمنع الاشتراك بسبب خطأ في المستمع */
    }
    return () => subscribers.delete(cb);
  },

  async signIn(email, password) {
    ensureReady();
    try {
      const cred = await api.signInWithEmailAndPassword(auth, email, password);
      // استنى وصول دور الأدمن من Firestore قبل ما الدخول يكمل،
      // عشان التوجيه يروح للوحة الإدارة مباشرة بدل صفحة العضو.
      await waitForAdminDecision();
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || '',
        photoURL: cred.user.photoURL || '',
      };
    } catch (err) {
      throw arabicError(err);
    }
  },

  async signUp(email, password, profile = {}) {
    ensureReady();
    const cleanEmail = String(email || '').trim().toLowerCase();
    try {
      const cred = await api.createUserWithEmailAndPassword(auth, cleanEmail, password);
      const memberId = cred.user.uid;
      const name = profile.name || cleanEmail.split('@')[0];
      const qrToken = profile.qrToken || genQR();
      const member = {
        id: memberId,
        uid: memberId,
        name,
        phone: profile.phone || '',
        address: profile.address || '',
        age: profile.age != null ? profile.age : 0,
        birthDate: profile.birthDate || '',
        confessorName: profile.confessorName || '',
        college: profile.college || '',
        level: profile.level || '',
        photoURL: profile.photoURL || '',
        qrToken,
        memberCode: profile.memberCode || memberCodeOf({ qrToken, uid: memberId }),
        joinedAt: nowISO(),
        active: profile.active !== false,
        notes: profile.notes || '',
      };

      await api.setDoc(api.doc(firestore, 'members', memberId), member);
      await api.setDoc(api.doc(firestore, 'roles', memberId), { role: 'member', email: cleanEmail });
      if (name) await api.updateProfile(cred.user, { displayName: name });

      // الدخول صريحًا بعد إنشاء المستندات كما هو مطلوب في العقد
      await api.signInWithEmailAndPassword(auth, cleanEmail, password);

      return {
        uid: memberId,
        email: cleanEmail,
        displayName: name,
        photoURL: '',
      };
    } catch (err) {
      throw arabicError(err);
    }
  },

  async signOut() {
    ensureReady();
    try {
      await api.signOut(auth);
      currentUser = null;
      roleIsAdmin = false;
      notify();
    } catch (err) {
      throw arabicError(err);
    }
  },

  async resetPassword(email) {
    ensureReady();
    try {
      await api.sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      throw arabicError(err);
    }
  },

  async save(collection, doc) {
    ensureReady();
    assertCollection(collection);
    const payload = doc && typeof doc === 'object' ? clone(doc) : {};

    try {
      if (collection === 'settings') {
        await api.setDoc(
          api.doc(firestore, 'settings', 'single'),
          { ...payload, id: 'single', updatedAt: payload.updatedAt || nowISO() },
          { merge: true },
        );
        return 'single';
      }

      const id = payload.id || payload.uid || uid();
      const next = { ...payload, id };
      if (collection === 'members' && !next.uid) next.uid = id;
      await api.setDoc(api.doc(firestore, collection, id), next, { merge: true });
      return id;
    } catch (err) {
      throw arabicError(err);
    }
  },

  async remove(collection, id) {
    ensureReady();
    assertCollection(collection);
    if (!id) throw new Error('معرف المستند مطلوب للحذف');
    try {
      await api.deleteDoc(api.doc(firestore, collection, id));
    } catch (err) {
      throw arabicError(err);
    }
  },

  /** إضافة قارئ واحد بدون ما نكتب كائن الرسالة كله (يمنع فقدان القرّاء). */
  async markMessageRead(id, readerUid) {
    ensureReady();
    if (!id || !readerUid) return;
    try {
      await api.updateDoc(api.doc(firestore, 'messages', id), {
        readBy: api.arrayUnion(String(readerUid)),
      });
    } catch (err) {
      throw arabicError(err);
    }
  },

  /**
   * يضغط الصورة ويحفظها داخل مستند العضو في Firestore كـ data URL.
   * لا يحتاج Firebase Storage نهائيًا، ويناسب حد 1 ميجابايت لمستند Firestore.
   */
  async uploadPhoto(file, memberId) {
    ensureReady();
    const targetUid = memberId || (currentUser && currentUser.uid);
    if (!targetUid) throw new Error('يجب تسجيل الدخول قبل رفع الصورة');
    if (!file) throw new Error('لم يتم اختيار صورة');

    try {
      const dataURL = typeof compressImage === 'function'
        ? await compressImage(file, 480, 0.75)
        : await readFileAsDataURL(file);
      if (typeof dataURL !== 'string' || !dataURL.startsWith('data:image/')) {
        throw new Error('صيغة الصورة غير مدعومة');
      }
      if (dataURL.length > 850000) {
        throw new Error('الصورة كبيرة جدًا، اختر صورة أصغر أو أقل تفاصيل');
      }
      return dataURL;
    } catch (err) {
      throw err && err.message ? err : arabicError(err);
    }
  },

  /** يكتب مستند دور الأدمن. القواعد تسمح بذلك للأدمن فقط. */
  async grantAdmin(uidToPromote, email = '') {
    ensureReady();
    if (!uidToPromote) throw new Error('معرف المستخدم مطلوب');
    try {
      await api.setDoc(api.doc(firestore, 'roles', uidToPromote), {
        role: 'admin',
        email: String(email || '').trim().toLowerCase(),
      });
    } catch (err) {
      throw arabicError(err);
    }
  },
};
