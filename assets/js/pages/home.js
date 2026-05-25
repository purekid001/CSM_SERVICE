import { database, ref, get } from '../firebase.js';
import { hrDatabase } from '../firebase-hr.js';
import { parseDateTime, canAccessPage } from '../utils.js';

export function render() {
  const actionButtons = [
    renderActionButton('eng-request', 'fa-wrench', 'แจ้งซ่อม', 'สร้างใบแจ้งซ่อม', '#d97706', '#fef3c7'),
    renderActionButton('eng-list', 'fa-list-check', 'ติดตามงานซ่อม', 'ตรวจสถานะ EN', '#059669', '#d1fae5'),
    renderActionButton('eng-doc', 'fa-folder-open', 'เอกสาร EN', 'มาตรฐานวิศวกรรม', '#2563eb', '#dbeafe'),
    renderActionButton('hr-car', 'fa-car', 'จองรถ', 'สร้างคำขอใช้รถ', '#1d4ed8', '#dbeafe'),
    renderActionButton('hr-shuttle', 'fa-bus', 'รถรับ-ส่ง', 'สร้างคำขอ shuttle', '#7c3aed', '#ede9fe'),
    renderActionButton('hr-list', 'fa-clipboard-check', 'ติดตามงานรถ', 'อนุมัติและปิดงาน', '#0f766e', '#ccfbf1'),
    renderActionButton('hr-doc', 'fa-file-signature', 'เอกสาร HR', 'แบบฟอร์มและระเบียบ', '#be123c', '#ffe4e6'),
  ].filter(Boolean);

  return `
    <div class="home-wrap fade-in">
      <section class="home-command">
        <div class="home-command-main">
          <div class="home-command-icon">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <p class="home-eyebrow">CSM SERVICE DASHBOARD</p>
            <h1>สวัสดี, <span id="home-user-name">กำลังโหลด...</span></h1>
            <p class="home-command-sub">
              <i class="fa-solid fa-building-user"></i>
              <span id="home-user-dept">-</span>
            </p>
          </div>
        </div>
        <div class="home-command-meta">
          <div>
            <span>วันนี้</span>
            <strong id="home-current-date">--/--/----</strong>
          </div>
          <div>
            <span>สถานะข้อมูล</span>
            <strong id="home-health-text">กำลังโหลด</strong>
          </div>
        </div>
      </section>

      <section class="home-kpi-row" aria-label="ภาพรวมงาน">
        ${renderKpiCard('kpi-fix', 'fa-screwdriver-wrench', 'งานซ่อมรอดำเนินการ', 'Engineering', 'kpi-amber')}
        ${renderKpiCard('kpi-car', 'fa-car-side', 'จองรถรออนุมัติ', 'Car booking', 'kpi-blue')}
        ${renderKpiCard('kpi-shuttle', 'fa-van-shuttle', 'รถรับ-ส่งรอดำเนินการ', 'Shuttle service', 'kpi-purple')}
        ${renderKpiCard('kpi-done', 'fa-check-double', 'ปิดสำเร็จเดือนนี้', 'Completed', 'kpi-green')}
      </section>

      <section class="home-main-grid">
        <div class="form-card home-panel home-actions-panel">
          <div class="home-panel-header">
            <div>
              <h3><i class="fa-solid fa-bolt"></i> เมนูลัด</h3>
              <p>งานที่ใช้บ่อยในระบบ</p>
            </div>
          </div>
          <div class="home-action-grid">
            ${actionButtons.join('')}
          </div>
        </div>

        <div class="form-card home-panel">
          <div class="home-panel-header">
            <div>
              <h3><i class="fa-solid fa-wave-square"></i> ภาพรวมคิวงาน</h3>
              <p>จำนวนรายการที่มองเห็นตามสิทธิ์ผู้ใช้งาน</p>
            </div>
          </div>
          <div class="home-workload">
            <div class="home-workload-item">
              <span>Engineering</span>
              <strong id="home-eng-total">0</strong>
              <div class="home-meter"><i id="home-eng-meter" style="width:0%;"></i></div>
            </div>
            <div class="home-workload-item">
              <span>Car booking</span>
              <strong id="home-car-total">0</strong>
              <div class="home-meter"><i id="home-car-meter" style="width:0%;"></i></div>
            </div>
            <div class="home-workload-item">
              <span>Shuttle</span>
              <strong id="home-shuttle-total">0</strong>
              <div class="home-meter"><i id="home-shuttle-meter" style="width:0%;"></i></div>
            </div>
          </div>
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
      get(ref(hrDatabase, 'Booking/Booking1')),
      get(ref(hrDatabase, 'Booking/Booking2')),
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
    setText('home-health-text', 'โหลดไม่สำเร็จ');
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
  setText('kpi-fix', dashboard.fixPending);
  setText('kpi-car', dashboard.carPending);
  setText('kpi-shuttle', dashboard.shuttlePending);
  setText('kpi-done', dashboard.doneThisMonth);

  setText('home-eng-total', dashboard.engTotal);
  setText('home-car-total', dashboard.carTotal);
  setText('home-shuttle-total', dashboard.shuttleTotal);
  setText('home-health-text', 'พร้อมใช้งาน');

  const maxTotal = Math.max(dashboard.engTotal, dashboard.carTotal, dashboard.shuttleTotal, 1);
  setMeter('home-eng-meter', dashboard.engTotal, maxTotal);
  setMeter('home-car-meter', dashboard.carTotal, maxTotal);
  setMeter('home-shuttle-meter', dashboard.shuttleTotal, maxTotal);
}

function setKpiError() {
  ['kpi-fix', 'kpi-car', 'kpi-shuttle', 'kpi-done'].forEach(id => setText(id, '-'));
}

function renderKpiCard(id, icon, label, caption, cssClass) {
  return `
    <div class="form-card kpi-card ${cssClass}">
      <div class="kpi-icon"><i class="fa-solid ${icon}"></i></div>
      <div>
        <p class="kpi-caption">${escapeHTML(caption)}</p>
        <p class="kpi-label">${escapeHTML(label)}</p>
        <h2 class="kpi-value" id="${id}"><i class="fa-solid fa-spinner fa-spin"></i></h2>
      </div>
    </div>`;
}

function renderActionButton(page, icon, label, caption, color, bg) {
  if (!canAccessPage(page)) return '';

  return `
    <button class="quick-action-btn" onclick="showPage('${page}')" style="--qa-color:${color}; --qa-bg:${bg};">
      <span class="qa-icon"><i class="fa-solid ${icon}"></i></span>
      <span class="qa-copy">
        <strong>${escapeHTML(label)}</strong>
        <small>${escapeHTML(caption)}</small>
      </span>
      <i class="fa-solid fa-arrow-right qa-arrow"></i>
    </button>`;
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
  if (el) el.style.width = `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
