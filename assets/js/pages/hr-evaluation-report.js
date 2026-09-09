import { showToast } from '../ui.js';
import { escapeAttr, escapeHTML, getUserAccessProfile } from '../utils.js';
import { loadEvaluationReferenceData, sortEvaluationCycles } from '../services/google-sheets.js';

let focusChart = null;
let comparisonChart = null;

const ALL_EMPLOYEES_VALUE = '__all__';
const CHART_COLORS = [
  '#0f766e',
  '#2563eb',
  '#f97316',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#e11d48',
  '#4338ca',
];
const EVALUATION_SCOPE_RULES = [
  {
    titles: ['กรรมการผู้จัดการ'],
    type: 'all',
    label: 'ทุกส่วนงาน',
  },
  {
    titles: ['รองกรรมการผู้จัดการS', 'รองกรรมการผู้จัดการ S'],
    type: 'sections',
    label: 'สายงาน Support',
    sections: [
      'ควบคุมคุณภาพ',
      'การตลาด',
      'พัฒนาผลิตภัณฑ์',
      'พัฒนาระบบ',
      'ห้องปฏิบัติการและพัฒนาสิ่งแวดล้อม',
      'ทรัพยากรบุคคลและธุรการ',
      'เทคโนโลยีสารสนเทศ',
      'อาชีวอนามัยและความปลอดภัย',
    ],
  },
  {
    titles: ['รองกรรมการผู้จัดการP', 'รองกรรมการผู้จัดการ P'],
    type: 'sections',
    label: 'สายงาน Production',
    sections: [
      'ผลิต1',
      'ผลิต2',
      'วิศวกรรม',
      'คลังสินค้า',
    ],
  },
];

const state = {
  refs: null,
  currentEmployeeId: '',
  currentEvaluatorName: '',
  accessScope: null,
  visibleResults: [],
  comparisonResults: [],
  comparisonRows: [],
  focusResults: [],
  selectedDepartment: '',
  selectedEmployeeId: ALL_EMPLOYEES_VALUE,
};

export function render() {
  return `
    <div class="app-page evaluation-report-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Evaluator Insights</p>
          <h1 class="page-hero-title">Evaluation Score Report</h1>
          <p class="page-hero-subtitle">ดูคะแนนรายรอบ / ปีของพนักงานในขอบเขตที่คุณมีสิทธิ์เข้าถึง พร้อมภาพรวมเปรียบเทียบทั้งกลุ่ม ตารางวิเคราะห์ และกราฟแนวโน้มในหน้าเดียว</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>Scope</span>
            <strong>Evaluator Locked</strong>
          </div>
          <div class="page-hero-stat">
            <span>สิทธิ์ข้อมูล</span>
            <strong id="eval-rep-access-label">กำลังตรวจสอบ</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-user-lock"></i>
        <div>
          <strong id="eval-rep-note-title">รายงานนี้ล็อกตามรหัสผู้ประเมินที่ล็อกอิน</strong>
          <span id="eval-rep-note-body">ระบบจะแสดงข้อมูลตามสิทธิ์ของผู้ประเมินที่ล็อกอิน และอาจขยายขอบเขตตามตำแหน่งผู้ประเมินที่กำหนดไว้</span>
        </div>
      </div>

      <section class="form-card report-filter-card fade-in">
        <div class="form-header">
          <div class="form-header-copy">
            <div class="form-header-icon">
              <i class="fa-solid fa-sliders"></i>
            </div>
            <div class="form-header-text">
              <h2>Evaluation Scope</h2>
              <p>เลือกดูภาพรวมทั้งหมดในขอบเขตสิทธิ์ หรือโฟกัสรายพนักงานคนเดียวได้ทันที</p>
            </div>
          </div>
        </div>
        <div class="list-filter-bar report-filter-bar">
          <div class="filter-group">
            <div class="filter-item report-type-filter">
              <label><i class="fa-solid fa-user-check"></i> ผู้ประเมินที่ล็อกอิน</label>
              <div class="report-static-pill" id="eval-rep-evaluator-pill">-</div>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-building"></i> แผนก / ส่วน</label>
              <select class="form-control" id="eval-rep-department">
                <option value="">ทั้งหมด</option>
              </select>
            </div>
            <div class="filter-item report-type-filter">
              <label><i class="fa-solid fa-users"></i> พนักงานที่ถูกประเมิน</label>
              <select class="form-control" id="eval-rep-employee">
                <option value="${escapeAttr(ALL_EMPLOYEES_VALUE)}">ภาพรวมทั้งหมดในขอบเขตสิทธิ์</option>
              </select>
            </div>
          </div>
          <div class="filter-actions report-filter-actions">
            <button class="btn btn-secondary" type="button" id="eval-rep-reset">
              <i class="fa-solid fa-rotate-left"></i>
              รีเซ็ตมุมมอง
            </button>
          </div>
        </div>
      </section>

      <section class="report-section">
        <div class="report-metric-grid report-metric-grid-5">
          <div class="form-card report-metric-card metric-blue">
            <span class="report-metric-icon"><i class="fa-solid fa-file-signature"></i></span>
            <div>
              <strong id="eval-rep-total">0</strong>
              <span id="eval-rep-total-label">แบบประเมินในมุมมองนี้</span>
            </div>
          </div>
          <div class="form-card report-metric-card metric-green">
            <span class="report-metric-icon"><i class="fa-solid fa-chart-line"></i></span>
            <div>
              <strong id="eval-rep-average">0.00</strong>
              <span id="eval-rep-average-label">คะแนนเฉลี่ยของมุมมองนี้</span>
            </div>
          </div>
          <div class="form-card report-metric-card metric-purple">
            <span class="report-metric-icon"><i class="fa-solid fa-calendar-days"></i></span>
            <div>
              <strong id="eval-rep-years">0</strong>
              <span>จำนวนรอบ / ปี</span>
            </div>
          </div>
          <div class="form-card report-metric-card metric-amber">
            <span class="report-metric-icon"><i class="fa-solid fa-user-group"></i></span>
            <div>
              <strong id="eval-rep-employees">0</strong>
              <span id="eval-rep-employees-label">พนักงานในขอบเขตเปรียบเทียบ</span>
            </div>
          </div>
          <div class="form-card report-metric-card metric-red">
            <span class="report-metric-icon"><i class="fa-solid fa-wave-square"></i></span>
            <div>
              <strong id="eval-rep-trend">-</strong>
              <span id="eval-rep-trend-label">ล่าสุดเทียบรอบก่อนหน้า</span>
            </div>
          </div>
        </div>
      </section>

      <section class="report-section">
        <div class="report-chart-grid evaluation-report-chart-grid">
          <div class="form-card report-panel report-chart-card">
            <div class="report-card-header compact">
              <div>
                <h3><i class="fa-solid fa-chart-area"></i> คะแนนต่อรอบ / ปี</h3>
                <p id="eval-rep-focus-summary">กำลังเตรียมข้อมูลกราฟคะแนน</p>
              </div>
            </div>
            <div class="report-chart-box report-chart-box-large"><canvas id="eval-rep-focus-chart"></canvas></div>
          </div>
          <div class="form-card report-panel report-chart-card">
            <div class="report-card-header compact">
              <div>
                <h3><i class="fa-solid fa-chart-line"></i> เปรียบเทียบคะแนนพนักงานทุกปี</h3>
                <p id="eval-rep-comparison-summary">กำลังเตรียมข้อมูลกราฟเปรียบเทียบ</p>
              </div>
            </div>
            <div class="report-chart-box report-chart-box-large"><canvas id="eval-rep-comparison-chart"></canvas></div>
          </div>
        </div>
      </section>

      <section class="form-card report-panel fade-in">
        <div class="report-card-header compact">
          <div>
            <h3><i class="fa-solid fa-table"></i> ตารางเปรียบเทียบคะแนนรายพนักงานทุกปี</h3>
            <p id="eval-rep-table-summary">แสดงข้อมูลเปรียบเทียบทุกคนในขอบเขตสิทธิ์ปัจจุบัน</p>
          </div>
        </div>
        <div class="table-wrapper report-table-wrapper">
          <table class="data-table table-width-lock" id="eval-rep-table" style="--report-table-min-width: 1260px; --table-lock-width: 1260px; --table-cell-min: 120px;">
            <thead id="eval-rep-head"></thead>
            <tbody id="eval-rep-body">
              <tr>
                <td colspan="7" class="table-loading">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="form-card report-panel fade-in">
        <div class="report-card-header compact">
          <div>
            <h3><i class="fa-solid fa-clock-rotate-left"></i> ตารางประวัติการประเมิน</h3>
            <p id="eval-rep-history-summary">แสดงรายการประเมินตามขอบเขตที่เลือก</p>
          </div>
        </div>
        <div class="table-wrapper report-table-wrapper">
          <table class="data-table table-width-lock" id="eval-rep-history-table" style="--report-table-min-width: 1480px; --table-lock-width: 1480px; --table-cell-min: 120px; --table-detail-min: 300px;">
            <thead id="eval-rep-history-head"></thead>
            <tbody id="eval-rep-history-body">
              <tr>
                <td colspan="7" class="table-loading">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function init() {
  if (!canViewEvaluationReport()) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงรายงานผลประเมิน', 'error');
    return;
  }

  state.currentEmployeeId = String(sessionStorage.getItem('empId') || '').trim();

  bindEvents();
  syncAccessUi();
  loadReportData();
}

function bindEvents() {
  document.getElementById('eval-rep-department')?.addEventListener('change', () => {
    state.selectedDepartment = String(document.getElementById('eval-rep-department')?.value || '').trim();
    applyFilters();
  });

  document.getElementById('eval-rep-employee')?.addEventListener('change', () => {
    state.selectedEmployeeId = String(document.getElementById('eval-rep-employee')?.value || ALL_EMPLOYEES_VALUE).trim() || ALL_EMPLOYEES_VALUE;
    applyFilters();
  });

  document.getElementById('eval-rep-reset')?.addEventListener('click', () => {
    state.selectedDepartment = '';
    state.selectedEmployeeId = ALL_EMPLOYEES_VALUE;

    const departmentSelect = document.getElementById('eval-rep-department');
    const employeeSelect = document.getElementById('eval-rep-employee');
    if (departmentSelect) departmentSelect.value = '';
    if (employeeSelect) employeeSelect.value = ALL_EMPLOYEES_VALUE;

    applyFilters();
  });
}

async function loadReportData() {
  try {
    state.refs = await loadEvaluationReferenceData();
    state.accessScope = resolveEvaluationAccessScope();
    state.visibleResults = getVisibleResults();
    state.currentEvaluatorName = resolveCurrentEvaluatorName();

    syncAccessUi();
    populateDepartmentOptions();
    applyFilters();
  } catch (error) {
    console.error('loadReportData failed:', error);
    showToast(`โหลดรายงานผลประเมินไม่สำเร็จ: ${error.message}`, 'error');
    destroyCharts();
    renderEmptyTable('ไม่สามารถโหลดข้อมูลรายงานได้');
    renderEmptyHistoryTable('ไม่สามารถโหลดประวัติการประเมินได้');
  }
}

function applyFilters() {
  const department = String(document.getElementById('eval-rep-department')?.value || state.selectedDepartment || '').trim();
  const requestedEmployeeId = String(document.getElementById('eval-rep-employee')?.value || state.selectedEmployeeId || ALL_EMPLOYEES_VALUE).trim() || ALL_EMPLOYEES_VALUE;

  state.selectedDepartment = department;

  state.comparisonResults = state.visibleResults.filter(item => {
    return !department || item.employeeDepartment === department;
  });

  syncEmployeeOptions(state.comparisonResults, requestedEmployeeId);

  state.selectedEmployeeId = String(document.getElementById('eval-rep-employee')?.value || ALL_EMPLOYEES_VALUE).trim() || ALL_EMPLOYEES_VALUE;
  state.focusResults = state.selectedEmployeeId === ALL_EMPLOYEES_VALUE
    ? state.comparisonResults
    : state.comparisonResults.filter(item => item.employeeId === state.selectedEmployeeId);
  state.comparisonRows = buildComparisonRows(state.comparisonResults);

  syncScopeUi();
  renderMetrics();
  renderCharts();
  renderComparisonTable();
  renderHistoryTable();
}

function populateDepartmentOptions() {
  const select = document.getElementById('eval-rep-department');
  if (!select) return;

  const departments = uniqueSorted(state.visibleResults.map(item => item.employeeDepartment));
  select.innerHTML = `
    <option value="">ทั้งหมด</option>
    ${departments.map(department => `
      <option value="${escapeAttr(department)}">${escapeHTML(department)}</option>
    `).join('')}
  `;

  select.value = departments.includes(state.selectedDepartment) ? state.selectedDepartment : '';
  state.selectedDepartment = String(select.value || '').trim();
}

function syncEmployeeOptions(results, requestedEmployeeId) {
  const select = document.getElementById('eval-rep-employee');
  if (!select) return;

  const employees = buildEmployeeOptions(results);
  select.innerHTML = `
    <option value="${escapeAttr(ALL_EMPLOYEES_VALUE)}">ภาพรวมทั้งหมดในขอบเขตสิทธิ์</option>
    ${employees.map(employee => `
      <option value="${escapeAttr(employee.employeeId)}">${escapeHTML(employee.label)}</option>
    `).join('')}
  `;

  select.value = employees.some(employee => employee.employeeId === requestedEmployeeId)
    ? requestedEmployeeId
    : ALL_EMPLOYEES_VALUE;
}

function renderMetrics() {
  const focusSummary = buildYearlySummary(state.focusResults);
  const totalEvaluations = state.focusResults.length;
  const averageScore = totalEvaluations > 0
    ? state.focusResults.reduce((sum, item) => sum + toScore(item.overallScore), 0) / totalEvaluations
    : 0;
  const scopeEmployeeCount = new Set(state.comparisonResults.map(item => item.employeeId)).size;
  const latestAverage = focusSummary.at(-1)?.averageScore;
  const previousAverage = focusSummary.length > 1 ? focusSummary.at(-2)?.averageScore : null;
  const trend = Number.isFinite(latestAverage) && Number.isFinite(previousAverage)
    ? latestAverage - previousAverage
    : null;

  setText('eval-rep-total', String(totalEvaluations));
  setText('eval-rep-average', averageScore.toFixed(2));
  setText('eval-rep-years', String(focusSummary.length));
  setText('eval-rep-employees', String(scopeEmployeeCount));
  setText('eval-rep-trend', formatSignedScore(trend));
  setText('eval-rep-total-label', state.selectedEmployeeId === ALL_EMPLOYEES_VALUE ? 'แบบประเมินในภาพรวมนี้' : 'แบบประเมินของพนักงานที่เลือก');
  setText('eval-rep-average-label', state.selectedEmployeeId === ALL_EMPLOYEES_VALUE ? 'คะแนนเฉลี่ยภาพรวมของกลุ่มนี้' : 'คะแนนเฉลี่ยของพนักงานที่เลือก');
  setText('eval-rep-employees-label', state.selectedDepartment ? 'พนักงานในแผนกที่เลือก' : 'พนักงานในขอบเขตเปรียบเทียบ');
  setText('eval-rep-trend-label', state.selectedEmployeeId === ALL_EMPLOYEES_VALUE ? 'ค่าเฉลี่ยล่าสุดเทียบรอบก่อน' : 'คะแนนล่าสุดเทียบรอบก่อนหน้า');
}

function renderCharts() {
  destroyCharts();

  renderFocusChart();
  renderComparisonChart();
}

function renderFocusChart() {
  const chartContext = document.getElementById('eval-rep-focus-chart')?.getContext('2d');
  if (!chartContext) return;

  const focusSummary = buildYearlySummary(state.focusResults);
  const comparisonSummary = buildYearlySummary(state.comparisonResults);
  const labels = sortEvaluationCycles([
    ...focusSummary.map(item => item.year),
    ...comparisonSummary.map(item => item.year),
  ], 'asc');

  if (labels.length === 0) {
    setText('eval-rep-focus-summary', 'ยังไม่พบข้อมูลผลประเมินในขอบเขตที่เลือก');
    return;
  }

  const focusMap = new Map(focusSummary.map(item => [item.year, item]));
  const comparisonMap = new Map(comparisonSummary.map(item => [item.year, item]));
  const isEmployeeView = state.selectedEmployeeId !== ALL_EMPLOYEES_VALUE;
  const scoreGradient = createVerticalGradient(chartContext, '#0f766e', '#14b8a6', 0.26);
  const benchmarkGradient = createVerticalGradient(chartContext, '#2563eb', '#60a5fa', 0.18);
  const countGradient = createVerticalGradient(chartContext, '#f97316', '#fdba74', 0.34);

  const datasets = [
    {
      type: 'bar',
      label: 'จำนวนแบบประเมิน',
      data: labels.map(label => focusMap.get(label)?.count || 0),
      yAxisID: 'yCount',
      backgroundColor: countGradient,
      borderRadius: 14,
      borderSkipped: false,
      maxBarThickness: 34,
      order: 2,
    },
    {
      type: 'line',
      label: isEmployeeView ? 'คะแนนพนักงานที่เลือก' : 'คะแนนเฉลี่ยภาพรวม',
      data: labels.map(label => focusMap.get(label)?.averageScore ?? null),
      yAxisID: 'yScore',
      borderColor: '#0f766e',
      backgroundColor: scoreGradient,
      fill: true,
      spanGaps: true,
      tension: 0.38,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#0f766e',
      pointBorderWidth: 2,
      order: 0,
    },
  ];

  if (isEmployeeView) {
    datasets.push({
      type: 'line',
      label: 'ค่าเฉลี่ยภาพรวมของกลุ่ม',
      data: labels.map(label => comparisonMap.get(label)?.averageScore ?? null),
      yAxisID: 'yScore',
      borderColor: '#2563eb',
      backgroundColor: benchmarkGradient,
      fill: false,
      spanGaps: true,
      tension: 0.34,
      borderWidth: 2,
      borderDash: [8, 6],
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#2563eb',
      pointBorderWidth: 2,
      order: 1,
    });
  }

  focusChart = new Chart(chartContext, {
    data: {
      labels,
      datasets,
    },
    options: buildChartOptions({
      showLegend: true,
      withCountAxis: true,
      maxScore: Math.max(100, ...labels.map(label => focusMap.get(label)?.averageScore || 0), ...labels.map(label => comparisonMap.get(label)?.averageScore || 0)),
    }),
  });
}

function renderComparisonChart() {
  const chartContext = document.getElementById('eval-rep-comparison-chart')?.getContext('2d');
  if (!chartContext) return;

  const labels = sortEvaluationCycles(state.comparisonResults.map(item => item.year), 'asc');
  if (labels.length === 0 || state.comparisonRows.length === 0) {
    setText('eval-rep-comparison-summary', 'ยังไม่พบข้อมูลสำหรับเปรียบเทียบคะแนนรายพนักงาน');
    return;
  }

  const hasSelectedEmployee = state.selectedEmployeeId !== ALL_EMPLOYEES_VALUE;
  const datasets = state.comparisonRows.map((row, index) => {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    const isSelected = row.employeeId === state.selectedEmployeeId;
    const muted = hasSelectedEmployee && !isSelected;

    return {
      label: row.employeeName || row.employeeId,
      data: labels.map(label => row.scoresByYear[label] ?? null),
      borderColor: hexToRgba(color, muted ? 0.28 : 0.96),
      backgroundColor: hexToRgba(color, muted ? 0.08 : 0.16),
      fill: false,
      spanGaps: true,
      tension: 0.36,
      borderWidth: isSelected ? 3.8 : 2.2,
      pointRadius: isSelected ? 4 : 2.8,
      pointHoverRadius: isSelected ? 6 : 4.8,
      pointBackgroundColor: muted ? hexToRgba(color, 0.4) : '#ffffff',
      pointBorderColor: hexToRgba(color, muted ? 0.36 : 0.98),
      pointBorderWidth: isSelected ? 2 : 1.4,
      order: isSelected ? 0 : 1,
    };
  });

  comparisonChart = new Chart(chartContext, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: buildChartOptions({
      showLegend: true,
      withCountAxis: false,
      maxScore: Math.max(100, ...datasets.flatMap(dataset => dataset.data.filter(Number.isFinite))),
    }),
  });
}

function renderComparisonTable() {
  const years = sortEvaluationCycles(state.comparisonResults.map(item => item.year), 'asc');
  if (years.length === 0 || state.comparisonRows.length === 0) {
    renderEmptyTable('ยังไม่พบข้อมูลผลประเมินที่ตรงกับขอบเขตที่เลือก');
    return;
  }

  const thead = document.getElementById('eval-rep-head');
  const tbody = document.getElementById('eval-rep-body');
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>รหัสพนักงาน</th>
      <th>ชื่อพนักงาน</th>
      <th>หน่วยงาน</th>
      ${years.map(year => `<th class="cell-center">${escapeHTML(year)}</th>`).join('')}
      <th class="cell-center">เฉลี่ยทุกปี</th>
      <th class="cell-center">คะแนนล่าสุด</th>
      <th class="cell-center">Trend</th>
    </tr>
  `;

  tbody.innerHTML = state.comparisonRows.map(row => {
    const isSelected = row.employeeId === state.selectedEmployeeId && state.selectedEmployeeId !== ALL_EMPLOYEES_VALUE;
    const trendClass = row.delta > 0 ? 'score-positive' : row.delta < 0 ? 'score-negative' : '';

    return `
      <tr class="${isSelected ? 'eval-report-row-highlight' : ''}">
        <td>${escapeHTML(row.employeeId)}</td>
        <td>${escapeHTML(row.employeeName)}</td>
        <td>${escapeHTML(row.employeeDepartment || '-')}</td>
        ${years.map(year => `
          <td class="cell-center">${formatTableScore(row.scoresByYear[year])}</td>
        `).join('')}
        <td class="cell-center">${formatTableScore(row.averageScore)}</td>
        <td class="cell-center">${formatTableScore(row.latestScore)}</td>
        <td class="cell-center ${trendClass}">${escapeHTML(formatSignedScore(row.delta))}</td>
      </tr>
    `;
  }).join('');
}

function renderEmptyTable(message) {
  renderEmptyTableState({
    theadId: 'eval-rep-head',
    tbodyId: 'eval-rep-body',
    colspan: 7,
    message,
  });
}

function renderHistoryTable() {
  const historyRows = buildHistoryRows(state.focusResults);
  if (historyRows.length === 0) {
    renderEmptyHistoryTable('ยังไม่พบประวัติการประเมินที่ตรงกับขอบเขตที่เลือก');
    return;
  }

  const thead = document.getElementById('eval-rep-history-head');
  const tbody = document.getElementById('eval-rep-history-body');
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>รอบ / ปี</th>
      <th>วันที่ประเมิน</th>
      <th>รหัสพนักงาน</th>
      <th>ชื่อพนักงาน</th>
      <th>หน่วยงาน</th>
      <th class="cell-center">คะแนนรวม</th>
      <th>ความคิดเห็นผู้ประเมิน</th>
    </tr>
  `;

  tbody.innerHTML = historyRows.map(row => {
    const isSelected = row.employeeId === state.selectedEmployeeId && state.selectedEmployeeId !== ALL_EMPLOYEES_VALUE;

    return `
      <tr class="${isSelected ? 'eval-report-row-highlight' : ''}">
        <td>${escapeHTML(row.year)}</td>
        <td>${escapeHTML(formatDateTimeDisplay(row.submittedAt))}</td>
        <td>${escapeHTML(row.employeeId)}</td>
        <td>${escapeHTML(row.employeeName)}</td>
        <td>${escapeHTML(row.employeeDepartment || '-')}</td>
        <td class="cell-center">${formatTableScore(row.overallScore)}</td>
        <td class="cell-detail eval-report-comment-cell">${escapeHTML(row.comment || '-')}</td>
      </tr>
    `;
  }).join('');
}

function renderEmptyHistoryTable(message) {
  renderEmptyTableState({
    theadId: 'eval-rep-history-head',
    tbodyId: 'eval-rep-history-body',
    colspan: 7,
    message,
  });
}

function renderEmptyTableState({ theadId, tbodyId, colspan, message }) {
  const thead = document.getElementById(theadId);
  const tbody = document.getElementById(tbodyId);
  if (thead) thead.innerHTML = '';
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="table-loading">
          <i class="fa-solid fa-inbox"></i>
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }
}

function syncAccessUi() {
  const accessScope = state.accessScope || resolveEvaluationAccessScope();
  const evaluatorLabel = state.currentEvaluatorName
    ? `${state.currentEvaluatorName} (${state.currentEmployeeId || '-'})`
    : (state.currentEmployeeId || 'ไม่พบรหัสผู้ใช้');

  setText('eval-rep-access-label', buildAccessScopeLabel(accessScope));
  setText('eval-rep-evaluator-pill', evaluatorLabel);

  if (state.refs && state.visibleResults.length === 0) {
    setText('eval-rep-note-title', buildEmptyAccessScopeTitle(accessScope));
    setText('eval-rep-note-body', buildEmptyAccessScopeMessage(accessScope));
    return;
  }

  setText('eval-rep-note-title', buildAccessScopeTitle(accessScope));
  setText('eval-rep-note-body', buildAccessScopeMessage(accessScope));
}

function syncScopeUi() {
  const selectedEmployee = getSelectedEmployeeOption();
  const employeeCount = new Set(state.comparisonResults.map(item => item.employeeId)).size;
  const years = sortEvaluationCycles(state.comparisonResults.map(item => item.year), 'asc');
  const departmentLabel = state.selectedDepartment || 'ทุกแผนก';

  setText(
    'eval-rep-focus-summary',
    selectedEmployee
      ? `แสดงคะแนนของ ${selectedEmployee.label} เทียบกับค่าเฉลี่ยภาพรวมของกลุ่มใน ${departmentLabel}`
      : `แสดงคะแนนเฉลี่ยรายรอบ / ปี และจำนวนแบบประเมินของพนักงานทั้งหมด ${employeeCount} คนใน ${departmentLabel}`
  );
  setText(
    'eval-rep-comparison-summary',
    selectedEmployee
      ? `เส้นที่ถูกไฮไลต์คือ ${selectedEmployee.label} และยังเห็นเส้นของพนักงานคนอื่นเพื่อใช้เทียบวิเคราะห์`
      : `เปรียบเทียบแนวโน้มคะแนนของพนักงานทุกคนในขอบเขตสิทธิ์ ครอบคลุม ${years.length} รอบ / ปี`
  );
  setText(
    'eval-rep-table-summary',
    `ตารางนี้รวม ${state.comparisonRows.length} พนักงาน และ ${years.length} รอบ / ปี${selectedEmployee ? ` โดยไฮไลต์ ${selectedEmployee.label}` : ''}`
  );
  setText(
    'eval-rep-history-summary',
    selectedEmployee
      ? `ประวัติการประเมินของ ${selectedEmployee.label} ตามตัวกรองปัจจุบัน จำนวน ${state.focusResults.length} รายการ`
      : `ประวัติการประเมินทั้งหมดใน ${departmentLabel} จำนวน ${state.focusResults.length} รายการ`
  );
}

function buildYearlySummary(results) {
  const grouped = new Map();

  results.forEach(item => {
    const year = String(item.year || '').trim();
    if (!year) return;

    const current = grouped.get(year) || { year, totalScore: 0, count: 0 };
    current.totalScore += toScore(item.overallScore);
    current.count += 1;
    grouped.set(year, current);
  });

  return sortEvaluationCycles([...grouped.keys()], 'asc').map(year => {
    const current = grouped.get(year);
    return {
      year,
      count: current.count,
      averageScore: current.count > 0 ? roundTo(current.totalScore / current.count) : 0,
    };
  });
}

function buildComparisonRows(results) {
  const yearsAsc = sortEvaluationCycles(results.map(item => item.year), 'asc');
  const yearsDesc = [...yearsAsc].reverse();
  const grouped = new Map();

  results.forEach(item => {
    const key = String(item.employeeId || '').trim();
    if (!key) return;

    const current = grouped.get(key) || {
      employeeId: key,
      employeeName: String(item.employeeName || key).trim(),
      employeeDepartment: String(item.employeeDepartment || '-').trim(),
      buckets: {},
    };

    const year = String(item.year || '').trim();
    const bucket = current.buckets[year] || { total: 0, count: 0 };
    bucket.total += toScore(item.overallScore);
    bucket.count += 1;
    current.buckets[year] = bucket;

    grouped.set(key, current);
  });

  return [...grouped.values()]
    .map(row => {
      const scoresByYear = {};

      yearsAsc.forEach(year => {
        const bucket = row.buckets[year];
        scoresByYear[year] = bucket && bucket.count > 0 ? roundTo(bucket.total / bucket.count) : null;
      });

      const orderedScores = yearsDesc
        .map(year => scoresByYear[year])
        .filter(score => Number.isFinite(score));
      const latestScore = orderedScores[0] ?? null;
      const previousScore = orderedScores[1] ?? null;
      const averageScore = averageOf(Object.values(scoresByYear).filter(score => Number.isFinite(score)));

      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeDepartment: row.employeeDepartment,
        scoresByYear,
        averageScore,
        latestScore,
        delta: Number.isFinite(latestScore) && Number.isFinite(previousScore)
          ? roundTo(latestScore - previousScore)
          : null,
      };
    })
    .sort((left, right) => {
      if (left.employeeId === state.selectedEmployeeId) return -1;
      if (right.employeeId === state.selectedEmployeeId) return 1;

      const leftScore = Number.isFinite(left.latestScore) ? left.latestScore : -Infinity;
      const rightScore = Number.isFinite(right.latestScore) ? right.latestScore : -Infinity;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return left.employeeName.localeCompare(right.employeeName, 'th');
    });
}

function buildEmployeeOptions(results) {
  const grouped = new Map();

  results.forEach(item => {
    const employeeId = String(item.employeeId || '').trim();
    if (!employeeId || grouped.has(employeeId)) return;

    const employeeName = String(item.employeeName || employeeId).trim();
    grouped.set(employeeId, {
      employeeId,
      employeeName,
      label: `${employeeName} (${employeeId})`,
    });
  });

  return [...grouped.values()].sort((left, right) => left.employeeName.localeCompare(right.employeeName, 'th'));
}

function buildHistoryRows(results) {
  return [...results].sort((left, right) => {
    const rightTime = parseDateTimeForSort(right.submittedAt);
    const leftTime = parseDateTimeForSort(left.submittedAt);
    if (rightTime !== leftTime) return rightTime - leftTime;

    const cycleCompare = compareEvaluationCycle(right.year, left.year);
    if (cycleCompare !== 0) return cycleCompare;

    return String(left.employeeName || '').localeCompare(String(right.employeeName || ''), 'th');
  });
}

function resolveCurrentEvaluatorName() {
  const normalizedCurrentId = normalizeId(state.currentEmployeeId);
  const evaluatorMatch = state.refs?.evaluators?.find(item => normalizeId(item.employeeId) === normalizedCurrentId);
  if (evaluatorMatch?.fullName) return evaluatorMatch.fullName;

  const resultMatch = state.visibleResults.find(item => String(item.evaluatorName || '').trim());
  if (resultMatch?.evaluatorName) return resultMatch.evaluatorName;

  const sessionName = `${sessionStorage.getItem('empName') || ''} ${sessionStorage.getItem('empLastname') || ''}`.trim();
  return sessionName;
}

function getVisibleResults() {
  if (!state.refs) return [];
  const normalizedCurrentId = normalizeId(state.currentEmployeeId);
  const accessScope = state.accessScope || resolveEvaluationAccessScope();

  if (accessScope.type === 'all') {
    return state.refs.results;
  }

  if (accessScope.type === 'sections') {
    return state.refs.results.filter(item => matchesSectionScope(item.employeeSection, accessScope.sections));
  }

  return state.refs.results.filter(item => normalizeId(item.evaluatorEmployeeId) === normalizedCurrentId);
}

function resolveEvaluationAccessScope() {
  const evaluatorProfile = getCurrentEvaluatorProfile();
  const evaluatorTitle = String(evaluatorProfile?.position || evaluatorProfile?.evaluatorTitle || '').trim();
  const matchedRule = EVALUATION_SCOPE_RULES.find(rule => matchesEvaluatorTitle(evaluatorTitle, rule.titles));

  if (!matchedRule) {
    return {
      type: 'self',
      evaluatorTitle,
    };
  }

  return {
    ...matchedRule,
    evaluatorTitle,
  };
}

function getCurrentEvaluatorProfile() {
  if (!state.refs) return null;
  const normalizedCurrentId = normalizeId(state.currentEmployeeId);

  return state.refs.evaluators?.find(item => normalizeId(item.employeeId) === normalizedCurrentId)
    || state.refs.employees?.find(item => normalizeId(item.employeeId) === normalizedCurrentId)
    || null;
}

function matchesEvaluatorTitle(currentTitle, expectedTitles = []) {
  const currentKey = normalizeScopeKey(currentTitle);
  if (!currentKey) return false;

  return expectedTitles.some(title => {
    const titleKey = normalizeScopeKey(title);
    return titleKey && currentKey === titleKey;
  });
}

function matchesSectionScope(sectionName, allowedSections = []) {
  const sectionKey = normalizeScopeKey(sectionName);
  if (!sectionKey) return false;

  return allowedSections.some(name => {
    const allowedKey = normalizeScopeKey(name);
    return allowedKey && sectionKey === allowedKey;
  });
}

function buildAccessScopeLabel(accessScope) {
  if (!accessScope || accessScope.type === 'self') {
    return state.currentEmployeeId ? `evaluatorEmployeeId = ${state.currentEmployeeId}` : 'ไม่พบรหัส Login';
  }

  if (accessScope.type === 'all') {
    return `${accessScope.evaluatorTitle || 'ผู้ประเมิน'} : ทุกส่วนงาน`;
  }

  return `${accessScope.evaluatorTitle || accessScope.label} : ${accessScope.sections.length} ส่วนงาน`;
}

function buildAccessScopeTitle(accessScope) {
  if (!accessScope || accessScope.type === 'self') {
    return 'รายงานนี้ล็อกตามรหัสผู้ประเมินที่ล็อกอิน';
  }

  return 'รายงานนี้ขยายสิทธิ์ตามตำแหน่งผู้ประเมิน';
}

function buildAccessScopeMessage(accessScope) {
  if (!state.currentEmployeeId) {
    return 'ระบบต้องใช้รหัสพนักงานจาก session เพื่อกำหนดขอบเขตรายงานผลประเมิน';
  }

  if (!accessScope || accessScope.type === 'self') {
    return `ระบบจะแสดงเฉพาะข้อมูลที่ evaluatorEmployeeId = ${state.currentEmployeeId} และยังสามารถสลับดูภาพรวมทั้งหมดหรือโฟกัสรายพนักงานแต่ละคนได้`;
  }

  if (accessScope.type === 'all') {
    return `ตำแหน่ง ${accessScope.evaluatorTitle || 'ผู้ประเมิน'} สามารถเห็นรายงานที่ประเมินแล้วทั้งหมด ทุกส่วนงาน`;
  }

  return `ตำแหน่ง ${accessScope.evaluatorTitle || 'ผู้ประเมิน'} สามารถเห็นรายงานที่ประเมินแล้วของ ${accessScope.sections.join(', ')}`;
}

function buildEmptyAccessScopeMessage(accessScope) {
  if (!state.currentEmployeeId) {
    return 'ระบบยังไม่พบรหัสพนักงานใน session จึงไม่สามารถกำหนดขอบเขตรายงานได้';
  }

  if (!accessScope || accessScope.type === 'self') {
    return 'ระบบค้นหาเฉพาะรายการที่ evaluatorEmployeeId ตรงกับรหัส Login ปัจจุบัน และตอนนี้ยังไม่พบข้อมูลในผลประเมิน';
  }

  if (accessScope.type === 'all') {
    return `ตำแหน่ง ${accessScope.evaluatorTitle || 'ผู้ประเมิน'} มีสิทธิ์เห็นทุกส่วนงาน แต่ตอนนี้ยังไม่พบข้อมูลผลประเมินในระบบ`;
  }

  return `ตำแหน่ง ${accessScope.evaluatorTitle || 'ผู้ประเมิน'} มีสิทธิ์เห็น ${accessScope.sections.join(', ')} แต่ตอนนี้ยังไม่พบข้อมูลผลประเมินในขอบเขตนี้`;
}

function buildEmptyAccessScopeTitle(accessScope) {
  if (!accessScope || accessScope.type === 'self') {
    return 'ยังไม่พบข้อมูลผลประเมินของผู้ใช้ที่ล็อกอิน';
  }

  return 'ยังไม่พบข้อมูลผลประเมินในขอบเขตสิทธิ์นี้';
}

function getSelectedEmployeeOption() {
  if (state.selectedEmployeeId === ALL_EMPLOYEES_VALUE) return null;

  const match = state.comparisonRows.find(row => row.employeeId === state.selectedEmployeeId);
  return match
    ? {
        employeeId: match.employeeId,
        label: `${match.employeeName} (${match.employeeId})`,
      }
    : null;
}

function buildChartOptions({ showLegend, withCountAxis, maxScore }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 900,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: showLegend,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18,
          color: '#334155',
          font: {
            family: 'inherit',
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 14,
        displayColors: true,
        cornerRadius: 14,
        boxPadding: 6,
        callbacks: {
          label(context) {
            const label = context.dataset.label || 'ข้อมูล';
            if (context.dataset.yAxisID === 'yCount') {
              return `${label}: ${context.raw || 0} แบบประเมิน`;
            }
            return `${label}: ${formatNumber(context.raw)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      yScore: {
        beginAtZero: true,
        suggestedMax: Math.max(100, roundTo(maxScore + 5, 0)),
        grid: {
          color: 'rgba(148, 163, 184, 0.18)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          callback(value) {
            return `${value}`;
          },
        },
        title: {
          display: true,
          text: 'คะแนน',
          color: '#334155',
          font: {
            size: 12,
            weight: 700,
          },
        },
      },
      ...(withCountAxis ? {
        yCount: {
          beginAtZero: true,
          position: 'right',
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            precision: 0,
            color: '#f97316',
          },
          title: {
            display: true,
            text: 'จำนวนแบบประเมิน',
            color: '#f97316',
            font: {
              size: 12,
              weight: 700,
            },
          },
        },
      } : {}),
    },
  };
}

function destroyCharts() {
  if (focusChart) {
    focusChart.destroy();
    focusChart = null;
  }

  if (comparisonChart) {
    comparisonChart.destroy();
    comparisonChart = null;
  }
}

function createVerticalGradient(context, startColor, endColor, alpha = 0.2) {
  const gradient = context.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, hexToRgba(startColor, alpha));
  gradient.addColorStop(1, hexToRgba(endColor, 0.03));
  return gradient;
}

function canViewEvaluationReport() {
  return getUserAccessProfile().isLoggedIn;
}

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeScopeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_/\\.,]/g, '');
}

function toScore(value) {
  const normalized = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(normalized) ? normalized : 0;
}

function averageOf(values) {
  if (!values.length) return null;
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'th'));
}

function compareEvaluationCycle(left, right) {
  const leftParts = parseCycleParts(left);
  const rightParts = parseCycleParts(right);

  if (leftParts.year !== rightParts.year) return leftParts.year - rightParts.year;
  if (leftParts.round !== rightParts.round) return leftParts.round - rightParts.round;
  return String(left || '').localeCompare(String(right || ''), 'th');
}

function parseCycleParts(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/(\d{4}).*?(\d+)/);
  if (!match) {
    return {
      year: 0,
      round: 0,
    };
  }

  return {
    year: Number(match[1]) || 0,
    round: Number(match[2]) || 0,
  };
}

function parseDateTimeForSort(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 0;

  const thaiMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (thaiMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = thaiMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }

  const parsed = new Date(normalized).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTimeDisplay(value) {
  const timestamp = parseDateTimeForSort(value);
  if (!timestamp) return '-';

  const date = new Date(timestamp);
  const pad = number => String(number).padStart(2, '0');

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatTableScore(value) {
  return Number.isFinite(value) ? escapeHTML(formatNumber(value)) : '-';
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function formatSignedScore(value) {
  if (!Number.isFinite(value)) return '-';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}`;
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || '').replace('#', '').trim();
  const safeHex = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6);

  const red = parseInt(safeHex.slice(0, 2), 16);
  const green = parseInt(safeHex.slice(2, 4), 16);
  const blue = parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
