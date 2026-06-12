import { canAccessPage, dateToString, escapeHTML } from '../utils.js';
import {
  getEngAutoCloseIntervalHours,
  getEngAutoCloseState,
  runEngAutoClose,
  setEngAutoCloseEnabled,
  subscribeEngAutoCloseState,
  syncEngAutoCloseForSession,
} from '../services/eng-auto-close.js';
import { showToast } from '../ui.js';

function formatTimestamp(value) {
  if (!value) return '-';
  return dateToString(new Date(value));
}

function formatCountdown(target) {
  if (!target) return '-';
  const diff = target - Date.now();
  if (diff <= 0) return 'กำลังรันรอบถัดไป';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `อีกประมาณ ${minutes} นาที`;
  return `อีกประมาณ ${hours} ชม. ${minutes} นาที`;
}

function renderHistoryRows(history) {
  if (!history || history.length === 0) {
    return `
      <tr>
        <td colspan="5" class="table-empty">ยังไม่มีประวัติการทำงานใน session นี้</td>
      </tr>
    `;
  }

  return history.map((item, index) => `
    <tr>
      <td class="cell-center">${index + 1}</td>
      <td>${escapeHTML(item.runAtText)}</td>
      <td class="cell-center">${item.queued}</td>
      <td class="cell-center">${item.closed}</td>
      <td>${escapeHTML(item.ids.length > 0 ? item.ids.join(', ') : '-')}</td>
    </tr>
  `).join('');
}

function paintState(snapshot) {
  const statusEl = document.getElementById('eng-auto-close-status');
  const statusMetaEl = document.getElementById('eng-auto-close-status-meta');
  const lastRunEl = document.getElementById('eng-auto-close-last-run');
  const nextRunEl = document.getElementById('eng-auto-close-next-run');
  const nextRunMetaEl = document.getElementById('eng-auto-close-next-run-meta');
  const queueEl = document.getElementById('eng-auto-close-queue');
  const closedEl = document.getElementById('eng-auto-close-closed');
  const scannedEl = document.getElementById('eng-auto-close-scanned');
  const errorEl = document.getElementById('eng-auto-close-error');
  const historyBody = document.getElementById('eng-auto-close-history');
  const toggleBtn = document.getElementById('eng-auto-close-toggle');
  const runBtn = document.getElementById('eng-auto-close-run');

  if (!statusEl) return;

  statusEl.textContent = snapshot.running
    ? 'กำลังประมวลผล'
    : snapshot.enabled
      ? 'เปิดใช้งานอัตโนมัติ'
      : 'ปิดใช้งานชั่วคราว';

  statusMetaEl.textContent = snapshot.running
    ? 'กำลังตรวจงานที่รอประเมินครบ 10 ชั่วโมง'
    : snapshot.enabled
      ? 'ตัว scheduler จะทำงานต่อให้อัตโนมัติทุก 10 ชั่วโมง'
      : 'หยุดจับเวลาไว้ก่อน แต่ยังสั่ง Run now ได้';

  lastRunEl.textContent = formatTimestamp(snapshot.lastRunAt);
  nextRunEl.textContent = snapshot.enabled ? formatTimestamp(snapshot.nextRunAt) : '-';
  nextRunMetaEl.textContent = snapshot.enabled ? formatCountdown(snapshot.nextRunAt) : 'ยังไม่ได้ตั้งเวลารอบถัดไป';

  queueEl.textContent = String(snapshot.lastResult?.queued ?? 0);
  closedEl.textContent = String(snapshot.lastResult?.closed ?? 0);
  scannedEl.textContent = String(snapshot.lastResult?.scanned ?? 0);

  if (errorEl) {
    if (snapshot.lastError) {
      errorEl.style.display = 'flex';
      errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${escapeHTML(snapshot.lastError)}</span>`;
    } else {
      errorEl.style.display = 'none';
      errorEl.innerHTML = '';
    }
  }

  if (historyBody) {
    historyBody.innerHTML = renderHistoryRows(snapshot.history);
  }

  if (toggleBtn) {
    toggleBtn.disabled = snapshot.running;
    toggleBtn.innerHTML = snapshot.enabled
      ? '<i class="fa-solid fa-pause"></i> หยุด Auto Close'
      : '<i class="fa-solid fa-play"></i> เปิด Auto Close';
  }

  if (runBtn) {
    runBtn.disabled = snapshot.running;
    runBtn.innerHTML = snapshot.running
      ? '<i class="fa-solid fa-spinner fa-spin"></i> กำลังประมวลผล...'
      : '<i class="fa-solid fa-bolt"></i> Run now';
  }
}

export function render() {
  const intervalHours = getEngAutoCloseIntervalHours();

  return `
    <div class="app-page app-page-tight eng-auto-close-page">
      <section class="page-hero page-hero-admin fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Administrator Only</p>
          <h1 class="page-hero-title">Auto Close Repair Jobs</h1>
          <p class="page-hero-subtitle">เครื่องมือนี้จะตรวจงานซ่อมที่อยู่สถานะรอประเมินความเรียบร้อย และปิดงานให้อัตโนมัติเมื่อค้างเกิน ${intervalHours} ชั่วโมง โดยใช้ผลลัพธ์เดียวกับการกดยืนยันรับงาน</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ความถี่การตรวจ</span>
            <strong>ทุก ${intervalHours} ชั่วโมง</strong>
          </div>
          <div class="page-hero-stat">
            <span>สิทธิ์ที่ต้องใช้</span>
            <strong>Administrator</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>การทำงานของ scheduler</strong>
          ระบบจะเริ่มทำงานอัตโนมัติเมื่อ admin login และมีแท็บแอปนี้เปิดอยู่ ถ้าปิด browser หรือปิดทุกแท็บของระบบ การจับเวลาจะหยุดจนกว่าจะมี admin เปิดระบบอีกครั้ง
        </div>
      </div>

      <div class="ops-kpi-grid fade-in">
        <div class="form-card ops-kpi-card ops-kpi-indigo">
          <div class="ops-kpi-icon"><i class="fa-solid fa-robot"></i></div>
          <div class="ops-kpi-copy">
            <span>สถานะ scheduler</span>
            <strong id="eng-auto-close-status">กำลังโหลด...</strong>
            <small id="eng-auto-close-status-meta">-</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-blue">
          <div class="ops-kpi-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
          <div class="ops-kpi-copy">
            <span>รอบล่าสุด</span>
            <strong id="eng-auto-close-last-run">-</strong>
            <small>เวลาที่ระบบประมวลผลครั้งล่าสุด</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-amber">
          <div class="ops-kpi-icon"><i class="fa-solid fa-hourglass-half"></i></div>
          <div class="ops-kpi-copy">
            <span>รอบถัดไป</span>
            <strong id="eng-auto-close-next-run">-</strong>
            <small id="eng-auto-close-next-run-meta">-</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-green">
          <div class="ops-kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="ops-kpi-copy">
            <span>ปิดงานรอบล่าสุด</span>
            <strong id="eng-auto-close-closed">0</strong>
            <small>รายการที่ถูกปิดอัตโนมัติ</small>
          </div>
        </div>
      </div>

      <div class="admin-grid">
        <div class="card fade-in admin-card">
          <div class="admin-card-head">
            <div>
              <h3><i class="fa-solid fa-sliders"></i> ควบคุมการทำงาน</h3>
              <p>ใช้สำหรับสั่งทำงานทันที เปิด/หยุด scheduler ชั่วคราว และดูตัวเลขรอบล่าสุดที่ระบบประมวลผล</p>
            </div>
          </div>
          <div class="danger-note" id="eng-auto-close-error" style="display:none;"></div>
          <div class="admin-inline-grid">
            <div class="form-group">
              <label>งานรอประเมินที่พบรอบล่าสุด</label>
              <input type="text" id="eng-auto-close-queue" class="form-control" value="0" readonly>
            </div>
            <div class="form-group">
              <label>รายการที่ระบบสแกนรอบล่าสุด</label>
              <input type="text" id="eng-auto-close-scanned" class="form-control" value="0" readonly>
            </div>
          </div>
          <div class="form-actions admin-actions">
            <button class="btn btn-primary" id="eng-auto-close-run">
              <i class="fa-solid fa-bolt"></i> Run now
            </button>
            <button class="btn btn-secondary" id="eng-auto-close-toggle">
              <i class="fa-solid fa-play"></i> เปิด Auto Close
            </button>
          </div>
        </div>

        <div class="card fade-in admin-card" style="animation-delay: 0.08s;">
          <div class="admin-card-head">
            <div>
              <h3><i class="fa-solid fa-list-check"></i> ประวัติการปิดงานอัตโนมัติ</h3>
              <p>แสดงผลเฉพาะใน session ปัจจุบัน เพื่อให้ตรวจได้ว่ารอบไหนปิดงานอะไรไปบ้าง</p>
            </div>
          </div>
          <div class="table-wrapper ops-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>เวลาที่รัน</th>
                  <th>รอประเมิน</th>
                  <th>ปิดงาน</th>
                  <th>เลขที่ใบแจ้งซ่อม</th>
                </tr>
              </thead>
              <tbody id="eng-auto-close-history">
                <tr>
                  <td colspan="5" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  if (!canAccessPage('eng-auto-close')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
    return;
  }

  syncEngAutoCloseForSession();

  const runBtn = document.getElementById('eng-auto-close-run');
  const toggleBtn = document.getElementById('eng-auto-close-toggle');

  const cleanupPrevious = window.__engAutoClosePageCleanup;
  if (typeof cleanupPrevious === 'function') cleanupPrevious();

  const unsubscribe = subscribeEngAutoCloseState(paintState);

  runBtn?.addEventListener('click', async () => {
    await runEngAutoClose({ manual: true, showSuccessToast: true });
  });

  toggleBtn?.addEventListener('click', () => {
    const current = getEngAutoCloseState();
    const nextEnabled = !current.enabled;
    setEngAutoCloseEnabled(nextEnabled);
    showToast(nextEnabled ? 'เปิด Auto Close แล้ว' : 'หยุด Auto Close ชั่วคราวแล้ว', nextEnabled ? 'success' : 'info');
  });

  const handleHashChange = () => {
    if (window.location.hash !== '#eng-auto-close') {
      cleanup();
    }
  };

  const cleanup = () => {
    unsubscribe();
    window.removeEventListener('hashchange', handleHashChange);
    if (window.__engAutoClosePageCleanup === cleanup) {
      window.__engAutoClosePageCleanup = null;
    }
  };

  window.addEventListener('hashchange', handleHashChange);
  window.__engAutoClosePageCleanup = cleanup;
  paintState(getEngAutoCloseState());
}
