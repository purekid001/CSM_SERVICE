/**
 * Engineer — Report (รายงานสรุปสถิติการแจ้งซ่อม)
 */
import { database, ref, get } from '../firebase.js';
import { getEngStepText as getStepText, getEngStepBadge as getStepBadge, parseDMY as parseDateString, buildPaginationHTML, bindPaginationEvents, escapeHTML } from '../utils.js';

let currentChart = null;
let currentData = [];
let tblPage = 1;
const TBL_SIZE = 20;

export function render() {
  return `
    <div class="app-page app-page-tight">
      <section class="page-hero page-hero-eng fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Engineering Analytics</p>
          <h1 class="page-hero-title">Engineering Reports</h1>
          <p class="page-hero-subtitle">สรุปปริมาณงานซ่อม แนวโน้มการแจ้งซ่อม และประสิทธิภาพการดำเนินงาน เพื่อให้มองภาพรวมและเจาะข้อมูลย้อนหลังได้จากหน้าเดียว</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ประเภทหน้า</span>
            <strong>Dashboard + Export Report</strong>
          </div>
          <div class="page-hero-stat">
            <span>แหล่งข้อมูล</span>
            <strong>DEN / FIX</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>มุมมองวิเคราะห์งานซ่อม</strong>
          เลือกช่วงวันที่และรูปแบบรายงานก่อนสร้างผลลัพธ์ ระบบจะแสดงทั้งกราฟ ตาราง และ timeline เพื่อให้ดูภาพรวมและไล่เคสย้อนหลังได้ต่อเนื่อง
        </div>
      </div>
      <section class="form-card report-filter-card fade-in">
        <div class="form-header">
            <div class="form-header-copy">
              <div class="form-header-icon">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <div class="form-header-text">
                <h2>Engineering Reports</h2>
                <p>เลือกช่วงวันที่ ประเภทรายงาน และเงื่อนไขเสริมก่อนสร้างผลลัพธ์</p>
              </div>
            </div>
            <div class="form-header-badge">
              <i class="fa-solid fa-file-export"></i>
              Export Excel ได้หลังสร้างรายงาน
            </div>
          </div>
          <div class="list-filter-bar report-filter-bar">
            <div class="filter-group">
              <div class="filter-item">
                <label><i class="fa-solid fa-calendar"></i> วันที่เริ่ม</label>
                <input type="text" class="form-control" id="rep-date-start" placeholder="dd/mm/yyyy" readonly>
              </div>
              <div class="filter-item">
                <label><i class="fa-solid fa-calendar-check"></i> วันที่สิ้นสุด</label>
                <input type="text" class="form-control" id="rep-date-end" placeholder="dd/mm/yyyy" readonly>
              </div>
              <div class="filter-item report-type-filter">
                <label><i class="fa-solid fa-file-lines"></i> ประเภทรายงาน</label>
                <select class="form-control" id="rep-type">
                  <option value="1">1. รายงานแสดงงานทั้งหมด (Summary)</option>
                  <option value="2">2. ประสิทธิภาพงานซ่อม ตามช่าง (Tech)</option>
                  <option value="3">3. ประสิทธิภาพงานซ่อม ตามหัวหน้าช่าง (Leader)</option>
                  <option value="4">4. รายการการแจ้งซ่อมทั้งหมด (Raw Data)</option>
                </select>
              </div>
              <div class="filter-item" id="rep-dept-filter" style="display: none;">
                <label><i class="fa-solid fa-users"></i> ค้นหาแผนก</label>
                <select class="form-control" id="rep-department">
                  <option value="">-- ทุกแผนก --</option>
                </select>
              </div>
              <div class="filter-item" id="rep-status-filter" style="display: none;">
                <label><i class="fa-solid fa-list-check"></i> สถานะงาน</label>
                <select class="form-control" id="rep-status">
                  <option value="">-- ทุกสถานะ --</option>
                  <option value="1">รอหัวหน้าอนุมัติ</option>
                  <option value="2">รอช่างอนุมัติ</option>
                  <option value="3">กำลังซ่อม</option>
                  <option value="5">รอการประเมิณความเรียบร้อย</option>
                  <option value="4">ซ่อมเสร็จแล้ว</option>
                  <option value="6">ยกเลิก</option>
                </select>
              </div>
            </div>
            <div class="filter-actions report-filter-actions">
              <button type="button" id="rep-btn-generate" class="btn btn-primary"><i class="fa-solid fa-bolt"></i> สร้างรายงาน</button>
              <button type="button" id="rep-btn-export" class="btn btn-secondary" style="display: none;"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
            </div>
          </div>
        </section>

        <section class="form-card report-panel report-chart-card" id="rep-chart-card" style="display: none;">
          <div class="report-card-header compact">
            <h3 id="rep-chart-title">กราฟแสดงข้อมูล</h3>
          </div>
          <div class="report-chart-box report-chart-box-large">
            <canvas id="reportChart"></canvas>
          </div>
        </section>

        <section class="form-card report-panel report-timeline-panel" id="rep-timeline-card" style="display: none;">
          <div class="report-card-header report-card-header-row" id="rep-timeline-header" style="cursor: pointer; user-select: none;">
            <div>
              <h3>
                <i class="fa-solid fa-timeline"></i> Timeline การแจ้งซ่อม
                <i class="fa-solid fa-chevron-down" id="rep-tl-icon" style="margin-left: 8px; font-size: 0.8em; transition: transform 0.3s; color: #6366f1;"></i>
              </h3>
              <p>คลิกเพื่อแสดงหรือซ่อนรายการแจ้งซ่อมเรียงตามวันที่ล่าสุด</p>
            </div>
            <div class="report-inline-filter" id="rep-tl-filter-group" style="display: none; pointer-events: auto;" onclick="event.stopPropagation();">
              <label><i class="fa-solid fa-filter"></i> กรองตามเครื่องจักร</label>
              <select id="rep-tl-mac-filter" class="form-control">
                <option value="">-- แสดงทุกเครื่องจักร --</option>
              </select>
            </div>
          </div>
          <div id="rep-timeline-content" style="display: none;">
            <div id="rep-timeline" class="report-timeline-body"></div>
            <div id="rep-tl-pagination" class="pagination-bar"></div>
          </div>
        </section>

        <section class="form-card report-panel" id="rep-table-card" style="display: none;">
          <div class="report-card-header compact">
            <h3 id="rep-table-title">ตารางข้อมูล</h3>
          </div>
          <div class="table-wrapper report-table-wrapper">
            <table class="data-table table-width-lock" id="rep-table" style="--report-table-min-width: 1320px; --table-lock-width: 1320px; --table-cell-min: 114px; --table-detail-min: 260px;">
              <thead id="rep-thead"></thead>
              <tbody id="rep-tbody"></tbody>
            </table>
          </div>
          <div id="rep-table-pagination" class="pagination-bar"></div>
        </section>
    </div>
  `;
}

export function init() {
  // === ฟังก์ชันเริ่มต้น (Initialization) ===
  // โหลดข้อมูลรายงานจาก Firebase, เตรียมแผนกสำหรับ Filter และจัดการการแสดงผลกราฟ/ตาราง
  // Initialize Flatpickr
  const fpStart = flatpickr("#rep-date-start", { dateFormat: "d/m/Y" });
  const fpEnd = flatpickr("#rep-date-end", { dateFormat: "d/m/Y" });

  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  fpStart.setDate(firstDay);
  fpEnd.setDate(today);

  document.getElementById('rep-btn-generate').addEventListener('click', generateReport);
  document.getElementById('rep-btn-export').addEventListener('click', exportToExcel);
  document.getElementById('rep-tl-mac-filter').addEventListener('change', () => { tlPage = 1; renderTimeline(); });
  document.getElementById('rep-type').addEventListener('change', (e) => {
    // Show/hide export button based on type (Show on all or just 4)
    document.getElementById('rep-btn-export').style.display = 'none';

    // Show filters for type 4
    const val = e.target.value;
    if (val === "4") {
      document.getElementById('rep-dept-filter').style.display = 'block';
      document.getElementById('rep-status-filter').style.display = 'block';
    } else {
      document.getElementById('rep-dept-filter').style.display = 'none';
      document.getElementById('rep-status-filter').style.display = 'none';
      document.getElementById('rep-department').value = '';
      document.getElementById('rep-status').value = '';
    }
  });

  // Load departments from DHR/User node
  const depSelect = document.getElementById('rep-department');
  get(ref(database, 'DHR/User')).then(snap => {
    if (snap.exists()) {
      const users = snap.val();
      const deps = new Set();
      Object.values(users).forEach(u => {
        if (u.department && u.department.trim() && u.department !== '-') {
          deps.add(u.department.trim());
        }
      });
      Array.from(deps).sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        depSelect.appendChild(opt);
      });
    }
  }).catch(err => console.error("Error loading departments:", err));

  // Toggle Timeline collapse/expand
  const tlHeader = document.getElementById('rep-timeline-header');
  if (tlHeader) {
    tlHeader.addEventListener('click', () => {
      const content = document.getElementById('rep-timeline-content');
      const icon = document.getElementById('rep-tl-icon');
      const filterGroup = document.getElementById('rep-tl-filter-group');
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

// Helpers
// Helpers moved to utils.js

async function fetchRecordsInRange(startDt, endDt) {
  const startYear = startDt.getFullYear();
  const endYear = endDt.getFullYear();
  let allRecords = [];

  try {
    for (let y = startYear; y <= endYear; y++) {
      const snap = await get(ref(database, `DEN/FIX/${y}`));
      if (snap.exists()) {
        const data = snap.val();
        Object.entries(data).forEach(([id, rec]) => {
          const recDate = parseDateString(rec.date);
          if (recDate && recDate >= startDt && recDate <= endDt) {
            allRecords.push({ id, ...rec });
          }
        });
      }
    }
    return allRecords;
  } catch (error) {
    console.error("Error fetching data:", error);
    showAlert("Error", "เกิดข้อผิดพลาดในการดึงข้อมูล", "fa-circle-xmark");
    return [];
  }
}

async function generateReport() {
  const startStr = document.getElementById('rep-date-start').value;
  const endStr = document.getElementById('rep-date-end').value;
  const type = document.getElementById('rep-type').value;

  if (!startStr || !endStr) {
    showAlert("Warning", "กรุณาเลือกช่วงวันที่", "fa-triangle-exclamation");
    return;
  }

  const [sd, sm, sy] = startStr.split('/');
  const startDt = new Date(sy, sm - 1, sd, 0, 0, 0);

  const [ed, em, ey] = endStr.split('/');
  const endDt = new Date(ey, em - 1, ed, 23, 59, 59);

  const btn = document.getElementById('rep-btn-generate');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...';
  btn.disabled = true;

  let records = await fetchRecordsInRange(startDt, endDt);

  if (type === "4") {
    const deptFilter = document.getElementById('rep-department').value.trim().toLowerCase();
    const statusFilter = document.getElementById('rep-status').value;

    records = records.filter(r => {
      // 1. Check Department
      let passDept = true;
      if (deptFilter !== "") {
        const rDept = (r.dep || '').toLowerCase().replace(/\s+/g, '');
        const cleanDeptFilter = deptFilter.toLowerCase().replace(/\s+/g, '');
        passDept = rDept.includes(cleanDeptFilter);
      }

      // 2. Check Status
      let passStatus = true;
      if (statusFilter !== "") {
        passStatus = String(r.step) === statusFilter;
      }

      return passDept && passStatus;
    });
  }

  currentData = records;
  tblPage = 1;
  tlPage = 1;

  // Show elements BEFORE rendering so Chart.js can calculate correct width/height
  document.getElementById('rep-chart-card').style.display = 'block';
  document.getElementById('rep-table-card').style.display = 'block';
  document.getElementById('rep-timeline-card').style.display = 'block';
  document.getElementById('rep-timeline-content').style.display = 'none';
  document.getElementById('rep-tl-filter-group').style.display = 'none';
  document.getElementById('rep-tl-icon').style.transform = 'rotate(0deg)';
  document.getElementById('rep-btn-export').style.display = 'inline-flex';

  const tlMacSelect = document.getElementById('rep-tl-mac-filter');
  const prevMac = tlMacSelect.value;
  tlMacSelect.innerHTML = '<option value="">-- แสดงทุกเครื่องจักร --</option>';
  const macSet = new Set();
  records.forEach(r => {
    let mac = r.mac || '';
    if (mac === '-') return;
    const macParts = mac.split(' | ');
    const macCode = macParts[0].trim();
    const macName = macParts[1] ? macParts[1].trim() : '';
    const formattedMac = macName ? `${macCode} | ${macName}` : macCode;
    macSet.add(formattedMac);
  });
  Array.from(macSet).sort().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    tlMacSelect.appendChild(opt);
  });
  if (prevMac && macSet.has(prevMac)) tlMacSelect.value = prevMac;

  if (type === "1") renderType1(records);
  else if (type === "2") renderType2(records);
  else if (type === "3") renderType3(records);
  else if (type === "4") renderType4(records);

  renderTimeline();

  btn.innerHTML = '<i class="fa-solid fa-bolt"></i> สร้างรายงาน';
  btn.disabled = false;
}

function destroyChart() {
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
}

// 1. รายงานแสดงงานทั้งหมด (Summary)
function renderType1(records) {
  document.getElementById('rep-chart-title').innerText = "สัดส่วนสถานะงานซ่อมทั้งหมด";

  const counts = {};
  records.forEach(r => {
    const s = getStepText(r.step);
    counts[s] = (counts[s] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  destroyChart();
  const ctx = document.getElementById('reportChart').getContext('2d');

  // Premium status-mapped harmonized color palette
  const statusColors = {
    'รอหัวหน้าอนุมัติ': '#f59e0b',          // Amber
    'รอช่างอนุมัติ': '#38bdf8',           // Sky Blue
    'กำลังซ่อม': '#6366f1',               // Indigo
    'รอการประเมิณความเรียบร้อย': '#a855f7', // Purple
    'ซ่อมเสร็จแล้ว': '#10b981',            // Emerald
    'ยกเลิก': '#ef4444'                   // Rose
  };
  const colors = labels.map(l => statusColors[l] || '#64748b');

  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBorderWidth: 4,
        hoverOffset: 12
      }]
    },
    options: {
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 13, family: "'Inter', 'Noto Sans Thai', sans-serif" }
          }
        }
      },
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1600,
        easing: 'easeOutBack'
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, width, height } = chart;
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        ctx.save();
        ctx.font = "bold 26px 'Inter', 'Noto Sans Thai', sans-serif";
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total, width / 2, height / 2 - 8);
        ctx.font = "600 11px 'Inter', 'Noto Sans Thai', sans-serif";
        ctx.fillStyle = '#64748b';
        ctx.fillText('ใบแจ้งซ่อม', width / 2, height / 2 + 16);
        ctx.restore();
      }
    }]
  });

  document.getElementById('rep-thead').innerHTML = `
    <tr>
      <th>หมวดหมู่</th>
      <th class="cell-center">จำนวน (ใบ)</th>
    </tr>`;

  let html = `<tr><td colspan="2" style="background:#f1f5f9; font-weight:bold;"><i class="fa-solid fa-list-check"></i> แยกตามสถานะงาน</td></tr>`;
  html += labels.map(l => `
    <tr>
      <td style="padding-left: 20px;">${escapeHTML(l)}</td>
      <td class="cell-center">${counts[l]}</td>
    </tr>`).join('');
  html += `<tr><td style="font-weight:bold; text-align:right;">รวมทั้งหมด</td><td class="cell-center" style="font-weight:bold; color: #10b981;">${records.length}</td></tr>`;

  html += `<tr><td colspan="2" style="background:#f1f5f9; font-weight:bold;"><i class="fa-solid fa-screwdriver-wrench"></i> แยกตามประเภทงานซ่อม</td></tr>`;
  const typeCounts = {};
  records.forEach(r => {
    const t = r.type || 'ไม่ระบุ';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  html += Object.keys(typeCounts).map(t => `
    <tr>
      <td style="padding-left: 20px;">${escapeHTML(t)}</td>
      <td class="cell-center">${typeCounts[t]}</td>
    </tr>`).join('');
  html += `<tr><td style="font-weight:bold; text-align:right;">รวมทั้งหมด</td><td class="cell-center" style="font-weight:bold; color: #10b981;">${records.length}</td></tr>`;

  document.getElementById('rep-tbody').innerHTML = html;
}

// 2. ประสิทธิภาพงานซ่อม ตามช่าง (Tech)
function renderType2(records) {
  document.getElementById('rep-chart-title').innerText = "ปริมาณงานแยกตามช่างซ่อม";

  const techCounts = {};
  let totalAll = 0, totalProg = 0, totalComp = 0;
  records.forEach(r => {
    if (r.den_name && r.den_name !== "-") {
      const names = r.den_name.split(',').map(n => n.replace('-', '').trim()).filter(n => n);
      names.forEach(n => {
        if (!techCounts[n]) techCounts[n] = { total: 0, inProgress: 0, completed: 0 };
        techCounts[n].total += 1;
        totalAll += 1;
        if (String(r.step) === "3") { techCounts[n].inProgress += 1; totalProg += 1; }
        if (String(r.step) === "4" || String(r.step) === "5") { techCounts[n].completed += 1; totalComp += 1; }
      });
    }
  });

  const labels = Object.keys(techCounts);
  const totalData = labels.map(l => techCounts[l].total);
  const progData = labels.map(l => techCounts[l].inProgress);
  const compData = labels.map(l => techCounts[l].completed);

  destroyChart();
  const ctx = document.getElementById('reportChart').getContext('2d');

  // Dynamic vertical linear canvas gradients
  const gradTotal = ctx.createLinearGradient(0, 0, 0, 300);
  gradTotal.addColorStop(0, 'rgba(148, 163, 184, 0.65)');
  gradTotal.addColorStop(1, 'rgba(148, 163, 184, 0.1)');

  const gradProg = ctx.createLinearGradient(0, 0, 0, 300);
  gradProg.addColorStop(0, 'rgba(245, 158, 11, 0.85)');
  gradProg.addColorStop(1, 'rgba(245, 158, 11, 0.15)');

  const gradComp = ctx.createLinearGradient(0, 0, 0, 300);
  gradComp.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
  gradComp.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'งานทั้งหมด', data: totalData, backgroundColor: gradTotal, borderColor: '#94a3b8', borderWidth: 1.5, borderRadius: 6 },
        { label: 'กำลังซ่อม', data: progData, backgroundColor: gradProg, borderColor: '#f59e0b', borderWidth: 1.5, borderRadius: 6 },
        { label: 'ซ่อมเสร็จ', data: compData, backgroundColor: gradComp, borderColor: '#10b981', borderWidth: 1.5, borderRadius: 6 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, family: "'Inter', 'Noto Sans Thai', sans-serif" }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif" } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif" } } }
      },
      animation: {
        duration: 1400,
        easing: 'easeOutBack',
        delay: (context) => {
          let delay = 0;
          if (context.type === 'data' && (context.mode === 'default' || context.mode === 'show' || context.mode === 'reset')) {
            delay = context.dataIndex * 60;
          }
          return delay;
        }
      }
    }
  });

  document.getElementById('rep-thead').innerHTML = `
    <tr>
      <th>ชื่อช่าง</th>
      <th class="cell-center">งานทั้งหมด (ใบ)</th>
      <th class="cell-center">กำลังซ่อม (ใบ)</th>
      <th class="cell-center">ซ่อมเสร็จ (ใบ)</th>
      <th class="cell-center">อัตราความสำเร็จ (%)</th>
    </tr>`;

  let html = labels.map(l => {
    const t = techCounts[l].total;
    const p = techCounts[l].inProgress;
    const c = techCounts[l].completed;
    const pct = t > 0 ? ((c / t) * 100).toFixed(2) : '0.00';
    return `
      <tr>
        <td>${escapeHTML(l)}</td>
        <td class="cell-center">${t}</td>
        <td class="cell-center" style="color: #f59e0b; font-weight: bold;">${p}</td>
        <td class="cell-center" style="color: #10b981; font-weight: bold;">${c}</td>
        <td class="cell-center">${pct}%</td>
      </tr>`;
  }).join('');

  html += `<tr>
            <td style="font-weight:bold; text-align:right;">รวมทั้งหมด</td>
            <td class="cell-center" style="font-weight:bold;">${totalAll}</td>
            <td class="cell-center" style="font-weight:bold; color: #f59e0b;">${totalProg}</td>
            <td class="cell-center" style="font-weight:bold; color: #10b981;">${totalComp}</td>
            <td class="cell-center" style="font-weight:bold;">${totalAll > 0 ? ((totalComp / totalAll) * 100).toFixed(2) : '0.00'}%</td>
           </tr>`;
  document.getElementById('rep-tbody').innerHTML = html;
}

// 3. ประสิทธิภาพงานซ่อม ตามหัวหน้าช่าง (Leader)
function renderType3(records) {
  document.getElementById('rep-chart-title').innerText = "ปริมาณงานแยกตามหัวหน้าช่างซ่อม (ผู้อนุมัติ/ตรวจสอบ)";

  const leaderCounts = {};
  let totalAll = 0, totalProg = 0, totalComp = 0;
  records.forEach(r => {
    if (r.den_name && r.den_name !== "-") {
      const names = r.den_name.split(',').map(n => n.replace('-', '').trim()).filter(n => n);
      if (names.length > 0) {
        const n = names[0]; // ใช้ชื่อช่างคนแรกในอาร์เรย์ (หัวหน้าช่างของงาน)
        if (!leaderCounts[n]) leaderCounts[n] = { total: 0, inProgress: 0, completed: 0 };
        leaderCounts[n].total += 1;
        totalAll += 1;
        if (String(r.step) === "3") { leaderCounts[n].inProgress += 1; totalProg += 1; }
        if (String(r.step) === "4" || String(r.step) === "5") { leaderCounts[n].completed += 1; totalComp += 1; }
      }
    }
  });

  const labels = Object.keys(leaderCounts);
  const totalData = labels.map(l => leaderCounts[l].total);
  const progData = labels.map(l => leaderCounts[l].inProgress);
  const compData = labels.map(l => leaderCounts[l].completed);

  destroyChart();
  const ctx = document.getElementById('reportChart').getContext('2d');

  // Dynamic vertical linear canvas gradients
  const gradTotal = ctx.createLinearGradient(0, 0, 0, 300);
  gradTotal.addColorStop(0, 'rgba(148, 163, 184, 0.65)');
  gradTotal.addColorStop(1, 'rgba(148, 163, 184, 0.1)');

  const gradProg = ctx.createLinearGradient(0, 0, 0, 300);
  gradProg.addColorStop(0, 'rgba(245, 158, 11, 0.85)');
  gradProg.addColorStop(1, 'rgba(245, 158, 11, 0.15)');

  const gradComp = ctx.createLinearGradient(0, 0, 0, 300);
  gradComp.addColorStop(0, 'rgba(59, 130, 246, 0.85)');
  gradComp.addColorStop(1, 'rgba(59, 130, 246, 0.15)');

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'งานที่ตรวจสอบ', data: totalData, backgroundColor: gradTotal, borderColor: '#94a3b8', borderWidth: 1.5, borderRadius: 6 },
        { label: 'กำลังซ่อม', data: progData, backgroundColor: gradProg, borderColor: '#f59e0b', borderWidth: 1.5, borderRadius: 6 },
        { label: 'ซ่อมเสร็จ', data: compData, backgroundColor: gradComp, borderColor: '#3b82f6', borderWidth: 1.5, borderRadius: 6 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, family: "'Inter', 'Noto Sans Thai', sans-serif" }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif" } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif" } } }
      },
      animation: {
        duration: 1400,
        easing: 'easeOutBack',
        delay: (context) => {
          let delay = 0;
          if (context.type === 'data' && (context.mode === 'default' || context.mode === 'show' || context.mode === 'reset')) {
            delay = context.dataIndex * 60;
          }
          return delay;
        }
      }
    }
  });

  document.getElementById('rep-thead').innerHTML = `
    <tr>
      <th>ชื่อหัวหน้าช่าง</th>
      <th class="cell-center">งานที่ตรวจสอบ (ใบ)</th>
      <th class="cell-center">กำลังซ่อม (ใบ)</th>
      <th class="cell-center">ซ่อมเสร็จ (ใบ)</th>
      <th class="cell-center">อัตราความสำเร็จ (%)</th>
    </tr>`;

  let html = labels.map(l => {
    const t = leaderCounts[l].total;
    const p = leaderCounts[l].inProgress;
    const c = leaderCounts[l].completed;
    const pct = t > 0 ? ((c / t) * 100).toFixed(2) : '0.00';
    return `
      <tr>
        <td>${escapeHTML(l)}</td>
        <td class="cell-center">${t}</td>
        <td class="cell-center" style="color: #f59e0b; font-weight: bold;">${p}</td>
        <td class="cell-center" style="color: #3b82f6; font-weight: bold;">${c}</td>
        <td class="cell-center">${pct}%</td>
      </tr>`;
  }).join('');

  html += `<tr>
            <td style="font-weight:bold; text-align:right;">รวมทั้งหมด</td>
            <td class="cell-center" style="font-weight:bold;">${totalAll}</td>
            <td class="cell-center" style="font-weight:bold; color: #f59e0b;">${totalProg}</td>
            <td class="cell-center" style="font-weight:bold; color: #3b82f6;">${totalComp}</td>
            <td class="cell-center" style="font-weight:bold;">${totalAll > 0 ? ((totalComp / totalAll) * 100).toFixed(2) : '0.00'}%</td>
           </tr>`;
  document.getElementById('rep-tbody').innerHTML = html;
}

// 4. รายการการแจ้งซ่อมทั้งหมด (Raw Data)
function renderType4(records) {
  document.getElementById('rep-chart-title').innerText = "แนวโน้มการแจ้งซ่อมรายวัน";

  const dailyCounts = {};
  records.forEach(r => {
    if (r.date && r.date !== "-") {
      const d = r.date.split(' ')[0];
      dailyCounts[d] = (dailyCounts[d] || 0) + 1;
    }
  });

  // Sort by date key string (DD/MM/YYYY) needs proper sorting
  const sortedDates = Object.keys(dailyCounts).sort((a, b) => {
    const [d1, m1, y1] = a.split('/');
    const [d2, m2, y2] = b.split('/');
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });

  const data = sortedDates.map(d => dailyCounts[d]);

  destroyChart();
  const ctx = document.getElementById('reportChart').getContext('2d');

  // Premium glowing indigo line gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 350);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        label: 'จำนวนใบแจ้งซ่อม',
        data: data,
        borderColor: '#6366f1',
        borderWidth: 3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#6366f1',
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#6366f1',
        pointHoverBorderColor: '#ffffff',
        backgroundColor: gradient,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif", size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: "'Inter', 'Noto Sans Thai', sans-serif", size: 11 } } }
      },
      animation: {
        duration: 1400,
        easing: 'easeOutQuart',
        delay: (context) => {
          let delay = 0;
          if (context.type === 'data' && (context.mode === 'default' || context.mode === 'show' || context.mode === 'reset')) {
            delay = context.dataIndex * 40;
          }
          return delay;
        }
      }
    }
  });

  document.getElementById('rep-thead').innerHTML = `
    <tr>
      <th>สถานะ</th>
      <th>วันที่แจ้ง</th>
      <th>เลขที่ใบแจ้งซ่อม</th>
      <th>สถานที่</th>
      <th>รหัสเครื่อง</th>
      <th>เครื่องจักร</th>
      <th>รายละเอียด</th>
      <th>ผู้แจ้ง</th>
      <th>แผนก</th>
      <th>ช่างที่ซ่อม</th>
      <th>การแก้ไข</th>
      <th>กำหนดเสร็จ</th>
    </tr>`;

  tblPage = 1;
  renderType4Table(records);
}

function renderType4Table(records) {
  const totalPages = Math.ceil(records.length / TBL_SIZE);
  if (tblPage > totalPages) tblPage = totalPages;
  if (tblPage < 1) tblPage = 1;
  const start = (tblPage - 1) * TBL_SIZE;
  const pageRecords = records.slice(start, start + TBL_SIZE);

  // TODO(next-security): record fields ในตารางนี้มาจาก Firebase โดยตรง
  // ถ้ายัง render ผ่าน template string + innerHTML ต่อ ควรมี escape helper กลางก่อน inject ทุก field
  document.getElementById('rep-tbody').innerHTML = pageRecords.map(r => `
    <tr>
      <td>${getStepBadge(r.step)}</td>
      <td>${escapeHTML((r.date || '-').split(' ')[0] || '-')}</td>
      <td>${escapeHTML(r.id || '-')}</td>
      <td>${escapeHTML(r.plant || '-')}</td>
      <td>${escapeHTML((r.mac || '').split(' | ')[0] || '-')}</td>
      <td>${escapeHTML((r.mac || '').split(' | ')[1] || r.mac || '-')}</td>
      <td class="cell-detail" style="max-width: 300px; white-space: pre-wrap; word-wrap: break-word;">${escapeHTML(r.detail || '-')}</td>
      <td>${escapeHTML((r.name || '').split(' | ')[1] || r.name || '-')}</td>
      <td>${escapeHTML(r.dep || '-')}</td>
      <td>${escapeHTML((r.den_name || '-').replace(/,-/g, ''))}</td>
      <td class="cell-detail" style="max-width: 250px; white-space: pre-wrap; word-wrap: break-word;">${escapeHTML(r.den_fix || '-')}</td>
      <td>${escapeHTML(r.complete || '-')}</td>
    </tr>`).join('');

  renderTablePagination(totalPages, 'type4', records.length);
}


function exportToExcel() {
  if (currentData.length === 0) {
    showAlert("Warning", "ไม่มีข้อมูลสำหรับ Export", "fa-triangle-exclamation");
    return;
  }

  const type = document.getElementById('rep-type').value;
  let exportData = [];

  if (type === "1") {
    const counts = {};
    const typeCounts = {};
    currentData.forEach(r => {
      const s = getStepText(r.step);
      counts[s] = (counts[s] || 0) + 1;
      const t = r.type || 'ไม่ระบุ';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    exportData.push({ "หมวดหมู่": "--- แยกตามสถานะ ---", "จำนวน (ใบ)": "" });
    Object.keys(counts).forEach(k => exportData.push({ "หมวดหมู่": k, "จำนวน (ใบ)": counts[k] }));
    exportData.push({ "หมวดหมู่": "รวมทั้งหมด", "จำนวน (ใบ)": currentData.length });

    exportData.push({ "หมวดหมู่": "", "จำนวน (ใบ)": "" }); // เว้นบรรทัด

    exportData.push({ "หมวดหมู่": "--- แยกตามประเภทงานซ่อม ---", "จำนวน (ใบ)": "" });
    Object.keys(typeCounts).forEach(k => exportData.push({ "หมวดหมู่": k, "จำนวน (ใบ)": typeCounts[k] }));
    exportData.push({ "หมวดหมู่": "รวมทั้งหมด", "จำนวน (ใบ)": currentData.length });
  } else if (type === "2") {
    const techCounts = {};
    let totalAll = 0, totalProg = 0, totalComp = 0;
    currentData.forEach(r => {
      if (r.den_name && r.den_name !== "-") {
        const names = r.den_name.split(',').map(n => n.replace('-', '').trim()).filter(n => n);
        names.forEach(n => {
          if (!techCounts[n]) techCounts[n] = { total: 0, inProgress: 0, completed: 0 };
          techCounts[n].total += 1;
          totalAll += 1;
          if (String(r.step) === "3") { techCounts[n].inProgress += 1; totalProg += 1; }
          if (String(r.step) === "4" || String(r.step) === "5") { techCounts[n].completed += 1; totalComp += 1; }
        });
      }
    });

    Object.keys(techCounts).forEach(k => {
      exportData.push({
        "ชื่อช่าง": k,
        "งานทั้งหมด": techCounts[k].total,
        "กำลังซ่อม": techCounts[k].inProgress,
        "งานที่ซ่อมเสร็จ": techCounts[k].completed,
        "เปอร์เซ็นความสำเร็จ (%)": techCounts[k].total > 0 ? parseFloat(((techCounts[k].completed / techCounts[k].total) * 100).toFixed(2)) : 0
      });
    });
    exportData.push({ "ชื่อช่าง": "รวมทั้งหมด", "งานทั้งหมด": totalAll, "กำลังซ่อม": totalProg, "งานที่ซ่อมเสร็จ": totalComp, "เปอร์เซ็นความสำเร็จ (%)": totalAll > 0 ? parseFloat(((totalComp / totalAll) * 100).toFixed(2)) : 0 });

  } else if (type === "3") {
    const leaderCounts = {};
    let totalAll = 0, totalProg = 0, totalComp = 0;
    currentData.forEach(r => {
      if (r.den_name && r.den_name !== "-") {
        const names = r.den_name.split(',').map(n => n.replace('-', '').trim()).filter(n => n);
        if (names.length > 0) {
          const n = names[0]; // ใช้ชื่อช่างคนแรกในอาร์เรย์ (หัวหน้าช่างของงาน)
          if (!leaderCounts[n]) leaderCounts[n] = { total: 0, inProgress: 0, completed: 0 };
          leaderCounts[n].total += 1;
          totalAll += 1;
          if (String(r.step) === "3") { leaderCounts[n].inProgress += 1; totalProg += 1; }
          if (String(r.step) === "4" || String(r.step) === "5") { leaderCounts[n].completed += 1; totalComp += 1; }
        }
      }
    });
    Object.keys(leaderCounts).forEach(k => {
      exportData.push({
        "ชื่อหัวหน้าช่าง": k,
        "งานที่รับผิดชอบ": leaderCounts[k].total,
        "กำลังซ่อม": leaderCounts[k].inProgress,
        "ซ่อมเสร็จ": leaderCounts[k].completed,
        "เปอร์เซ็นความสำเร็จ (%)": leaderCounts[k].total > 0 ? parseFloat(((leaderCounts[k].completed / leaderCounts[k].total) * 100).toFixed(2)) : 0
      });
    });
    exportData.push({ "ชื่อหัวหน้าช่าง": "รวมทั้งหมด", "งานที่รับผิดชอบ": totalAll, "กำลังซ่อม": totalProg, "ซ่อมเสร็จ": totalComp, "เปอร์เซ็นความสำเร็จ (%)": totalAll > 0 ? parseFloat(((totalComp / totalAll) * 100).toFixed(2)) : 0 });

  } else if (type === "4") {
    exportData = currentData.map(r => ({
      "วันที่แจ้ง": r.date,
      "เลขที่ใบแจ้งซ่อม": r.id,
      "ประเภทงาน": r.type,
      "สถานที่": r.plant,
      "รหัสเครื่องจักร": (r.mac || '').split(' | ')[0],
      "ชื่อเครื่องจักร": (r.mac || '').split(' | ')[1] || r.mac,
      "รายละเอียด": r.detail,
      "ผู้แจ้ง": (r.name || '').split(' | ')[1] || r.name,
      "แผนก": r.dep || '-',
      "สถานะ": getStepText(r.step),
      "วันที่เริ่มซ่อม": r.den_start_real || '-',
      "วันที่ซ่อมเสร็จ": r.den_end_real || '-',
      "ช่างที่ซ่อม": (r.den_name || '').replace(/,-/g, ''),
      "หมายเหตุซ่อม": r.den_fix || '-'
    }));
  }

  try {
    // Generate Excel
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const startStr = document.getElementById('rep-date-start').value.replace(/\//g, '');
    const endStr = document.getElementById('rep-date-end').value.replace(/\//g, '');
    const filename = `Engineering_Report_Type${type}_${startStr}_to_${endStr}.xlsx`;

    // Generate base64 and use data URI to force exact filename
    const base64Excel = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Excel;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
  } catch (error) {
    console.error("Export Error:", error);
    showAlert("Error", "ไม่สามารถสร้างไฟล์ Excel ได้: " + error.message, "fa-circle-xmark");
  }
}

let tlPage = 1;
const TL_SIZE = 15;

function renderTimeline() {
  const container = document.getElementById('rep-timeline');
  const macFilter = document.getElementById('rep-tl-mac-filter').value;

  // Sort data descending by date
  const sortedData = [...currentData].sort((a, b) => parseDateString(b.date) - parseDateString(a.date));

  const filtered = sortedData.filter(r => {
    if (!macFilter) return true;
    let mac = r.mac || '';
    if (mac === '-') return false;
    const macParts = mac.split(' | ');
    const macCode = macParts[0].trim();
    const macName = macParts[1] ? macParts[1].trim() : '';
    const formattedMac = macName ? `${macCode} | ${macName}` : macCode;
    return formattedMac === macFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;"><i class="fa-solid fa-inbox"></i> ไม่มีข้อมูล</div>';
    document.getElementById('rep-tl-pagination').innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filtered.length / TL_SIZE);
  if (tlPage > totalPages) tlPage = totalPages;
  if (tlPage < 1) tlPage = 1;
  const start = (tlPage - 1) * TL_SIZE;
  const items = filtered.slice(start, start + TL_SIZE);

  // TODO(next-security): timeline นี้ประกอบ HTML จากข้อมูลในฐานข้อมูลโดยตรงเช่นกัน
  // ถ้าจะเก็บ rich text ต่อ ให้แยก field ที่อนุญาต HTML ออกจาก field ทั่วไปแล้ว sanitize ก่อน
  let html = '<div class="tl-container">';
  items.forEach((r, i) => {
    const stepColors = { '1': '#f59e0b', '2': '#0ea5e9', '3': '#3b82f6', '4': '#10b981', '5': '#a855f7', '6': '#ef4444' };
    const color = stepColors[String(r.step)] || '#94a3b8';
    const icon = { '1': 'fa-clock', '2': 'fa-user-check', '3': 'fa-wrench', '4': 'fa-flag-checkered', '5': 'fa-list-check', '6': 'fa-ban' };
    const ic = icon[String(r.step)] || 'fa-circle';
    const reqName = (r.name || '-').split(' | ')[1] || r.name || '-';

    let mac = r.mac || '-';
    const macParts = mac.split(' | ');
    const macCode = macParts[0].trim();
    const macName = macParts[1] ? macParts[1].trim() : '';

    html += `
      <div class="tl-item fade-in" style="animation-delay:${i * 0.05}s;">
        <div class="tl-dot" style="background:${color};"><i class="fa-solid ${ic}"></i></div>
        <div class="tl-content">
          <div class="tl-header">
            <span class="tl-title" style="color:${color};">${escapeHTML(r.id || '-')}</span>
            <span class="tl-time"><i class="fa-regular fa-calendar"></i> ${escapeHTML(r.date || '-')}</span>
          </div>
          <div class="tl-body">
            <p><strong>ผู้แจ้ง:</strong> ${escapeHTML(reqName)} <span style="margin-left:15px;"><strong>แผนก:</strong> ${escapeHTML(r.dep || '-')}</span></p>
            <p><strong>เครื่องจักร:</strong> ${escapeHTML(macCode)} ${macName ? `<span style="color:#64748b;font-size:12px;">(${escapeHTML(macName)})</span>` : ''}</p>
            <p><strong>รายละเอียด:</strong> ${escapeHTML(r.detail || '-')}</p>
            <p style="margin-top:6px;">${getStepBadge(r.step)}</p>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  // Pagination
  const pagBar = document.getElementById('rep-tl-pagination');
  pagBar.innerHTML = buildPaginationHTML(tlPage, totalPages, filtered.length, TL_SIZE);
  bindPaginationEvents(pagBar, 'rep-timeline-card', () => tlPage, p => tlPage = p, renderTimeline);
}

function renderTablePagination(totalPages, reportType, totalRecords) {
  const container = document.getElementById('rep-table-pagination');
  if (totalRecords === 0) { container.innerHTML = ''; return; }

  const startRow = (tblPage - 1) * TBL_SIZE + 1;
  const endRow = Math.min(tblPage * TBL_SIZE, totalRecords);

  let html = '';
  if (totalPages > 1) {
    html += '<div class="page-group">';
    html += `<button class="page-btn page-nav ${tblPage === 1 ? 'disabled' : ''}" ${tblPage === 1 ? 'disabled' : ''} onclick="window.setEngTblPage(${tblPage - 1},'${reportType}')"><i class="fa-solid fa-chevron-left"></i></button>`;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= tblPage - 2 && p <= tblPage + 2)) {
        html += `<button class="page-btn ${p === tblPage ? 'active' : ''}" onclick="window.setEngTblPage(${p},'${reportType}')">${p}</button>`;
      } else if (p === tblPage - 3 || p === tblPage + 3) {
        html += `<span class="page-dots">···</span>`;
      }
    }

    html += `<button class="page-btn page-nav ${tblPage === totalPages ? 'disabled' : ''}" ${tblPage === totalPages ? 'disabled' : ''} onclick="window.setEngTblPage(${tblPage + 1},'${reportType}')"><i class="fa-solid fa-chevron-right"></i></button>`;
    html += '</div>';
  }

  html += `<span class="page-info">${startRow}–${endRow} จาก ${totalRecords} รายการ</span>`;
  container.innerHTML = html;
}

window.setEngTblPage = function (p, reportType) {
  tblPage = p;
  if (reportType === 'type4') {
    renderType4Table(currentData);
  }
  document.getElementById('rep-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
