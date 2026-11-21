// مكونات الواجهة المشتركة — خدمة اجتماع بولس الرسول
import { esc, initials } from './utils.js';

export { esc };

export function toast(message, type = 'ok') {
  const host = document.getElementById('toasts') || document.body;
  const el = document.createElement('div');
  el.className = `toast ${type === 'err' ? 'toast-err' : 'toast-ok'}`;
  el.innerHTML = `<span class="toast-icon">${type === 'err' ? '!' : '✓'}</span><span>${esc(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const remove = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 260);
  };
  setTimeout(remove, 4200);
  el.addEventListener('click', remove);
  return el;
}

let openModals = 0;

export function modal({ title = '', body = '', okText = 'حفظ', cancelText = 'إلغاء', onOk, onCancel, size = 'md', hideFooter = false } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-close aria-label="إغلاق">×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${hideFooter ? '' : `<div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
        <button type="button" class="btn btn-primary" data-ok>${esc(okText)}</button>
      </div>`}
    </div>`;
  document.body.appendChild(backdrop);
  openModals += 1;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const close = () => {
    backdrop.classList.remove('show');
    setTimeout(() => {
      backdrop.remove();
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.style.overflow = '';
    }, 180);
  };

  backdrop.querySelectorAll('[data-close], [data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => { onCancel?.(); close(); });
  });
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) { onCancel?.(); close(); }
  });
  backdrop.querySelector('[data-ok]')?.addEventListener('click', async () => {
    const btn = backdrop.querySelector('[data-ok]');
    btn.disabled = true;
    try {
      const result = await onOk?.(backdrop);
      if (result !== false) close();
    } catch (error) {
      toast(error?.message || 'حدث خطأ، حاول مرة أخرى', 'err');
    } finally {
      btn.disabled = false;
    }
  });
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      onCancel?.();
      close();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
  setTimeout(() => backdrop.querySelector('input, select, textarea, button[data-ok]')?.focus(), 80);
  return { element: backdrop, close };
}

export function confirmBox(message, title = 'تأكيد') {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title,
      body: `<p class="confirm-text">${esc(message)}</p>`,
      okText: 'تأكيد',
      cancelText: 'تراجع',
      onOk: () => { done = true; resolve(true); },
      onCancel: () => { if (!done) resolve(false); },
    });
  });
}

export function empty(text = 'لا توجد بيانات حتى الآن') {
  return `<div class="empty-state"><div class="empty-icon">✧</div><p>${esc(text)}</p></div>`;
}

export function pageHead(title, subtitle = '', actions = '') {
  return `<div class="page-head">
    <div>
      <h1 class="page-title">${esc(title)}</h1>
      ${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ''}
    </div>
    ${actions ? `<div class="toolbar">${actions}</div>` : ''}
  </div>`;
}

export function tableHTML(headers, rows, emptyText = 'لا توجد بيانات') {
  if (!rows?.length) return empty(emptyText);
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function badge(text, tone = 'gray') {
  const map = { green: 'badge-green', red: 'badge-red', gold: 'badge-gold', gray: 'badge-gray', blue: 'badge-blue' };
  return `<span class="badge ${map[tone] || 'badge-gray'}">${esc(text)}</span>`;
}

export function spin() {
  return '<span class="loading" aria-label="جاري التحميل"></span>';
}

export function formRow(label, control, hint = '') {
  return `<div class="field">
    <label class="field-label">${esc(label)}</label>
    ${control}
    ${hint ? `<small class="field-hint">${esc(hint)}</small>` : ''}
  </div>`;
}

export function avatar(name, photoURL = '', size = '') {
  if (photoURL) return `<img src="${esc(photoURL)}" alt="${esc(name)}" class="avatar ${size}">`;
  return `<span class="avatar ${size}" aria-label="${esc(name)}">${esc(initials(name))}</span>`;
}

export function sectionTitle(text, extra = '') {
  return `<div class="section-title"><span>${esc(text)}</span>${extra}</div>`;
}

export function statusBadge(status) {
  if (status === 'present') return badge('حاضر', 'green');
  if (status === 'absent') return badge('غائب', 'red');
  if (status === 'excused') return badge('مذور', 'gold');
  return badge('لم يُسجّل', 'gray');
}

export function valueCard(label, value, icon = '') {
  return `<div class="stat"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div></div>`;
}
