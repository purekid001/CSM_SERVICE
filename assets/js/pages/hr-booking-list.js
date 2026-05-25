/**
 * HR — Booking List (ตารางการจองรถ)
 */
import { hrDatabase, ref, get, update } from '../firebase-hr.js';
import { getHrStepBadge as getStepBadge, getHrStepText as getStepLabel, buildPaginationHTML, bindPaginationEvents, canAccessPage, escapeHTML, escapeAttr } from '../utils.js';

export function render() {
  // === ส่วนของ HTML Template ===
  // คืนค่า HTML โครงสร้างหลักสำหรับแสดงตารางใบขอรถ (รออนุมัติ และ ค้นหาประวัติ)
  const thCols = `
    <th>สถานะ</th>
    <th>วันที่เขียน</th>
    <th>รหัส</th>
    <th>ประเภท</th>
    <th>รายละเอียด/จำนวนคน</th>
    <th>วันที่ขอ</th>
    <th>สถานที่รับ/เวลา</th>
    <th>สถานที่ส่ง/เวลา</th>
    <th>ผู้แจ้ง</th>
    <th>ผู้อนุมัติ</th>`;

  return `
    <div class="app-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Workflow</p>
          <h1 class="page-hero-title">Booking Operations Center</h1>
          <p class="page-hero-subtitle">ติดตามคำขอจองรถและรถรับส่ง เปิดรายละเอียดเพื่ออนุมัติ จัดรถ หรือปิดงานได้จากมุมมองเดียว</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>โมดูล</span>
            <strong>Car + Shuttle Booking</strong>
          </div>
          <div class="page-hero-stat">
            <span>การทำงาน</span>
            <strong>อนุมัติ จัดรถ ติดตามย้อนหลัง</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>ศูนย์ควบคุมงานจองรถ</strong>
          หน้านี้รวมคิวที่ต้องอนุมัติ งานที่กำลังจัดรถ และประวัติการจองไว้ในมุมมองเดียวเพื่อให้ตามงานได้เร็วขึ้น
        </div>
      </div>

      <div class="ops-kpi-grid fade-in">
        <div class="form-card ops-kpi-card ops-kpi-blue">
          <div class="ops-kpi-icon"><i class="fa-solid fa-folder-tree"></i></div>
          <div class="ops-kpi-copy">
            <span>งานทั้งหมด</span>
            <strong id="hr-booking-total">0</strong>
            <small>รายการที่มองเห็นได้</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-amber">
          <div class="ops-kpi-icon"><i class="fa-solid fa-hourglass-half"></i></div>
          <div class="ops-kpi-copy">
            <span>รออนุมัติ</span>
            <strong id="hr-booking-queue">0</strong>
            <small>คิวที่ต้องตัดสินใจ</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-indigo">
          <div class="ops-kpi-icon"><i class="fa-solid fa-car-side"></i></div>
          <div class="ops-kpi-copy">
            <span>กำลังจัดรถ</span>
            <strong id="hr-booking-progress">0</strong>
            <small>รายการที่ดำเนินการอยู่</small>
          </div>
        </div>
        <div class="form-card ops-kpi-card ops-kpi-green">
          <div class="ops-kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="ops-kpi-copy">
            <span>ปิดงานแล้ว</span>
            <strong id="hr-booking-complete">0</strong>
            <small>งานที่จบสมบูรณ์</small>
          </div>
        </div>
      </div>

    <!-- ===== ตารางที่ 1: Booking List Overview ===== -->
    <div class="form-card fade-in ops-card ops-card-primary">
      <div class="ops-panel-head">
        <div class="form-header">
          <div class="form-header-icon ops-header-icon ops-icon-ocean">
            <i class="fa-solid fa-list-check"></i>
          </div>
          <div class="form-header-text">
            <h2>Booking List</h2>
            <p>คิวงานหลักที่ยังต้องอนุมัติหรือกำลังอยู่ระหว่างจัดรถ เพื่อให้เปิดดูและเดินงานต่อได้ไว</p>
          </div>
        </div>
        <div class="ops-panel-chip">
          <i class="fa-solid fa-hand-pointer"></i>
          คลิกที่แถวเพื่อเปิดรายละเอียด
        </div>
      </div>

      <div class="ops-section-note">
        <i class="fa-solid fa-circle-info"></i>
        <span>ตารางด้านบนโฟกัสงาน active ก่อน ส่วนตารางค้นหาด้านล่างใช้สำหรับไล่ดูย้อนหลังทุกสถานะ</span>
      </div>

      <div class="list-filter-bar ops-filter-bar">
        <div class="filter-group">
          <div class="filter-item">
            <label><i class="fa-solid fa-calendar-days"></i> ปี</label>
            <select class="form-control" id="bl-filter-year">
              <option value="">ทุกปี</option>
            </select>
          </div>
          <div class="filter-item">
            <label><i class="fa-solid fa-magnifying-glass"></i> ค้นหา</label>
            <input type="text" class="form-control" id="bl-search" placeholder="ค้นหา รหัส, ผู้แจ้ง, สถานที่...">
          </div>
        </div>
        <div class="ops-filter-side">
          <div class="filter-summary">
            <span id="bl-count">0</span>
            <span class="ops-summary-copy">กำลังแสดง</span>
            <small id="bl-total">จาก 0 งาน</small>
          </div>
          <button class="btn btn-secondary btn-compact" type="button" id="bl-reset">
            <i class="fa-solid fa-rotate-left"></i>
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div class="ops-table-caption">
        <span><i class="fa-solid fa-arrow-down-wide-short"></i> เรียงจากวันที่จองล่าสุดไปเก่าสุด</span>
        <span><i class="fa-solid fa-table-list"></i> รองรับการเลื่อนแนวนอนในหน้าจอเล็ก</span>
      </div>

      <div class="table-wrapper ops-table-wrapper">
        <table class="data-table table-width-lock" id="bl-table" style="--ops-table-min-width: 1340px; --table-lock-width: 1460px; --table-cell-min: 116px; --table-detail-min: 220px;">
          <thead><tr>${thCols}</tr></thead>
          <tbody id="bl-tbody">
            <tr><td colspan="10" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-bar" id="bl-pagination"></div>
    </div>

    <!-- ===== ตารางที่ 2: ค้นหาแบบละเอียด (มีสถานะ) ===== -->
    <div class="form-card fade-in ops-card ops-card-stack ops-card-search">
      <div class="ops-panel-head">
        <div class="form-header">
          <div class="form-header-icon ops-header-icon ops-icon-amber">
            <i class="fa-solid fa-magnifying-glass-chart"></i>
          </div>
          <div class="form-header-text">
            <h2>Search — ค้นหารายการจองรถ</h2>
            <p>ค้นหาตามช่วงวันที่ สถานะ หรือคำสำคัญ เพื่อย้อนดูงานเก่าและตรวจสอบเคสเฉพาะได้เร็วขึ้น</p>
            <p>
              <a href="https://docs.google.com/spreadsheets/d/1IFoa5NFgvBFxeSL923TSaq932gPN1iNhYMqNF75k9x8/edit?gid=0#gid=0" target="_blank" rel="noopener noreferrer">
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
            <label><i class="fa-solid fa-hashtag"></i> เลขใบจองรถ</label>
            <input type="text" class="form-control" id="s2-keyword" placeholder="ค้นหาเลขที่, ผู้แจ้ง, แผนก, สถานที่">
          </div>
          <div class="filter-item">
            <label><i class="fa-solid fa-filter"></i> สถานะจอง</label>
            <select class="form-control" id="s2-status">
              <option value="">ทั้งหมด</option>
              <option value="รอหัวหน้าอนุมัติ">รอหัวหน้าอนุมัติ</option>
              <option value="รอทีมจัดรถอนุมัติ">รอทีมจัดรถอนุมัติ</option>
              <option value="ทีมจัดรถอนุมัติแล้ว">ทีมจัดรถอนุมัติแล้ว</option>
              <option value="ปิดงานแล้ว">ปิดงานแล้ว</option>
              <option value="ยกเลิก">ยกเลิก</option>
            </select>
          </div>
        </div>
        <div class="ops-filter-side">
          <div class="filter-summary">
            <span id="s2-count">0</span>
            <span class="ops-summary-copy">กำลังแสดง</span>
            <small id="s2-total">จาก 0 งาน</small>
          </div>
          <div class="ops-filter-actions">
            <button class="btn btn-secondary btn-compact" type="button" id="s2-reset">
              <i class="fa-solid fa-rotate-left"></i>
              ล้างตัวกรอง
            </button>
            <button class="btn btn-secondary btn-ocean" id="s2-btn-group">
              <i class="fa-solid fa-bus"></i> จัดกลุ่มขนส่งพนักงาน
            </button>
          </div>
        </div>
      </div>

      <div class="ops-table-caption">
        <span><i class="fa-solid fa-clock-rotate-left"></i> ใช้สำหรับค้นย้อนหลังทั้งฝั่ง Car และ Shuttle</span>
        <span><i class="fa-solid fa-expand"></i> เปิด modal เพื่อตรวจข้อมูลและอัปเดตสถานะต่อได้ทันที</span>
      </div>

      <div class="table-wrapper ops-table-wrapper">
        <table class="data-table table-width-lock" id="s2-table" style="--ops-table-min-width: 1340px; --table-lock-width: 1460px; --table-cell-min: 116px; --table-detail-min: 220px;">
          <thead><tr>${thCols}</tr></thead>
          <tbody id="s2-tbody">
            <tr><td colspan="10" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-bar" id="s2-pagination"></div>
    </div>

    <!-- ===== Detail Modal ===== -->
    <div class="modal-overlay" id="detail-modal" style="display:none;">
      <div class="modal-container" style="max-width: 800px;">
        <div class="modal-header">
          <div class="modal-header-main">
            <div class="modal-title-block">
              <h3><i class="fa-solid fa-file-lines"></i> รายละเอียดใบจองรถ <span id="dm-title-id"></span></h3>
              <p>ตรวจสอบข้อมูลการจอง จัดรถ และยืนยันสถานะต่อจากหน้าต่างเดียว</p>
            </div>
            <div class="modal-status-panel">
              <span class="modal-status-label">สถานะปัจจุบัน</span>
              <div id="dm-status-badge" class="modal-status-badge"></div>
            </div>
          </div>
          <button class="modal-close" id="dm-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">

          <!-- ส่วนที่ 1: ข้อมูลแจ้งจอง (ข้อมูลที่แจ้งมา) -->
          <div class="detail-section section-blue" id="divDetail">
            <div class="detail-section-header"><i class="fa-solid fa-info-circle"></i> ข้อมูลการจอง</div>
            <div class="detail-section-body">
              <div class="detail-grid">
                <div class="detail-field"><span class="detail-label">เลขที่ใบจอง</span><div class="detail-value" id="dm-id"></div></div>
                <div class="detail-field"><span class="detail-label">วันที่ขอ</span><div class="detail-value" id="dm-booking-date"></div></div>
                <div class="detail-field"><span class="detail-label">ชื่อผู้แจ้ง</span><div class="detail-value" id="dm-name"></div></div>
                <div class="detail-field"><span class="detail-label">แผนก</span><div class="detail-value" id="dm-dep"></div></div>
                
                <div class="detail-field span-2"><span class="detail-label">ลักษณะงาน</span><div class="detail-value" id="dm-type"></div></div>
                <div class="detail-field span-2"><span class="detail-label">รายละเอียด/จำนวนคน</span><div class="detail-value" id="dm-headcount"></div></div>
                
                <div class="detail-field"><span class="detail-label">สถานที่รับ</span><div class="detail-value" id="dm-pickup-loc"></div></div>
                <div class="detail-field"><span class="detail-label">เวลารับ</span><div class="detail-value" id="dm-pickup-time"></div></div>
                <div class="detail-field span-2"><span class="detail-label">รายละเอียดการรับ</span><div class="detail-value" id="dm-pickup-detail"></div></div>
                
                <div class="detail-field"><span class="detail-label">สถานที่ส่ง</span><div class="detail-value" id="dm-dropoff-loc"></div></div>
                <div class="detail-field"><span class="detail-label">เวลาส่ง</span><div class="detail-value" id="dm-dropoff-time"></div></div>
                <div class="detail-field span-2"><span class="detail-label">รายละเอียดการส่ง</span><div class="detail-value" id="dm-dropoff-detail"></div></div>
                
                <div class="detail-field span-2"><span class="detail-label">หมายเหตุผู้แจ้ง</span><div class="detail-value" id="dm-remark"></div></div>
              </div>
            </div>
          </div>

          <!-- ส่วนที่ 2: HR Team (ทีมงานกรอก) -->
          <div class="detail-section section-amber" id="divDetail1">
            <div class="detail-section-header"><i class="fa-solid fa-user-gear"></i> ทีมจัดรถ — ระบุรายละเอียดรถและคนขับ</div>
            <div class="detail-section-body">
              <div class="form-grid">
                <div class="form-group">
                  <label>รถ (Car)</label>
                  <select class="form-control" id="dm-car">
                    <option value="" disabled selected>กำลังโหลด...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>รายชื่อคนขับรถ 1 (Driver)</label>
                  <select class="form-control" id="dm-driver">
                    <option value="" disabled selected>กำลังโหลด...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>รายชื่อคนขับรถ 2 (Driver)</label>
                  <select class="form-control" id="dm-driver-2">
                    <option value="" disabled selected>กำลังโหลด...</option>
                  </select>
                </div>
                <div class="form-group span-2">
                  <label>หมายเหตุทีมงาน</label>
                  <textarea class="form-control" id="dm-admin-remark" placeholder="ระบุหมายเหตุการจัดรถ..."></textarea>
                </div>
              </div>
            </div>
          </div>

        </div>
        
        <!-- Modal Footer Buttons -->
        <div class="modal-footer modal-footer-split" id="divButton">
          <div class="modal-action-group modal-action-group-secondary">
            <button class="btn btn-edit" id="dm-btn-edit"><i class="fa-solid fa-pen-to-square"></i> บันทึกแก้ไข</button>
            <button class="btn btn-cancel-action" id="dm-btn-cancel"><i class="fa-solid fa-ban"></i> ยกเลิกรายการ</button>
            <button class="btn btn-work" id="dm-btn-work"><i class="fa-solid fa-file-invoice"></i> เปิดใบงาน</button>
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

// --- Data & Helpers ---
let allBookings = [];
let bookingsMap = new Map(); // O(1) lookup by id
let currentPage1 = 1;
let currentPage2 = 1;
const rowsPerPage = 20;

// Helpers moved to utils.js

async function loadBookings() {
  try {
    document.getElementById('bl-tbody').innerHTML = '<tr><td colspan="10" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>';
    document.getElementById('s2-tbody').innerHTML = '<tr><td colspan="10" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>';

    const empLevelHr = sessionStorage.getItem('empLevel_hr') || sessionStorage.getItem('level_Hr') || '';
    const empDep = sessionStorage.getItem('empDepartment') || '';
    const isAdmin = (empLevelHr === 'admin' || empLevelHr === 'admin_hr');

    const [snap1, snap2] = await Promise.all([
      get(ref(hrDatabase, 'Booking/Booking1')),
      get(ref(hrDatabase, 'Booking/Booking2'))
    ]);

    allBookings = [];
    bookingsMap = new Map();

    function pushBooking(raw, module, isAdmin, empDep) {
      if (!raw) return;
      const itemDep = raw.dep || raw.department || '';
      if (!isAdmin && itemDep !== empDep) return;

      let pLoc = raw.pickupLoc || raw.pickupLocation || '-';
      let dLoc = raw.deliveryLoc || raw.dropoffLocation || '-';
      if (pLoc === '***สถานที่อื่นๆ***') pLoc = raw.pickupLocOther || '-';
      if (dLoc === '***สถานที่อื่นๆ***') dLoc = raw.deliveryLocOther || raw.delivreyLocOther || '-';

      const pTime = raw.pickupTime || '-';
      const dTime = raw.dropoffTime || raw.deliveryTime || '-';

      const item = {
        id: raw.id,
        date: raw.date,
        name: raw.name,
        dep: raw.dep || raw.department || '-',
        type: raw.type,
        step: raw.step,
        approve: raw.approve,
        remark: raw.remark || '',
        bookingDate: raw.bookingDate,
        car: raw.car || '',
        driverName1: (raw.driverName || '').split(',')[0] || '-',
        driverName2: (raw.driverName || '').split(',')[1] || '-',
        pickupLoc: pLoc,
        pickupTime: pTime,
        detailPickup: raw.detailPickup || '-',
        deliveryLoc: dLoc,
        deliveryTime: dTime,
        detailDelivery: raw.detailDelivery || '-',
        detailType: raw.detailType,
        headcount: raw.headcount || raw.amont,
        detail_remark: raw.detail_remark || raw.detail_remack || '',
        module: module,
        displayPickup: `${pLoc}<br><small class="text-muted">${pTime}</small>`,
        displayDropoff: `${dLoc}<br><small class="text-muted">${dTime}</small>`,
        displayHeadcount: module === 'Car' ? (raw.detailType || '-') : (raw.headcount || raw.amont || '-'),

      };
      allBookings.push(item);
      bookingsMap.set(String(item.id), item);
    }

    // Process Booking1 (Car)
    if (snap1.exists()) {
      const b1Data = snap1.val() || {};
      for (const year in b1Data) {
        if (!b1Data[year]) continue;
        for (const id in b1Data[year]) {
          pushBooking(b1Data[year][id], 'Car', isAdmin, empDep);
        }
      }
    }

    // Process Booking2 (Shuttle)
    if (snap2.exists()) {
      const b2Data = snap2.val() || {};
      for (const year in b2Data) {
        if (!b2Data[year]) continue;
        for (const id in b2Data[year]) {
          pushBooking(b2Data[year][id], 'Shuttle', isAdmin, empDep);
        }
      }
    }

    // Sort by bookingDate descending (newest first)
    // bookingDate format: dd/mm/yyyy
    function parseDate(str) {
      if (!str) return 0;
      const parts = str.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      return 0;
    }
    allBookings.sort((a, b) => parseDate(b.bookingDate) - parseDate(a.bookingDate));

    updateOverviewStats();
    renderTable1();
    renderTable2();

  } catch (error) {
    console.error("Error loading bookings:", error);
    showToast("เกิดข้อผิดพลาดในการดึงข้อมูล: " + error.message, "error");
  }
}

// Pagination helpers moved to utils.js

function updateOverviewStats() {
  const stats = {
    total: allBookings.length,
    queue: 0,
    progress: 0,
    complete: 0,
  };

  allBookings.forEach(item => {
    const step = String(item.step || '0');
    if (step === '1' || step === '2') stats.queue += 1;
    else if (step === '3') stats.progress += 1;
    else if (step === '4') stats.complete += 1;
  });

  document.getElementById('hr-booking-total').textContent = stats.total;
  document.getElementById('hr-booking-queue').textContent = stats.queue;
  document.getElementById('hr-booking-progress').textContent = stats.progress;
  document.getElementById('hr-booking-complete').textContent = stats.complete;
}

function renderTable1(page = 1) {
  currentPage1 = page;
  const tbody = document.getElementById('bl-tbody');
  const filtered = allBookings.filter(item => ['1', '2', '3'].includes(String(item.step)));

  const yearSel = document.getElementById('bl-filter-year').value;
  const keyword = document.getElementById('bl-search').value.toLowerCase();

  const finalData = filtered.filter(item => {
    const isYearMatch = !yearSel || (item.bookingDate && item.bookingDate.includes(yearSel));
    const isKeyMatch = !keyword ||
      (item.id && String(item.id).toLowerCase().includes(keyword)) ||
      (item.name && item.name.toLowerCase().includes(keyword)) ||
      (item.dep && item.dep.toLowerCase().includes(keyword)) ||
      (item.pickupLoc && item.pickupLoc.toLowerCase().includes(keyword)) ||
      (item.deliveryLoc && item.deliveryLoc.toLowerCase().includes(keyword)) ||
      (item.displayPickup && item.displayPickup.toLowerCase().includes(keyword));
    return isYearMatch && isKeyMatch;
  });

  document.getElementById('bl-count').textContent = finalData.length;
  document.getElementById('bl-total').textContent = `จาก ${filtered.length} งาน`;

  const totalPages = Math.ceil(finalData.length / rowsPerPage);
  if (currentPage1 > totalPages) currentPage1 = totalPages;
  if (currentPage1 < 1) currentPage1 = 1;

  const startIndex = (currentPage1 - 1) * rowsPerPage;
  const paginatedData = finalData.slice(startIndex, startIndex + rowsPerPage);

  renderRows(paginatedData, tbody);

  const pagBar = document.getElementById('bl-pagination');
  pagBar.innerHTML = buildPaginationHTML(currentPage1, totalPages, finalData.length, rowsPerPage);
  bindPaginationEvents(pagBar, 'bl-table', () => currentPage1, p => currentPage1 = p, () => renderTable1(currentPage1));
}

function renderTable2(page = 1) {
  currentPage2 = page;
  const tbody = document.getElementById('s2-tbody');

  const keyword = document.getElementById('s2-keyword').value.toLowerCase();
  const statusLabel = document.getElementById('s2-status').value;
  const dateStartStr = document.getElementById('s2-date-start').value;
  const dateEndStr = document.getElementById('s2-date-end').value;

  function parseToDate(str) {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = new Date(parts[2], parts[1] - 1, parts[0]);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  const dateStart = parseToDate(dateStartStr);
  const dateEnd = parseToDate(dateEndStr);

  const finalData = allBookings.filter(item => {
    // Keyword match
    const isKeyMatch = !keyword || [
      item.id,
      item.name,
      item.dep,
      item.pickupLoc,
      item.deliveryLoc,
      item.type,
      item.bookingDate,
    ].join(' ').toLowerCase().includes(keyword);

    // Status match
    const isStatusMatch = !statusLabel || getStepLabel(item.step) === statusLabel;

    // Date range match
    let isDateMatch = true;
    if (dateStart || dateEnd) {
      const itemDate = parseToDate(item.bookingDate);
      if (itemDate) {
        if (dateStart && itemDate < dateStart) isDateMatch = false;
        if (dateEnd && itemDate > dateEnd) isDateMatch = false;
      } else {
        // If searching by date but item has no date, exclude it
        isDateMatch = false;
      }
    }

    return isKeyMatch && isStatusMatch && isDateMatch;
  });

  document.getElementById('s2-count').textContent = finalData.length;
  document.getElementById('s2-total').textContent = `จาก ${allBookings.length} งาน`;

  const totalPages = Math.ceil(finalData.length / rowsPerPage);
  if (currentPage2 > totalPages) currentPage2 = totalPages;
  if (currentPage2 < 1) currentPage2 = 1;

  const startIndex = (currentPage2 - 1) * rowsPerPage;
  const paginatedData = finalData.slice(startIndex, startIndex + rowsPerPage);

  renderRows(paginatedData, tbody);

  const pagBar = document.getElementById('s2-pagination');
  pagBar.innerHTML = buildPaginationHTML(currentPage2, totalPages, finalData.length, rowsPerPage);
  bindPaginationEvents(pagBar, 's2-table', () => currentPage2, p => currentPage2 = p, () => renderTable2(currentPage2));
}

function renderRows(dataArray, tbody) {
  if (dataArray.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">ไม่มีข้อมูล</td></tr>';
    return;
  }

  let html = '';
  dataArray.forEach(item => {
    const reqName = (item.name || '-').split(" | ")[1] || item.name || '-';
    const appName = (item.approve || '-').split(" | ")[1] || item.approve || '-';
    const reqDep = (item.dep || '-').split(" | ")[1] || item.dep || '-';
    const safeId = escapeAttr(item.id || '-');
    const safeDate = escapeHTML(item.date || '-');
    const safeType = escapeHTML(item.type || '-');
    const safeModule = escapeHTML(item.module || '-');
    const safeHeadcount = escapeHTML(item.displayHeadcount || '-');
    const safeBookingDate = escapeHTML(item.bookingDate || '-');
    const safePickupLoc = escapeHTML(item.pickupLoc || '-');
    const safePickupTime = escapeHTML(item.pickupTime || '-');
    const safeDropoffLoc = escapeHTML(item.deliveryLoc || '-');
    const safeDropoffTime = escapeHTML(item.deliveryTime || '-');
    const safeReqName = escapeHTML(reqName);
    const safeReqDep = escapeHTML(reqDep);
    const safeAppName = escapeHTML(appName);

    html += `
      <tr class="clickable-row" data-id="${safeId}" style="cursor: pointer;">
        <td>${getStepBadge(item.step)}</td>
        <td>${safeDate}</td>
        <td>${escapeHTML(item.id || '-')}</td>
        <td>${safeType} <br><small class="text-muted" style="color:#6b7280; font-size:12px;">${safeModule}</small></td>
        <td class="cell-detail">${safeHeadcount}</td>
        <td>${safeBookingDate}</td>
        <td>${safePickupLoc} <br><small class="text-muted" style="color:#6b7280; font-size:12px;">${safePickupTime}</small></td>
        <td>${safeDropoffLoc} <br><small class="text-muted" style="color:#6b7280; font-size:12px;">${safeDropoffTime}</small></td>
        <td>${safeReqName} <br><small class="text-muted" style="color:#6b7280; font-size:12px;">${safeReqDep}</small></td>
        <td>${safeAppName}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function openModalWithData(item) {
  try {
    const isShuttle = item.module === 'Shuttle';

    document.getElementById('dm-title-id').textContent = item.id || '-';
    document.getElementById('dm-id').textContent = item.id || '-';
    document.getElementById('dm-booking-date').textContent = item.bookingDate || '-';
    document.getElementById('dm-status-badge').innerHTML = getStepBadge(item.step);

    const reqName = (item.name || '-').split(" | ")[1] || item.name || '-';
    document.getElementById('dm-name').textContent = reqName;
    document.getElementById('dm-dep').textContent = item.dep || item.department || '-';

    document.getElementById('dm-type').textContent = item.type || '-';
    document.getElementById('dm-headcount').textContent = item.displayHeadcount || '-';

    document.getElementById('dm-pickup-loc').textContent = item.pickupLoc || item.pickupLocation || '-';
    document.getElementById('dm-pickup-time').textContent = item.pickupTime || '-';
    document.getElementById('dm-pickup-detail').textContent = item.detailPickup || '-';

    document.getElementById('dm-dropoff-loc').textContent = item.deliveryLoc || item.dropoffLocation || '-';
    document.getElementById('dm-dropoff-time').textContent = item.deliveryTime || item.dropoffTime || '-';
    document.getElementById('dm-dropoff-detail').textContent = item.detailDelivery || '-';

    document.getElementById('dm-remark').textContent = item.remark || '-';

    // ซ่อนฟิลด์ที่ไม่จำเป็นสำหรับหน้า Shuttle
    document.getElementById('dm-pickup-detail').parentElement.style.display = isShuttle ? 'none' : '';
    document.getElementById('dm-dropoff-time').parentElement.style.display = isShuttle ? 'none' : '';
    document.getElementById('dm-dropoff-detail').parentElement.style.display = isShuttle ? 'none' : '';
    document.getElementById('dm-remark').parentElement.style.display = isShuttle ? 'none' : '';

    const modal = document.getElementById('detail-modal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));

    // Pre-populate dropdowns
    const carSel = document.getElementById('dm-car');
    const driverSel1 = document.getElementById('dm-driver');
    const driverSel2 = document.getElementById('dm-driver-2');

    if (carSel) carSel.value = item.car || '';

    // Match driver by partial name (stored value may differ from dropdown format)
    function selectDriverByName(selectEl, driverValue) {
      if (!selectEl || !driverValue || driverValue === '-') return;
      // Try exact match first
      selectEl.value = driverValue;
      if (selectEl.value === driverValue) return;
      // Try partial match (name contains stored value)
      for (const opt of selectEl.options) {
        if (opt.value.includes(driverValue) || driverValue.includes(opt.value)) {
          selectEl.value = opt.value;
          return;
        }
      }
    }

    const driverNameParts = String(item.driverName || '').split(',');
    selectDriverByName(driverSel1, item.driverName1 || driverNameParts[0] || '-');
    selectDriverByName(driverSel2, item.driverName2 || driverNameParts[1] || '-');
    document.getElementById('dm-admin-remark').value = item.detail_remark || '';

    // Set button and section visibility based on step
    const stepInt = parseInt(item.step);
    const approveBtn = document.getElementById("dm-btn-approve");
    const editBtn = document.getElementById("dm-btn-edit");
    const cancelBtn = document.getElementById("dm-btn-cancel");
    const workBtn = document.getElementById("dm-btn-work");

    approveBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> อัปเดตสถานะ';
    editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> บันทึกแก้ไข';
    cancelBtn.innerHTML = '<i class="fa-solid fa-ban"></i> ยกเลิกรายการ';
    workBtn.innerHTML = '<i class="fa-solid fa-file-invoice"></i> เปิดใบงาน';

    // Default fallback (hide all if invalid)
    document.getElementById('divDetail').style.display = 'none';
    document.getElementById('divDetail1').style.display = 'none';
    document.getElementById('divButton').style.display = 'none';

    switch (stepInt) {
      case 1:
        document.getElementById("divDetail").style.display = "block";
        document.getElementById("divDetail1").style.display = "none";
        document.getElementById("divButton").style.display = "flex";
        approveBtn.innerHTML = '<i class="fa-solid fa-share-from-square"></i> อนุมัติส่งทีมจัดรถ';
        approveBtn.disabled = false;
        editBtn.disabled = true;
        cancelBtn.disabled = false;
        workBtn.disabled = true;
        break;

      case 2:
        document.getElementById("divDetail").style.display = "block";
        document.getElementById("divDetail1").style.display = "block";

        document.getElementById("divButton").style.display = "flex";
        approveBtn.innerHTML = '<i class="fa-solid fa-car-side"></i> ยืนยันจัดรถ';
        approveBtn.disabled = false;
        editBtn.disabled = false;
        cancelBtn.disabled = false;
        workBtn.disabled = true;
        break;

      case 3:
        document.getElementById("divDetail").style.display = "block";
        document.getElementById("divDetail1").style.display = "block";

        document.getElementById("divButton").style.display = "flex";
        approveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> ปิดงานรายการนี้';
        approveBtn.disabled = false;
        editBtn.disabled = false;
        cancelBtn.disabled = false;
        workBtn.disabled = false;
        break;

      case 4:
      case 5:
        document.getElementById("divDetail").style.display = "block";
        document.getElementById("divDetail1").style.display = "block";

        document.getElementById("divButton").style.display = "flex";
        approveBtn.disabled = true;
        editBtn.disabled = true;
        cancelBtn.disabled = true;
        workBtn.disabled = false;
        break;
    }

  } catch (error) {
    console.error('Error opening modal:', error);
    showToast('เกิดข้อผิดพลาดในการเปิดรายละเอียด: ' + error.message, 'error');
  }
}

export function init() {
  // === ฟังก์ชันเริ่มต้น (Initialization) ===
  // จัดการตัวแปร, ดึงข้อมูลจาก Firebase และผูก Event (คลิกปุ่มต่างๆ)
  // --- Flatpickr Setup (default: 15 days ago → today) ---
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 15);

  flatpickr('#s2-date-start', {
    dateFormat: 'd/m/Y',
    disableMobile: true,
    defaultDate: thirtyDaysAgo,
    onChange: () => renderTable2(1)
  });
  flatpickr('#s2-date-end', {
    dateFormat: 'd/m/Y',
    disableMobile: true,
    defaultDate: today,
    onChange: () => renderTable2(1)
  });

  // --- Year Filter Setup ---
  const yearSelect = document.getElementById('bl-filter-year');
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 3; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }

  // --- Action Buttons Setup ---
  const s2BtnGroup = document.getElementById('s2-btn-group');
  if (s2BtnGroup) {
    if (!canAccessPage('hr-shuttle-group')) {
      s2BtnGroup.style.display = 'none';
    }
    s2BtnGroup.addEventListener('click', () => {
      showPage('hr-shuttle-group');
    });
  }

  // --- Filter Listeners (Real-time updates) ---
  document.getElementById('bl-filter-year').addEventListener('change', () => renderTable1(1));
  document.getElementById('bl-search').addEventListener('input', () => renderTable1(1));
  document.getElementById('s2-keyword').addEventListener('input', () => renderTable2(1));
  document.getElementById('s2-status').addEventListener('change', () => renderTable2(1));
  document.getElementById('s2-date-start').addEventListener('change', () => renderTable2(1));
  document.getElementById('s2-date-end').addEventListener('change', () => renderTable2(1));
  document.getElementById('bl-reset').addEventListener('click', () => {
    document.getElementById('bl-filter-year').value = '';
    document.getElementById('bl-search').value = '';
    renderTable1(1);
  });
  document.getElementById('s2-reset').addEventListener('click', () => {
    document.getElementById('s2-keyword').value = '';
    document.getElementById('s2-status').value = '';
    document.getElementById('s2-date-start')._flatpickr.setDate(thirtyDaysAgo, true);
    document.getElementById('s2-date-end')._flatpickr.setDate(today, true);
    renderTable2(1);
  });

  // --- Event Delegation for Tables (bind once, O(1) lookup) ---
  ['bl-tbody', 's2-tbody'].forEach(id => {
    const tbody = document.getElementById(id);
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr.clickable-row');
        if (!row) return;
        const bid = row.getAttribute('data-id');
        const booking = bookingsMap.get(bid);
        if (booking) openModalWithData(booking);
      });
    }
  });

  // --- Modal Logic ---
  const detailModal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('dm-close');

  function closeModal() {
    detailModal.classList.remove('show');
    setTimeout(() => { detailModal.style.display = 'none'; }, 300);
  }

  closeBtn.addEventListener('click', closeModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
  });

  // --- Fetch Data for Dropdowns ---
  async function loadCars() {
    const sel = document.getElementById('dm-car');
    try {
      const snap = await get(ref(hrDatabase, 'Booking/Car'));
      if (snap.exists()) {
        const data = snap.val();
        sel.innerHTML = '<option value="" disabled selected>-- เลือกรถ --</option>';
        Object.keys(data).forEach(k => {
          const c = data[k];
          const val = c.car_id + ' | ' + c.type;
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          sel.appendChild(opt);
        });
      } else {
        sel.innerHTML = '<option value="" disabled selected>ไม่มีข้อมูลรถในระบบ</option>';
      }
    } catch (e) {
      sel.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาดในการโหลดรถ</option>';
    }
  }

  async function loadDrivers() {
    const sel1 = document.getElementById('dm-driver');
    const sel2 = document.getElementById('dm-driver-2');
    try {
      const snap = await get(ref(hrDatabase, 'Booking/Driver'));
      if (snap.exists()) {
        const data = snap.val();
        const defaultOpt = '<option value="" disabled selected>-- เลือกคนขับ --</option>';
        const noneOpt = '<option value="-">- ไม่ระบุ -</option>';
        sel1.innerHTML = defaultOpt;
        sel2.innerHTML = defaultOpt + noneOpt;
        Object.keys(data).forEach(k => {
          const d = data[k];
          const val = d.employee_id + ' | ' + d.firstname + " " + d.lastname;
          const opt1 = document.createElement('option');
          opt1.value = val;
          opt1.textContent = val;
          sel1.appendChild(opt1);
          const opt2 = document.createElement('option');
          opt2.value = val;
          opt2.textContent = val;
          sel2.appendChild(opt2);
        });
      } else {
        sel1.innerHTML = '<option value="" disabled selected>ไม่มีข้อมูลคนขับในระบบ</option>';
        sel2.innerHTML = '<option value="" disabled selected>ไม่มีข้อมูลคนขับในระบบ</option>';
      }
    } catch (e) {
      sel1.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาดในการโหลดคนขับ</option>';
      sel2.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาดในการโหลดคนขับ</option>';
    }
  }

  // --- Modal Action Buttons Event Listeners ---
  // ==========================================
  // ส่วนจัดการปุ่มในหน้าต่าง Modal (Approve, Edit, Cancel, Work)
  // ==========================================

  // 1. ปุ่ม Approve (อนุมัติ/จัดรถ/ปิดงาน)
  document.getElementById('dm-btn-approve').addEventListener('click', async () => {
    const id = document.getElementById('dm-id').textContent || '';
    if (!id || id === '-') return;

    const booking = bookingsMap.get(id);
    if (!booking) return;

    const empLevelHr = sessionStorage.getItem('empLevel_hr') || sessionStorage.getItem('level_Hr') || '';
    const isAdmin = (empLevelHr === 'admin' || empLevelHr === 'admin_hr' || empLevelHr === '1' || empLevelHr === 1);
    const empIdStr = sessionStorage.getItem('empId') || sessionStorage.getItem('employee_id') || 'Unknown';
    const empFNameStr = sessionStorage.getItem('empName') || sessionStorage.getItem('firstname') || '';
    const empLNameStr = sessionStorage.getItem('empLastname') || sessionStorage.getItem('lastname') || '';
    const approverStr = `${empIdStr} | ${empFNameStr} ${empLNameStr}`.trim();

    const reqApproveId = (booking.approve || '').split(' | ')[0]; // The designated leader ID
    const stepInt = parseInt(booking.step);

    try {
      const idParts = id.split('-');
      if (idParts.length < 2) throw new Error('รูปแบบ ID ไม่ถูกต้อง');
      const prefix = idParts[0];
      const year = idParts[1].substring(0, 4);
      const dbPath = prefix === 'B1' ? `Booking/Booking1/${year}/${id}` : `Booking/Booking2/${year}/${id}`;

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Retrieve form values
      const carSel = document.getElementById('dm-car');
      const driverSel1 = document.getElementById('dm-driver');
      const driverSel2 = document.getElementById('dm-driver-2');
      const carVal = carSel.options[carSel.selectedIndex]?.text || '';
      let d1Val = driverSel1.options[driverSel1.selectedIndex]?.text || '';
      let d2Val = driverSel2.options[driverSel2.selectedIndex]?.text || '';

      if (d1Val === '-- เลือกคนขับ --' || d1Val === '') d1Val = '-';
      if (d2Val === '-- เลือกคนขับ --' || d2Val === '') d2Val = '-';

      const driverNameStr = [d1Val, d2Val].join(',');
      const detail_remark = document.getElementById('dm-admin-remark').value || '';

      if (stepInt === 1) {
        if (reqApproveId === empIdStr || isAdmin) {
          const isConfirmed = await showConfirmModal('ยืนยันอนุมัติ', 'คุณต้องการอนุมัติรายการนี้ (ส่งต่อให้ทีมจัดรถ) ใช่หรือไม่?', 'fa-check');
          if (!isConfirmed) return;

          const updates = {
            dateUpdate: dateStr,
            step: "2",
            leaderApprove: approverStr,
            leaderApproveTime: dateStr
          };
          await update(ref(hrDatabase, dbPath), updates);

          booking.step = "2";
          renderTable1(currentPage1);
          renderTable2(currentPage2);
          closeModal();
          showToast('อนุมัติสำเร็จ รอทีมจัดรถดำเนินการ', 'success');
        } else {
          showToast('ไม่มีสิทธิ์อนุมัติใบงานนี้ !!!', 'error');
        }
      }
      else if (stepInt === 2) {
        if (!isAdmin) {
          showToast('ไม่มีสิทธิ์จัดรถ !!!', 'error');
          return;
        }
        if (!carVal || carVal === '-- เลือกรถ --') {
          showToast('กรุณาเลือกรถ !!!', 'warning');
          return;
        }
        if (!d1Val || d1Val === '-- เลือกคนขับ --' || d1Val === '-') {
          showToast('กรุณาเลือกพนักงานขับรถ !!!', 'warning');
          return;
        }

        const isConfirmed = await showConfirmModal('ยืนยันอนุมัติ', 'คุณต้องการอนุมัติการจัดรถรายการนี้ใช่หรือไม่?', 'fa-bus');
        if (!isConfirmed) return;

        const updates = {
          dateUpdate: dateStr,
          step: "3",
          driverName: driverNameStr,
          detail_remark: detail_remark,
          car: carVal,
          adminApprove: approverStr,
          adminApproveTime: dateStr
        };
        await update(ref(hrDatabase, dbPath), updates);

        booking.step = "3";
        booking.car = carVal;
        booking.driverName = driverNameStr;
        booking.driverName1 = d1Val;
        booking.driverName2 = d2Val;
        booking.detail_remark = detail_remark;

        renderTable1(currentPage1);
        renderTable2(currentPage2);
        closeModal();
        showToast('ทีมจัดรถอนุมัติเรียบร้อยแล้ว', 'success');

        // ถามผู้ใช้หลังจากอนุมัติจัดรถสำเร็จว่าต้องการพิมพ์ใบงาน (Report) ด้วยหรือไม่
        const isPrint = await showConfirmModal('เปิดใบงาน', 'ต้องการเปิดใบงาน (Report) หรือไม่?', 'fa-print');
        if (isPrint) {
          // ดึงไฟล์รายงานจัดรถจากโฟลเดอร์ reports/hr/ และแนบรหัส (id) ไปใน URL
          window.open(`reports/hr/reporthr01.html?id=${id}`, '_blank');
        }
      }
      else if (stepInt === 3) {
        if (!isAdmin) {
          showToast('ไม่มีสิทธิ์ปิดงาน !!!', 'error');
          return;
        }

        const isConfirmed = await showConfirmModal('ยืนยันปิดงาน', 'คุณต้องการปิดงานรายการนี้ใช่หรือไม่?', 'fa-flag-checkered');
        if (!isConfirmed) return;

        const updates = {
          dateUpdate: dateStr,
          step: "4",
          driverName: driverNameStr,
          detail_remark: detail_remark,
          car: carVal,
          adminClose: approverStr,
          adminCloseTime: dateStr
        };
        await update(ref(hrDatabase, dbPath), updates);

        booking.step = "4";
        booking.car = carVal;
        booking.driverName = driverNameStr;
        booking.driverName1 = d1Val;
        booking.driverName2 = d2Val;
        booking.detail_remark = detail_remark;

        renderTable1(currentPage1);
        renderTable2(currentPage2);
        closeModal();
        showToast('ปิดงานเรียบร้อยแล้ว', 'success');
      }

    } catch (error) {
      console.error("Approve Error: ", error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
  });

  // 2. ปุ่ม Edit (แก้ไขข้อมูลคนขับ/รถ)
  document.getElementById('dm-btn-edit').addEventListener('click', async () => {
    const empLevelHr = sessionStorage.getItem('empLevel_hr') || sessionStorage.getItem('level_Hr') || '';
    const isAdmin = (empLevelHr === 'admin' || empLevelHr === 'admin_hr' || empLevelHr === '1' || empLevelHr === 1);

    if (!isAdmin) {
      showToast('ไม่มีสิทธิ์แก้ไขใบงานนี้ !!!', 'error');
      return;
    }

    const id = document.getElementById('dm-id').textContent || '';
    if (!id || id === '-') return;

    try {
      const carSel = document.getElementById('dm-car');
      const driverSel1 = document.getElementById('dm-driver');
      const driverSel2 = document.getElementById('dm-driver-2');

      const carVal = carSel.options[carSel.selectedIndex]?.text || '';
      let d1Val = driverSel1.options[driverSel1.selectedIndex]?.text || '';
      let d2Val = driverSel2.options[driverSel2.selectedIndex]?.text || '';

      if (d1Val === '-- เลือกคนขับ --' || d1Val === '') d1Val = '-';
      if (d2Val === '-- เลือกคนขับ --' || d2Val === '') d2Val = '-';

      const arrayName = [d1Val, d2Val];
      const driverNameStr = arrayName.join(',');

      const detail_remark = document.getElementById('dm-admin-remark').value || '';

      const idParts = id.split('-');
      if (idParts.length < 2) throw new Error('รูปแบบ ID ไม่ถูกต้อง');

      const prefix = idParts[0];
      const year = idParts[1].substring(0, 4);
      const dbPath = prefix === 'B1'
        ? `Booking/Booking1/${year}/${id}`
        : `Booking/Booking2/${year}/${id}`;

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const updates = {
        dateUpdate: dateStr,
        driverName: driverNameStr,
        detail_remark: detail_remark,
        car: carVal
      };

      await update(ref(hrDatabase, dbPath), updates);

      // Update local data
      const booking = bookingsMap.get(id);
      if (booking) {
        booking.car = carVal;
        booking.driverName = driverNameStr;
        booking.driverName1 = d1Val;
        booking.driverName2 = d2Val;
        booking.detail_remark = detail_remark;
      }

      // Re-render
      renderTable1(currentPage1);
      renderTable2(currentPage2);
      closeModal();

      showToast('แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');

    } catch (error) {
      console.error("Edit Error: ", error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
  });

  // 3. ปุ่ม Cancel (ยกเลิกใบขอรถ)
  document.getElementById('dm-btn-cancel').addEventListener('click', () => {
    const id = document.getElementById('dm-id').textContent || '';
    if (!id || id === '-') return;

    showConfirmModal('ยืนยันยกเลิก', 'คุณต้องการยกเลิกรายการนี้ใช่หรือไม่?', 'fa-ban').then(async res => {
      if (res) {
        try {
          const idParts = id.split('-');
          if (idParts.length < 2) throw new Error('รูปแบบ ID ไม่ถูกต้อง');

          const prefix = idParts[0]; // B1 or B2
          const year = idParts[1].substring(0, 4);
          const dbPath = prefix === 'B1'
            ? `Booking/Booking1/${year}/${id}`
            : `Booking/Booking2/${year}/${id}`;

          const empIdStr = sessionStorage.getItem('empId') || sessionStorage.getItem('employee_id') || 'Unknown';
          const empFNameStr = sessionStorage.getItem('empName') || sessionStorage.getItem('firstname') || '';
          const empLNameStr = sessionStorage.getItem('empLastname') || sessionStorage.getItem('lastname') || '';
          const adminStr = `${empIdStr} | ${empFNameStr} ${empLNameStr}`.trim();

          const now = new Date();
          const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          const detail_remark = document.getElementById('dm-admin-remark').value || '';

          const updates = {
            dateUpdate: dateStr,
            step: "5",
            detail_remark: detail_remark,
            adminCancal: adminStr,
            adminCancalTime: dateStr
          };

          await update(ref(hrDatabase, dbPath), updates);

          // Update local data
          const booking = bookingsMap.get(id);
          if (booking) {
            booking.step = "5";
            booking.detail_remark = detail_remark;
          }

          // Re-render
          renderTable1(currentPage1);
          renderTable2(currentPage2);
          closeModal();

          // Success notification
          showToast('ยกเลิกรายการสำเร็จ', 'success');

        } catch (error) {
          console.error("Cancel Error: ", error);
          showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
      }
    });
  });

  // ฟังก์ชันสำหรับเปิดหน้าใบงาน (ใบขอจัดรถ)
  document.getElementById('dm-btn-work').addEventListener('click', () => {
    // ดึงรหัสใบงานจากหน้าต่าง Modal
    const id = document.getElementById('dm-id').textContent || '';
    if (!id || id === '-') return;

    // เปิดแท็บใหม่ไปที่หน้าใบขอให้จัดรถ (reporthr01.html) พร้อมกับส่งพารามิเตอร์ id
    window.open(`reports/hr/reporthr01.html?id=${id}`, '_blank');
  });

  // --- Load table data first (priority), then dropdowns in background ---
  loadBookings().then(() => {
    loadCars();
    loadDrivers();
  });
}
