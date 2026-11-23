/**
 * الواجهة المحلية (localStorage) لعقد backend.
 * تعمل فورًا ببيانات تجريبية عربية دون أي إعداد أو اتصال بالإنترنت.
 */

const DB_KEY = 'khadma.db.v1';
const SESSION_KEY = 'khadma.session.v1';

const COLLECTIONS = ['members', 'meetings', 'attendance', 'visits', 'messages'];

const DEFAULT_SETTINGS = {
  id: 'single',
  serviceName: 'خدمة اجتماع بولس الرسول',
  serviceDay: 'الأحد',
  serviceTime: '18:00',
  address: 'مصر — القاهرة',
  whatsappGroup: '',
  announcement: 'مرحبًا بكم في خدمة اجتماع بولس الرسول 🌿',
  updatedAt: '',
};

/* ------------------------------------------------------------------ */
/* مساعدات صغيرة مستقلة (لا نعتمد على utils.js حتى يبقى هذا الملف وحده) */
/* ------------------------------------------------------------------ */

function uid() {
  const c = typeof crypto !== 'undefined' && crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ageFrom(birthDate) {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a -= 1;
  return Math.max(0, a);
}

function qrToken() {
  const c = typeof crypto !== 'undefined' && crypto;
  const bytes = c && typeof c.getRandomValues === 'function'
    ? Array.from(c.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `KH-${bytes.toUpperCase()}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hashString(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** صورة رمزية مولّدة من الأحرف الأولى (Initials avatar) كـ data URL. */
function initialsAvatar(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p.charAt(0)).join('') || '؟';
  const palette = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#0891b2'];
  const color = palette[hashString(name) % palette.length];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
    `<rect width="128" height="128" rx="64" fill="${color}"/>` +
    `<text x="64" y="66" fill="#ffffff" font-size="46" font-family="Tahoma,Arial,sans-serif" ` +
    `text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* التخزين                                                             */
/* ------------------------------------------------------------------ */

function storageOK() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

function readJSON(key, fallback) {
  if (!storageOK()) return clone(fallback);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return clone(fallback);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

function writeJSON(key, value) {
  if (!storageOK()) throw new Error('التخزين المحلي غير متاح في هذا المتصفح');
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // لازم نُظهر الخطأ بدل ما نبتلعه، وإلا هيظهر «تم الحفظ» والبيانات تضيع.
    throw new Error('امتلأت مساحة التخزين المحلي. احذف بعض الصور أو صدّر نسخة احتياطية ثم حاول مجددًا');
  }
}

function emptyDB() {
  return {
    members: [],
    meetings: [],
    attendance: [],
    visits: [],
    messages: [],
    settings: { ...DEFAULT_SETTINGS },
    roles: [],
    accounts: [],
  };
}

function normalizeDB(raw) {
  const db = { ...emptyDB(), ...(raw && typeof raw === 'object' ? raw : {}) };
  COLLECTIONS.forEach((key) => {
    if (!Array.isArray(db[key])) db[key] = [];
  });
  if (!Array.isArray(db.roles)) db.roles = [];
  if (!Array.isArray(db.accounts)) db.accounts = [];
  if (!db.settings || typeof db.settings !== 'object') db.settings = { ...DEFAULT_SETTINGS };
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings, id: 'single' };
  return db;
}

/* ------------------------------------------------------------------ */
/* البيانات التجريبية                                                   */
/* ------------------------------------------------------------------ */

function seedDB() {
  const db = emptyDB();

  const rawMembers = [
    {
      id: 'mem-amira',
      name: 'ماريا جرجس فهمي',
      phone: '01012345671',
      address: 'مصر الجديدة — القاهرة، شارع النصر',
      birthDate: '2003-04-12',
      confessorName: 'الأب بولس',
      college: 'ايوي', level: 'الكامل',
      notes: 'تخدم في فريق الترنيم، تحب القراءة الروحية.',
    },
    {
      id: 'mem-boulos',
      name: 'بولس سمير عزت',
      phone: '01012345672',
      address: 'المهندسين — الجيزة، شارع الجامعة',
      birthDate: '2001-09-23',
      confessorName: 'الأب مكسيموس',
      college: 'ايوي', level: 'الكامل',
      notes: 'مسؤول تجهيز الاجتماع، متطوع نشط.',
    },
    {
      id: 'mem-mariam',
      name: 'مريم كمال شفيق',
      phone: '01012345673',
      address: 'سيدي بشر — الإسكندرية، شارع الحريّة',
      birthDate: '2004-01-30',
      confessorName: 'الأب يوحنا',
      college: 'ايوي', level: 'الكامل',
      notes: 'تهتم بزيارة المرضى وتنسيق الافتقاد.',
    },
    {
      id: 'mem-youssef',
      name: 'يوسف نبيل سعد',
      phone: '01012345674',
      address: 'وسط البلد — طنطا، شارع Ahmed',
      birthDate: '2002-11-05',
      confessorName: 'الأب أنطونيوس',
      college: 'ايوي', level: 'الكامل',
      notes: 'يلعب على الجيتار في الاجتماع.',
    },
    {
      id: 'mem-hanaa',
      name: 'هناء رفعت باسيلي',
      phone: '01012345675',
      address: 'شارع البحر — المنصورة',
      birthDate: '2005-07-14',
      confessorName: 'الأب مكاريوس',
      college: 'ايوي', level: 'الكامل',
      notes: 'جديدة في الخدمة، تحتاج متابعة.',
    },
    {
      id: 'mem-david',
      name: 'ديفيد فؤاد جيد',
      phone: '01012345676',
      address: 'أول النيل — أسوان',
      birthDate: '2000-02-28',
      confessorName: 'الأب صموئيل',
      college: 'ايوي', level: 'الكامل',
      notes: 'يتولى حسابات الخدمة ومسؤولية الحضور.',
    },
  ];

  db.members = rawMembers.map((m, i) => ({
    id: m.id,
    uid: m.id,
    name: m.name,
    phone: m.phone,
    address: m.address,
    age: ageFrom(m.birthDate),
    birthDate: m.birthDate,
    confessorName: m.confessorName || '',
    college: m.college || '',
    level: m.level || '',
    photoURL: initialsAvatar(m.name),
    qrToken: `KH-DEMO-${String(i + 1).padStart(3, '0')}`,
    memberCode: `KH-${String(i + 1).padStart(4, '0')}`,
    joinedAt: nowISO(),
    active: true,
    notes: m.notes,
  }));

  db.meetings = [
    {
      id: 'meet-past-1',
      title: 'اجتماع الأحد — كلمة الوداع',
      date: dateOffset(-35),
      time: '18:00',
      description: 'اجتماع الأسبوع الماضي: كلمة عن المحبة والخدمة مع فترة ترنيم.',
      createdAt: nowISO(),
    },
    {
      id: 'meet-past-2',
      title: 'اجتماع منتصف الشهر — التوبة',
      date: dateOffset(-14),
      time: '19:00',
      description: 'اجتماع منتصف الشهر: تأمل في التوبة وقراءة جماعية.',
      createdAt: nowISO(),
    },
    {
      id: 'meet-next',
      title: 'الاجتماع الأسبوعي القادم',
      date: dateOffset(7),
      time: '18:30',
      description: 'اجتماع الأحد القادم — ترنيم، كلمة، ثم لقاء الافتقاد.',
      createdAt: nowISO(),
    },
  ];

  const statuses = ['present', 'present', 'present', 'absent', 'excused', 'present'];
  const notes = ['', '', '', 'اعتذر لظروف العمل', 'سفر خارج المحافظة', ''];
  db.meetings.slice(0, 2).forEach((meeting, mi) => {
    db.members.forEach((member, i) => {
      const status = statuses[(i + mi) % statuses.length];
      db.attendance.push({
        id: `att-${meeting.id}-${member.id}`,
        meetingId: meeting.id,
        memberId: member.id,
        status,
        note: status === 'present' ? '' : notes[i],
        recordedAt: nowISO(),
      });
    });
  });

  db.visits = [
    {
      id: 'vis-1',
      memberId: 'mem-hanaa',
      date: dateOffset(-9),
      type: 'visit',
      notes: 'زيارة منزلية، تمت الصلاة مع الأسرة وناقشنا مواعيد الاجتماع.',
      doneBy: 'أ. مريم الخادمة',
    },
    {
      id: 'vis-2',
      memberId: 'mem-youssef',
      date: dateOffset(-6),
      type: 'call',
      notes: 'اتصال هاتفي للاطمئنان بعد غياب الاجتماع.',
      doneBy: 'أ. ديفيد',
    },
    {
      id: 'vis-3',
      memberId: 'mem-mariam',
      date: dateOffset(-3),
      type: 'followup',
      notes: 'متابعة تجهيز فريق الافتقاد وترتيب الزيارات القادمة.',
      doneBy: 'أ. مريم الخادمة',
    },
  ];

  db.messages = [
    {
      id: 'msg-1',
      scope: 'group',
      title: 'تذكير بالاجتماع',
      body: 'الاجتماع الأسبوعي يوم الأحد في الساعة 6:30 مساءً. نرجو الحضور قبل الموعد بعشر دقائق.',
      toMemberId: null,
      toAll: true,
      createdAt: nowISO(),
      readBy: ['demo-admin', 'demo-member'],
    },
    {
      id: 'msg-2',
      scope: 'direct',
      title: 'اطمئنان عليك',
      body: 'إيه الأخبار؟ اشتقنا لك في الاجتماع اللي فات، نورتنا لو حضرت الأحد الجاي 🌿',
      toMemberId: 'mem-amira',
      toAll: false,
      createdAt: nowISO(),
      readBy: [], // رسالة غير مقروءة للحساب التجريبي
    },
    {
      id: 'msg-3',
      scope: 'group',
      title: 'خدمة الافتقاد',
      body: 'تم تحديث جدول الزيارات لهذا الأسبوع. من يحتاج تعديل يكلّمنا.',
      toMemberId: null,
      toAll: true,
      createdAt: nowISO(),
      readBy: ['demo-admin', 'demo-member'],
    },
  ];

  db.roles = [
    { uid: 'demo-admin', role: 'admin', email: 'admin@demo.local' },
    { uid: 'demo-member', role: 'member', email: 'demo@demo.local' },
  ];

  db.accounts = [
    {
      uid: 'demo-admin',
      email: 'admin@demo.local',
      password: 'Admin@123',
      role: 'admin',
      memberId: null,
      displayName: 'مدير الخدمة',
      photoURL: '',
    },
    {
      uid: 'demo-member',
      email: 'demo@demo.local',
      password: 'Member@123',
      role: 'member',
      memberId: 'mem-amira',
      displayName: db.members[0].name,
      photoURL: db.members[0].photoURL,
    },
  ];

  db.settings = { ...DEFAULT_SETTINGS, updatedAt: nowISO() };
  return db;
}

/* ------------------------------------------------------------------ */
/* الحالة الداخلية                                                      */
/* ------------------------------------------------------------------ */

let db = null;
let session = null;
let ready = false;
let initPromise = null;
const subscribers = new Set();

function loadState() {
  const stored = storageOK() ? localStorage.getItem(DB_KEY) : null;
  if (stored == null) {
    db = seedDB();
    try { writeJSON(DB_KEY, db); }
    catch (err) { console.warn('[khadma] تعذّر حفظ البيانات الأولية:', err.message); }
  } else {
    db = normalizeDB(readJSON(DB_KEY, {}));
  }
  session = readJSON(SESSION_KEY, null);
  if (!session || typeof session !== 'object') session = null;
}

function persistDB() {
  writeJSON(DB_KEY, db);
}

function persistSession() {
  if (storageOK()) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.setItem(SESSION_KEY, 'null');
    } catch {
      /* تجاهل */
    }
  }
}

function publicUser(account) {
  if (!account) return null;
  return {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName || account.name || '',
    photoURL: account.photoURL || '',
    role: account.role || 'member',
    memberId: account.memberId || null,
  };
}

function isAdminNow() {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return db.roles.some((r) => r.uid === session.uid && r.role === 'admin');
}

function buildSnapshot() {
  const user = publicUser(session);
  const linkedId = session ? session.memberId || session.uid : null;
  const profile = linkedId
    ? db.members.find((m) => m.id === linkedId || m.uid === linkedId) || null
    : null;
  return {
    members: clone(db.members),
    meetings: clone(db.meetings),
    attendance: clone(db.attendance),
    visits: clone(db.visits),
    messages: clone(db.messages),
    settings: { ...DEFAULT_SETTINGS, ...clone(db.settings), id: 'single' },
    currentUser: user,
    profile: profile ? clone(profile) : null,
    isAdmin: isAdminNow(),
    ready,
  };
}

function notify() {
  const snapshot = buildSnapshot();
  subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('[khadma] خطأ في مستمع الحالة المحلية:', err);
    }
  });
  return snapshot;
}

function findAccount(email) {
  const needle = String(email || '').trim().toLowerCase();
  return db.accounts.find((a) => String(a.email || '').toLowerCase() === needle) || null;
}

function makeDocId(doc) {
  if (doc && doc.id) return String(doc.id);
  if (doc && doc.uid) return String(doc.uid);
  return uid();
}

function assertCollection(collection) {
  if (!COLLECTIONS.includes(collection) && collection !== 'settings') {
    throw new Error(`مجموعة بيانات غير معروفة: ${collection}`);
  }
}

/* ------------------------------------------------------------------ */
/* الواجهة العامة                                                       */
/* ------------------------------------------------------------------ */

export const backend = {
  /** يجهّز قاعدة البيانات المحلية ويبثّ أول لقطة. آمن عند تكرار الاستدعاء. */
  init() {
    if (initPromise) return initPromise;
    initPromise = Promise.resolve().then(() => {
      if (!db) loadState();
      ready = true;
      return notify();
    });
    return initPromise;
  },

  isLocal() {
    return true;
  },

  getSnapshot() {
    if (!db) loadState();
    return buildSnapshot();
  },

  subscribe(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.add(cb);
    try {
      cb(buildSnapshot());
    } catch {
      /* لا نمنع الاشتراك بسبب خطأ في المستمع */
    }
    return () => subscribers.delete(cb);
  },

  async signIn(email, password) {
    if (!db) loadState();
    const account = findAccount(email);
    if (!account || account.password !== password) {
      throw new Error('بيانات الدخول غير صحيحة، تأكد من البريد وكلمة المرور');
    }
    session = {
      uid: account.uid,
      email: account.email,
      role: account.role || 'member',
      memberId: account.memberId || null,
    };
    persistSession();
    notify();
    return publicUser(account);
  },

  async signUp(email, password, profile = {}) {
    if (!db) loadState();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('يرجى إدخال بريد إلكتروني صالح');
    }
    if (String(password || '').length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }
    if (findAccount(cleanEmail)) {
      throw new Error('البريد الإلكتروني مسجّل بالفعل');
    }

    const newUid = uid();
    const name = profile.name || cleanEmail.split('@')[0];
    const member = {
      id: newUid,
      uid: newUid,
      name,
      phone: profile.phone || '',
      address: profile.address || '',
      age: profile.age != null ? profile.age : ageFrom(profile.birthDate),
      birthDate: profile.birthDate || '',
      confessorName: profile.confessorName || '',
      college: profile.college || '',
      level: profile.level || '',
      photoURL: profile.photoURL || initialsAvatar(name),
      qrToken: profile.qrToken || qrToken(),
      memberCode: profile.memberCode || '',
      joinedAt: nowISO(),
      active: profile.active !== false,
      notes: profile.notes || '',
    };

    db.members.push(member);
    db.accounts.push({
      uid: newUid,
      email: cleanEmail,
      password,
      role: 'member',
      memberId: newUid,
      displayName: name,
      photoURL: member.photoURL,
    });
    db.roles.push({ uid: newUid, role: 'member', email: cleanEmail });
    persistDB();

    session = { uid: newUid, email: cleanEmail, role: 'member', memberId: newUid };
    persistSession();
    notify();
    return publicUser(db.accounts[db.accounts.length - 1]);
  },

  async signOut() {
    session = null;
    persistSession();
    notify();
  },

  async resetPassword(email) {
    if (!db) loadState();
    const account = findAccount(email);
    if (!account) throw new Error('البريد الإلكتروني غير مسجّل في النظام');
    // الوضع المحلي لا يرسل رسائل؛ نكتفي بالتحقق من وجود الحساب.
    return true;
  },

  async save(collection, doc) {
    if (!db) loadState();
    assertCollection(collection);
    const payload = doc && typeof doc === 'object' ? clone(doc) : {};

    if (collection === 'settings') {
      db.settings = { ...DEFAULT_SETTINGS, ...db.settings, ...payload, id: 'single' };
      persistDB();
      notify();
      return 'single';
    }

    const id = makeDocId(payload);
    const next = { ...payload, id };
    if (collection === 'members' && !next.uid) next.uid = id;
    const index = db[collection].findIndex((item) => item && item.id === id);
    if (index >= 0) db[collection][index] = { ...db[collection][index], ...next, id };
    else db[collection].push(next);

    persistDB();
    notify();
    return id;
  },

  async remove(collection, id) {
    if (!db) loadState();
    assertCollection(collection);
    if (collection === 'settings') {
      db.settings = { ...DEFAULT_SETTINGS };
    } else {
      db[collection] = db[collection].filter((item) => item && item.id !== id);
    }
    persistDB();
    notify();
  },

  /** يقرأ الصورة ويضغطها بـ canvas إلى 600px كحد أقصى وjpeg بجودة 0.8. */
  async uploadPhoto(file, memberId) {
    void memberId; // غير مستخدم محليًا (يحفظه store.js في مستند العضو)
    if (!file || typeof FileReader === 'undefined' || typeof document === 'undefined') {
      throw new Error('تعذّر قراءة الصورة في هذا المتصفح');
    }

    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('تعذّر قراءة ملف الصورة'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('صيغة الصورة غير مدعومة'));
      img.src = dataURL;
    });

    try {
      const max = 600;
      const scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataURL;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return dataURL;
    }
  },

  /** إعادة البيانات التجريبية كما كانت (يستخدمها زر إعادة الضبط في الإدارة). */
  resetDemo() {
    db = seedDB();
    session = null;
    persistDB();
    persistSession();
    notify();
  },

  /** منح صلاحية أدمن محليًا (يحدّث الأدوار والحساب والجلسة الحالية). */
  async grantAdmin(uidToPromote, email = '') {
    if (!db) loadState();
    if (!uidToPromote) throw new Error('معرف المستخدم مطلوب');
    const existingRole = db.roles.find((r) => r.uid === uidToPromote);
    if (existingRole) existingRole.role = 'admin';
    else db.roles.push({ uid: uidToPromote, role: 'admin', email });

    const account = db.accounts.find((a) => a.uid === uidToPromote);
    if (account) account.role = 'admin';
    if (session && session.uid === uidToPromote) session.role = 'admin';

    persistDB();
    persistSession();
    notify();
  },
};
