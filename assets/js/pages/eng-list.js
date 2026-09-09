/**
 * Engineer — Repair Request List (ตารางติดตามสถานะแจ้งซ่อม)
 */
import { database, ref, get, update } from '../firebase.js';
import { getEngStepBadge as getStepBadge, getEngStepText, parseDMY, dateToString, parseDateTime, buildPaginationHTML, bindPaginationEvents, escapeHTML, escapeAttr, sanitizeUrl } from '../utils.js';

export function render() {
  const summarySheetUrl = sanitizeUrl(import.meta.env.VITE_ENG_REPAIR_REPORT_SHEET_SOURCE_URL);

  // === ส่วนของ HTML Template (หน้าตาของตารางและฟอร์ม) ===
  // ฟังก์ชันนี้ส่งคืน HTML ที่จะนำไปแสดงในหน้าจอ ประกอบด้วย 2 ตารางหลัก (Table 1 รออนุมัติ และ Table 2 ค้นหา)
  // === Header columns (shared) ===
  const thCols = `
    <th>สถานะ</th>
    <th>#</th>
    <th>วันที่แจ้งซ่อม</th>
    <th>เลขที่ใบแจ้งซ่อม</th>
    <th>พื้นที่</th>
    <th>ประเภทงาน</th>
    <th>รหัสเครื่องจักร</th>
    <th>ชื่อเครื่องจักร</th>
    <th>รายละเอียด</th>
    <th>ผู้แจ้งงาน</th>
    <th>ผู้อนุมัติ</th>
    <th>วันที่ต้องการ</th>
    <th>กำหนดวันเสร็จ(ช่าง)</th>`;

  return `
    <div class="app-page">
      <section class="page-hero page-hero-eng fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Engineer Workflow</p>
          <h1 class="page-hero-title">Repair Request Command Center</h1>
          <p class="page-hero-subtitle">ติดตามงานค้าง อนุมัติรายการที่ต้องดำเนินการ และเปิดรายละเอียดเพื่อเดินงานต่อได้จากหน้าเดียว</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>มุมมองข้อมูล</span>
            <strong id="eng-scope-label">กำลังตรวจสอบสิทธิ์...</strong>
          </div>
          <div class="page-hero-stat">
            <span>อัปเดตล่าสุด</span>
            <strong id="eng-last-sync">กำลังโหลด...</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>ศูนย์ติดตามงานซ่อม</strong>
          หน้านี้รวมคิวงานที่ต้องอนุมัติ งานที่กำลังดำเนินการ และประวัติย้อนหลังไว้ในมุมมองเดียวเพื่อให้ไล่งานได้เร็วขึ้น
        </div>
      </div>

      <div class="ops-kpi-grid fade-in">
        <div class="form-card ops-kpi-card ops-kpi-blue">
          <div class="ops-kpi-icon"><i class="fa-solid fa-folder-tree"></i></div>
          <div class="ops-kpi-copy">
            <span>งานทั้งหมด</span>
            <strong id="eng-stat-total">0</strong>
            <small>รายการในระบบ</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-amber">
          <div class="ops-kpi-icon"><i class="fa-solid fa-bell"></i></div>
          <div class="ops-kpi-copy">
            <span>ต้องติดตาม</span>
            <strong id="eng-stat-queue">0</strong>
            <small>คิวที่ควรเปิดดูต่อ</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-indigo">
          <div class="ops-kpi-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
          <div class="ops-kpi-copy">
            <span>กำลังซ่อม</span>
            <strong id="eng-stat-progress">0</strong>
            <small>ใบงานที่กำลังดำเนินการ</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-green">
          <div class="ops-kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="ops-kpi-copy">
            <span>ปิดงานแล้ว</span>
            <strong id="eng-stat-complete">0</strong>
            <small>งานซ่อมที่เสร็จสมบูรณ์</small>
          </div>
        </div>
      </div>

      <div class="form-card fade-in ops-card ops-card-primary">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-blue">
              <i class="fa-solid fa-clipboard-list"></i>
            </div>
            <div class="form-header-text">
              <h2>Repair Request List</h2>
              <p>รายการที่รออนุมัติหรือรอประเมินความเรียบร้อย เพื่อให้เปิดดูและตัดสินใจต่อได้เร็วขึ้น</p>
            </div>
          </div>
          <div class="ops-panel-chip">
            <i class="fa-solid fa-hand-pointer"></i>
            คลิกที่แถวเพื่อเปิดรายละเอียด
          </div>
        </div>

        <div class="ops-section-note">
          <i class="fa-solid fa-circle-info"></i>
          <span>ตารางนี้เน้นคิวที่ต้องตัดสินใจตอนนี้ ส่วนรายการค้นหาด้านล่างใช้สำหรับไล่ดูประวัติทั้งหมด</span>
        </div>

        <div class="list-filter-bar ops-filter-bar">
          <div class="filter-group">
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar-days"></i> ปี</label>
              <select class="form-control" id="rl-filter-year">
                <option value="">ทุกปี</option>
              </select>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-magnifying-glass"></i> ค้นหา</label>
              <input type="text" class="form-control" id="rl-search" placeholder="ค้นหาเลขที่, พื้นที่, เครื่องจักร, ผู้แจ้ง, ผู้อนุมัติ">
            </div>
          </div>
          <div class="ops-filter-side">
            <div class="filter-summary">
              <span id="rl-count">0</span>
              <span class="ops-summary-copy">กำลังแสดง</span>
              <small id="rl-total">จาก 0 งาน</small>
            </div>
            <button class="btn btn-secondary btn-compact" type="button" id="rl-reset">
              <i class="fa-solid fa-rotate-left"></i>
              ล้างตัวกรอง
            </button>
          </div>
        </div>

        <div class="ops-table-caption">
          <span><i class="fa-solid fa-arrow-up-wide-short"></i> เรียงวันที่แจ้งจากน้อยไปมาก</span>
          <span><i class="fa-solid fa-table-list"></i> ตารางเลื่อนแนวนอนได้ในหน้าจอเล็ก</span>
        </div>

        <div class="table-wrapper ops-table-wrapper">
          <table class="data-table table-width-lock" id="rl-table" style="--ops-table-min-width: 1620px; --table-lock-width: 1980px; --table-cell-min: 118px; --table-detail-min: 280px;">
            <thead><tr>${thCols}</tr></thead>
            <tbody id="rl-tbody">
              <tr><td colspan="13" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="rl-pagination"></div>
      </div>

      <div class="form-card fade-in ops-card ops-card-stack ops-card-search">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-amber">
              <i class="fa-solid fa-magnifying-glass-chart"></i>
            </div>
            <div class="form-header-text">
              <h2>Search — ค้นหาใบแจ้งซ่อม</h2>
              <p>ค้นหาตามช่วงวันที่ สถานะ หรือคำสำคัญ เพื่อย้อนดูใบแจ้งซ่อมทุกขั้นตอน</p>
              <p>
                <a href="${escapeAttr(summarySheetUrl)}" target="_blank" rel="noopener noreferrer">
                  <i class="fa-solid fa-up-right-from-square"></i>
                  เปิดไฟล์สรุปใน Google Sheets
                </a>
              </p>
            </div>
          </div>
          <div class="ops-panel-chip ops-panel-chip-soft">
            <i class="fa-solid fa-sliders"></i>
            ใช้ตัวกรองร่วมกันได้
          </div>
        </div>

        <div class="list-filter-bar ops-filter-bar">
          <div class="filter-group">
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar"></i> วันที่เริ่ม</label>
              <input type="text" class="form-control" id="s2-date-start" placeholder="dd/mm/yyyy" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar-check"></i> วันที่สิ้นสุด</label>
              <input type="text" class="form-control" id="s2-date-end" placeholder="dd/mm/yyyy" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-hashtag"></i> คำค้นหา</label>
              <input type="text" class="form-control" id="s2-keyword" placeholder="เลขที่, พื้นที่, เครื่องจักร, ผู้แจ้ง">
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-filter"></i> สถานะ</label>
              <select class="form-control" id="s2-status">
                <option value="">ทั้งหมด</option>
                <option value="1">รอหัวหน้าอนุมัติ</option>
                <option value="2">รอช่างอนุมัติ</option>
                <option value="3">กำลังซ่อม</option>
                <option value="4">ซ่อมเสร็จแล้ว</option>
                <option value="5">รอการประเมิณความเรียบร้อย</option>
                <option value="6">ยกเลิก</option>
              </select>
            </div>
          </div>
          <div class="ops-filter-side">
            <div class="filter-summary">
              <span id="s2-count">0</span>
              <span class="ops-summary-copy">กำลังแสดง</span>
              <small id="s2-total">จาก 0 งาน</small>
            </div>
            <button class="btn btn-secondary btn-compact" type="button" id="s2-reset">
              <i class="fa-solid fa-rotate-left"></i>
              ล้างตัวกรอง
            </button>
          </div>
        </div>

        <div class="ops-table-caption">
          <span><i class="fa-solid fa-clock-rotate-left"></i> ใช้สำหรับค้นย้อนหลังและเรียงวันที่แจ้งจากน้อยไปมาก</span>
          <span><i class="fa-solid fa-expand"></i> คลิกแถวเพื่อเปิดรายละเอียดและจัดการต่อ</span>
        </div>

        <div class="table-wrapper ops-table-wrapper">
          <table class="data-table table-width-lock" id="s2-table" style="--ops-table-min-width: 1620px; --table-lock-width: 1980px; --table-cell-min: 118px; --table-detail-min: 280px;">
            <thead><tr>${thCols}</tr></thead>
            <tbody id="s2-tbody">
              <tr><td colspan="13" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="s2-pagination"></div>
      </div>

      <div class="modal-overlay" id="detail-modal" style="display:none;">
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-header-main">
              <div class="modal-title-block">
                <h3><i class="fa-solid fa-file-lines"></i> รายละเอียดใบแจ้งซ่อม <span id="dm-title-id"></span></h3>
                <p>ตรวจสอบข้อมูล แจ้งงานวิศวกรรม และยืนยันการรับงานได้ในหน้าต่างเดียว</p>
              </div>
              <div class="modal-status-panel">
                <span class="modal-status-label">สถานะปัจจุบัน</span>
                <div id="dm-status-badge" class="modal-status-badge"></div>
              </div>
            </div>
            <button class="modal-close" id="dm-close"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="detail-section section-blue">
              <div class="detail-section-header"><i class="fa-solid fa-info-circle"></i> ข้อมูลแจ้งซ่อม</div>
              <div class="detail-section-body">
                <div class="detail-grid">
                  <div class="detail-field"><span class="detail-label">เลขที่ใบแจ้งซ่อม</span><div class="detail-value" id="dm-id"></div></div>
                  <div class="detail-field"><span class="detail-label">วันที่แจ้ง</span><div class="detail-value" id="dm-date"></div></div>
                  <div class="detail-field"><span class="detail-label">ชื่อผู้แจ้ง</span><div class="detail-value" id="dm-name"></div></div>
                  <div class="detail-field"><span class="detail-label">แผนก</span><div class="detail-value" id="dm-dep"></div></div>
                  <div class="detail-field"><span class="detail-label">ลักษณะงาน</span><div class="detail-value" id="dm-type"></div></div>
                  <div class="detail-field"><span class="detail-label">พื้นที่</span><div class="detail-value" id="dm-plant"></div></div>
                  <div class="detail-field"><span class="detail-label">รหัสเครื่องจักร</span><div class="detail-value" id="dm-mac-code"></div></div>
                  <div class="detail-field"><span class="detail-label">ชื่อเครื่องจักร</span><div class="detail-value" id="dm-mac-name"></div></div>
                  <div class="detail-field span-2"><span class="detail-label">รายละเอียด</span><div class="detail-value" id="dm-detail"></div></div>
                  <div class="detail-field span-2"><span class="detail-label">ภาพประกอบ</span><div id="dm-images"></div></div>
                </div>
              </div>
            </div>

            <div class="detail-section section-amber">
              <div class="detail-section-header"><i class="fa-solid fa-user-gear"></i> Engineer — กำหนดงาน</div>
              <div class="detail-section-body">
                <div class="detail-grid">
                  <div class="detail-field span-2"><span class="detail-label">หัวหน้าช่างที่ดูแล</span><select class="modal-select" id="dm-leader"><option value="">-- เลือกหัวหน้าช่าง --</option></select></div>
                  <div class="detail-field"><span class="detail-label">กำหนดวันเริ่ม</span><input type="text" class="modal-input" id="dm-start" placeholder="dd/mm/yyyy HH:mm" readonly></div>
                  <div class="detail-field"><span class="detail-label">กำหนดวันเสร็จ</span><input type="text" class="modal-input" id="dm-end" placeholder="dd/mm/yyyy HH:mm" readonly></div>
                </div>
              </div>
            </div>

            <div class="detail-section section-purple">
              <div class="detail-section-header"><i class="fa-solid fa-users-gear"></i> Engineer — รายละเอียดงาน</div>
              <div class="detail-section-body">
                <div class="detail-grid cols-1">
                  <div class="detail-field"><span class="detail-label">รายชื่อช่างที่ดูแล (สูงสุด 5 คน)</span>
                    <div class="tech-slots">
                      <div class="tech-slot"><span class="tech-slot-num">1.</span><select class="modal-select dm-tech" id="dm-tech-1"><option value="">-- เลือก --</option></select></div>
                      <div class="tech-slot"><span class="tech-slot-num">2.</span><select class="modal-select dm-tech" id="dm-tech-2"><option value="">-- เลือก --</option></select></div>
                      <div class="tech-slot"><span class="tech-slot-num">3.</span><select class="modal-select dm-tech" id="dm-tech-3"><option value="">-- เลือก --</option></select></div>
                      <div class="tech-slot"><span class="tech-slot-num">4.</span><select class="modal-select dm-tech" id="dm-tech-4"><option value="">-- เลือก --</option></select></div>
                      <div class="tech-slot"><span class="tech-slot-num">5.</span><select class="modal-select dm-tech" id="dm-tech-5"><option value="">-- เลือก --</option></select></div>
                    </div>
                  </div>
                  <div class="detail-field"><span class="detail-label">วิธีการแก้ไข</span><textarea class="modal-textarea" id="dm-fix" rows="2"></textarea></div>
                  <div class="detail-field"><span class="detail-label">รายการอะไหล่ที่ใช้</span><textarea class="modal-textarea" id="dm-parts" rows="2"></textarea></div>
                  <div class="detail-field"><span class="detail-label">หมายเหตุ</span><textarea class="modal-textarea" id="dm-remark" rows="2"></textarea></div>
                  <div class="detail-field"><span class="detail-label">วันและเวลาเสร็จสิ้น</span><input type="text" class="modal-input" id="dm-end-real" placeholder="dd/mm/yyyy HH:mm" readonly></div>
                </div>
              </div>
            </div>

            <div class="detail-section section-green">
              <div class="detail-section-header"><i class="fa-solid fa-clipboard-check"></i> ผู้แจ้ง — ประเมินรับงาน</div>
              <div class="detail-section-body">
                <div class="detail-grid cols-1">
                  <div class="detail-field"><span class="detail-label">ประเมินรับงานซ่อม</span>
                    <div class="radio-group">
                      <label class="radio-item"><input type="radio" name="dm-accept" value="รับงานซ่อม"> รับงานซ่อม</label>
                      <label class="radio-item"><input type="radio" name="dm-accept" value="ไม่รับงานซ่อม"> ไม่รับงานซ่อม</label>
                    </div>
                  </div>
                  <div class="detail-field"><span class="detail-label">หมายเหตุ</span><textarea class="modal-textarea" id="dm-user-remark" rows="2"></textarea></div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer modal-footer-split">
            <div class="modal-action-group modal-action-group-secondary">
              <button class="btn btn-edit" id="dm-btn-edit"><i class="fa-solid fa-pen-to-square"></i> บันทึกแก้ไข</button>
              <button class="btn btn-cancel-action" id="dm-btn-cancel"><i class="fa-solid fa-ban"></i> ยกเลิกใบงาน</button>
              <button class="btn btn-work" id="dm-btn-work"><i class="fa-solid fa-file-invoice"></i> เปิดใบงาน</button>
              <button class="btn btn-report" id="dm-btn-report"><i class="fa-solid fa-chart-bar"></i> เปิดรายงาน</button>
            </div>
            <div class="modal-action-group modal-action-group-primary">
              <button class="btn btn-approve" id="dm-btn-approve"><i class="fa-solid fa-check-circle"></i> อัปเดตสถานะ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const SEARCH_DEFAULT_LOOKBACK_DAYS = 15;

  function getRecordDateValue(dateStr) {
    if (!dateStr || dateStr === '-') return 0;
    const withTime = parseDateTime(dateStr);
    if (withTime) return withTime;

    const dateOnly = parseDMY(dateStr);
    return dateOnly ? dateOnly.getTime() : 0;
  }

  // Helpers moved to utils.js

  // Helper: สร้าง row HTML
  function buildRow(r, rowNum) {
    const detailText = r.detail || '-';
    const shortDetail = detailText.length > 56 ? detailText.substring(0, 56) + '...' : detailText;
    const dateOnly = r.date !== '-' ? r.date.split(' ')[0] : '-';
    const stepBadge = getStepBadge(r.step);
    return `
      <tr class="clickable-row" data-keyword="${escapeAttr(r.keyword)}">
        <td class="cell-center">${stepBadge}</td>
        <td class="cell-center">${rowNum}</td>
        <td class="cell-center">${escapeHTML(dateOnly)}</td>
        <td class="cell-keyword"><span class="badge-keyword">${escapeHTML(r.keyword)}</span></td>
        <td>${escapeHTML(r.plant)}</td>
        <td>${escapeHTML(r.type)}</td>
        <td class="cell-mono">${escapeHTML(r.machineCode)}</td>
        <td>${escapeHTML(r.machineName)}</td>
        <td class="cell-detail" title="${escapeAttr(detailText)}">${escapeHTML(shortDetail)}</td>
        <td>${escapeHTML(r.reporter)}</td>
        <td>${escapeHTML(r.approverName)}</td>
        <td class="cell-center">${escapeHTML(r.complete)}</td>
        <td class="cell-center">${escapeHTML(r.denEnd)}</td>
      </tr>
    `;
  }

  const ROWS_PER_PAGE = 10;
  const loggedInId = sessionStorage.getItem('empId') || '';
  const empLevelEn = String(sessionStorage.getItem('empLevel_en') || '').trim().toLowerCase();
  const isAdmin = empLevelEn === 'admin' || empLevelEn === 'admin_en';
  const loggedInDept = sessionStorage.getItem('empDepartment') || '';

  // ==========================================
  // ตารางที่ 1: List Approve (step 1 & 5)
  // ==========================================
  const t1 = {
    tbody: document.getElementById('rl-tbody'),
    yearSelect: document.getElementById('rl-filter-year'),
    searchInput: document.getElementById('rl-search'),
    resetBtn: document.getElementById('rl-reset'),
    countSpan: document.getElementById('rl-count'),
    totalSpan: document.getElementById('rl-total'),
    pagBar: document.getElementById('rl-pagination'),
    all: [],        // ข้อมูล step 1 & 5
    filtered: [],
    page: 1,
  };

  const overview = {
    scopeLabel: document.getElementById('eng-scope-label'),
    lastSync: document.getElementById('eng-last-sync'),
    total: document.getElementById('eng-stat-total'),
    queue: document.getElementById('eng-stat-queue'),
    progress: document.getElementById('eng-stat-progress'),
    complete: document.getElementById('eng-stat-complete'),
  };

  let masterRecords = []; // ข้อมูลทุก step สำหรับตาราง 2 & 3

  function syncPrimaryQueue() {
    t1.all = masterRecords.filter((record) => {
      const step = String(record.step);
      if (step !== '1' && step !== '2') return false;
      if (isAdmin) return true;
      const approveId = (record._raw.approve || '').split(' | ')[0].trim();
      return approveId === loggedInId;
    });
    updateOverviewStats();
  }

  function updateOverviewStats() {
    const latestRecord = masterRecords
      .slice()
      .sort((a, b) => parseDateTime(b.updatedAt) - parseDateTime(a.updatedAt))[0];

    overview.scopeLabel.textContent = isAdmin
      ? 'ผู้ดูแลระบบ, เห็นข้อมูลทุกแผนก'
      : `เฉพาะแผนก ${loggedInDept || 'ของคุณ'}`;
    overview.lastSync.textContent = latestRecord?.updatedAt || 'ยังไม่มีข้อมูล';
    overview.total.textContent = masterRecords.length;
    overview.queue.textContent = t1.all.length;
    overview.progress.textContent = masterRecords.filter(r => String(r.step) === '3').length;
    overview.complete.textContent = masterRecords.filter(r => String(r.step) === '4').length;
  }

  async function loadData() {
    try {
      const fixRef = ref(database, 'DEN/FIX');
      const snapshot = await get(fixRef);

      if (!snapshot.exists()) {
        masterRecords = [];
        t1.all = [];
        updateOverviewStats();
        t1.tbody.innerHTML = '<tr><td colspan="13" class="table-empty"><i class="fa-solid fa-inbox"></i> ไม่พบข้อมูลการแจ้งซ่อม</td></tr>';
        return;
      }

      const data = snapshot.val();
      const years = new Set();
      masterRecords = [];

      // แปลงข้อมูลจาก Firebase ให้อยู่ในรูปแบบ Array เพื่อนำไปแสดงในตาราง
      Object.entries(data).forEach(([year, items]) => {
        years.add(year);
        if (items && typeof items === 'object') {
          Object.entries(items).forEach(([recordId, record]) => {
            const macParts = (record.mac || '').split(' | ');
            const machineCode = macParts[0] || '-';
            const machineName = macParts[1] || '-';

            const nameParts = (record.name || '').split(' | ');
            const reporter = nameParts.length > 1 ? nameParts[1] : (record.name || '-');
            const approveParts = (record.approve || '').split(' | ');
            const approverName = approveParts[1] || approveParts[0] || '-';

            const recObj = {
              date: record.date || '-',
              updatedAt: record.dateUpdate || record.date || '-',
              keyword: record.id || recordId,
              plant: record.plant || '-',
              type: record.type || '-',
              machineCode, machineName,
              detail: record.detail || '-',
              reporter,
              approve: record.approve || '-',
              approverName,
              complete: record.complete || '-',
              denEnd: record.den_end || '-',
              year,
              step: record.step || '0',
              _raw: record,
            };

            masterRecords.push(recObj);
          });
        }
      });

      // เรียงลำดับตามวันที่แจ้ง: จากน้อยไปมาก
      const sortAsc = (arr) => arr.sort((a, b) => getRecordDateValue(a.date) - getRecordDateValue(b.date));
      sortAsc(masterRecords);
      syncPrimaryQueue();
      sortAsc(t1.all);

      // สร้าง dropdown ปี
      const sortedYears = [...years].sort((a, b) => b - a);
      t1.yearSelect.innerHTML = '<option value="">ทุกปี</option>';
      sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        t1.yearSelect.appendChild(opt);
      });

      console.log(`✅ โหลดข้อมูลแจ้งซ่อมสำเร็จ: ${masterRecords.length} รายการ (ตาราง 1: ${t1.all.length})`);
      t1.filtered = t1.all;
      t1.page = 1;
      renderT1();

      // โหลดตาราง 2 หลังข้อมูลพร้อม
      if (typeof s2Refresh === 'function') s2Refresh();

    } catch (error) {
      console.error('❌ โหลดข้อมูลล้มเหลว:', error);
      t1.tbody.innerHTML = `<tr><td colspan="13" class="table-empty table-error"><i class="fa-solid fa-circle-exclamation"></i> เกิดข้อผิดพลาด: ${escapeHTML(error.message)}</td></tr>`;
    }
  }

  function renderT1() {
    t1.totalSpan.textContent = `จาก ${t1.all.length} งาน`;
    if (t1.filtered.length === 0) {
      t1.tbody.innerHTML = '<tr><td colspan="13" class="table-empty"><i class="fa-solid fa-filter-circle-xmark"></i> ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>';
      t1.countSpan.textContent = '0';
      t1.pagBar.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(t1.filtered.length / ROWS_PER_PAGE);
    if (t1.page > totalPages) t1.page = totalPages;
    if (t1.page < 1) t1.page = 1;

    const startIdx = (t1.page - 1) * ROWS_PER_PAGE;
    const pageRecords = t1.filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);

    t1.countSpan.textContent = t1.filtered.length;
    t1.tbody.innerHTML = pageRecords.map((r, i) => buildRow(r, startIdx + i + 1)).join('');

    t1.pagBar.innerHTML = buildPaginationHTML(t1.page, totalPages, t1.filtered.length, ROWS_PER_PAGE);
    bindPaginationEvents(t1.pagBar, 'rl-table', () => t1.page, p => t1.page = p, renderT1);
  }

  function applyT1Filters() {
    const selectedYear = t1.yearSelect.value;
    const searchText = t1.searchInput.value.trim().toLowerCase();
    let filtered = t1.all;

    if (selectedYear) filtered = filtered.filter(r => r.year === selectedYear);
    if (searchText) {
      filtered = filtered.filter(r => {
        const haystack = [r.keyword, r.plant, r.type, r.machineCode, r.machineName, r.detail, r.reporter, r.approve, r.date, r.complete, r.denEnd].join(' ').toLowerCase();
        return haystack.includes(searchText);
      });
    }

    t1.filtered = filtered;
    t1.page = 1;
    renderT1();
  }

  t1.yearSelect.addEventListener('change', applyT1Filters);
  let t1Timeout;
  t1.searchInput.addEventListener('input', () => {
    clearTimeout(t1Timeout);
    t1Timeout = setTimeout(applyT1Filters, 300);
  });
  t1.resetBtn.addEventListener('click', () => {
    t1.yearSelect.value = '';
    t1.searchInput.value = '';
    applyT1Filters();
  });

  loadData();

  // ==========================================
  // Detail Modal Logic
  // ==========================================
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('dm-close');
  let engineerOptions = ''; // cache dropdown options

  function validateScheduleRange(startVal, endVal) {
    if (!startVal || startVal === '-' || !endVal || endVal === '-') return true;

    if (parseDateTime(endVal) < parseDateTime(startVal)) {
      showAlert("Warning", "กำหนดวันสิ้นสุดต้องไม่น้อยกว่ากำหนดวันเริ่ม", "fa-triangle-exclamation");
      return false;
    }

    return true;
  }

  // Load engineers from DHR/User (active=true, dept=EN)
  async function loadEngineers() {
    if (engineerOptions) return; // already loaded
    try {
      const snap = await get(ref(database, 'DHR/User'));
      if (!snap.exists()) return;
      const users = snap.val();
      let opts = '<option value="">-- เลือก --</option>';
      Object.entries(users).forEach(([id, u]) => {
        if (u.active === 'true' && u.department === 'วิศวกรรม ( EN )') {
          const name = `${u.firstname || ''} ${u.lastname || ''}`.trim();
          opts += `<option value="${escapeAttr(name)}">${escapeHTML(name)}</option>`;
        }
      });
      engineerOptions = opts;
    } catch (e) { console.error('Load engineers error:', e); }
  }

  function populateEngineerDropdowns() {
    document.getElementById('dm-leader').innerHTML = engineerOptions;
    for (let i = 1; i <= 5; i++) {
      document.getElementById(`dm-tech-${i}`).innerHTML = engineerOptions;
    }
  }

  function openModal(record) {
    const raw = record._raw;
    // ส่วนที่ 1: read-only
    document.getElementById('dm-title-id').textContent = record.keyword;
    document.getElementById('dm-status-badge').innerHTML = getStepBadge(record.step);
    document.getElementById('dm-status-badge').setAttribute('aria-label', getEngStepText(record.step));
    document.getElementById('dm-id').textContent = record.keyword;
    document.getElementById('dm-date').textContent = raw.date || '-';
    document.getElementById('dm-name').textContent = raw.name || '-';
    document.getElementById('dm-dep').textContent = raw.dep || '-';
    document.getElementById('dm-type').textContent = raw.type || '-';
    document.getElementById('dm-plant').textContent = raw.plant || '-';
    const macP = (raw.mac || '').split(' | ');
    document.getElementById('dm-mac-code').textContent = macP[0] || '-';
    document.getElementById('dm-mac-name').textContent = macP[1] || '-';
    document.getElementById('dm-detail').textContent = raw.detail || '-';

    // Images
    const imgDiv = document.getElementById('dm-images');
    const imgs = (raw.image || '').split(', ').filter(u => u && u !== '-');
    if (imgs.length > 0) {
      const galleryHtml = imgs.slice(0, 5).map((url, i) => {
        const safeUrl = sanitizeUrl(url, '');
        if (!safeUrl) return '';
        const safeAttrUrl = escapeAttr(safeUrl);
        return `<a href="${safeAttrUrl}" target="_blank" rel="noopener noreferrer" title="ภาพที่ ${i + 1}"><img src="${safeAttrUrl}" alt="img${i + 1}"></a>`;
      }).join('');

      imgDiv.innerHTML = galleryHtml
        ? `<div class="detail-gallery">${galleryHtml}</div>`
        : '<span class="detail-no-image">ไม่มีภาพ</span>';
    } else {
      imgDiv.innerHTML = '<span class="detail-no-image">ไม่มีภาพ</span>';
    }

    // ส่วนที่ 2: Engineer
    populateEngineerDropdowns();

    // den_name: index 0 = หัวหน้าช่าง, index 1-5 = ช่าง
    const names = (raw.den_name || '').split(',');
    const leaderVal = (names[0] || '').trim();
    document.getElementById('dm-leader').value = leaderVal !== '-' ? leaderVal : '';

    // Flatpickr
    const startInput = document.getElementById('dm-start');
    const endInput = document.getElementById('dm-end');
    const endRealInput = document.getElementById('dm-end-real');
    if (startInput._flatpickr) startInput._flatpickr.destroy();
    if (endInput._flatpickr) endInput._flatpickr.destroy();
    if (endRealInput._flatpickr) endRealInput._flatpickr.destroy();

    const initialStart = raw.den_start !== '-' ? raw.den_start : null;
    const endPicker = flatpickr(endInput, {
      dateFormat: 'd/m/Y H:i',
      enableTime: true,
      time_24hr: true,
      disableMobile: true,
      defaultDate: raw.den_end !== '-' ? raw.den_end : null,
      minDate: initialStart
    });
    flatpickr(startInput, {
      dateFormat: 'd/m/Y H:i',
      enableTime: true,
      time_24hr: true,
      disableMobile: true,
      defaultDate: initialStart,
      onChange: selectedDates => {
        const selectedStart = selectedDates[0] || null;
        endPicker.set('minDate', selectedStart);
        if (selectedStart && endPicker.selectedDates[0] && endPicker.selectedDates[0] < selectedStart) {
          endPicker.clear();
        }
      }
    });
    flatpickr(endRealInput, {
      dateFormat: 'd/m/Y H:i',
      enableTime: true,
      time_24hr: true,
      disableMobile: true,
      defaultDate: raw.den_end_real && raw.den_end_real !== '-' ? raw.den_end_real : new Date()
    });

    // ส่วนที่ 3: ช่าง index 1-5
    for (let i = 1; i <= 5; i++) {
      const v = (names[i] || '').trim();
      document.getElementById(`dm-tech-${i}`).value = v !== '-' ? v : '';
    }
    document.getElementById('dm-fix').value = raw.den_fix !== '-' ? (raw.den_fix || '') : '';
    document.getElementById('dm-parts').value = raw.den_parts !== '-' ? (raw.den_parts || '') : '';
    document.getElementById('dm-remark').value = raw.den_remack !== '-' ? (raw.den_remack || '') : '';

    // ส่วนที่ 4: User
    document.querySelectorAll('input[name="dm-accept"]').forEach(r => r.checked = false);
    if (raw.clean && raw.clean !== '-') {
      const radio = document.querySelector(`input[name="dm-accept"][value="${raw.clean}"]`);
      if (radio) radio.checked = true;
    }
    document.getElementById('dm-user-remark').value = raw.remack !== '-' ? (raw.remack || '') : '';

    // === Step Visibility Logic ===
    const sections = modal.querySelectorAll('.detail-section');
    const btnApprove = document.getElementById('dm-btn-approve');
    const btnEdit = document.getElementById('dm-btn-edit');
    const btnCancel = document.getElementById('dm-btn-cancel');
    const btnWork = document.getElementById('dm-btn-work');
    const btnReport = document.getElementById('dm-btn-report');
    const userRemarkField = document.getElementById('dm-user-remark').closest('.detail-field');

    // Default visibility setup
    sections.forEach(s => s.style.display = 'none');
    btnApprove.innerHTML = '<i class="fa-solid fa-check-circle"></i> อัปเดตสถานะ';
    btnEdit.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> บันทึกแก้ไข';
    btnCancel.innerHTML = '<i class="fa-solid fa-ban"></i> ยกเลิกใบงาน';
    btnWork.innerHTML = '<i class="fa-solid fa-file-invoice"></i> เปิดใบงาน';
    btnReport.innerHTML = '<i class="fa-solid fa-chart-bar"></i> เปิดรายงาน';

    switch (Number(raw.step)) {
      case 1:
        sections[0].style.display = 'block';
        btnApprove.innerHTML = '<i class="fa-solid fa-share-from-square"></i> ส่งต่อหัวหน้าช่าง';
        btnApprove.style.display = 'inline-flex';
        btnEdit.style.display = 'none';
        btnCancel.style.display = 'inline-flex';
        btnWork.style.display = 'none';
        btnReport.style.display = 'none';
        break;
      case 2:
        sections[0].style.display = 'block';
        sections[1].style.display = 'block';
        btnApprove.innerHTML = '<i class="fa-solid fa-play"></i> เปิดใบงานซ่อม';
        btnApprove.style.display = 'inline-flex';
        btnEdit.style.display = 'inline-flex';
        btnCancel.style.display = 'inline-flex';
        btnWork.style.display = 'inline-flex';
        btnReport.style.display = 'none';
        break;
      case 3:
        sections[0].style.display = 'block';
        sections[1].style.display = 'block';
        sections[2].style.display = 'block';
        btnApprove.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> ส่งประเมินงาน';
        btnApprove.style.display = 'inline-flex';
        btnEdit.style.display = 'inline-flex';
        btnCancel.style.display = 'inline-flex';
        btnWork.style.display = 'inline-flex';
        btnReport.style.display = 'none';
        break;
      case 4:
        sections[0].style.display = 'block';
        sections[1].style.display = 'block';
        sections[2].style.display = 'block';
        sections[3].style.display = 'block';
        const isRejected4 = raw.clean === 'ไม่รับงานซ่อม';
        const hasUserRemark4 = document.getElementById('dm-user-remark').value.trim() !== '';
        userRemarkField.style.display = (isRejected4 || hasUserRemark4) ? 'block' : 'none';
        btnApprove.style.display = 'none';
        btnEdit.style.display = 'none';
        btnCancel.style.display = 'none';
        btnWork.style.display = 'inline-flex';
        btnReport.style.display = 'none';
        break;
      case 5:
        sections[0].style.display = 'block';
        sections[1].style.display = 'block';
        sections[2].style.display = 'block';
        sections[3].style.display = 'block';
        const isRejected5 = raw.clean === 'ไม่รับงานซ่อม';
        const hasUserRemark5 = document.getElementById('dm-user-remark').value.trim() !== '';
        userRemarkField.style.display = (isRejected5 || hasUserRemark5) ? 'block' : 'none';
        btnApprove.innerHTML = '<i class="fa-solid fa-circle-check"></i> ยืนยันผลรับงาน';
        btnApprove.style.display = 'inline-flex';
        btnEdit.style.display = 'none';
        btnCancel.style.display = 'none';
        btnWork.style.display = 'none';
        btnReport.style.display = 'none';
        break;
      case 6:
        sections[0].style.display = 'block';
        sections[1].style.display = 'block';
        sections[2].style.display = 'block';
        sections[3].style.display = 'block';
        const isRejected6 = raw.clean === 'ไม่รับงานซ่อม';
        const hasUserRemark6 = document.getElementById('dm-user-remark').value.trim() !== '';
        userRemarkField.style.display = (isRejected6 || hasUserRemark6) ? 'block' : 'none';
        btnApprove.style.display = 'none';
        btnEdit.style.display = 'none';
        btnCancel.style.display = 'none';
        btnWork.style.display = 'inline-flex';
        btnReport.style.display = 'none';
        break;
      default:
        sections.forEach(s => s.style.display = 'block');
        btnApprove.style.display = 'inline-flex';
        btnEdit.style.display = 'inline-flex';
        btnCancel.style.display = 'inline-flex';
        btnWork.style.display = 'inline-flex';
        btnReport.style.display = 'none';
        break;
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  function closeModal() {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
  }

  // Close modal events
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Toggle user-remark text area when radio button changes
  document.querySelectorAll('input[name="dm-accept"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const userRemarkField = document.getElementById('dm-user-remark').closest('.detail-field');
      if (e.target.value === 'ไม่รับงานซ่อม') {
        userRemarkField.style.display = 'block';
      } else {
        userRemarkField.style.display = document.getElementById('dm-user-remark').value.trim() ? 'block' : 'none';
      }
    });
  });

  // Row click → open modal (event delegation on t1 tbody)
  t1.tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr.clickable-row');
    if (!row) return;
    const kw = row.dataset.keyword;
    const rec = t1.filtered.find(r => r.keyword === kw);
    if (rec) openModal(rec);
  });

  // Row click → open modal (event delegation on s2 tbody)
  document.getElementById('s2-tbody').addEventListener('click', (e) => {
    const row = e.target.closest('tr.clickable-row');
    if (!row) return;
    const kw = row.dataset.keyword;
    const rec = masterRecords.find(r => r.keyword === kw);
    if (rec) openModal(rec);
  });

  // 5 action buttons (placeholder)
  // ==========================================
  // ส่วนจัดการปุ่มในหน้าต่าง Modal (Approve, Edit, Cancel)
  // ==========================================

  // 1. ปุ่ม Approve (อนุมัติ/ปิดงาน)
  document.getElementById('dm-btn-approve').addEventListener('click', async () => {
    const empLevelEn = sessionStorage.getItem('empLevel_en') || '';
    const empId = sessionStorage.getItem('empId') || '';
    const empName = sessionStorage.getItem('empName') || '';
    const empLastname = sessionStorage.getItem('empLastname') || '';
    const recordId = document.getElementById('dm-id').textContent.trim();

    if (!recordId) return;
    const rec = masterRecords.find(r => r.keyword === recordId);
    if (!rec || !rec._raw) return;

    const intStep = Number(rec.step);
    const strApprove_id = rec._raw.approve || "-";
    const strLeadApprove_id = rec._raw.leaderApprove || "-";

    // Gather form values
    const leader = document.getElementById('dm-leader').value;
    const tech1 = document.getElementById('dm-tech-1').value;
    const tech2 = document.getElementById('dm-tech-2').value;
    const tech3 = document.getElementById('dm-tech-3').value;
    const tech4 = document.getElementById('dm-tech-4').value;
    const tech5 = document.getElementById('dm-tech-5').value;
    const arrayName = [leader || "-", tech1 || "-", tech2 || "-", tech3 || "-", tech4 || "-", tech5 || "-"].join(",");

    const fixText = document.getElementById('dm-fix').value.trim() || "-";
    const partsText = document.getElementById('dm-parts').value.trim() || "-";
    const remarkText = document.getElementById('dm-remark').value.trim() || "-";
    const startVal = document.getElementById('dm-start').value || "-";
    const endVal = document.getElementById('dm-end').value || "-";
    const endRealDate = document.getElementById('dm-end-real')._flatpickr?.selectedDates[0];
    const endRealVal = endRealDate ? dateToString(endRealDate) : "-";
    const userRemark = document.getElementById('dm-user-remark').value.trim() || "-";

    if ([1, 2, 3].includes(intStep) && !validateScheduleRange(startVal, endVal)) return;

    let strCheck = "-";
    const checkedRadio = document.querySelector('input[name="dm-accept"]:checked');
    if (checkedRadio) strCheck = checkedRadio.value;

    const year = recordId.substring(0, 4);
    const firebaseRef = ref(database, `DEN/FIX/${year}/${recordId}`);

    let updateData = null;
    let successMsg = "";
    let nextStep = "";

    try {
      switch (intStep) {
        case 1: // รอหัวหน้าอนุมัติ
          if (strApprove_id.split(" | ")[0].trim() === empId) {
            nextStep = "2";
            updateData = {
              dateUpdate: dateToString(new Date()),
              step: nextStep,
              den_start: startVal,
              den_end: endVal,
              leaderApprove: strApprove_id
            };
            successMsg = "Update Data Success ---> รอช่างอนุมัติซ่อม";
          } else {
            return showAlert("Error", "ไม่มีสิทธิ์ยืนยันใบงานนี้ !!!", "fa-circle-xmark");
          }
          break;

        case 2: // รอช่างอนุมัติ
          if (empLevelEn === "admin_en" || empLevelEn === "admin") {
            if (!leader || leader === "-") {
              return showAlert("Warning", "กรุณาเลือกหัวหน้าช่างด้วย !!!", "fa-triangle-exclamation");
            }
            nextStep = "3";
            updateData = {
              dateUpdate: dateToString(new Date()),
              step: nextStep,
              den_name: arrayName,
              den_remack: remarkText,
              den_start: startVal,
              den_end: endVal,
              den_start_real: dateToString(new Date()),
              adminApprove: `${empId} | ${empName} ${empLastname}`
            };
            successMsg = "เปิดใบงานสำเร็จ";
          } else {
            return swal("error!", "ไม่มีสิทธิ์ยืนยันใบงานนี้ !!!", { icon: "error", buttons: { confirm: { className: "btn btn-danger" } } });
          }
          break;

        case 3: // กำลังซ่อม -> รอประเมิน
          if (empLevelEn === "admin_en" || empLevelEn === "admin") {
            if (!tech1 || tech1 === "-") {
              return showAlert("Warning", "กรุณาเลือกช่างที่ดูแลด้วย !!!", "fa-triangle-exclamation");
            }
            if (fixText === "-" || fixText === "") {
              return showAlert("Warning", "กรุณากรอกวิธีการแก้ไขด้วย !!!", "fa-triangle-exclamation");
            }
            nextStep = "5";
            updateData = {
              dateUpdate: dateToString(new Date()),
              step: nextStep,
              den_name: arrayName,
              den_fix: fixText,
              den_parts: partsText,
              den_remack: remarkText,
              den_start: startVal,
              den_end: endVal,
              den_end_real: endRealVal,
              closeApprove: `${empId} | ${empName} ${empLastname}`
            };
            successMsg = "Update Data Success ---> ตรวจสอบรับงานซ่อม";
          } else {
            return swal("error!", "ไม่มีสิทธิ์ยืนยันใบงานนี้ !!!", { icon: "error", buttons: { confirm: { className: "btn btn-danger" } } });
          }
          break;

        case 5: // รอประเมินความเรียบร้อย
          if (strLeadApprove_id.split(" | ")[0].trim() === empId || empLevelEn === "admin") {
            if (strCheck === "-" || strCheck === " ") {
              return showAlert("Warning", "กรุณาประเมินรับงานซ่อม!!!!", "fa-triangle-exclamation");
            }
            if (strCheck === "รับงานซ่อม") {
              nextStep = "4";
              updateData = {
                dateUpdate: dateToString(new Date()),
                step: nextStep,
                den_end_real: endRealVal,
                clean: strCheck
              };
              successMsg = "Update Data Success ---> ซ่อมเรียบร้อยแล้ว";
            } else {
              // ไม่รับงานซ่อม
              if (!userRemark || userRemark === "-") {
                return showAlert("Warning", "กรุณากรอกสาเหตุที่ต้องการแก้ไข !!!!", "fa-triangle-exclamation");
              }
              nextStep = "2";
              updateData = {
                dateUpdate: dateToString(new Date()),
                step: nextStep,
                den_end_real: endRealVal,
                remack: userRemark + ` ( ไม่รับงานซ่อม ${dateToString(new Date())} )`,
                clean: strCheck
              };
              successMsg = "Update Data Success ---> รอช่างอนุมัติซ่อม(แก้ไขการซ่อม)";
            }
          } else {
            return swal("error!", "ไม่มีสิทธิ์ยืนยันใบงานนี้ !!!", { icon: "error", buttons: { confirm: { className: "btn btn-danger" } } });
          }
          break;
      }

      if (updateData) {
        await update(firebaseRef, updateData);

        // Local update
        const updateLocal = (arr) => {
          const r = arr.find(x => x.keyword === recordId);
          if (r && r._raw) {
            Object.assign(r._raw, updateData);
            r.step = nextStep;
            r.updatedAt = updateData.dateUpdate;
          }
        };
        updateLocal(masterRecords);

        syncPrimaryQueue();
        applyT1Filters();
        if (typeof s2Refresh === 'function') s2Refresh();

        if (intStep === 2) {
          // แจ้งเตือนหลังจากอัปเดตสถานะสำเร็จ และถามผู้ใช้ว่าต้องการเปิดใบงาน (Report) หรือไม่
          const ok = await showConfirmModal("Update Data Success", "ต้องการเปิดใบงานหรือไม่", "fa-circle-check", "Yes", "No");
          if (ok) {
            // ดึงไฟล์รายงานวิศวกรรมจากโฟลเดอร์ reports/eng/ และแนบรหัส (id) ไปใน URL
            window.open("reports/eng/reporteng01.html?id=" + recordId, '_blank');
          }
        } else {
          showToast(successMsg, "success");
        }

        closeModal();
      }

    } catch (error) {
      console.error("Approve error:", error);
      showAlert("Error", "เกิดข้อผิดพลาด: " + error.message, "fa-circle-xmark");
    }
  });
  // 2. ปุ่ม Edit (แก้ไขข้อมูลใบงาน)
  document.getElementById('dm-btn-edit').addEventListener('click', async () => {
    const empLevelEn = sessionStorage.getItem('empLevel_en') || '';
    const recordId = document.getElementById('dm-id').textContent.trim();

    if (!recordId) return;

    if (empLevelEn === "admin_en" || empLevelEn === "admin") {
      const startVal = document.getElementById('dm-start').value || "-";
      const endVal = document.getElementById('dm-end').value || "-";
      if (!validateScheduleRange(startVal, endVal)) return;

      const willEdit = await showConfirmModal("ยืนยันการบันทึก?", "คุณต้องการบันทึกการแก้ไขข้อมูลใช่หรือไม่?", "fa-circle-info", "บันทึก", "ยกเลิก");
      if (willEdit) {
        try {
          // Get values
          const leader = document.getElementById('dm-leader').value;
          const tech1 = document.getElementById('dm-tech-1').value;
          const tech2 = document.getElementById('dm-tech-2').value;
          const tech3 = document.getElementById('dm-tech-3').value;
          const tech4 = document.getElementById('dm-tech-4').value;
          const tech5 = document.getElementById('dm-tech-5').value;

          // map empty to "-" for saving
          const arrayName = [
            leader || "-",
            tech1 || "-",
            tech2 || "-",
            tech3 || "-",
            tech4 || "-",
            tech5 || "-"
          ];

          const fixText = document.getElementById('dm-fix').value.trim() || "-";
          const partsText = document.getElementById('dm-parts').value.trim() || "-";
          const remarkText = document.getElementById('dm-remark').value.trim() || "-";

          const year = recordId.substring(0, 4);
          const firebaseRef = ref(database, `DEN/FIX/${year}/${recordId}`);

          const updateData = {
            dateUpdate: dateToString(new Date()),
            den_name: arrayName.join(","),
            den_fix: fixText,
            den_parts: partsText,
            den_remack: remarkText,
            den_start: startVal,
            den_end: endVal
          };

          await update(firebaseRef, updateData);

          // Update local arrays directly
          const updateLocal = (arr) => {
            const rec = arr.find(r => r.keyword === recordId);
            if (rec && rec._raw) {
              rec._raw.dateUpdate = updateData.dateUpdate;
              rec._raw.den_name = updateData.den_name;
              rec._raw.den_fix = updateData.den_fix;
              rec._raw.den_parts = updateData.den_parts;
              rec._raw.den_remack = updateData.den_remack;
              rec._raw.den_start = updateData.den_start;
              rec._raw.den_end = updateData.den_end;
              rec.updatedAt = updateData.dateUpdate;
              rec.denEnd = updateData.den_end; // Update the display field in table
            }
          };
          updateLocal(masterRecords);

          // Re-render
          syncPrimaryQueue();
          applyT1Filters();
          if (typeof s2Refresh === 'function') s2Refresh();

          showToast("Edit Data Success", "success");
          closeModal();

        } catch (error) {
          console.error("Edit error:", error);
          showAlert("Error", "เกิดข้อผิดพลาดในการบันทึก", "fa-circle-xmark");
        }
      }

    } else {
      showAlert("Error", "ไม่มีสิทธิ์แก้ไขใบงานนี้ !!!", "fa-circle-xmark");
    }
  });
  // 3. ปุ่ม Cancel (ยกเลิกใบงาน)
  document.getElementById('dm-btn-cancel').addEventListener('click', async () => {
    const empLevelEn = sessionStorage.getItem('empLevel_en') || '';
    const empId = sessionStorage.getItem('empId') || '';
    const empName = sessionStorage.getItem('empName') || '';
    const empLastname = sessionStorage.getItem('empLastname') || '';
    const recordId = document.getElementById('dm-id').textContent.trim();
    const remark = document.getElementById('dm-remark').value.trim();

    if (!recordId) return;

    if (empLevelEn === "admin_en" || empLevelEn === "admin" || empLevelEn === "1") {
      const willCancel = await showConfirmModal("ยืนยันการยกเลิก?", `คุณต้องการยกเลิกใบแจ้งซ่อม ${recordId} ใช่หรือไม่?`, "fa-triangle-exclamation", "ใช่, ยกเลิกใบงาน", "ไม่, กลับไป");
      if (willCancel) {
        try {
          const year = recordId.substring(0, 4);
          const firebaseRef = ref(database, `DEN/FIX/${year}/${recordId}`);
          const updateData = {
            dateUpdate: dateToString(new Date()),
            step: "6",
            den_remack: remark,
            adminCancal: `${empId} | ${empName} ${empLastname}`
          };

          await update(firebaseRef, updateData);

          // Update local arrays directly without reloading
          const updateLocal = (arr) => {
            const rec = arr.find(r => r.keyword === recordId);
            if (rec && rec._raw) {
              rec._raw.dateUpdate = updateData.dateUpdate;
              rec.step = "6";
              rec._raw.step = "6";
              rec._raw.den_remack = updateData.den_remack;
              rec._raw.adminCancal = updateData.adminCancal;
              rec.updatedAt = updateData.dateUpdate;
            }
          };
          updateLocal(masterRecords);

          // Re-render current views
          syncPrimaryQueue();
          applyT1Filters();
          if (typeof s2Refresh === 'function') s2Refresh(); // Refresh table 2

          showToast("Cancel Data Success", "success");
          closeModal();

        } catch (error) {
          console.error("Cancel error:", error);
          showAlert("Error", "ไม่สามารถยกเลิกใบงานได้", "fa-circle-xmark");
        }
      }

    } else {
      showAlert("Error", "ไม่มีสิทธิ์ยืนยันใบงานนี้ !!!", "fa-circle-xmark");
    }
  });
  // ฟังก์ชันสำหรับเปิดหน้ารายงาน (ใบงาน Work)
  document.getElementById('dm-btn-work').addEventListener('click', () => {
    // ดึงรหัสใบงานจากหน้าต่าง Modal
    const recordId = document.getElementById('dm-id').textContent.trim();
    if (recordId) {
      // เปิดแท็บใหม่ไปที่หน้ารายงานของวิศวกรรม (reporteng01.html) พร้อมกับส่งพารามิเตอร์ id
      window.open("reports/eng/reporteng01.html?id=" + recordId, '_blank');
    }
  });
  document.getElementById('dm-btn-report').addEventListener('click', () => alert('Report — Coming soon'));

  // Pre-load engineers
  loadEngineers();

  // ==========================================
  // Factory: Search Table (ใช้กับตาราง 2 & 3)
  // ==========================================
  function setupSearchTable({ prefix, hasStatus }) {
    const els = {
      tbody: document.getElementById(`${prefix}-tbody`),
      countSpan: document.getElementById(`${prefix}-count`),
      totalSpan: document.getElementById(`${prefix}-total`),
      pagBar: document.getElementById(`${prefix}-pagination`),
      dateStart: document.getElementById(`${prefix}-date-start`),
      dateEnd: document.getElementById(`${prefix}-date-end`),
      keyword: document.getElementById(`${prefix}-keyword`),
      status: hasStatus ? document.getElementById(`${prefix}-status`) : null,
      resetBtn: document.getElementById(`${prefix}-reset`),
    };

    let localFiltered = [];
    let localPage = 1;

    function getDefaultDateRange() {
      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - SEARCH_DEFAULT_LOOKBACK_DAYS);

      return { startDate, endDate };
    }

    // Flatpickr
    const startPicker = flatpickr(`#${prefix}-date-start`, {
      dateFormat: 'd/m/Y', disableMobile: true, allowInput: false,
      onChange: () => applySearch(),
    });
    const endPicker = flatpickr(`#${prefix}-date-end`, {
      dateFormat: 'd/m/Y', disableMobile: true, allowInput: false,
      onChange: () => applySearch(),
    });

    function applyDefaultDateRange() {
      const { startDate, endDate } = getDefaultDateRange();
      startPicker.setDate(startDate, false);
      endPicker.setDate(endDate, false);
    }

    function applySearch() {
      const startDate = parseDMY(els.dateStart.value);
      const endDate = parseDMY(els.dateEnd.value);
      const keyword = els.keyword.value.trim().toLowerCase();
      const status = els.status ? els.status.value : '';

      // ไม่ต้อง check ว่ากรอกหรือยัง — แสดงข้อมูลทั้งหมดของแผนกเลย

      let filtered = isAdmin ? masterRecords.slice() : masterRecords.filter(r => (r._raw.dep || '') === loggedInDept);

      if (startDate) filtered = filtered.filter(r => { const d = parseDMY(r.date); return d && d >= startDate; });
      if (endDate) filtered = filtered.filter(r => { const d = parseDMY(r.date); return d && d <= endDate; });
      if (keyword) {
        filtered = filtered.filter(r => {
          const haystack = [
            r.keyword,
            r.plant,
            r.type,
            r.machineCode,
            r.machineName,
            r.detail,
            r.reporter,
            r.approverName,
            r.complete,
            r.denEnd,
          ].join(' ').toLowerCase();
          return haystack.includes(keyword);
        });
      }
      if (status) filtered = filtered.filter(r => r.step === status);

      localFiltered = filtered;
      localPage = 1;
      renderSearch();
    }

    function renderSearch() {
      const baseCount = isAdmin ? masterRecords.length : masterRecords.filter(r => (r._raw.dep || '') === loggedInDept).length;
      els.totalSpan.textContent = `จาก ${baseCount} งาน`;
      if (localFiltered.length === 0) {
        els.tbody.innerHTML = '<tr><td colspan="13" class="table-empty"><i class="fa-solid fa-filter-circle-xmark"></i> ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>';
        els.countSpan.textContent = '0';
        els.pagBar.innerHTML = '';
        return;
      }

      const totalPages = Math.ceil(localFiltered.length / ROWS_PER_PAGE);
      if (localPage > totalPages) localPage = totalPages;
      if (localPage < 1) localPage = 1;

      const startIdx = (localPage - 1) * ROWS_PER_PAGE;
      const pageRecords = localFiltered.slice(startIdx, startIdx + ROWS_PER_PAGE);

      els.countSpan.textContent = localFiltered.length;
      els.tbody.innerHTML = pageRecords.map((r, i) => buildRow(r, startIdx + i + 1)).join('');

      els.pagBar.innerHTML = buildPaginationHTML(localPage, totalPages, localFiltered.length, ROWS_PER_PAGE);
      bindPaginationEvents(els.pagBar, `${prefix}-table`, () => localPage, p => localPage = p, renderSearch);
    }

    // Event listeners
    let kTimeout;
    els.keyword.addEventListener('input', () => {
      clearTimeout(kTimeout);
      kTimeout = setTimeout(applySearch, 300);
    });
    if (els.status) els.status.addEventListener('change', applySearch);
    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', () => {
        applyDefaultDateRange();
        els.keyword.value = '';
        if (els.status) els.status.value = '';
        applySearch();
      });
    }

    applyDefaultDateRange();
    return applySearch; // expose for external call
  }

  // ตารางที่ 2: ค้นหา + สถานะ
  const s2Refresh = setupSearchTable({ prefix: 's2', hasStatus: true });
}
