import { bindPaginationEvents, buildPaginationHTML, canAccessPage, escapeAttr, escapeHTML } from '../utils.js';
import { showAlert, showConfirmModal, showToast } from '../ui.js';
import { listUserAccessDirectory, updateUserAccessProfile } from '../services/account-access.js';

const ROWS_PER_PAGE = 20;

const EN_LEVEL_OPTIONS = [
  { value: '0', label: '0 - User' },
  { value: '1', label: '1 - Approver' },
  { value: 'admin_en', label: 'admin_en - Engineer Admin' },
  { value: 'admin', label: 'admin - System Admin' },
];

const HR_LEVEL_OPTIONS = [
  { value: '0', label: '0 - User' },
  { value: '1', label: '1 - Approver' },
  { value: 'admin_hr', label: 'admin_hr - HR Admin' },
  { value: 'admin', label: 'admin - System Admin' },
];

const IT_LEVEL_OPTIONS = [
  { value: '0', label: '0 - User' },
  { value: '1', label: '1 - Approver' },
  { value: 'admin_it', label: 'admin_it - IT Admin' },
  { value: 'admin', label: 'admin - System Admin' },
];

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const state = {
  users: [],
  loading: false,
  error: '',
  query: '',
  department: 'all',
  currentPage: 1,
  drafts: {},
  savingEmployeeId: '',
};

export function render() {
  return `
    <div class="app-page app-page-tight">
      <section class="page-hero page-hero-admin fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Administrator Only</p>
          <h1 class="page-hero-title">Permission Management</h1>
          <p class="page-hero-subtitle">กำหนดสิทธิ์การใช้งานของพนักงานจากฐานข้อมูลชุดเดียวกับระบบสมัครสมาชิก แล้วซิงก์กลับไปยัง Firebase ฝั่ง EN, Firebase ฝั่ง HR และ Google Sheet ในครั้งเดียว</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ฟิลด์สิทธิ์</span>
            <strong>Dept / EN / HR / IT / Active</strong>
          </div>
          <div class="page-hero-stat">
            <span>เป้าหมายการอัปเดต</span>
            <strong>3 แหล่งข้อมูล</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-shield-halved"></i>
        <div><strong>หมายเหตุ:</strong> เมื่อกดบันทึก ระบบจะอัปเดตค่า <code>department</code>, <code>level</code>, <code>level_Hr</code>, <code>level_It</code> และ <code>active</code> พร้อมกันทั้ง Firebase EN, Firebase HR และ Google Sheet</div>
      </div>

      <section class="form-card fade-in ops-card ops-card-primary">
        <div class="ops-panel-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-blue">
              <i class="fa-solid fa-table-list"></i>
            </div>
            <div class="form-header-text">
              <h2>รายการผู้ใช้ทั้งหมด</h2>
              <p>ค้นหาและปรับสิทธิ์รายบุคคลได้จากหน้าจอนี้ โดยค่าเดิมจะยังคงถูกเก็บไว้จนกว่าจะกดบันทึก</p>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-compact" id="admin-access-refresh">
            <i class="fa-solid fa-rotate"></i> รีเฟรชรายการ
          </button>
        </div>

        <div class="ops-section-note">
          <i class="fa-solid fa-circle-info"></i>
          <span>ตารางนี้ใช้รูปแบบเดียวกับหน้า Repair Request List เพื่อให้ไล่ดูข้อมูล, ค้นหา, และอัปเดตสิทธิ์ได้ง่ายขึ้นในมุมมองเดียว</span>
        </div>

        <div class="list-filter-bar ops-filter-bar">
          <div class="filter-group">
            <div class="filter-item">
              <label for="admin-access-search"><i class="fa-solid fa-magnifying-glass"></i> ค้นหา</label>
              <input type="search" id="admin-access-search" class="form-control" placeholder="รหัสพนักงาน, ชื่อ, แผนก, อีเมล">
            </div>
            <div class="filter-item">
              <label for="admin-access-department"><i class="fa-solid fa-building-user"></i> แผนก</label>
              <select id="admin-access-department" class="form-control">
                <option value="all">ทุกแผนก</option>
              </select>
            </div>
          </div>
          <div class="ops-filter-side">
            <div class="filter-summary">
              <span id="admin-access-count">0</span>
              <span class="ops-summary-copy">กำลังแสดง</span>
              <small>รายการ</small>
            </div>
          </div>
        </div>

        <div id="admin-access-feedback"></div>

        <div class="ops-table-caption">
          <span><i class="fa-solid fa-table-list"></i> หัวตารางยึดด้านบนขณะเลื่อนเหมือนหน้า Repair Request List</span>
          <span><i class="fa-solid fa-arrows-left-right"></i> ตารางเลื่อนแนวนอนได้ในหน้าจอเล็ก</span>
        </div>

        <div class="table-wrapper ops-table-wrapper">
          <table class="data-table table-width-lock admin-access-table" id="admin-access-table" style="--ops-table-min-width: 1700px; --table-lock-width: 1760px; --table-detail-min: 300px; --table-cell-min: 130px;">
            <thead>
              <tr>
                <th class="cell-center">#</th>
                <th>Employee ID</th>
                <th>ชื่อผู้ใช้</th>
                <th>แผนก</th>
                <th class="admin-access-col-level">EN Level</th>
                <th class="admin-access-col-level">HR Level</th>
                <th class="admin-access-col-level">IT Level</th>
                <th class="admin-access-col-active">Active</th>
                <th>สถานะ</th>
                <th>Source</th>
                <th class="cell-center">Action</th>
              </tr>
            </thead>
            <tbody id="admin-access-table-body">
              <tr>
                <td colspan="11" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูลผู้ใช้...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="admin-access-pagination"></div>
      </section>
    </div>
  `;
}

function getDraftForUser(user) {
  return state.drafts[user.employeeId] || {
    department: user.department && user.department !== '-' ? user.department : '',
    level: user.level || '0',
    level_Hr: user.level_Hr || '0',
    level_It: user.level_It || '0',
    active: String(user.active || 'false').toLowerCase() === 'true' ? 'true' : 'false',
  };
}

function isUserDirty(user) {
  const draft = getDraftForUser(user);
  const currentDepartment = user.department && user.department !== '-' ? user.department : '';

  return draft.department !== currentDepartment
    || draft.level !== (user.level || '0')
    || draft.level_Hr !== (user.level_Hr || '0')
    || draft.level_It !== (user.level_It || '0')
    || draft.active !== (String(user.active || 'false').toLowerCase() === 'true' ? 'true' : 'false');
}

function getFilteredUsers() {
  const query = state.query.trim().toLowerCase();

  return state.users.filter(user => {
    const matchesDepartment = state.department === 'all'
      || user.department === state.department;

    if (!matchesDepartment) return false;
    if (!query) return true;

    return [
      user.employeeId,
      user.username,
      user.fullName,
      user.department,
      user.email,
    ].some(value => String(value || '').toLowerCase().includes(query));
  });
}

function getDepartmentOptions() {
  return [...new Set(
    state.users
      .map(user => user.department)
      .filter(department => department && department !== '-')
  )].sort((left, right) => left.localeCompare(right, 'th'));
}

function renderSelectOptions(currentValue, options, fallbackLabel = 'Current') {
  const normalizedCurrentValue = String(currentValue || '').trim();
  const map = new Map(options.map(option => [option.value, option.label]));

  if (!map.has(normalizedCurrentValue)) {
    map.set(normalizedCurrentValue, `${normalizedCurrentValue} - ${fallbackLabel}`);
  }

  return [...map.entries()]
    .map(([value, label]) => `<option value="${escapeAttr(value)}"${value === normalizedCurrentValue ? ' selected' : ''}>${escapeHTML(label)}</option>`)
    .join('');
}

function renderDepartmentOptions(currentValue, departmentOptions) {
  const normalizedCurrentValue = String(currentValue || '').trim();
  const options = [...departmentOptions];

  if (normalizedCurrentValue && !options.includes(normalizedCurrentValue)) {
    options.unshift(normalizedCurrentValue);
  }

  return [
    '<option value="">-- ไม่ระบุ --</option>',
    ...options.map(department => `<option value="${escapeAttr(department)}"${department === normalizedCurrentValue ? ' selected' : ''}>${escapeHTML(department)}</option>`),
  ].join('');
}

function renderSourceBadges(user) {
  const badges = [
    { label: 'EN', enabled: user.hasEngineering },
    { label: 'HR', enabled: user.hasHr },
    { label: 'Sheet', enabled: user.hasSheet },
  ];

  return badges
    .map(badge => `<span class="badge-status ${badge.enabled ? 'badge-success' : 'badge-danger'}">${escapeHTML(badge.label)}</span>`)
    .join(' ');
}

function renderStatusBadge(user) {
  const isActive = String(user.active || '').toLowerCase() === 'true';
  return `<span class="badge-status ${isActive ? 'badge-success' : 'badge-danger'}">${isActive ? 'Active' : 'Inactive'}</span>`;
}

function renderTableRows() {
  const users = getFilteredUsers();

  if (state.loading) {
    return `
      <tr>
        <td colspan="11" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูลผู้ใช้...</td>
      </tr>
    `;
  }

  if (state.error) {
    return `
      <tr>
        <td colspan="11" class="table-empty table-error"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(state.error)}</td>
      </tr>
    `;
  }

  if (users.length === 0) {
    return `
      <tr>
        <td colspan="11" class="table-empty"><i class="fa-solid fa-inbox"></i> ไม่พบข้อมูลที่ตรงกับเงื่อนไขที่ค้นหา</td>
      </tr>
    `;
  }

  const totalPages = Math.max(1, Math.ceil(users.length / ROWS_PER_PAGE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const startIndex = (state.currentPage - 1) * ROWS_PER_PAGE;
  const pageUsers = users.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const departmentOptions = getDepartmentOptions();

  return pageUsers.map((user, index) => {
    const draft = getDraftForUser(user);
    const dirty = isUserDirty(user);
    const isSaving = state.savingEmployeeId === user.employeeId;

    return `
      <tr>
        <td class="cell-center">${startIndex + index + 1}</td>
        <td class="cell-mono">${escapeHTML(user.employeeId)}</td>
        <td class="cell-detail">
          <strong>${escapeHTML(user.fullName)}</strong><br>
          <small>${escapeHTML(user.email || '-')}</small>
        </td>
        <td>
          <select class="form-control admin-access-select admin-access-select-department" data-employee-id="${escapeAttr(user.employeeId)}" data-field="department" ${isSaving ? 'disabled' : ''}>
            ${renderDepartmentOptions(draft.department, departmentOptions)}
          </select>
        </td>
        <td>
          <select class="form-control admin-access-select" data-employee-id="${escapeAttr(user.employeeId)}" data-field="level" ${isSaving ? 'disabled' : ''}>
            ${renderSelectOptions(draft.level, EN_LEVEL_OPTIONS)}
          </select>
        </td>
        <td>
          <select class="form-control admin-access-select" data-employee-id="${escapeAttr(user.employeeId)}" data-field="level_Hr" ${isSaving ? 'disabled' : ''}>
            ${renderSelectOptions(draft.level_Hr, HR_LEVEL_OPTIONS)}
          </select>
        </td>
        <td>
          <select class="form-control admin-access-select" data-employee-id="${escapeAttr(user.employeeId)}" data-field="level_It" ${isSaving ? 'disabled' : ''}>
            ${renderSelectOptions(draft.level_It, IT_LEVEL_OPTIONS)}
          </select>
        </td>
        <td>
          <select class="form-control admin-access-select admin-access-select-active" data-employee-id="${escapeAttr(user.employeeId)}" data-field="active" ${isSaving ? 'disabled' : ''}>
            ${renderSelectOptions(draft.active, ACTIVE_OPTIONS, 'Status')}
          </select>
        </td>
        <td>${renderStatusBadge(user)}</td>
        <td>${renderSourceBadges(user)}</td>
        <td class="cell-center">
          <button type="button" class="btn btn-primary btn-compact admin-access-save" data-employee-id="${escapeAttr(user.employeeId)}" ${!dirty || isSaving ? 'disabled' : ''}>
            <i class="fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>
            ${isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderFeedback() {
  const feedbackEl = document.getElementById('admin-access-feedback');
  if (!feedbackEl) return;

  const incompleteCount = state.users.filter(user => !user.hasEngineering || !user.hasHr || !user.hasSheet).length;
  if (state.error || incompleteCount === 0) {
    feedbackEl.innerHTML = '';
    return;
  }

  feedbackEl.innerHTML = `
    <div class="danger-note" style="margin-bottom: 18px;">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div>พบ ${escapeHTML(String(incompleteCount))} บัญชีที่มีข้อมูลไม่ครบ 3 แหล่ง ระบบจะพยายามเติมข้อมูลที่ขาดให้เมื่อกดบันทึกสิทธิ์</div>
    </div>
  `;
}

function syncDepartmentFilterOptions() {
  const select = document.getElementById('admin-access-department');
  if (!select) return;

  const departments = getDepartmentOptions();
  const options = ['<option value="all">ทุกแผนก</option>']
    .concat(departments.map(department => `<option value="${escapeAttr(department)}">${escapeHTML(department)}</option>`));

  select.innerHTML = options.join('');

  if (state.department !== 'all' && !departments.includes(state.department)) {
    state.department = 'all';
  }

  select.value = state.department;
}

function renderTableState() {
  const countEl = document.getElementById('admin-access-count');
  const bodyEl = document.getElementById('admin-access-table-body');
  const refreshButton = document.getElementById('admin-access-refresh');
  const paginationBar = document.getElementById('admin-access-pagination');
  const filteredUsers = getFilteredUsers();

  if (countEl) {
    countEl.textContent = String(filteredUsers.length);
  }

  if (bodyEl) {
    bodyEl.innerHTML = renderTableRows();
  }

  if (paginationBar) {
    if (state.loading || state.error || filteredUsers.length === 0) {
      paginationBar.innerHTML = '';
    } else {
      const totalPages = Math.ceil(filteredUsers.length / ROWS_PER_PAGE);
      paginationBar.innerHTML = buildPaginationHTML(state.currentPage, totalPages, filteredUsers.length, ROWS_PER_PAGE);
      bindPaginationEvents(
        paginationBar,
        'admin-access-table',
        () => state.currentPage,
        page => { state.currentPage = page; },
        renderTableState
      );
    }
  }

  if (refreshButton) {
    refreshButton.disabled = state.loading || Boolean(state.savingEmployeeId);
    refreshButton.innerHTML = state.loading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...'
      : '<i class="fa-solid fa-rotate"></i> รีเฟรชรายการ';
  }

  renderFeedback();
}

async function loadUsers() {
  state.loading = true;
  state.error = '';
  renderTableState();

  try {
    const result = await listUserAccessDirectory();
    state.users = result.users;
    state.currentPage = 1;
    syncDepartmentFilterOptions();
  } catch (error) {
    console.error('User access load error:', error);
    state.error = error.message || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ';
  } finally {
    state.loading = false;
    renderTableState();
  }
}

function applyDraftChange(employeeId, field, value) {
  const user = state.users.find(item => item.employeeId === employeeId);
  if (!user) return;

  const nextDraft = {
    ...getDraftForUser(user),
    [field]: String(value || '').trim(),
  };

  if (
    nextDraft.department === (user.department && user.department !== '-' ? user.department : '')
    && nextDraft.level === (user.level || '0')
    && nextDraft.level_Hr === (user.level_Hr || '0')
    && nextDraft.level_It === (user.level_It || '0')
    && nextDraft.active === (String(user.active || 'false').toLowerCase() === 'true' ? 'true' : 'false')
  ) {
    delete state.drafts[employeeId];
  } else {
    state.drafts[employeeId] = nextDraft;
  }

  renderTableState();
}

async function handleSave(employeeId) {
  const user = state.users.find(item => item.employeeId === employeeId);
  if (!user) return;

  const draft = getDraftForUser(user);
  if (!isUserDirty(user)) return;

  const confirmed = await showConfirmModal(
    'ยืนยันการอัปเดตสิทธิ์',
    `ต้องการบันทึกสิทธิ์ของรหัสพนักงาน ${employeeId} ใช่หรือไม่`,
    'fa-user-shield',
    'บันทึก',
    'ยกเลิก'
  );

  if (!confirmed) return;

  state.savingEmployeeId = employeeId;
  renderTableState();

  try {
    await updateUserAccessProfile({
      employeeId,
      department: draft.department,
      level: draft.level,
      level_Hr: draft.level_Hr,
      level_It: draft.level_It,
      active: draft.active,
    });

    user.department = draft.department || '-';
    user.level = draft.level;
    user.level_Hr = draft.level_Hr;
    user.level_It = draft.level_It;
    user.active = draft.active;
    user.hasEngineering = true;
    user.hasHr = true;
    user.hasSheet = true;
    delete state.drafts[employeeId];

    if (sessionStorage.getItem('empId') === employeeId) {
      sessionStorage.setItem('empLevel_en', user.level);
      sessionStorage.setItem('empLevel_hr', user.level_Hr);
      sessionStorage.setItem('empLevel_it', user.level_It);
      sessionStorage.setItem('empActive', user.active);
      sessionStorage.setItem('empDepartment', user.department);
      window.dispatchEvent(new CustomEvent('csm:session-profile-updated'));
      showToast('อัปเดตสิทธิ์ของบัญชีที่กำลังใช้งานแล้ว ระบบปรับเมนูให้ทันทีโดยไม่ต้องเข้าสู่ระบบใหม่', 'success');
      return;
    }

    showToast(`อัปเดตสิทธิ์ของ ${employeeId} เรียบร้อยแล้ว`, 'success');
  } catch (error) {
    console.error('User access update error:', error);
    showToast(`บันทึกสิทธิ์ไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    state.savingEmployeeId = '';
    renderTableState();
  }
}

export function init() {
  if (!canAccessPage('admin-access')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
    return;
  }

  document.getElementById('admin-access-search')?.addEventListener('input', event => {
    state.query = event.target.value || '';
    state.currentPage = 1;
    renderTableState();
  });

  document.getElementById('admin-access-department')?.addEventListener('change', event => {
    state.department = event.target.value || 'all';
    state.currentPage = 1;
    renderTableState();
  });

  document.getElementById('admin-access-refresh')?.addEventListener('click', () => {
    void loadUsers();
  });

  document.getElementById('admin-access-table-body')?.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains('admin-access-select')) {
      return;
    }

    applyDraftChange(target.dataset.employeeId || '', target.dataset.field || '', target.value);
  });

  document.getElementById('admin-access-table-body')?.addEventListener('click', event => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest('.admin-access-save')
      : null;

    if (!(button instanceof HTMLButtonElement)) return;
    void handleSave(button.dataset.employeeId || '');
  });

  void loadUsers();
}
