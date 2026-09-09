import { database, ref, get } from '../firebase.js';
import {
  hrDatabase,
  ref as hrRef,
  get as hrGet,
} from '../firebase-hr.js';
import { parseDateTime, canAccessPage } from '../utils.js';

const serviceDocks = [
  {
    id: 'engineering', title: 'Engineering', icon: 'fa-gear',
    description: 'ดูแลและซ่อมบำรุง เพื่อการทำงานที่ต่อเนื่อง',
    image: new URL('../../img/home/service-dock-maintenance.webp', import.meta.url).href,
    actions: [
      { page: 'eng-request', icon: 'fa-wrench', label: 'แจ้งซ่อม' },
      { page: 'eng-list', icon: 'fa-list-check', label: 'ติดตามงานซ่อม' },
      { page: 'eng-doc', icon: 'fa-folder-open', label: 'เอกสาร EN' },
    ],
  },
  {
    id: 'mobility', title: 'Mobility', icon: 'fa-car',
    description: 'บริการยานพาหนะ สะดวก ปลอดภัย พร้อมเดินทาง',
    image: new URL('../../img/home/service-dock-mobility.webp', import.meta.url).href,
    actions: [
      { page: 'hr-car', icon: 'fa-car', label: 'จองรถ' },
      { page: 'hr-shuttle', icon: 'fa-bus', label: 'รถรับ-ส่ง' },
      { page: 'hr-list', icon: 'fa-clipboard-check', label: 'ติดตามงานรถ' },
    ],
  },
  {
    id: 'hr', title: 'Human Resources', icon: 'fa-user-group',
    description: 'ดูแลบุคลากร สร้างองค์กรที่แข็งแรง',
    image: new URL('../../img/home/service-dock-hr.webp', import.meta.url).href,
    actions: [
      { page: 'hr-evaluation', icon: 'fa-chart-simple', label: 'Evaluation' },
      { page: 'hr-doc', icon: 'fa-file-signature', label: 'เอกสาร HR' },
    ],
  },
];

export function render() {
  const docks = serviceDocks
    .map(dock => ({ ...dock, actions: dock.actions.filter(({ page }) => canAccessPage(page)) }))
    .filter(dock => dock.actions.length > 0);

  return `
    <div class="home-dock">
      <section class="dock-greeting" aria-label="ข้อมูลผู้ใช้งาน">
        <h1>สวัสดี, <span id="home-user-name">กำลังโหลด...</span></h1>
        <div class="dock-user-meta">
          <span><i class="fa-regular fa-building" aria-hidden="true"></i><span id="home-user-dept">-</span></span>
          <span><i class="fa-regular fa-calendar-days" aria-hidden="true"></i><span id="home-current-date">--/--/----</span></span>
          <span class="dock-health" data-state="loading" role="status">
            <i class="dock-health-dot" aria-hidden="true"></i><span id="home-health-text">กำลังโหลด</span>
          </span>
        </div>
      </section>

      <section class="dock-kpis" aria-label="ภาพรวมงาน">
        ${renderKpiCard('kpi-fix', 'fa-file-lines', 'งานซ่อมรอดำเนินการ', 'blue')}
        ${renderKpiCard('kpi-car', 'fa-car-side', 'จองรถรออนุมัติ', 'teal')}
        ${renderKpiCard('kpi-shuttle', 'fa-van-shuttle', 'รถรับ-ส่งรอดำเนินการ', 'blue')}
        ${renderKpiCard('kpi-done', 'fa-check', 'ปิดสำเร็จเดือนนี้', 'green')}
      </section>

      <section class="dock-services" aria-label="Service Dock บริการภายใน">
        ${docks.map(renderServiceDock).join('') || '<p class="dock-empty">ไม่มีเมนูที่เปิดใช้งานสำหรับบัญชีนี้</p>'}
      </section>

      <section class="dock-workload" aria-labelledby="dock-workload-title">
        <div class="dock-workload-heading">
          <h2 id="dock-workload-title"><i class="fa-solid fa-chart-simple" aria-hidden="true"></i>ภาพรวมคิวงาน</h2>
          <p>จำนวนรายการที่มองเห็นตามสิทธิ์ผู้ใช้งาน</p>
        </div>
        <div class="dock-workload-grid">
          ${renderWorkload('eng', 'Engineering')}
          ${renderWorkload('car', 'Car booking')}
          ${renderWorkload('shuttle', 'Shuttle')}
        </div>
      </section>
    </div>
  `;
}

export function init() {
  const empName = [sessionStorage.getItem('empName'), sessionStorage.getItem('empLastname')]
    .filter(Boolean)
    .join(' ')
    .trim() || sessionStorage.getItem('username') || 'ผู้ใช้งาน';
  const empDept = sessionStorage.getItem('empDepartment') || '-';

  setText('home-user-name', empName);
  setText('home-user-dept', empDept);
  setText('home-current-date', formatToday());

  loadDashboardData();
}

async function loadDashboardData() {
  const empId = sessionStorage.getItem('empId') || '';
  const empLevelHr = sessionStorage.getItem('empLevel_hr') || sessionStorage.getItem('level_Hr') || '';
  const empLevelEn = sessionStorage.getItem('empLevel_en') || '';
  const empDept = sessionStorage.getItem('empDepartment') || '';

  const isAdminHr = ['admin', 'admin_hr', '1'].includes(String(empLevelHr).toLowerCase());
  const isAdminEn = ['admin', 'admin_en', '1'].includes(String(empLevelEn).toLowerCase());

  try {
    const [snapB1, snapB2, snapFix] = await Promise.all([
      hrGet(hrRef(hrDatabase, 'Booking/Booking1')),
      hrGet(hrRef(hrDatabase, 'Booking/Booking2')),
      get(ref(database, 'DEN/FIX')),
    ]);

    const dashboard = {
      fixPending: 0,
      carPending: 0,
      shuttlePending: 0,
      doneThisMonth: 0,
      engTotal: 0,
      carTotal: 0,
      shuttleTotal: 0,
    };

    collectEngineeringRecords(snapFix, dashboard, { empId, empDept, isAdminEn });
    collectBookingRecords(snapB1, dashboard, { empId, empDept, isAdminHr, type: 'car' });
    collectBookingRecords(snapB2, dashboard, { empId, empDept, isAdminHr, type: 'shuttle' });

    updateDashboard(dashboard);
  } catch (error) {
    console.error('Dashboard Load Error:', error);
    setHealth('error', 'โหลดไม่สำเร็จ');
    setKpiError();
  }
}

function collectEngineeringRecords(snapshot, dashboard, access) {
  if (!snapshot.exists()) return;

  const fixData = snapshot.val();
  Object.entries(fixData).forEach(([, recordsByYear]) => {
    Object.entries(recordsByYear || {}).forEach(([id, rec]) => {
      if (!rec || !canSeeEngineering(rec, access)) return;

      const step = String(rec.step || '0');
      dashboard.engTotal += 1;
      if (['1', '2', '3', '5'].includes(step)) dashboard.fixPending += 1;
      if (isDoneThisMonth(rec.date, step, ['4', '6'])) dashboard.doneThisMonth += 1;
    });
  });
}

function collectBookingRecords(snapshot, dashboard, access) {
  if (!snapshot.exists()) return;

  const data = snapshot.val();
  const isCar = access.type === 'car';

  Object.entries(data).forEach(([, recordsByYear]) => {
    Object.entries(recordsByYear || {}).forEach(([id, rec]) => {
      if (!rec || !canSeeBooking(rec, access)) return;

      const step = String(rec.step || '0');
      if (isCar) dashboard.carTotal += 1;
      else dashboard.shuttleTotal += 1;

      if (['1', '2'].includes(step)) {
        if (isCar) dashboard.carPending += 1;
        else dashboard.shuttlePending += 1;
      }
      if (isDoneThisMonth(rec.date, step, ['4'])) dashboard.doneThisMonth += 1;
    });
  });
}

function canSeeEngineering(rec, { empId, empDept, isAdminEn }) {
  if (isAdminEn) return true;
  const recDept = rec.dep || '-';
  const recReqId = getPairId(rec.name);
  const recApproveId = getPairId(rec.approve);
  return recDept === empDept || recReqId === empId || recApproveId === empId;
}

function canSeeBooking(rec, { empId, empDept, isAdminHr }) {
  if (isAdminHr) return true;
  const recDept = rec.dep || rec.department || '-';
  const recReqId = getPairId(rec.name);
  const recApproveId = getPairId(rec.approve);
  return recDept === empDept || recReqId === empId || recApproveId === empId;
}

function updateDashboard(dashboard) {
  animateCounter('kpi-fix', dashboard.fixPending);
  animateCounter('kpi-car', dashboard.carPending);
  animateCounter('kpi-shuttle', dashboard.shuttlePending);
  animateCounter('kpi-done', dashboard.doneThisMonth);

  setText('home-eng-total', dashboard.engTotal);
  setText('home-car-total', dashboard.carTotal);
  setText('home-shuttle-total', dashboard.shuttleTotal);
  setHealth('ready', 'พร้อมใช้งาน');

  const maxTotal = Math.max(dashboard.engTotal, dashboard.carTotal, dashboard.shuttleTotal, 1);
  setMeter('home-eng-meter', dashboard.engTotal, maxTotal);
  setMeter('home-car-meter', dashboard.carTotal, maxTotal);
  setMeter('home-shuttle-meter', dashboard.shuttleTotal, maxTotal);
}

function setKpiError() {
  ['kpi-fix', 'kpi-car', 'kpi-shuttle', 'kpi-done', 'home-eng-total', 'home-car-total', 'home-shuttle-total']
    .forEach(id => setText(id, '-'));
}

function setHealth(state, message) {
  setText('home-health-text', message);
  const status = document.getElementById('home-health-text')?.closest('.dock-health');
  if (status) status.dataset.state = state;
}

function renderKpiCard(id, icon, label, color) {
  const readableLabel = escapeHTML(label).replace('รอดำเนินการ', '<span class="dock-label-tail">รอดำเนินการ</span>');
  return `
    <div class="dock-kpi dock-kpi-${color}">
      <span class="dock-kpi-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <div>
        <p>${readableLabel}</p>
        <strong class="dock-kpi-value" id="${id}"><span class="skeleton-value" aria-label="กำลังโหลด"></span></strong>
      </div>
    </div>`;
}

function renderServiceDock({ id, title, icon, description, image, actions }) {
  return `
    <article class="dock-service dock-service-${id}" aria-labelledby="dock-title-${id}">
      <header class="dock-service-heading">
        <span class="dock-service-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
        <div><h2 id="dock-title-${id}">${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>
      </header>
      <div class="dock-art" aria-hidden="true">
        <img src="${escapeHTML(image)}" alt="" width="840" height="560" decoding="async" draggable="false">
      </div>
      <div class="dock-actions">${actions.map(renderActionButton).join('')}</div>
    </article>`;
}

function renderActionButton({ page, icon, label }) {
  return `
    <button type="button" class="dock-action" onclick="showPage('${page}')">
      <i class="fa-solid ${icon} dock-action-icon" aria-hidden="true"></i>
      <span>${escapeHTML(label)}</span>
      <i class="fa-solid fa-chevron-right dock-action-arrow" aria-hidden="true"></i>
    </button>`;
}

function renderWorkload(id, label) {
  return `
    <div class="dock-workload-item dock-workload-${id}">
      <span>${escapeHTML(label)}</span>
      <strong id="home-${id}-total">-</strong>
      <div class="dock-meter" aria-hidden="true"><i id="home-${id}-meter" style="width:0%"></i></div>
    </div>`;
}

function isDoneThisMonth(date, step, doneSteps) {
  if (!date || !doneSteps.includes(String(step))) return false;
  const parsed = parseDateTime(date);
  if (!parsed) return false;
  const d = new Date(parsed);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getPairId(value) {
  return String(value || '').split('|')[0].trim();
}

function setMeter(id, value, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const num = parseInt(target, 10);
  if (isNaN(num)) { el.textContent = target; return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = num;
    return;
  }
  const duration = 700;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = Math.round(num * eased);
    if (t < 1) requestAnimationFrame(tick);
    else { el.textContent = num; el.classList.add('counter-pop'); }
  };
  requestAnimationFrame(tick);
}

function formatToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
