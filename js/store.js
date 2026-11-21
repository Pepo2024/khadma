// طبقة الأعمال المركزية — خدمة اجتماع بولس الرسول
import { FIREBASE, getFirebaseConfig } from './config.js';
import { uid, token, nowISO, todayISO, age, normalizePhone, fmtDate, daysUntil, memberCodeOf } from './utils.js';

const DEFAULT_STATE = {
  members: [],
  meetings: [],
  attendance: [],
  visits: [],
  messages: [],
  roles: {},
  settings: {},
  currentUser: null,
  profile: null,
  isAdmin: false,
  ready: false,
  mode: 'local',
};

function firebaseWanted() {
  try {
    const saved = localStorage.getItem('khadma.fb.enabled');
    if (saved !== null) return saved === '1' || saved === 'true';
  } catch (_) { /* تجاهل */ }
  return Boolean(FIREBASE?.enabled);
}

function firebaseReady() {
  const cfg = getFirebaseConfig?.() || FIREBASE?.config || {};
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export const store = {
  state: { ...DEFAULT_STATE },
  backend: null,
  _subs: new Set(),
  _unsub: null,

  subscribe(fn) {
    this._subs.add(fn);
    if (this.state.ready) queueMicrotask(() => fn(this.state));
    return () => this._subs.delete(fn);
  },

  notify() {
    this._subs.forEach((fn) => {
      try { fn(this.state); } catch (error) { console.error('store subscriber error', error); }
    });
  },

  apply(snapshot = {}) {
    Object.assign(this.state, snapshot);
    Object.defineProperty(this.state, 'ready', { value: true, writable: true, configurable: true, enumerable: true });
    this.notify();
  },

  async init() {
    let chosen = 'local';
    if (firebaseWanted()) {
      try {
        if (!firebaseReady()) throw new Error('إعدادات Firebase غير مكتملة');
        const mod = await import('./backend-firebase.js');
        this.backend = mod.backend;
        await withTimeout(this.backend.init(), 12000, 'تعذّر الاتصال بـ Firebase خلال 12 ثانية');
        chosen = 'firebase';
      } catch (error) {
        console.warn('Firebase init failed, falling back to local mode', error);
        this.backend = null;
        chosen = 'local';
      }
    }
    if (!this.backend) {
      const mod = await import('./backend-local.js');
      this.backend = mod.backend;
      await this.backend.init();
    }
    this.state.mode = this.backend.isLocal() ? 'local' : 'firebase';
    this._unsub?.(true);
    this._unsub = this.backend.subscribe((snap) => this.apply(snap));
    this.apply(this.backend.getSnapshot());
    return this.state;
  },

  get isAdmin() { return Boolean(this.state.isAdmin); },
  get currentUser() { return this.state.currentUser; },
  isLocal() { return this.state.mode === 'local'; },

  // ---------------- المصادقة ----------------
  async login(email, password) {
    const user = await this.backend.signIn(email, password);
    await this.refresh();
    return user;
  },

  async register(data = {}) {
    const profile = {
      id: uid(),
      uid: '',
      name: data.name || '',
      phone: normalizePhone(data.phone),
      address: data.address || '',
      birthDate: data.birthDate || '',
      confessorName: data.confessorName || '',
      college: data.college || '',
      level: data.level || '',
      age: data.birthDate ? age(data.birthDate) : (data.age || null),
      photoURL: data.photoURL || '',
      qrToken: token(10),
      joinedAt: nowISO(),
      active: true,
      notes: '',
    };
    profile.memberCode = memberCodeOf(profile);
    const user = await this.backend.signUp(data.email, data.password, profile);
    this.apply(this.backend.getSnapshot());
    let member = null;
    for (let i = 0; i < 12 && !member; i += 1) {
      member = this.state.members.find((m) => m.uid === user?.uid || m.id === user?.uid || m.id === profile.id);
      if (!member) await new Promise((resolve) => setTimeout(resolve, 60));
    }
    if (!member) {
      const doc = { ...profile, uid: user?.uid || profile.id, id: user?.uid || profile.id };
      const id = await this.backend.save('members', doc);
      member = { ...doc, id };
    }
    this.apply(this.backend.getSnapshot());
    return member;
  },

  async logout() {
    await this.backend.signOut();
    this.apply(this.backend.getSnapshot());
  },

  async resetPassword(email) {
    return this.backend.resetPassword(email);
  },

  async refresh() {
    this.apply(this.backend.getSnapshot());
  },

  // ---------------- البيانات ----------------
  async saveMember(data = {}) {
    const doc = { ...data };
    doc.id = data.id || uid();
    doc.uid = data.uid || '';
    doc.qrToken = data.qrToken || token(10);
    doc.memberCode = data.memberCode || memberCodeOf(doc);
    doc.joinedAt = data.joinedAt || nowISO();
    doc.active = data.active !== false;
    if (doc.birthDate && !doc.age) doc.age = age(doc.birthDate);
    if (doc.phone) doc.phone = normalizePhone(doc.phone);
    const id = await this.backend.save('members', doc);
    this.apply(this.backend.getSnapshot());
    return id;
  },

  async deleteMember(id) {
    await this.backend.remove('members', id);
    this.apply(this.backend.getSnapshot());
  },

  async saveMeeting(data = {}) {
    const doc = { ...data, id: data.id || uid(), createdAt: data.createdAt || nowISO() };
    if (doc.date) doc.date = `${doc.date}`.slice(0, 10);
    const id = await this.backend.save('meetings', doc);
    this.apply(this.backend.getSnapshot());
    return id;
  },

  async deleteMeeting(id) {
    await this.backend.remove('meetings', id);
    // حذف سجلات الحضور المرتبطة بالاجتماع
    await Promise.all(this.state.attendance.filter((a) => a.meetingId === id).map((a) => this.backend.remove('attendance', a.id)));
    this.apply(this.backend.getSnapshot());
  },

  async saveAttendance(rec = {}) {
    if (!rec.meetingId || !rec.memberId) throw new Error('بيعة الحضور غير مكتملة');
    const existing = this.state.attendance.find((a) => a.meetingId === rec.meetingId && a.memberId === rec.memberId);
    const doc = {
      ...rec,
      id: rec.id || existing?.id || uid(),
      recordedAt: nowISO(),
      status: ['present', 'absent', 'excused'].includes(rec.status) ? rec.status : 'absent',
    };
    const id = await this.backend.save('attendance', doc);
    this.apply(this.backend.getSnapshot());
    return id;
  },

  async saveAttendanceBulk(list = []) {
    await Promise.all(list.map((rec) => this.saveAttendance(rec)));
    return list.length;
  },

  async deleteAttendance(id) {
    await this.backend.remove('attendance', id);
    this.apply(this.backend.getSnapshot());
  },

  async saveVisit(data = {}) {
    const doc = { ...data, id: data.id || uid(), date: `${data.date || todayISO()}`.slice(0, 10), createdAt: data.createdAt || nowISO() };
    const id = await this.backend.save('visits', doc);
    this.apply(this.backend.getSnapshot());
    return id;
  },

  async deleteVisit(id) {
    await this.backend.remove('visits', id);
    this.apply(this.backend.getSnapshot());
  },

  async saveMessage(data = {}) {
    const doc = {
      ...data,
      id: data.id || uid(),
      createdAt: data.createdAt || nowISO(),
      readBy: data.readBy || [],
      scope: data.scope === 'direct' ? 'direct' : 'group',
      toAll: data.scope !== 'direct' ? true : Boolean(data.toAll),
    };
    const id = await this.backend.save('messages', doc);
    this.apply(this.backend.getSnapshot());
    return id;
  },

  async deleteMessage(id) {
    await this.backend.remove('messages', id);
    this.apply(this.backend.getSnapshot());
  },

  async markMessageRead(id) {
    const msg = this.state.messages.find((m) => m.id === id);
    const user = this.state.currentUser;
    if (!msg || !user) return;
    const readBy = new Set(msg.readBy || []);
    readBy.add(user.uid);
    await this.backend.save('messages', { ...msg, readBy: [...readBy] });
    this.apply(this.backend.getSnapshot());
  },

  async uploadPhoto(file, memberId) {
    const url = await this.backend.uploadPhoto(file, memberId || this.state.profile?.id);
    this.apply(this.backend.getSnapshot());
    return url;
  },

  async saveSettings(data = {}) {
    await this.backend.save('settings', { ...data, id: 'single', updatedAt: nowISO() });
    this.apply(this.backend.getSnapshot());
  },

  async grantAdmin(uidToGrant, email = '') {
    if (!this.backend.grantAdmin) throw new Error('هذه الميزة متاحة في الوضع المحلي فقط');
    await this.backend.grantAdmin(uidToGrant, email);
    this.apply(this.backend.getSnapshot());
  },

  async resetDemo() {
    if (!this.backend.resetDemo) throw new Error('إعادة الضبط متاحة في الوضع المحلي فقط');
    this.backend.resetDemo();
    this.apply(this.backend.getSnapshot());
  },

  // ---------------- استعلامات مشتقة ----------------
  sortedMeetings() {
    return [...this.state.meetings].sort((a, b) => `${b.date || ''}`.localeCompare(`${a.date || ''}`));
  },

  lastMeeting() {
    const sorted = this.sortedMeetings();
    const past = sorted.filter((m) => `${m.date || ''}` <= todayISO());
    return past[0] || sorted[0] || null;
  },

  attendanceFor(meetingId) {
    return this.state.attendance.filter((a) => a.meetingId === meetingId);
  },

  visitsFor(memberId) {
    return this.state.visits.filter((v) => v.memberId === memberId).sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));
  },

  messagesFor(uidValue) {
    const member = this.state.members.find((m) => m.uid === uidValue || m.id === uidValue);
    return this.state.messages
      .filter((m) => m.scope !== 'direct' || m.toMemberId === member?.id)
      .sort((a, b) => `${b.createdAt || ''}`.localeCompare(`${a.createdAt || ''}`));
  },

  membersWithStats() {
    const total = this.state.meetings.length || 0;
    return this.state.members.map((m) => {
      const records = this.state.attendance.filter((a) => a.memberId === m.id);
      const present = records.filter((a) => a.status === 'present').length;
      return { ...m, computedAge: m.age ?? age(m.birthDate), attended: present, attendanceRate: total ? Math.round((present / total) * 100) : 0 };
    });
  },

  stats() {
    const s = this.state;
    const last = this.lastMeeting();
    const lastRecords = last ? this.attendanceFor(last.id) : [];
    const present = lastRecords.filter((a) => a.status === 'present').length;
    const month = todayISO().slice(0, 7);
    const uidValue = s.currentUser?.uid;
    const unread = s.messages.filter((m) => !(m.readBy || []).includes(uidValue) && (m.scope !== 'direct' || m.toMemberId === s.profile?.id)).length;
    const birthdays = s.members.filter((m) => {
      const d = daysUntil(m.birthDate);
      return d !== null && d >= 0 && d <= 14;
    }).sort((a, b) => (daysUntil(a.birthDate) ?? 99) - (daysUntil(b.birthDate) ?? 99));
    return {
      members: s.members.length,
      meetings: s.meetings.length,
      lastAttendance: lastRecords.length ? Math.round((present / Math.max(1, s.members.length)) * 100) : 0,
      lastPresent: present,
      lastTotal: s.members.length,
      unread,
      visits: s.visits.length,
      messages: s.messages.length,
      visitsThisMonth: s.visits.filter((v) => `${v.date}`.startsWith(month)).length,
      birthdays,
    };
  },

  // ---------------- التصدير ----------------
  exportXlsx() {
    const X = globalThis.XLSX;
    if (!X) throw new Error('مكتبة Excel غير محمّلة');
    const wb = X.utils.book_new();
    const sheet = (name, rows, widths) => {
      const ws = X.utils.json_to_sheet(rows);
      ws['!cols'] = (widths || []).map((w) => ({ wch: w }));
      X.utils.book_append_sheet(wb, ws, name);
    };
    const members = this.state.members.map((m) => ({
      'رقم العضو': memberCodeOf(m), 'الاسم': m.name, 'الهاتف': m.phone, 'العنوان': m.address, 'العمر': m.age ?? age(m.birthDate),
      'تاريخ الميلاد': m.birthDate, 'أب الاعتراف': m.confessorName || '', 'الكلية': m.college || '', 'المستوى': m.level || '',
      'تاريخ التسجيل': (m.joinedAt || '').slice(0, 10),
      'كود QR': m.qrToken, 'حالة': m.active ? 'نشط' : 'غير نشط',
    }));
    const meetings = this.sortedMeetings().map((m) => ({ 'العنوان': m.title, 'التاريخ': m.date, 'الوقت': m.time, 'الوصف': m.description }));
    const attendance = this.state.attendance.map((a) => ({
      'الاجتماع': this.state.meetings.find((m) => m.id === a.meetingId)?.title || a.meetingId,
      'التاريخ': this.state.meetings.find((m) => m.id === a.meetingId)?.date || '',
      'العضو': this.state.members.find((m) => m.id === a.memberId)?.name || a.memberId,
      'الحالة': a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : 'مذور',
      'ملاحظة': a.note || '', 'وقت التسجيل': a.recordedAt || '',
    }));
    const visits = this.state.visits.map((v) => ({
      'العضو': this.state.members.find((m) => m.id === v.memberId)?.name || v.memberId,
      'التاريخ': v.date, 'النوع': v.type === 'visit' ? 'زيارة' : v.type === 'call' ? 'اتصال' : 'متابعة',
      'الملاحظات': v.notes, 'بواسطة': v.doneBy,
    }));
    const messages = this.state.messages.map((m) => ({
      'النوع': m.scope === 'direct' ? 'رسالة فردية' : 'رسالة جماعية',
      'العنوان': m.title, 'النص': m.body, 'تاريخ الإرسال': m.createdAt,
      'المستلم': m.toMemberId ? (this.state.members.find((x) => x.id === m.toMemberId)?.name || m.toMemberId) : 'الجميع',
      'عدد القرّاء': (m.readBy || []).length,
    }));
    sheet('الأعضاء', members, [22, 18, 30, 8, 15, 15, 15, 14, 10]);
    sheet('الاجتماعات', meetings, [30, 15, 10, 40]);
    sheet('الحضور', attendance, [30, 15, 22, 12, 26, 22]);
    sheet('الافتقاد', visits, [22, 15, 12, 50, 18]);
    sheet('الرسائل', messages, [16, 28, 60, 22, 22, 12]);
    X.writeFile(wb, `خدمة-بولس-الرسول-${todayISO()}.xlsx`, { compression: true });
  },

  exportMeetingXlsx(meetingId) {
    const X = globalThis.XLSX;
    if (!X) throw new Error('مكتبة Excel غير محمّلة');
    const meeting = this.state.meetings.find((m) => m.id === meetingId);
    const rows = this.state.members.map((m) => {
      const rec = this.attendanceFor(meetingId).find((a) => a.memberId === m.id);
      return {
        'الاسم': m.name,
        'الهاتف': m.phone,
        'الحالة': rec?.status === 'present' ? 'حاضر' : rec?.status === 'absent' ? 'غائب' : rec?.status === 'excused' ? 'مذور' : 'لم يُسجّل',
        'ملاحظة': rec?.note || '',
      };
    });
    const ws = X.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'الحضور');
    X.writeFile(wb, `حضور-${meeting?.title || 'اجتماع'}-${meeting?.date || todayISO()}.xlsx`, { compression: true });
  },
};
