/**
 * HR — Shuttle Group (จัดกลุ่มขนส่งพนักงาน)
 * เฉพาะ Admin HR เท่านั้น
 */
import { hrDatabase, ref, get, set, update } from '../firebase-hr.js';
import { getHrStepBadge as getStepBadge, dateToString, buildPaginationHTML, bindPaginationEvents, canAccessPage, escapeHTML, escapeAttr } from '../utils.js';

// Helpers moved to utils.js

export function render() {
  return `
    <div class="app-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Dispatch</p>
          <h1 class="page-hero-title">Shuttle Group Planner</h1>
          <p class="page-hero-subtitle">รวมคำขอ shuttle ที่ใกล้เคียงกันเป็นกลุ่มเดียว จัดรถและคนขับให้พร้อมก่อนส่งต่อไปปิดงาน</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ขอบเขตงาน</span>
            <strong>Grouping + Dispatch</strong>
          </div>
          <div class="page-hero-stat">
            <span>สิทธิ์ใช้งาน</span>
            <strong>Admin HR</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-route"></i>
        <div>
          <strong>โหมดวางแผนรถรับส่ง</strong>
          เลือกรายการที่เส้นทางและเวลาสอดคล้องกัน แล้วบันทึกเป็นกลุ่มพร้อมรถและคนขับในขั้นตอนเดียว
        </div>
      </div>

      <!-- ===== ส่วนที่ 1: Search & Select ===== -->
      <div class="form-card fade-in ops-card ops-card-primary shuttle-group-page">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-ocean">
              <i class="fa-solid fa-people-group"></i>
            </div>
            <div class="form-header-text">
              <h2>Booking List By Group</h2>
              <p>เลือกคำขอ shuttle ที่จะรวมเป็นกลุ่มเดียวกันก่อนส่งงานให้ทีมจัดรถดำเนินการต่อ</p>
            </div>
          </div>
          <div class="ops-panel-chip">
            <i class="fa-solid fa-hand-pointer"></i>
            เลือกหลายรายการได้ในตารางเดียว
          </div>
        </div>

        <div class="ops-section-note">
          <i class="fa-solid fa-circle-info"></i>
          <span>กรองตามวันที่ เวลา และแผนกก่อนเลือกกลุ่ม เพื่อให้คิวที่แสดงตรงกับงานที่ต้องจัดจริงมากที่สุด</span>
        </div>

        <div class="list-filter-bar ops-filter-bar">
          <div class="filter-group">
            <div class="filter-item">
              <label><i class="fa-solid fa-calendar-days"></i> วันที่</label>
              <input type="text" class="form-control" id="sg-date" placeholder="dd/mm/yyyy" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-clock"></i> เวลา</label>
              <input type="text" class="form-control" id="sg-time" placeholder="HH:mm" readonly>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-users"></i> แผนก</label>
              <select class="form-control" id="sg-dept">
                <option value="">-- ทุกแผนก --</option>
              </select>
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-hashtag"></i> เลขใบจอง</label>
              <input type="text" class="form-control" id="sg-keyword" placeholder="ค้นหาเลขที่, ผู้แจ้ง, สถานที่">
            </div>
            <div class="filter-item">
              <label><i class="fa-solid fa-filter"></i> สถานะ</label>
              <select class="form-control" id="sg-status">
                <option value="2" selected>รอทีมจัดรถอนุมัติ</option>
                <option value="3">ทีมจัดรถอนุมัติแล้ว</option>
              </select>
            </div>
          </div>
          <div class="ops-filter-side">
            <div class="filter-summary">
              <span id="sg-count">0</span>
              <span class="ops-summary-copy">กำลังแสดง</span>
              <small id="sg-total">จาก 0 งาน</small>
            </div>
            <div class="ops-filter-actions">
              <button class="btn btn-secondary btn-compact" type="button" id="sg-reset">
                <i class="fa-solid fa-rotate-left"></i>
                ล้างตัวกรอง
              </button>
              <button class="btn btn-secondary btn-ocean btn-compact" id="sg-select-all">
                <i class="fa-solid fa-check-double"></i> เลือกทั้งหมด
              </button>
            </div>
          </div>
        </div>

        <div class="ops-table-caption">
          <span><i class="fa-solid fa-arrow-up-wide-short"></i> เรียงวันที่ขอจากน้อยไปมากเพื่อคัดงานรวมกลุ่ม</span>
          <span><i class="fa-solid fa-users-viewfinder"></i> ยอดเลือกและจำนวนคนจะอัปเดตทันทีด้านล่าง</span>
        </div>

        <div class="table-wrapper ops-table-wrapper">
          <table class="data-table table-width-lock" id="sg-table" style="--ops-table-min-width: 1520px; --table-lock-width: 1520px; --table-cell-min: 116px; --table-detail-min: 220px;">
            <thead><tr>
              <th class="ops-select-col">เลือก</th>
              <th>สถานะ</th>
              <th>วันที่เขียน</th><th>รหัส</th><th>ประเภท</th><th>จำนวนคน</th>
              <th>วันที่ขอ</th><th>สถานที่รับ</th><th>เวลา</th><th>สถานที่ส่ง</th>
              <th>ผู้แจ้ง</th><th>แผนก</th><th>ผู้อนุมัติ</th>
            </tr></thead>
            <tbody id="sg-tbody">
              <tr><td colspan="13" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="sg-pagination" class="pagination-bar"></div>

        <!-- สรุปยอดรวม -->
        <div id="sg-summary" class="ops-selection-summary">
          <span><i class="fa-solid fa-list-check"></i> เลือกแล้ว: <strong id="sg-selected-count">0</strong> รายการ</span>
          <span><i class="fa-solid fa-users"></i> รวมจำนวนคน: <strong id="sg-total-headcount">0</strong> คน</span>
        </div>
      </div>

      <!-- ===== ส่วนที่ 2: Details (ทีมงานกรอก) ===== -->
      <div class="form-card fade-in ops-card ops-card-stack" id="sg-details-card" style="display:none;">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-amber">
              <i class="fa-solid fa-user-gear"></i>
            </div>
            <div class="form-header-text">
              <h2>Details — ระบุรถและคนขับ</h2>
              <p>ยืนยันรถ คนขับ และหมายเหตุก่อนอนุมัติกลุ่มที่เลือก</p>
            </div>
          </div>
          <div class="ops-panel-chip ops-panel-chip-soft">
            <i class="fa-solid fa-clipboard-check"></i>
            ใช้กับรายการที่เลือกอยู่เท่านั้น
          </div>
        </div>
        <div class="ops-form-body">
          <div class="form-grid">
            <div class="form-group">
              <label>รถ (Car) <span class="required">*</span></label>
              <select class="form-control" id="sg-car"><option value="" disabled selected>กำลังโหลด...</option></select>
            </div>
            <div class="form-group">
              <label>คนขับรถ 1 (Driver) <span class="required">*</span></label>
              <select class="form-control" id="sg-driver1"><option value="" disabled selected>กำลังโหลด...</option></select>
            </div>
            <div class="form-group">
              <label>คนขับรถ 2 (Driver)</label>
              <select class="form-control" id="sg-driver2"><option value="" disabled selected>กำลังโหลด...</option></select>
            </div>
            <div class="form-group full-width">
              <label>หมายเหตุ</label>
              <textarea class="form-control" id="sg-remark" rows="2" placeholder="ระบุหมายเหตุ..."></textarea>
            </div>
          </div>
          <div class="ops-form-actions">
            <button class="btn btn-approve" id="sg-btn-approve">
              <i class="fa-solid fa-check-circle"></i> Approve กลุ่ม
            </button>
          </div>
        </div>
      </div>

      <!-- ===== ส่วนที่ 3: List Group ===== -->
      <div class="form-card fade-in ops-card ops-card-stack">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-green">
              <i class="fa-solid fa-layer-group"></i>
            </div>
            <div class="form-header-text">
              <h2>List Group — ประวัติกลุ่มที่จัดแล้ว</h2>
              <p>ทบทวนกลุ่มที่เคยจัด ดูรถ คนขับ และเปิดรายละเอียดเพื่อปิดงานหรือยกเลิกได้</p>
            </div>
          </div>
          <div class="ops-panel-chip">
            <i class="fa-solid fa-folder-open"></i>
            คลิกแถวเพื่อดูรายละเอียดกลุ่ม
          </div>
        </div>
        <div class="ops-table-caption">
          <span><i class="fa-solid fa-timeline"></i> ประวัติกลุ่มเรียงตามวันที่ขอจากน้อยไปมาก</span>
          <span><i class="fa-solid fa-circle-nodes"></i> ใช้ดูรายการที่เคยรวมเส้นทางไว้แล้ว</span>
        </div>
        <div class="table-wrapper ops-table-wrapper">
          <table class="data-table table-width-lock" id="sg-group-table" style="--ops-table-min-width: 1440px; --table-lock-width: 1440px; --table-cell-min: 114px; --table-detail-min: 220px;">
            <thead><tr>
              <th>สถานะ</th>
              <th>วันที่จัด</th><th>รหัส Group</th><th>รหัสใบจอง</th><th>ประเภท</th>
              <th>จำนวนคน</th><th>วันที่ขอ</th><th>สถานที่รับ</th><th>เวลา</th>
              <th>สถานที่ส่ง</th><th>แผนก</th><th>คนขับ</th>
            </tr></thead>
            <tbody id="sg-group-tbody">
              <tr><td colspan="12" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="sg-group-pagination" class="pagination-bar"></div>
      </div>

      <!-- ===== Group Detail Modal ===== -->
      <div class="modal-overlay" id="sg-modal" style="display:none;">
        <div class="modal-container" style="max-width:700px;">
          <div class="modal-header">
            <div class="modal-header-main">
              <div class="modal-title-block">
                <h3><i class="fa-solid fa-layer-group"></i> รายละเอียดกลุ่ม <span id="sgm-title"></span></h3>
                <p>ตรวจสอบข้อมูลกลุ่ม รถ และคนขับก่อนปิดงานหรือยกเลิกกลุ่ม</p>
              </div>
              <div class="modal-status-panel">
                <span class="modal-status-label">สถานะปัจจุบัน</span>
                <div id="sgm-status-badge" class="modal-status-badge"></div>
              </div>
            </div>
            <button class="modal-close" id="sgm-close"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            <div class="detail-section section-blue">
              <div class="detail-section-header"><i class="fa-solid fa-info-circle"></i> ข้อมูลกลุ่ม</div>
              <div class="detail-section-body">
                <div class="detail-grid">
                <div class="detail-field"><span class="detail-label">รหัส Group</span><div class="detail-value" id="sgm-group"></div></div>
                <div class="detail-field"><span class="detail-label">วันที่ขอ</span><div class="detail-value" id="sgm-date"></div></div>
                <div class="detail-field"><span class="detail-label">ประเภท</span><div class="detail-value" id="sgm-type"></div></div>
                <div class="detail-field"><span class="detail-label">จำนวนคนรวม</span><div class="detail-value" id="sgm-headcount"></div></div>
                <div class="detail-field"><span class="detail-label">สถานที่รับ</span><div class="detail-value" id="sgm-pickup"></div></div>
                <div class="detail-field"><span class="detail-label">เวลา</span><div class="detail-value" id="sgm-time"></div></div>
                <div class="detail-field span-2"><span class="detail-label">สถานที่ส่ง</span><div class="detail-value" id="sgm-delivery"></div></div>
                <div class="detail-field"><span class="detail-label">แผนก</span><div class="detail-value" id="sgm-dep"></div></div>
                <div class="detail-field"><span class="detail-label">สถานะ</span><div class="detail-value" id="sgm-status"></div></div>
              </div>
            </div>
          </div>
          <div class="detail-section section-amber" style="margin-top:16px;">
            <div class="detail-section-header"><i class="fa-solid fa-car"></i> รถและคนขับ</div>
            <div class="detail-section-body">
              <div class="detail-grid">
                <div class="detail-field"><span class="detail-label">รถ (Car)</span><div class="detail-value" id="sgm-car"></div></div>
                <div class="detail-field"><span class="detail-label">คนขับ (Driver)</span><div class="detail-value" id="sgm-driver"></div></div>
                <div class="detail-field span-2"><span class="detail-label">หมายเหตุ</span><div class="detail-value" id="sgm-remark"></div></div>
              </div>
            </div>
          </div>
          <div class="detail-section section-green" style="margin-top:16px;">
            <div class="detail-section-header"><i class="fa-solid fa-list-ol"></i> รหัสใบจองในกลุ่ม</div>
            <div class="detail-section-body">
              <div class="detail-value" id="sgm-ids" style="white-space:pre-wrap;"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer modal-footer-split" id="sgm-footer">
          <div class="modal-action-group modal-action-group-secondary">
            <button class="btn btn-cancel-action" id="sgm-btn-cancel"><i class="fa-solid fa-ban"></i> ยกเลิกกลุ่ม</button>
            <button class="btn btn-work" id="sgm-btn-work"><i class="fa-solid fa-file-invoice"></i> เปิดใบงาน</button>
          </div>
          <div class="modal-action-group modal-action-group-primary">
            <button class="btn btn-approve" id="sgm-btn-approve"><i class="fa-solid fa-check-circle"></i> ปิดงานกลุ่ม</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
}

// === Data ===
let allShuttles = [];
let shuttleMap = new Map();
let groupData = [];
let selectedIds = new Set();

// === Pagination ===
const PAGE_SIZE = 20;
let currentPage = 1;
let currentGroupPage = 1;

function getBookingDateValue(str) {
  if (!str || str === '-') return 0;
  const parts = str.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
  }
  return 0;
}

export function init() {
  // ตรวจสอบสิทธิ์ Admin
  const isAdmin = canAccessPage('hr-shuttle-group');
  if (!isAdmin) {
    document.getElementById('sg-tbody').innerHTML = '<tr><td colspan="13" style="text-align:center;padding:40px;color:#ef4444;"><i class="fa-solid fa-lock"></i> คุณไม่มีสิทธิ์เข้าถึงหน้านี้</td></tr>';
    return;
  }

  // Flatpickr วันที่ (default วันนี้)
  flatpickr('#sg-date', { dateFormat: 'd/m/Y', defaultDate: 'today', disableMobile: true, onChange: () => renderTable() });
  // Flatpickr เวลา
  flatpickr('#sg-time', { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true, disableMobile: true, onChange: () => renderTable() });

  // Filter listeners
  document.getElementById('sg-dept').addEventListener('change', () => renderTable());
  document.getElementById('sg-keyword').addEventListener('input', () => renderTable());
  document.getElementById('sg-status').addEventListener('change', () => renderTable());
  document.getElementById('sg-reset').addEventListener('click', () => {
    document.getElementById('sg-date')._flatpickr.setDate('today', true);
    document.getElementById('sg-time')._flatpickr.clear();
    document.getElementById('sg-dept').value = '';
    document.getElementById('sg-keyword').value = '';
    document.getElementById('sg-status').value = '2';
    selectedIds.clear();
    renderTable(1);
    updateSummary();
  });

  // Select All toggle
  let allSelected = false;
  document.getElementById('sg-select-all').addEventListener('click', () => {
    allSelected = !allSelected;
    const checkboxes = document.querySelectorAll('.sg-checkbox');
    checkboxes.forEach(cb => { cb.checked = allSelected; });
    selectedIds.clear();
    if (allSelected) {
      checkboxes.forEach(cb => selectedIds.add(cb.dataset.id));
    }
    updateSummary();
    document.getElementById('sg-select-all').innerHTML = allSelected
      ? '<i class="fa-solid fa-xmark"></i> ยกเลิกทั้งหมด'
      : '<i class="fa-solid fa-check-double"></i> เลือกทั้งหมด';
  });

  // Approve button
  document.getElementById('sg-btn-approve').addEventListener('click', approveGroup);

  // --- Group Modal ---
  const sgModal = document.getElementById('sg-modal');
  document.getElementById('sgm-close').addEventListener('click', closeGroupModal);
  sgModal.addEventListener('click', (e) => { if (e.target === sgModal) closeGroupModal(); });

  // Group table row click (event delegation)
  document.getElementById('sg-group-tbody').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-group]');
    if (!row) return;
    const gId = row.dataset.group;
    const gItem = groupData.find(g => g.group === gId);
    if (gItem) openGroupModal(gItem);
  });

  // Modal action buttons
  document.getElementById('sgm-btn-approve').addEventListener('click', handleGroupApprove);
  document.getElementById('sgm-btn-cancel').addEventListener('click', handleGroupCancel);
  document.getElementById('sgm-btn-work').addEventListener('click', () => {
    if (currentModalGroup) {
      window.open(`reports/hr/reporthr02.html?id=${currentModalGroup.group}`, '_blank');
    }
  });

  // Load data
  loadData();
}

async function loadData() {
  await Promise.all([loadBookings(), loadGroups(), loadCars(), loadDrivers(), loadDepartments()]);
}

async function loadDepartments() {
  try {
    const snap = await get(ref(hrDatabase, 'DHR/User'));
    if (!snap.exists()) return;
    const data = snap.val();
    const depts = new Set();
    Object.values(data).forEach(u => { if (u.department) depts.add(u.department); });
    const sel = document.getElementById('sg-dept');
    sel.innerHTML = '<option value="">-- ทุกแผนก --</option>';
    [...depts].sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Load dept error:', e); }
}

async function loadCars() {
  const sel = document.getElementById('sg-car');
  try {
    const snap = await get(ref(hrDatabase, 'Booking/Car'));
    if (!snap.exists()) { sel.innerHTML = '<option value="" disabled selected>ไม่มีข้อมูลรถ</option>'; return; }
    const data = snap.val();
    sel.innerHTML = '<option value="" disabled selected>-- เลือกรถ --</option>';
    Object.keys(data).forEach(k => {
      const c = data[k];
      const val = c.car_id + ' | ' + c.type;
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = val;
      sel.appendChild(opt);
    });
  } catch (e) { sel.innerHTML = '<option value="" disabled>เกิดข้อผิดพลาด</option>'; }
}

async function loadDrivers() {
  const sel1 = document.getElementById('sg-driver1');
  const sel2 = document.getElementById('sg-driver2');
  try {
    const snap = await get(ref(hrDatabase, 'Booking/Driver'));
    if (!snap.exists()) { sel1.innerHTML = sel2.innerHTML = '<option value="" disabled selected>ไม่มีข้อมูลคนขับ</option>'; return; }
    const data = snap.val();
    sel1.innerHTML = '<option value="" disabled selected>-- เลือกคนขับ --</option>';
    sel2.innerHTML = '<option value="" disabled selected>-- เลือกคนขับ --</option><option value="-">- ไม่ระบุ -</option>';
    Object.keys(data).forEach(k => {
      const d = data[k];
      const val = d.employee_id + ' | ' + d.firstname + ' ' + d.lastname;
      const opt1 = document.createElement('option');
      opt1.value = val;
      opt1.textContent = val;
      sel1.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = val;
      opt2.textContent = val;
      sel2.appendChild(opt2);
    });
  } catch (e) { sel1.innerHTML = sel2.innerHTML = '<option value="" disabled>เกิดข้อผิดพลาด</option>'; }
}

async function loadBookings() {
  try {
    const snap = await get(ref(hrDatabase, 'Booking/Booking2'));
    allShuttles = [];
    shuttleMap = new Map();
    if (!snap.exists()) { renderTable(); return; }
    const data = snap.val();
    Object.entries(data).forEach(([year, items]) => {
      if (!items || typeof items !== 'object') return;
      Object.entries(items).forEach(([id, raw]) => {
        //if (raw.step !== '2') return;
        const pLoc = raw.pickupLoc || '-';
        const dLoc = raw.deliveryLoc || '-';
        const item = {
          id: raw.id || id,
          date: raw.date || '-',
          type: raw.type || '-',
          headcount: parseInt(raw.headcount || raw.amont || 0),
          bookingDate: raw.bookingDate || '-',
          pickupLoc: pLoc,
          pickupTime: raw.pickupTime || '-',
          deliveryLoc: dLoc,
          name: raw.name || '-',
          dep: raw.dep || raw.department || '-',
          approve: raw.approve || '-',
          step: raw.step || '0',
          groupId: raw.groupId || '',
          year: year,
          _raw: raw,
        };
        allShuttles.push(item);
        shuttleMap.set(String(item.id), item);
      });
    });
    allShuttles.sort((a, b) => getBookingDateValue(a.bookingDate) - getBookingDateValue(b.bookingDate));
    renderTable();
  } catch (e) { console.error('Load bookings error:', e); }
}

function renderTable(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('sg-tbody');
  const dateFilter = document.getElementById('sg-date').value;
  const timeFilter = document.getElementById('sg-time').value;
  const deptFilter = document.getElementById('sg-dept').value;
  const keyword = document.getElementById('sg-keyword').value.toLowerCase();
  const statusFilter = document.getElementById('sg-status').value;

  const filtered = allShuttles.filter(item => {
    if (statusFilter && item.step !== statusFilter) return false;
    if (deptFilter && item.dep !== deptFilter) return false;
    if (keyword) {
      const haystack = [
        item.id,
        item.name,
        item.dep,
        item.pickupLoc,
        item.deliveryLoc,
        item.type,
      ].join(' ').toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (dateFilter && item.bookingDate !== dateFilter) return false;
    if (timeFilter && item.pickupTime !== timeFilter) return false;
    return true;
  });

  document.getElementById('sg-count').textContent = filtered.length;
  document.getElementById('sg-total').textContent = `จาก ${allShuttles.length} งาน`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:20px;">ไม่มีข้อมูล</td></tr>';
    document.getElementById('sg-pagination').innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  let html = '';
  pageItems.forEach(item => {
    const reqName = (item.name || '-').split(' | ')[1] || item.name || '-';
    const appName = (item.approve || '-').split(' | ')[1] || item.approve || '-';
    const isChecked = selectedIds.has(item.id) ? 'checked' : '';
    const safeId = escapeAttr(item.id || '-');
    const safeHeadcount = escapeAttr(item.headcount);

    html += `<tr>
      <td class="ops-select-cell">
        <input type="checkbox" class="sg-checkbox" data-id="${safeId}" data-headcount="${safeHeadcount}" ${isChecked} style="width:18px;height:18px;cursor:pointer;">
      </td>
      <td>${getStepBadge(item.step)}</td>
      <td>${escapeHTML(item.date)}</td><td>${escapeHTML(item.id)}</td><td>${escapeHTML(item.type)}</td>
      <td style="text-align:center;">${escapeHTML(item.headcount)}</td>
      <td>${escapeHTML(item.bookingDate)}</td><td>${escapeHTML(item.pickupLoc)}</td><td>${escapeHTML(item.pickupTime)}</td>
      <td>${escapeHTML(item.deliveryLoc)}</td><td>${escapeHTML(reqName)}</td><td>${escapeHTML(item.dep)}</td>
      <td>${escapeHTML(appName)}</td>
    </tr>`;
  });
  tbody.innerHTML = html;

  // Bind checkbox events
  tbody.querySelectorAll('.sg-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(e.target.dataset.id);
      else selectedIds.delete(e.target.dataset.id);
      updateSummary();
    });
  });

  const pagBar = document.getElementById('sg-pagination');
  pagBar.innerHTML = buildPaginationHTML(currentPage, totalPages, filtered.length, PAGE_SIZE);
  bindPaginationEvents(pagBar, 'sg-table', () => currentPage, p => currentPage = p, () => renderTable(currentPage));
}

function updateSummary() {
  let totalHead = 0;
  selectedIds.forEach(id => {
    const item = shuttleMap.get(id);
    if (item) totalHead += item.headcount;
  });
  document.getElementById('sg-selected-count').textContent = selectedIds.size;
  document.getElementById('sg-total-headcount').textContent = totalHead;

  // แสดง/ซ่อนส่วน Details ตามจำนวนที่เลือก
  const detailsCard = document.getElementById('sg-details-card');
  if (detailsCard) {
    detailsCard.style.display = selectedIds.size > 0 ? 'block' : 'none';
  }
}

async function approveGroup() {
  if (selectedIds.size === 0) { showToast('กรุณาเลือกรายการก่อน', 'warning'); return; }

  const carSel = document.getElementById('sg-car');
  const d1Sel = document.getElementById('sg-driver1');
  const d2Sel = document.getElementById('sg-driver2');
  const carVal = carSel.options[carSel.selectedIndex]?.text || '';
  let d1Val = d1Sel.options[d1Sel.selectedIndex]?.text || '';
  let d2Val = d2Sel.options[d2Sel.selectedIndex]?.text || '';

  if (d1Val === '-- เลือกคนขับ --' || d1Val === '') d1Val = '-';
  if (d2Val === '-- เลือกคนขับ --' || d2Val === '- ไม่ระบุ -' || d2Val === '') d2Val = '-';

  const detail_remark = document.getElementById('sg-remark').value || '';

  if (!carVal || carVal.includes('เลือกรถ') || carVal.includes('โหลด')) { showToast('กรุณาเลือกรถ', 'warning'); return; }
  if (d1Val === '-' || d1Val.includes('โหลด')) { showToast('กรุณาเลือกคนขับรถ', 'warning'); return; }

  const confirmed = await showConfirmModal('ยืนยัน Approve กลุ่ม', `คุณต้องการอนุมัติ ${selectedIds.size} รายการ รวม ${document.getElementById('sg-total-headcount').textContent} คน ใช่หรือไม่?`, 'fa-people-group');
  if (!confirmed) return;

  try {
    const today = new Date();
    const dateStr = dateToString(today);
    const dateParts = dateStr.split(' ');
    const splitData = 'G-' + dateParts[0].split('/')[2] + dateParts[0].split('/')[1] + dateParts[0].split('/')[0]
      + dateParts[1].split(':')[0] + dateParts[1].split(':')[1] + dateParts[1].split(':')[2];
    const groupId = splitData;
    const year = String(today.getFullYear());

    const empId = sessionStorage.getItem('empId') || '';
    const empName = sessionStorage.getItem('empName') || '';
    const empLast = sessionStorage.getItem('empLastname') || '';
    const approverStr = `${empId} | ${empName} ${empLast}`.trim();
    const driverNameStr = [d1Val, d2Val].join(',');

    // อัปเดตแต่ละใบจอง step → 3 พร้อมใส่ group, car, driverName
    const updatePromises = [...selectedIds].map(id => {
      const item = shuttleMap.get(id);
      if (!item) return Promise.resolve();
      const idParts = id.split('-');
      const bYear = idParts.length >= 2 ? idParts[1].substring(0, 4) : year;
      return update(ref(hrDatabase, `Booking/Booking2/${bYear}/${id}`), {
        dateUpdate: dateStr,
        step: '3',
        group: groupId,
        car: carVal,
        driverName: driverNameStr,
        detail_remark: detail_remark,
        adminApprove: approverStr,
        adminApproveTime: dateStr,
      });
    });
    await Promise.all(updatePromises);

    showToast(`Approve กลุ่ม ${groupId} สำเร็จ (${selectedIds.size} รายการ)`, 'success');
    selectedIds.clear();
    updateSummary();

    // Reset selection fields
    document.getElementById('sg-car').selectedIndex = 0;
    document.getElementById('sg-driver1').selectedIndex = 0;
    document.getElementById('sg-driver2').selectedIndex = 0;
    document.getElementById('sg-remark').value = '';

    // Reload
    await Promise.all([loadBookings(), loadGroups()]);
  } catch (e) {
    console.error('Approve group error:', e);
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// ==========================================
// ส่วนที่ 3: โหลดข้อมูล Booking2 ที่ step=3 และมี group แล้วจัดกลุ่มรวม
// ==========================================
async function loadGroups() {
  try {
    const snap = await get(ref(hrDatabase, 'Booking/Booking2'));
    groupData = [];
    if (!snap.exists()) { renderGroupTable(); return; }
    const data = snap.val();

    // รวมข้อมูลตาม group ID (เหมือนระบบเดิม)
    const objectValue = {};
    Object.entries(data).forEach(([year, items]) => {
      if (!items || typeof items !== 'object') return;
      Object.entries(items).forEach(([id, raw]) => {
        const strGroupId = raw.group || raw.id || id;
        const strId = raw.id || id;
        const strType = raw.type || '-';
        const intAmont = Number(raw.headcount || raw.amont || 0);
        const strPickupLoc = raw.pickupLoc || '-';
        const strPickupTime = raw.pickupTime || '-';
        const strDeliveryLoc = raw.deliveryLoc || '-';
        const strDep = raw.dep || raw.department || '-';
        const strCar = raw.car || '-';
        const strDriverName = raw.driverName || '-';
        const strBookingDate = raw.bookingDate || '-';
        const strdetail_remack = raw.detail_remack || raw.detail_remark || '-';

        if (!objectValue[strGroupId]) {
          objectValue[strGroupId] = {
            bookingDate: strBookingDate,
            group: strGroupId,
            arrayId: [],
            type: strType,
            intAmont: 0,
            pickupLoc: strPickupLoc,
            pickupTime: strPickupTime,
            arrayDeliveryLoc: [],
            dep: strDep,
            car: strCar,
            driverName: strDriverName,
            step: raw.step || '-',
            detail_remark: strdetail_remack,
          };
        }

        objectValue[strGroupId].arrayId.push(strId);
        objectValue[strGroupId].intAmont += intAmont;
        objectValue[strGroupId].arrayDeliveryLoc.push(strDeliveryLoc);
      });
    });

    // แปลง object → array เรียงตามวันที่ขอจากน้อยไปมาก
    groupData = Object.values(objectValue);
    groupData.sort((a, b) => getBookingDateValue(a.bookingDate) - getBookingDateValue(b.bookingDate));
    renderGroupTable();
  } catch (e) { console.error('Load groups error:', e); }
}

function renderGroupTable(page = 1) {
  currentGroupPage = page;
  const tbody = document.getElementById('sg-group-tbody');
  if (groupData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">ยังไม่มีกลุ่มที่จัดไว้</td></tr>';
    document.getElementById('sg-group-pagination').innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(groupData.length / PAGE_SIZE);
  if (currentGroupPage > totalPages) currentGroupPage = totalPages;
  if (currentGroupPage < 1) currentGroupPage = 1;

  const startIndex = (currentGroupPage - 1) * PAGE_SIZE;
  const pageItems = groupData.slice(startIndex, startIndex + PAGE_SIZE);

  let html = '';
  pageItems.forEach(g => {
    const driverDisplay = (g.driverName || '-').split(',')[0] || '-';
    const idsDisplay = (g.arrayId || []).join(', ');
    const deliveryDisplay = [...new Set(g.arrayDeliveryLoc || [])].join(', ');

    html += `<tr data-group="${escapeAttr(g.group)}" style="cursor:pointer;">
      <td>${getStepBadge(g.step)}</td>
      <td>${escapeHTML(g.bookingDate)}</td>
      <td style="font-weight:600;color:#2563eb;">${escapeHTML(g.group)}</td>
      <td class="cell-detail">${escapeHTML(idsDisplay)}</td>
      <td>${escapeHTML(g.type)}</td>
      <td style="text-align:center;font-weight:600;">${escapeHTML(g.intAmont)}</td>
      <td>${escapeHTML(g.bookingDate)}</td>
      <td>${escapeHTML(g.pickupLoc)}</td>
      <td>${escapeHTML(g.pickupTime)}</td>
      <td class="cell-detail">${escapeHTML(deliveryDisplay)}</td>
      <td>${escapeHTML(g.dep)}</td>
      <td>${escapeHTML(driverDisplay)}</td>
    </tr>`;
  });
  tbody.innerHTML = html;

  const pagBar = document.getElementById('sg-group-pagination');
  pagBar.innerHTML = buildPaginationHTML(currentGroupPage, totalPages, groupData.length, PAGE_SIZE);
  bindPaginationEvents(pagBar, 'sg-group-table', () => currentGroupPage, p => currentGroupPage = p, () => renderGroupTable(currentGroupPage));
}

// Pagination helpers moved to utils.js

// ==========================================
// Group Detail Modal
// ==========================================
let currentModalGroup = null;

function openGroupModal(g) {
  currentModalGroup = g;
  document.getElementById('sgm-title').textContent = g.group;
  document.getElementById('sgm-group').textContent = g.group;
  document.getElementById('sgm-date').textContent = g.bookingDate;
  document.getElementById('sgm-type').textContent = g.type;
  document.getElementById('sgm-headcount').textContent = g.intAmont + ' คน';
  document.getElementById('sgm-pickup').textContent = g.pickupLoc;
  document.getElementById('sgm-time').textContent = g.pickupTime;
  document.getElementById('sgm-delivery').textContent = [...new Set(g.arrayDeliveryLoc || [])].join(', ');
  document.getElementById('sgm-dep').textContent = g.dep;
  document.getElementById('sgm-status').innerHTML = getStepBadge(g.step);
  document.getElementById('sgm-status-badge').innerHTML = getStepBadge(g.step);
  document.getElementById('sgm-car').textContent = g.car || '-';
  document.getElementById('sgm-driver').textContent = g.driverName || '-';
  document.getElementById('sgm-remark').textContent = g.detail_remark || '-';
  document.getElementById('sgm-ids').textContent = (g.arrayId || []).join('\n');

  // Show/hide buttons based on step
  const btnApprove = document.getElementById('sgm-btn-approve');
  const btnCancel = document.getElementById('sgm-btn-cancel');
  const btnWork = document.getElementById('sgm-btn-work');
  const stepInt = parseInt(g.step);

  btnApprove.innerHTML = '<i class="fa-solid fa-check-circle"></i> ปิดงานกลุ่ม';
  btnCancel.innerHTML = '<i class="fa-solid fa-ban"></i> ยกเลิกกลุ่ม';
  btnWork.innerHTML = '<i class="fa-solid fa-file-invoice"></i> เปิดใบงาน';

  if (stepInt === 3) {
    btnApprove.style.display = 'inline-flex';
    btnCancel.style.display = 'inline-flex';
  } else {
    btnApprove.style.display = 'none';
    btnCancel.style.display = 'none';
  }

  if (stepInt >= 3) {
    btnWork.style.display = 'inline-flex';
  } else {
    btnWork.style.display = 'none';
  }

  const modal = document.getElementById('sg-modal');
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closeGroupModal() {
  const modal = document.getElementById('sg-modal');
  modal.classList.remove('show');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  currentModalGroup = null;
}

async function handleGroupApprove() {
  if (!currentModalGroup) return;
  const g = currentModalGroup;

  const confirmed = await showConfirmModal(
    'ยืนยันปิดงาน',
    `ต้องการปิดงานกลุ่ม ${g.group} (${g.arrayId.length} รายการ) ใช่หรือไม่?`,
    'fa-check-circle'
  );
  if (!confirmed) return;

  try {
    const now = new Date();
    const dateStr = dateToString(now);
    const empId = sessionStorage.getItem('empId') || '';
    const empName = sessionStorage.getItem('empName') || '';
    const empLast = sessionStorage.getItem('empLastname') || '';
    const closer = `${empId} | ${empName} ${empLast}`.trim();

    const updatePromises = g.arrayId.map(id => {
      const idParts = id.split('-');
      const bYear = idParts.length >= 2 ? idParts[1].substring(0, 4) : String(now.getFullYear());
      return update(ref(hrDatabase, `Booking/Booking2/${bYear}/${id}`), {
        dateUpdate: dateStr,
        step: '4',
        closeApprove: closer,
        closeApproveTime: dateStr,
      });
    });
    await Promise.all(updatePromises);

    showToast(`ปิดงานกลุ่ม ${g.group} สำเร็จ`, 'success');
    closeGroupModal();
    await Promise.all([loadBookings(), loadGroups()]);
  } catch (e) {
    console.error('Group approve error:', e);
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

async function handleGroupCancel() {
  if (!currentModalGroup) return;
  const g = currentModalGroup;

  const confirmed = await showConfirmModal(
    'ยืนยันยกเลิกกลุ่ม',
    `ต้องการยกเลิกกลุ่ม ${g.group} (${g.arrayId.length} รายการ) ใช่หรือไม่?`,
    'fa-ban'
  );
  if (!confirmed) return;

  try {
    const now = new Date();
    const dateStr = dateToString(now);
    const empId = sessionStorage.getItem('empId') || '';
    const empName = sessionStorage.getItem('empName') || '';
    const empLast = sessionStorage.getItem('empLastname') || '';
    const canceller = `${empId} | ${empName} ${empLast}`.trim();

    const updatePromises = g.arrayId.map(id => {
      const idParts = id.split('-');
      const bYear = idParts.length >= 2 ? idParts[1].substring(0, 4) : String(now.getFullYear());
      return update(ref(hrDatabase, `Booking/Booking2/${bYear}/${id}`), {
        dateUpdate: dateStr,
        step: '2',
        group: '',
        car: '',
        driverName: '',
        detail_remack: '',
        cancelApprove: canceller,
        cancelApproveTime: dateStr,
      });
    });
    await Promise.all(updatePromises);

    showToast(`ยกเลิกกลุ่ม ${g.group} สำเร็จ`, 'success');
    closeGroupModal();
    await Promise.all([loadBookings(), loadGroups()]);
  } catch (e) {
    console.error('Group cancel error:', e);
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}
