/**
 * HR — Report (รายงานสรุปสถิติการจองรถ)
 */
import { hrDatabase, ref, get } from '../firebase-hr.js';
import { getHrStepText as getStepText, getHrStepBadge as getStepBadge, parseDMY, formatDate as fmtDate, buildPaginationHTML, bindPaginationEvents, escapeHTML } from '../utils.js';

let currentChart1 = null;
let currentChart2 = null;

// Helpers moved to utils.js

export function render() {
  return `
    <div class="app-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Analytics</p>
          <h1 class="page-hero-title">HR Booking Reports</h1>
          <p class="page-hero-subtitle">สรุปสถิติการจองรถและรถรับส่ง ดูแนวโน้มรายวัน พร้อมไล่ timeline รายการย้อนหลังเพื่อช่วยวางแผนและติดตามงานบริการได้ครบขึ้น</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ประเภทหน้า</span>
            <strong>Dashboard + Export Report</strong>
          </div>
          <div class="page-hero-stat">
            <span>โมดูลข้อมูล</span>
            <strong>Car + Shuttle Booking</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>มุมมองวิเคราะห์งานบริการ HR</strong>
          เลือกช่วงวันที่และประเภทบริการก่อนสร้างรายงาน ระบบจะแสดงสรุปสถานะ กราฟแนวโน้ม และ timeline การจองเพื่อช่วยให้ตรวจสอบงานย้อนหลังได้ต่อเนื่อง
        </div>
      </div>

        <section class="form-card report-filter-card fade-in">
          <div class="form-header">
            <div class="form-header-copy">
              <div class="form-header-icon">
                <i class="fa-solid fa-chart-column"></i>
              </div>
              <div class="form-header-text">
                <h2>HR Booking Reports</h2>
                <p>เลือกช่วงวันที่และประเภทบริการก่อนสร้างรายงานสรุปและ Export ข้อมูล</p>
              </div>
            </div>
            <div class="form-header-badge">
              <i class="fa-solid fa-file-export"></i>
              Export ได้หลังสร้างรายงาน
            </div>
          </div>
          <div class="list-filter-bar report-filter-bar">
          <div class="filter-group">
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar"></i> วันที่เริ่ม</label>
              <input type="text" class="form-control" id="hr-rep-start" placeholder="dd/mm/yyyy" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar-check"></i> วันที่สิ้นสุด</label>
              <input type="text" class="form-control" id="hr-rep-end" placeholder="dd/mm/yyyy" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-car"></i> ประเภท</label>
              <select class="form-control" id="hr-rep-module">
                <option value="">ทั้งหมด</option>
                <option value="Car">รถยนต์ (Car)</option>
                <option value="Shuttle">รถรับส่ง (Shuttle)</option>
              </select>
            </div>
          </div>
          <div class="filter-actions report-filter-actions">
            <button class="btn btn-primary" id="hr-rep-btn"><i class="fa-solid fa-bolt"></i> สร้างรายงาน</button>
            <button class="btn btn-secondary" id="hr-rep-export" style="display:none;"><i class="fa-solid fa-file-excel"></i> Export</button>
          </div>
          </div>
        </section>

        <section id="hr-rep-summary" class="report-section" style="display:none;">
          <div class="report-metric-grid report-metric-grid-5">
            <div class="form-card report-metric-card metric-blue">
              <span class="report-metric-icon"><i class="fa-solid fa-clipboard-list"></i></span>
              <div>
                <strong id="sum-total">0</strong>
                <span>ทั้งหมด</span>
              </div>
            </div>
            <div class="form-card report-metric-card metric-amber">
              <span class="report-metric-icon"><i class="fa-solid fa-clock"></i></span>
              <div>
                <strong id="sum-pending">0</strong>
                <span>รออนุมัติ</span>
              </div>
            </div>
            <div class="form-card report-metric-card metric-purple">
              <span class="report-metric-icon"><i class="fa-solid fa-check-circle"></i></span>
              <div>
                <strong id="sum-approved">0</strong>
                <span>อนุมัติแล้ว</span>
              </div>
            </div>
            <div class="form-card report-metric-card metric-green">
              <span class="report-metric-icon"><i class="fa-solid fa-flag-checkered"></i></span>
              <div>
                <strong id="sum-closed">0</strong>
                <span>ปิดงานแล้ว</span>
              </div>
            </div>
            <div class="form-card report-metric-card metric-red">
              <span class="report-metric-icon"><i class="fa-solid fa-ban"></i></span>
              <div>
                <strong id="sum-cancel">0</strong>
                <span>ยกเลิก</span>
              </div>
            </div>
          </div>
        </section>

        <section id="hr-rep-charts" class="report-section" style="display:none;">
          <div class="report-chart-grid">
            <div class="form-card report-panel report-chart-card">
              <div class="report-card-header compact">
                <h3><i class="fa-solid fa-chart-pie"></i> สัดส่วนสถานะ</h3>
              </div>
              <div class="report-chart-box"><canvas id="hr-chart-status"></canvas></div>
            </div>
            <div class="form-card report-panel report-chart-card report-chart-wide">
              <div class="report-card-header compact">
                <h3><i class="fa-solid fa-chart-bar"></i> แนวโน้มรายวัน</h3>
              </div>
              <div class="report-chart-box"><canvas id="hr-chart-daily"></canvas></div>
            </div>
          </div>
        </section>

        <section class="form-card report-panel report-timeline-panel" id="hr-rep-timeline-card" style="display:none;">
          <div class="report-card-header report-card-header-row" id="hr-rep-timeline-header" style="cursor: pointer; user-select: none;">
            <div>
              <h3>
                <i class="fa-solid fa-timeline"></i> Timeline การจอง
                <i class="fa-solid fa-chevron-down" id="hr-rep-tl-icon" style="margin-left: 8px; font-size: 0.8em; transition: transform 0.3s; color: #6366f1;"></i>
              </h3>
              <p>คลิกเพื่อแสดงหรือซ่อนรายการจองรถเรียงตามวันที่ล่าสุด</p>
            </div>
            <div class="report-inline-filter" id="hr-rep-tl-filter-group" style="display: none; pointer-events: auto;" onclick="event.stopPropagation();">
              <label><i class="fa-solid fa-car-side"></i> กรองตามรถ</label>
              <select class="form-control" id="hr-rep-tl-car">
                <option value="">-- ทุกคัน --</option>
              </select>
            </div>
          </div>
          <div id="hr-rep-timeline-content" style="display: none;">
            <div id="hr-rep-timeline" class="report-timeline-body"></div>
            <div id="hr-rep-tl-pagination" class="pagination-bar"></div>
          </div>
        </section>

        <section class="report-table-grid">
          <div class="form-card report-panel" id="hr-rep-dept-card" style="display:none;">
            <div class="report-card-header compact">
              <h3><i class="fa-solid fa-building"></i> สรุปตามแผนก</h3>
            </div>
            <div class="table-wrapper report-table-wrapper">
              <table class="data-table table-width-lock" id="hr-rep-dept-table" style="--report-table-min-width: 980px; --table-lock-width: 980px; --table-cell-min: 120px;">
                <thead><tr>
                  <th>แผนก</th><th class="cell-center">ทั้งหมด</th>
                  <th class="cell-center">รออนุมัติ</th><th class="cell-center">อนุมัติแล้ว</th>
                  <th class="cell-center">ปิดงาน</th><th class="cell-center">ยกเลิก</th>
                </tr></thead>
                <tbody id="hr-rep-dept-tbody"></tbody>
              </table>
            </div>
          </div>

          <div class="form-card report-panel" id="hr-rep-driver-card" style="display:none;">
            <div class="report-card-header compact">
              <h3><i class="fa-solid fa-id-badge"></i> สรุปตามคนขับ</h3>
            </div>
            <div class="table-wrapper report-table-wrapper">
              <table class="data-table table-width-lock" id="hr-rep-driver-table" style="--report-table-min-width: 920px; --table-lock-width: 920px; --table-cell-min: 120px;">
                <thead><tr>
                  <th>คนขับ</th><th class="cell-center">งานทั้งหมด</th>
                  <th class="cell-center">อนุมัติแล้ว</th><th class="cell-center">ปิดงาน</th>
                  <th class="cell-center">ยกเลิก</th>
                </tr></thead>
                <tbody id="hr-rep-driver-tbody"></tbody>
              </table>
            </div>
          </div>
        </section>
    </div>
  `;
}

export function init() {
  flatpickr('#hr-rep-start', { dateFormat: 'd/m/Y', disableMobile: true });
  flatpickr('#hr-rep-end', { dateFormat: 'd/m/Y', disableMobile: true });

  // Default: current month
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('hr-rep-start')._flatpickr.setDate(first);
  document.getElementById('hr-rep-end')._flatpickr.setDate(today);

  document.getElementById('hr-rep-btn').addEventListener('click', generateReport);
  document.getElementById('hr-rep-export').addEventListener('click', exportExcel);
  document.getElementById('hr-rep-tl-car').addEventListener('change', () => { tlPage = 1; renderTimeline(); });

  // Toggle Timeline collapse/expand
  const tlHeader = document.getElementById('hr-rep-timeline-header');
  if (tlHeader) {
    tlHeader.addEventListener('click', () => {
      const content = document.getElementById('hr-rep-timeline-content');
      const icon = document.getElementById('hr-rep-tl-icon');
      const filterGroup = document.getElementById('hr-rep-tl-filter-group');
      if (content.style.display === 'none') {
        content.style.display = 'block';
        if (filterGroup) filterGroup.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        content.style.display = 'none';
        if (filterGroup) filterGroup.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  }
}

let allRecords = [];
let tlPage = 1;
const TL_SIZE = 15;

async function generateReport() {
  const startStr = document.getElementById('hr-rep-start').value;
  const endStr = document.getElementById('hr-rep-end').value;
  const modFilter = document.getElementById('hr-rep-module').value;

  if (!startStr || !endStr) { showToast('กรุณาเลือกช่วงวันที่', 'warning'); return; }

  const startDt = parseDMY(startStr); startDt.setHours(0, 0, 0, 0);
  const endDt = parseDMY(endStr); endDt.setHours(23, 59, 59, 999);

  const btn = document.getElementById('hr-rep-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...';
  btn.disabled = true;

  try {
    const [snap1, snap2] = await Promise.all([
      get(ref(hrDatabase, 'Booking/Booking1')),
      get(ref(hrDatabase, 'Booking/Booking2'))
    ]);

    allRecords = [];

    function push(raw, module) {
      if (!raw || !raw.id) return;
      const bd = parseDMY(raw.bookingDate);
      if (!bd || bd < startDt || bd > endDt) return;
      if (modFilter && module !== modFilter) return;
      allRecords.push({
        id: raw.id, date: raw.date, name: raw.name, dep: raw.dep || raw.department || '-',
        type: raw.type, step: String(raw.step || '0'), approve: raw.approve || '-',
        bookingDate: raw.bookingDate, pickupLoc: raw.pickupLoc || raw.pickupLocation || '-',
        pickupTime: raw.pickupTime || '-', deliveryLoc: raw.deliveryLoc || raw.dropoffLocation || '-',
        headcount: raw.headcount || raw.amont || '-', module,
        car: raw.car || '-', driverName: raw.driverName || '-',
        group: raw.group || '-',
        adminApprove: raw.adminApprove || '-', adminApproveTime: raw.adminApproveTime || '-',
        closeApprove: raw.closeApprove || '-', closeApproveTime: raw.closeApproveTime || '-',
        cancelApprove: raw.cancelApprove || '-', cancelApproveTime: raw.cancelApproveTime || '-',
        dateUpdate: raw.dateUpdate || '-',
      });
    }

    if (snap1.exists()) {
      const d = snap1.val();
      Object.values(d).forEach(yr => { if (yr && typeof yr === 'object') Object.values(yr).forEach(r => push(r, 'Car')); });
    }
    if (snap2.exists()) {
      const d = snap2.val();
      Object.values(d).forEach(yr => { if (yr && typeof yr === 'object') Object.values(yr).forEach(r => push(r, 'Shuttle')); });
    }

    allRecords.sort((a, b) => (parseDMY(b.bookingDate) || 0) - (parseDMY(a.bookingDate) || 0));

    // Show elements BEFORE rendering so Chart.js can calculate correct width/height
    document.getElementById('hr-rep-summary').style.display = 'block';
    document.getElementById('hr-rep-charts').style.display = 'block';
    document.getElementById('hr-rep-dept-card').style.display = 'block';
    document.getElementById('hr-rep-driver-card').style.display = 'block';
    document.getElementById('hr-rep-timeline-card').style.display = 'block';
    document.getElementById('hr-rep-timeline-content').style.display = 'none';
    document.getElementById('hr-rep-tl-filter-group').style.display = 'none';
    document.getElementById('hr-rep-tl-icon').style.transform = 'rotate(0deg)';
    document.getElementById('hr-rep-export').style.display = 'inline-flex';

    renderSummary();
    renderCharts();
    renderDeptTable();
    renderDriverTable();
    populateCarFilter();
    tlPage = 1;
    renderTimeline();

  } catch (e) {
    console.error('Report error:', e);
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
  btn.innerHTML = '<i class="fa-solid fa-bolt"></i> สร้างรายงาน';
  btn.disabled = false;
}

function renderSummary() {
  const cnt = { total: 0, pending: 0, approved: 0, closed: 0, cancel: 0 };
  allRecords.forEach(r => {
    cnt.total++;
    if (r.step === '1' || r.step === '2') cnt.pending++;
    else if (r.step === '3') cnt.approved++;
    else if (r.step === '4') cnt.closed++;
    else if (r.step === '5') cnt.cancel++;
  });
  document.getElementById('sum-total').textContent = cnt.total;
  document.getElementById('sum-pending').textContent = cnt.pending;
  document.getElementById('sum-approved').textContent = cnt.approved;
  document.getElementById('sum-closed').textContent = cnt.closed;
  document.getElementById('sum-cancel').textContent = cnt.cancel;
}

function renderCharts() {
  // Chart 1: Status Doughnut
  const statusCnt = {};
  allRecords.forEach(r => { const l = getStepText(r.step); statusCnt[l] = (statusCnt[l] || 0) + 1; });
  const sLabels = Object.keys(statusCnt), sData = Object.values(statusCnt);

  // Premium status-mapped harmonized color palette
  const statusColors = {
    'รอหัวหน้าอนุมัติ': '#f59e0b',        // Amber
    'รอทีมจัดรถอนุมัติ': '#38bdf8',       // Sky Blue
    'ทีมจัดรถอนุมัติแล้ว': '#6366f1',      // Indigo
    'ปิดงานแล้ว': '#10b981',             // Emerald
    'ยกเลิก': '#ef4444'                 // Rose
  };
  const colors = sLabels.map(l => statusColors[l] || '#9ca3af');

  if (currentChart1) currentChart1.destroy();
  const ctx1 = document.getElementById('hr-chart-status').getContext('2d');
  currentChart1 = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: sLabels,
      datasets: [{
        data: sData,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBorderWidth: 4,
        hoverOffset: 12,
      }]
    },
    options: {
      maintainAspectRatio: false,
      cutout: '70%',
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1600,
        easing: 'easeOutBack'
      },
      plugins: {
        legend: { 
          position: 'right', 
          labels: { 
            padding: 16, 
            usePointStyle: true, 
            pointStyle: 'circle', 
            font: { size: 13, family: "'Inter', 'Noto Sans Thai', sans-serif" } 
          } 
        },
      }
    }
  });

  // Chart 2: Daily Bar
  const dailyCnt = {};
  allRecords.forEach(r => { if (r.bookingDate && r.bookingDate !== '-') { const d = r.bookingDate.split(' ')[0]; dailyCnt[d] = (dailyCnt[d] || 0) + 1; } });
  const sorted = Object.keys(dailyCnt).sort((a, b) => { const [d1, m1, y1] = a.split('/'); const [d2, m2, y2] = b.split('/'); return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2); });
  // Short labels: dd/mm only
  const shortLabels = sorted.map(d => d.split('/').slice(0, 2).join('/'));

  if (currentChart2) currentChart2.destroy();
  const ctx2 = document.getElementById('hr-chart-daily').getContext('2d');

  // Dynamic vertical linear canvas gradient matching the indigo theme
  const gradient = ctx2.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.15)');

  currentChart2 = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: shortLabels,
      datasets: [{
        label: 'จำนวนการจอง',
        data: sorted.map(d => dailyCnt[d]),
        backgroundColor: gradient,
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(99, 102, 241, 0.95)',
      }]
    },
    options: {
      maintainAspectRatio: false,
      animation: {
        duration: 1400,
        easing: 'easeOutBack',
        delay: (context) => {
          let delay = 0;
          if (context.type === 'data' && (context.mode === 'default' || context.mode === 'show' || context.mode === 'reset')) {
            delay = context.dataIndex * 45; // 45ms stagger per bar
          }
          return delay;
        }
      },
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { 
          grid: { display: false }, 
          ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif", size: 11 }, maxRotation: 45, minRotation: 0 } 
        },
        y: { 
          beginAtZero: true, 
          grid: { color: 'rgba(0,0,0,0.04)' }, 
          ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif", size: 12 }, stepSize: Math.ceil(Math.max(...sorted.map(d => dailyCnt[d])) / 5) } 
        }
      }
    }
  });
}

function renderDeptTable() {
  const depts = {};
  allRecords.forEach(r => {
    const dep = r.dep || '-';
    if (!depts[dep]) depts[dep] = { total: 0, pending: 0, approved: 0, closed: 0, cancel: 0 };
    depts[dep].total++;
    if (r.step === '1' || r.step === '2') depts[dep].pending++;
    else if (r.step === '3') depts[dep].approved++;
    else if (r.step === '4') depts[dep].closed++;
    else if (r.step === '5') depts[dep].cancel++;
  });
  const keys = Object.keys(depts).sort((a, b) => depts[b].total - depts[a].total);
  let html = keys.map(k => {
    const d = depts[k];
    return `<tr><td>${escapeHTML(k)}</td><td class="cell-center" style="font-weight:600;">${d.total}</td>
      <td class="cell-center" style="color:#f59e0b;font-weight:600;">${d.pending}</td>
      <td class="cell-center" style="color:#8b5cf6;font-weight:600;">${d.approved}</td>
      <td class="cell-center" style="color:#10b981;font-weight:600;">${d.closed}</td>
      <td class="cell-center" style="color:#ef4444;font-weight:600;">${d.cancel}</td></tr>`;
  }).join('');
  // Total row
  const t = { total: allRecords.length, pending: 0, approved: 0, closed: 0, cancel: 0 };
  allRecords.forEach(r => { if (r.step === '1' || r.step === '2') t.pending++; else if (r.step === '3') t.approved++; else if (r.step === '4') t.closed++; else if (r.step === '5') t.cancel++; });
  html += `<tr style="font-weight:700;background:#f1f5f9;"><td style="text-align:right;">รวมทั้งหมด</td>
    <td class="cell-center">${t.total}</td><td class="cell-center" style="color:#f59e0b;">${t.pending}</td>
    <td class="cell-center" style="color:#8b5cf6;">${t.approved}</td><td class="cell-center" style="color:#10b981;">${t.closed}</td>
    <td class="cell-center" style="color:#ef4444;">${t.cancel}</td></tr>`;
  document.getElementById('hr-rep-dept-tbody').innerHTML = html;
}

function renderDriverTable() {
  const drivers = {};
  allRecords.forEach(r => {
    if (!r.driverName || r.driverName === '-') return;
    // Split comma-separated drivers
    r.driverName.split(',').forEach(dn => {
      const name = dn.trim().replace(/^-/, '').trim();
      if (!name) return;
      if (!drivers[name]) drivers[name] = { total: 0, approved: 0, closed: 0, cancel: 0 };
      drivers[name].total++;
      if (r.step === '3') drivers[name].approved++;
      else if (r.step === '4') drivers[name].closed++;
      else if (r.step === '5') drivers[name].cancel++;
    });
  });
  const keys = Object.keys(drivers).sort((a, b) => drivers[b].total - drivers[a].total);
  let totalAll = 0, totalApproved = 0, totalClosed = 0, totalCancel = 0;
  let html = keys.map(k => {
    const d = drivers[k];
    totalAll += d.total; totalApproved += d.approved; totalClosed += d.closed; totalCancel += d.cancel;
    return `<tr><td>${escapeHTML(k)}</td><td class="cell-center" style="font-weight:600;">${d.total}</td>
      <td class="cell-center" style="color:#8b5cf6;font-weight:600;">${d.approved}</td>
      <td class="cell-center" style="color:#10b981;font-weight:600;">${d.closed}</td>
      <td class="cell-center" style="color:#ef4444;font-weight:600;">${d.cancel}</td></tr>`;
  }).join('');
  html += `<tr style="font-weight:700;background:#f1f5f9;"><td style="text-align:right;">รวมทั้งหมด</td>
    <td class="cell-center">${totalAll}</td>
    <td class="cell-center" style="color:#8b5cf6;">${totalApproved}</td>
    <td class="cell-center" style="color:#10b981;">${totalClosed}</td>
    <td class="cell-center" style="color:#ef4444;">${totalCancel}</td></tr>`;
  document.getElementById('hr-rep-driver-tbody').innerHTML = html;
}

function renderTimeline() {
  const container = document.getElementById('hr-rep-timeline');
  const carFilter = document.getElementById('hr-rep-tl-car').value;
  const filtered = carFilter ? allRecords.filter(r => r.car === carFilter) : allRecords;

  if (filtered.length === 0) { container.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;"><i class="fa-solid fa-inbox"></i> ไม่มีข้อมูล</div>'; document.getElementById('hr-rep-tl-pagination').innerHTML = ''; return; }

  const totalPages = Math.ceil(filtered.length / TL_SIZE);
  if (tlPage > totalPages) tlPage = totalPages;
  if (tlPage < 1) tlPage = 1;
  const start = (tlPage - 1) * TL_SIZE;
  const items = filtered.slice(start, start + TL_SIZE);

  let html = '<div class="tl-container">';
  items.forEach((r, i) => {
    const stepColors = { '1': '#f59e0b', '2': '#3b82f6', '3': '#8b5cf6', '4': '#10b981', '5': '#ef4444' };
    const color = stepColors[r.step] || '#94a3b8';
    const icon = { '1': 'fa-clock', '2': 'fa-car', '3': 'fa-check', '4': 'fa-flag-checkered', '5': 'fa-ban' };
    const ic = icon[r.step] || 'fa-circle';
    const reqName = (r.name || '-').split(' | ')[1] || r.name || '-';
    const primaryDriver = (r.driverName || '-').split(',')[0] || '-';
    const adminApproveName = (r.adminApprove || '-').split(' | ')[1] || r.adminApprove || '-';
    const moduleLabel = r.module === 'Car' ? 'Car' : 'Shuttle';

    html += `
    <div class="tl-item" style="--tl-color:${color};">
      <div class="tl-dot"><i class="fa-solid ${ic}"></i></div>
      <div class="tl-content">
        <div class="tl-header">
          <span class="tl-id">${escapeHTML(r.id)}</span>
          ${getStepBadge(r.step)}
          <span class="tl-module" style="background:${moduleLabel === 'Car' ? '#dbeafe' : '#fef3c7'};color:${moduleLabel === 'Car' ? '#2563eb' : '#d97706'};">${escapeHTML(moduleLabel)}</span>
        </div>
        <div class="tl-body">
          <div class="tl-row"><i class="fa-solid fa-calendar-days"></i> <strong>วันที่จอง:</strong> ${escapeHTML(r.bookingDate)}</div>
          <div class="tl-row"><i class="fa-solid fa-user"></i> <strong>ผู้แจ้ง:</strong> ${escapeHTML(reqName)}</div>
          <div class="tl-row"><i class="fa-solid fa-building"></i> <strong>แผนก:</strong> ${escapeHTML(r.dep)}</div>
          <div class="tl-row"><i class="fa-solid fa-location-dot"></i> <strong>จาก:</strong> ${escapeHTML(r.pickupLoc)} (${escapeHTML(r.pickupTime)}) → <strong>ถึง:</strong> ${escapeHTML(r.deliveryLoc)}</div>
          ${r.car !== '-' ? `<div class="tl-row"><i class="fa-solid fa-car-side"></i> <strong>รถ:</strong> ${escapeHTML(r.car)} | <strong>คนขับ:</strong> ${escapeHTML(primaryDriver)}</div>` : ''}
          ${r.adminApproveTime !== '-' ? `<div class="tl-row tl-sub"><i class="fa-solid fa-check-circle" style="color:#10b981;"></i> อนุมัติเมื่อ ${escapeHTML(r.adminApproveTime)} โดย ${escapeHTML(adminApproveName)}</div>` : ''}
          ${r.closeApproveTime !== '-' ? `<div class="tl-row tl-sub"><i class="fa-solid fa-flag-checkered" style="color:#6366f1;"></i> ปิดงานเมื่อ ${escapeHTML(r.closeApproveTime)}</div>` : ''}
          ${r.cancelApproveTime !== '-' ? `<div class="tl-row tl-sub"><i class="fa-solid fa-ban" style="color:#ef4444;"></i> ยกเลิกเมื่อ ${escapeHTML(r.cancelApproveTime)}</div>` : ''}
        </div>
        <div class="tl-footer">เขียนเมื่อ ${escapeHTML(r.date || '-')}</div>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;

  // Pagination
  const pagBar = document.getElementById('hr-rep-tl-pagination');
  pagBar.innerHTML = buildPaginationHTML(tlPage, totalPages, filtered.length, TL_SIZE);
  bindPaginationEvents(pagBar, 'hr-rep-timeline-card', () => tlPage, p => tlPage = p, renderTimeline);
}

function populateCarFilter() {
  const sel = document.getElementById('hr-rep-tl-car');
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- ทุกคัน --</option>';
  const cars = new Set();
  allRecords.forEach(r => { if (r.car && r.car !== '-') cars.add(r.car); });
  Array.from(cars).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
  if (prev && cars.has(prev)) sel.value = prev;
}



function exportExcel() {
  if (allRecords.length === 0) { showToast('ไม่มีข้อมูลสำหรับ Export', 'warning'); return; }
  try {
    const data = allRecords.map(r => ({
      'รหัส': r.id, 'วันที่เขียน': r.date, 'วันที่จอง': r.bookingDate,
      'ประเภท': r.module, 'ชนิด': r.type, 'สถานะ': getStepText(r.step),
      'ผู้แจ้ง': (r.name || '').split(' | ')[1] || r.name, 'แผนก': r.dep,
      'สถานที่รับ': r.pickupLoc, 'เวลารับ': r.pickupTime,
      'สถานที่ส่ง': r.deliveryLoc, 'จำนวนคน': r.headcount,
      'รถ': r.car, 'คนขับ': r.driverName,
      'ผู้อนุมัติ': r.adminApprove, 'เวลาอนุมัติ': r.adminApproveTime,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HR Report');
    const s = document.getElementById('hr-rep-start').value.replace(/\//g, '');
    const e = document.getElementById('hr-rep-end').value.replace(/\//g, '');
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const link = document.createElement('a');
    link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
    link.setAttribute('download', `HR_Report_${s}_to_${e}.xlsx`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  } catch (err) {
    console.error('Export error:', err);
    showToast('ไม่สามารถ Export ได้: ' + err.message, 'error');
  }
}
