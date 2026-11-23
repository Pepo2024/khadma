// نقطة الإقلاع — خدمة اجتماع بولس الرسول
import { store } from './store.js';
import { startRouter } from './router.js';
import { toast } from './ui.js';

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;
  const splash = document.getElementById('boot');
  try {
    await store.init();
  } catch (error) {
    console.error('Boot error', error);
    toast('تعذّر تهيئة التطبيق، سيتم العمل في الوضع المحلي', 'err');
  }
  splash?.classList.add('hidden');
  setTimeout(() => splash?.remove(), 500);
  startRouter(document.getElementById('app'));

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection', event.reason);
  });
}

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
