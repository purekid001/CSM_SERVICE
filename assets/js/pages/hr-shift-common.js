import { escapeHTML, escapeAttr, dateToString } from '../utils.js';
import { showAlert, showConfirmModal, showToast } from '../ui.js';
import {
  appendHrShiftReport,
  loadHrShiftEmployees,
  loadHrShiftFormSettings,
  validateHrShiftFormWindow,
} from '../services/google-sheets.js';

const PAGE_CONFIG = {
  swap: {
    prefix: 'hr-shift-swap',
    title: 'กรอกข้อมูลแลกเวร',
    subtitle: 'บันทึกคำขอแลกเวรของพนักงานหนึ่งคนหรือหลายคน และส่งเข้าชีตรายงานเปลี่ยนแลกเวร',
    eyebrow: 'HR Shift Request',
    icon: 'fa-right-left',
    badge: 'Shift Swap',
    submitText: 'บันทึกข้อมูลแลกเวร',
    confirmTitle: 'ยืนยันบันทึกข้อมูลแลกเวร',
    successText: 'บันทึกข้อมูลแลกเวรเรียบร้อยแล้ว',
    idPrefix: 'SWP',
  },
  change: {
    prefix: 'hr-shift-change',
    title: 'กรอกข้อมูลเปลี่ยนกะงาน',
    subtitle: 'บันทึกคำขอเปลี่ยนกะงานของพนักงาน และส่งเข้าชีตรายงานเปลี่ยนกะงาน',
    eyebrow: 'HR Shift Request',
    icon: 'fa-calendar-days',
    badge: 'Shift Change',
    submitText: 'บันทึกข้อมูลเปลี่ยนกะ',
    confirmTitle: 'ยืนยันบันทึกข้อมูลเปลี่ยนกะงาน',
    successText: 'บันทึกข้อมูลเปลี่ยนกะงานเรียบร้อยแล้ว',
    idPrefix: 'CHG',
  },
};
const SIGNATURE_STROKE_COLOR = '#2563eb';

function getConfig(kind) {
  return PAGE_CONFIG[kind];
}

function getReporter() {
  const empId = sessionStorage.getItem('empId') || '';
  const empName = sessionStorage.getItem('empName') || '';
  const empLastname = sessionStorage.getItem('empLastname') || '';
  const reporterName = `${empName} ${empLastname}`.trim() || '-';

  return {
    reporterId: empId,
    reporterName,
    reporterDepartment: sessionStorage.getItem('empDepartment') || '-',
    reporterDisplay: empId ? `${empId} | ${reporterName}` : reporterName,
  };
}

function makeId(idPrefix, date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${idPrefix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function fieldId(prefix, name) {
  return `${prefix}-${name}`;
}

function employeeOptionValue(employee) {
  return `${employee.employeeId} | ${employee.displayName} | ${employee.department} | ${employee.position}`;
}

function renderEmployeePicker(prefix, role, label, { required = true } = {}) {
  const inputId = fieldId(prefix, `${role}-employee-search`);
  const listId = fieldId(prefix, `${role}-employee-list`);
  const summaryId = fieldId(prefix, `${role}-employee-summary`);
  const addId = fieldId(prefix, `${role}-employee-add`);

  return `
    <div class="form-group full-width shift-employee-picker">
      <label for="${escapeAttr(inputId)}"><i class="fa-solid fa-user"></i> ${escapeHTML(label)} ${required ? '<span class="required">*</span>' : ''}</label>
      <div class="shift-employee-input-row">
        <input type="text" class="form-control" id="${escapeAttr(inputId)}" list="${escapeAttr(listId)}" placeholder="ค้นหาจากรหัส ชื่อ แผนก หน่วย หรือตำแหน่ง" autocomplete="off">
        <button type="button" class="btn btn-secondary shift-employee-add" id="${escapeAttr(addId)}">
          <i class="fa-solid fa-plus"></i> เพิ่ม
        </button>
      </div>
      <datalist id="${escapeAttr(listId)}"></datalist>
      <div class="shift-employee-summary is-empty" id="${escapeAttr(summaryId)}">ยังไม่ได้เลือกพนักงาน</div>
    </div>
  `;
}

function renderSwapFields(config) {
  const prefix = config.prefix;
  return `
    ${renderEmployeePicker(prefix, 'primary', 'พนักงาน')}
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'primary-work-date'))}"><i class="fa-solid fa-calendar-day"></i> วันที่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'primary-work-date'))}" placeholder="dd/MM/yyyy" readonly>
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'primary-work-end-date'))}"><i class="fa-solid fa-calendar-check"></i> ถึงวันที่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'primary-work-end-date'))}" placeholder="dd/MM/yyyy" readonly>
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'primary-shift'))}"><i class="fa-solid fa-clock"></i> เวรเดิม <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'primary-shift'))}" placeholder="เช่น 01,02">
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'primary-new-shift'))}"><i class="fa-solid fa-clock"></i> เวรใหม่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'primary-new-shift'))}" placeholder="เช่น 01,02">
    </div>

    <div class="form-group full-width">
      <label for="${escapeAttr(fieldId(prefix, 'approver-signature'))}"><i class="fa-solid fa-signature"></i> ลายเซ็นผู้อนุมัติ <span class="required">*</span></label>
      <input type="hidden" id="${escapeAttr(fieldId(prefix, 'approver-signature'))}">
      <div class="shift-signature-pad">
        <canvas id="${escapeAttr(fieldId(prefix, 'approver-signature-canvas'))}" aria-label="พื้นที่เซ็นลายเซ็นผู้อนุมัติ"></canvas>
        <div class="shift-signature-toolbar">
          <span>เซ็นด้วยเมาส์หรือปลายนิ้วในช่องนี้</span>
          <button type="button" class="btn btn-secondary btn-compact" id="${escapeAttr(fieldId(prefix, 'approver-signature-clear'))}">
            <i class="fa-solid fa-eraser"></i> ล้างลายเซ็น
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderChangeFields(config) {
  const prefix = config.prefix;
  return `
    ${renderEmployeePicker(prefix, 'main', 'พนักงาน')}
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'work-date'))}"><i class="fa-solid fa-calendar-day"></i> วันที่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'work-date'))}" placeholder="dd/MM/yyyy" readonly>
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'work-end-date'))}"><i class="fa-solid fa-calendar-check"></i> ถึงวันที่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'work-end-date'))}" placeholder="dd/MM/yyyy" readonly>
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'old-shift'))}"><i class="fa-solid fa-clock-rotate-left"></i> กะเดิม <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'old-shift'))}" placeholder="เช่น 01,02">
    </div>
    <div class="form-group">
      <label for="${escapeAttr(fieldId(prefix, 'new-shift'))}"><i class="fa-solid fa-clock"></i> กะใหม่ <span class="required">*</span></label>
      <input type="text" class="form-control" id="${escapeAttr(fieldId(prefix, 'new-shift'))}" placeholder="เช่น 01,02">
    </div>

    <div class="form-group full-width">
      <label for="${escapeAttr(fieldId(prefix, 'approver-signature'))}"><i class="fa-solid fa-signature"></i> ลายเซ็นผู้อนุมัติ <span class="required">*</span></label>
      <input type="hidden" id="${escapeAttr(fieldId(prefix, 'approver-signature'))}">
      <div class="shift-signature-pad">
        <canvas id="${escapeAttr(fieldId(prefix, 'approver-signature-canvas'))}" aria-label="พื้นที่เซ็นลายเซ็นผู้อนุมัติ"></canvas>
        <div class="shift-signature-toolbar">
          <span>เซ็นด้วยเมาส์หรือปลายนิ้วในช่องนี้</span>
          <button type="button" class="btn btn-secondary btn-compact" id="${escapeAttr(fieldId(prefix, 'approver-signature-clear'))}">
            <i class="fa-solid fa-eraser"></i> ล้างลายเซ็น
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRemarkField(config) {
  const prefix = config.prefix;
  return `
    <div class="form-group full-width">
      <label for="${escapeAttr(fieldId(prefix, 'remark'))}"><i class="fa-solid fa-note-sticky"></i> หมายเหตุ</label>
      <textarea class="form-control" id="${escapeAttr(fieldId(prefix, 'remark'))}" rows="3" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></textarea>
    </div>
  `;
}

function renderSharedFields(config) {
  const prefix = config.prefix;
  return `
    <div class="form-group full-width">
      <label for="${escapeAttr(fieldId(prefix, 'reason'))}"><i class="fa-solid fa-message"></i> เหตุผล <span class="required">*</span></label>
      <textarea class="form-control" id="${escapeAttr(fieldId(prefix, 'reason'))}" rows="3" placeholder="ระบุเหตุผลในการแลกเวรหรือเปลี่ยนกะ"></textarea>
    </div>
    ${renderRemarkField(config)}
  `;
}

function renderShiftFormPage(kind) {
  const config = getConfig(kind);
  const reporter = getReporter();
  const formFields = kind === 'swap'
    ? `${renderSwapFields(config)}${renderSharedFields(config)}`
    : `${renderChangeFields(config)}${renderSharedFields(config)}`;

  return `
    <div class="app-page shift-form-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">${escapeHTML(config.eyebrow)}</p>
          <h1 class="page-hero-title">${escapeHTML(config.title)}</h1>
          <p class="page-hero-subtitle">${escapeHTML(config.subtitle)}</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ผู้บันทึก</span>
            <strong>${escapeHTML(reporter.reporterDisplay)}</strong>
          </div>
          <div class="page-hero-stat">
            <span>ปลายทาง</span>
            <strong>Google Sheets</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>ระบบจะเปิดให้บันทึกตามช่วงวันและเวลาที่ HR กำหนดในชีต Settings เท่านั้น</div>
      </div>

      <div class="shift-window-banner is-loading fade-in" id="${escapeAttr(fieldId(config.prefix, 'window-status'))}">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <div>กำลังตรวจสอบช่วงเวลาที่อนุญาต...</div>
      </div>

      <div class="form-card fade-in">
        <div class="form-header">
          <div class="form-header-copy">
            <div class="form-header-icon ops-header-icon ops-icon-ocean">
              <i class="fa-solid ${escapeAttr(config.icon)}"></i>
            </div>
            <div class="form-header-text">
              <h2>${escapeHTML(config.title)}</h2>
              <p>ค้นหาและเลือกพนักงานจากรายชื่อกลาง ระบบจะเติมรายละเอียดประกอบเพื่อช่วยลดการกรอกผิด</p>
            </div>
          </div>
          <div class="form-header-badge">
            <i class="fa-solid fa-file-lines"></i>
            ${escapeHTML(config.badge)}
          </div>
        </div>

        <form id="${escapeAttr(fieldId(config.prefix, 'form'))}" autocomplete="off">
          <div class="form-grid">
            ${formFields}
          </div>
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary">
              <i class="fa-solid fa-rotate-left"></i> ล้างฟอร์ม
            </button>
            <button type="submit" class="btn btn-primary" id="${escapeAttr(fieldId(config.prefix, 'submit'))}" disabled>
              <i class="fa-solid fa-floppy-disk"></i> ${escapeHTML(config.submitText)}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function setLoadingButton(config, loading) {
  const button = document.getElementById(fieldId(config.prefix, 'submit'));
  if (!button) return;
  button.dataset.loading = loading ? 'true' : 'false';
  button.innerHTML = loading
    ? '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'
    : `<i class="fa-solid fa-floppy-disk"></i> ${escapeHTML(config.submitText)}`;
}

function getInput(prefix, name) {
  return document.getElementById(fieldId(prefix, name));
}

function getValue(prefix, name) {
  return String(getInput(prefix, name)?.value || '').trim();
}

function findEmployeeByInput(value, employees) {
  const normalizedValue = String(value || '').trim();
  const idFromLabel = normalizedValue.split('|')[0]?.trim();
  return employees.find(employee => employee.employeeId === idFromLabel)
    || employees.find(employee => employeeOptionValue(employee) === normalizedValue)
    || null;
}

function populateEmployeeLists(config, employees) {
  ['primary', 'secondary', 'main'].forEach(role => {
    const list = document.getElementById(fieldId(config.prefix, `${role}-employee-list`));
    if (!list) return;
    list.innerHTML = employees
      .map(employee => `<option value="${escapeAttr(employeeOptionValue(employee))}"></option>`)
      .join('');
  });
}

function renderEmployeeSummary(config, state, role) {
  const summary = document.getElementById(fieldId(config.prefix, `${role}-employee-summary`));
  if (!summary) return;
  const employees = state.selectedEmployees?.[role] || [];

  if (employees.length === 0) {
    summary.className = 'shift-employee-summary is-empty';
    summary.textContent = 'ยังไม่ได้เลือกพนักงาน';
    return;
  }

  summary.className = 'shift-employee-summary';
  summary.innerHTML = `
    <div class="shift-employee-summary-head">
      <strong>เลือกแล้ว ${escapeHTML(String(employees.length))} คน</strong>
      <span>กด x เพื่อลบรายชื่อที่ไม่ต้องการ</span>
    </div>
    <div class="shift-employee-chip-list">
      ${employees.map(employee => `
        <button type="button" class="shift-employee-chip" data-role="${escapeAttr(role)}" data-employee-id="${escapeAttr(employee.employeeId)}" aria-label="ลบ ${escapeAttr(employee.displayName)}">
          <span>${escapeHTML(employee.employeeId)} | ${escapeHTML(employee.displayName)}</span>
          <small>${escapeHTML(employee.department)} / ${escapeHTML(employee.position)}</small>
          <i class="fa-solid fa-xmark"></i>
        </button>
      `).join('')}
    </div>
  `;
}

function bindEmployeePicker(config, state, role) {
  const input = document.getElementById(fieldId(config.prefix, `${role}-employee-search`));
  const addButton = document.getElementById(fieldId(config.prefix, `${role}-employee-add`));
  const summary = document.getElementById(fieldId(config.prefix, `${role}-employee-summary`));
  if (!input || !addButton || !summary) return;

  const addSelection = () => {
    const employee = findEmployeeByInput(input.value, state.employees);
    if (!employee) {
      showToast('กรุณาเลือกรายชื่อจากรายการที่ค้นหาได้', 'warning');
      markError(input, 'กรุณาเลือกรายชื่อจากรายการ');
      return;
    }

    const selected = state.selectedEmployees[role] || [];
    if (selected.some(item => item.employeeId === employee.employeeId)) {
      showToast('รายชื่อนี้ถูกเลือกไว้แล้ว', 'info');
      input.value = '';
      return;
    }

    state.selectedEmployees[role] = [...selected, employee];
    input.value = '';
    input.closest('.form-group')?.classList.remove('has-error');
    input.closest('.form-group')?.querySelector('.field-error')?.remove();
    renderEmployeeSummary(config, state, role);
  };

  addButton.addEventListener('click', addSelection);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSelection();
    }
  });
  input.addEventListener('change', () => {
    if (findEmployeeByInput(input.value, state.employees)) {
      addSelection();
    }
  });
  summary.addEventListener('click', event => {
    const chip = event.target.closest('.shift-employee-chip');
    if (!chip) return;
    const employeeId = chip.dataset.employeeId;
    state.selectedEmployees[role] = (state.selectedEmployees[role] || [])
      .filter(employee => employee.employeeId !== employeeId);
    renderEmployeeSummary(config, state, role);
  });
}

function getSelectedEmployees(state, role) {
  return state.selectedEmployees?.[role] || [];
}

function clearErrors(form) {
  form.querySelectorAll('.form-group.has-error').forEach(group => group.classList.remove('has-error'));
  form.querySelectorAll('.field-error').forEach(error => error.remove());
}

function markError(input, message) {
  const group = input?.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  if (!group.querySelector('.field-error')) {
    const error = document.createElement('span');
    error.className = 'field-error';
    error.textContent = message;
    group.appendChild(error);
  }
}

function requireField(config, name, label, errors) {
  const input = getInput(config.prefix, name);
  if (!input || !String(input.value || '').trim()) {
    errors.push(label);
    markError(input, `กรุณากรอก${label}`);
  }
}

function requireEmployees(config, state, role, label, errors) {
  const input = getInput(config.prefix, `${role}-employee-search`);
  const employees = getSelectedEmployees(state, role);
  if (employees.length === 0) {
    errors.push(label);
    markError(input, `กรุณาเลือก${label}อย่างน้อย 1 คน`);
  }
  return employees;
}

function employeeDisplayName(employee) {
  if (!employee) return '-';
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    || employee.displayName
    || '-';
}

function employeeFields(employee, prefix = '') {
  return {
    [`${prefix}EmployeeId`]: employee?.employeeId || '-',
    [`${prefix}EmployeeName`]: employee ? `${employee.employeeId} | ${employeeDisplayName(employee)}` : '-',
    [`${prefix}EmployeeDisplayName`]: employeeDisplayName(employee),
    [`${prefix}Section`]: employee?.section || '-',
    [`${prefix}Department`]: employee?.department || '-',
    [`${prefix}Unit`]: employee?.unit || '-',
    [`${prefix}Position`]: employee?.position || '-',
  };
}

function createSwapRecords(config, state) {
  const now = new Date();
  const reporter = getReporter();
  const primaryEmployees = getSelectedEmployees(state, 'primary');
  const baseId = makeId(config.idPrefix, now);

  return primaryEmployees.map((primaryEmployee, index) => {
    return {
      id: primaryEmployees.length > 1 ? `${baseId}-${String(index + 1).padStart(3, '0')}` : baseId,
      createdAt: dateToString(now),
      reporterId: reporter.reporterId,
      reporterName: reporter.reporterName,
      reporterDepartment: reporter.reporterDepartment,
      ...employeeFields(primaryEmployee, 'primary'),
      primaryWorkDate: getValue(config.prefix, 'primary-work-date'),
      primaryWorkEndDate: getValue(config.prefix, 'primary-work-end-date'),
      primaryShift: getValue(config.prefix, 'primary-shift'),
      primaryNewShift: getValue(config.prefix, 'primary-new-shift'),
      newShift: getValue(config.prefix, 'primary-new-shift'),
      ...employeeFields(null, 'secondary'),
      secondaryWorkDate: '-',
      secondaryShift: '-',
      reason: getValue(config.prefix, 'reason'),
      remark: getValue(config.prefix, 'remark') || '-',
      approverSignature: getValue(config.prefix, 'approver-signature'),
      source: 'web-client',
    };
  });
}

function createChangeRecords(config, state) {
  const now = new Date();
  const reporter = getReporter();
  const employees = getSelectedEmployees(state, 'main');
  const baseId = makeId(config.idPrefix, now);

  return employees.map((employee, index) => ({
    id: employees.length > 1 ? `${baseId}-${String(index + 1).padStart(3, '0')}` : baseId,
    createdAt: dateToString(now),
    reporterId: reporter.reporterId,
    reporterName: reporter.reporterName,
    reporterDepartment: reporter.reporterDepartment,
    employeeId: employee.employeeId,
    employeeName: employeeDisplayName(employee),
    section: employee.section,
    department: employee.department,
    unit: employee.unit,
    position: employee.position,
    workDate: getValue(config.prefix, 'work-date'),
    workEndDate: getValue(config.prefix, 'work-end-date'),
    oldShift: getValue(config.prefix, 'old-shift'),
    newShift: getValue(config.prefix, 'new-shift'),
    reason: getValue(config.prefix, 'reason'),
    remark: getValue(config.prefix, 'remark') || '-',
    approverSignature: getValue(config.prefix, 'approver-signature'),
    source: 'web-client',
  }));
}

function validateSwapForm(config, state, form) {
  clearErrors(form);
  const errors = [];
  const primary = requireEmployees(config, state, 'primary', 'พนักงาน', errors);

  requireField(config, 'primary-work-date', 'วันที่', errors);
  requireField(config, 'primary-work-end-date', 'ถึงวันที่', errors);
  requireField(config, 'primary-shift', 'เวรเดิม', errors);
  requireField(config, 'primary-new-shift', 'เวรใหม่', errors);
  requireField(config, 'reason', 'เหตุผล', errors);
  requireField(config, 'approver-signature', 'ลายเซ็นผู้อนุมัติ', errors);

  return errors;
}

function validateChangeForm(config, state, form) {
  clearErrors(form);
  const errors = [];
  requireEmployees(config, state, 'main', 'พนักงาน', errors);
  requireField(config, 'work-date', 'วันที่', errors);
  requireField(config, 'work-end-date', 'ถึงวันที่', errors);
  requireField(config, 'old-shift', 'เวรเดิม', errors);
  requireField(config, 'new-shift', 'เวรใหม่', errors);
  requireField(config, 'reason', 'เหตุผล', errors);
  requireField(config, 'approver-signature', 'ลายเซ็นผู้อนุมัติ', errors);
  return errors;
}

function buildConfirmMessage(kind, record) {
  if (kind === 'swap') {
    const records = Array.isArray(record) ? record : [record];
    return [
      `จำนวน ${records.length} รายการ`,
      records.slice(0, 5).map(item => {
        const pairText = item.secondaryEmployeeName && item.secondaryEmployeeName !== '-'
          ? ` ↔ ${item.secondaryEmployeeName}`
          : '';
        return `${item.primaryEmployeeName}${pairText}`;
      }).join('\n'),
      records.length > 5 ? `และอีก ${records.length - 5} รายการ` : '',
    ].filter(Boolean).join('\n');
  }

  const records = Array.isArray(record) ? record : [record];
  return [
    `จำนวน ${records.length} รายการ`,
    `จาก ${records[0]?.oldShift || '-'} เป็น ${records[0]?.newShift || '-'}`,
    records.slice(0, 5).map(item => item.employeeName).join(', '),
    records.length > 5 ? `และอีก ${records.length - 5} คน` : '',
  ].filter(Boolean).join('\n');
}

function updateWindowStatus(config, state) {
  const banner = document.getElementById(fieldId(config.prefix, 'window-status'));
  const button = document.getElementById(fieldId(config.prefix, 'submit'));
  const validation = validateHrShiftFormWindow(state.settings || undefined);

  if (banner) {
    banner.className = `shift-window-banner ${validation.allowed ? 'is-open' : 'is-closed'} fade-in`;
    banner.innerHTML = `
      <i class="fa-solid ${validation.allowed ? 'fa-unlock-keyhole' : 'fa-lock'}"></i>
      <div>
        <strong>${escapeHTML(validation.allowed ? 'เปิดรับบันทึกข้อมูล' : 'ปิดรับบันทึกข้อมูล')}</strong>
        <span>${escapeHTML(validation.allowed ? validation.message : validation.message)}</span>
      </div>
    `;
  }

  if (button) {
    const isLoading = button.dataset.loading === 'true';
    button.disabled = !validation.allowed || isLoading || state.loading || state.saving;
  }

  return validation;
}

function resetEmployeeSelections(config, state) {
  ['primary', 'secondary', 'main'].forEach(role => {
    const search = getInput(config.prefix, `${role}-employee-search`);
    if (search) search.value = '';
    if (state?.selectedEmployees) {
      state.selectedEmployees[role] = [];
    }
    renderEmployeeSummary(config, state || { selectedEmployees: { [role]: [] } }, role);
  });
}

function initDatePickers(config, kind) {
  const dateIds = kind === 'swap'
    ? ['primary-work-date', 'primary-work-end-date']
    : ['work-date', 'work-end-date'];

  return dateIds
    .map(name => {
      const selector = `#${fieldId(config.prefix, name)}`;
      const element = document.querySelector(selector);
      if (!element || typeof flatpickr !== 'function') return null;
      return flatpickr(selector, {
        dateFormat: 'd/m/Y',
        disableMobile: true,
        allowInput: false,
      });
    })
    .filter(Boolean);
}

function initSignaturePad(config, kind) {
  const canvas = document.getElementById(fieldId(config.prefix, 'approver-signature-canvas'));
  const hiddenInput = document.getElementById(fieldId(config.prefix, 'approver-signature'));
  const clearButton = document.getElementById(fieldId(config.prefix, 'approver-signature-clear'));
  if (!canvas || !hiddenInput) return null;

  const ctx = canvas.getContext('2d');
  const state = {
    strokes: [],
    drawing: false,
    width: 900,
    height: 180,
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.width = Math.max(320, Math.round(rect.width || 900));
    state.height = Math.max(160, Math.round(rect.height || 180));
    canvas.width = Math.round(state.width * dpr);
    canvas.height = Math.round(state.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function drawGuide() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(18, state.height - 34);
    ctx.lineTo(state.width - 18, state.height - 34);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStroke(points) {
    if (!Array.isArray(points) || points.length === 0) return;
    ctx.strokeStyle = SIGNATURE_STROKE_COLOR;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }

  function redraw() {
    drawGuide();
    state.strokes.forEach(drawStroke);
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || state.width;
    const displayHeight = rect.height || state.height;
    const rawX = Number.isFinite(event.offsetX) ? event.offsetX : event.clientX - rect.left;
    const rawY = Number.isFinite(event.offsetY) ? event.offsetY : event.clientY - rect.top;
    const x = rawX * (state.width / Math.max(1, displayWidth));
    const y = rawY * (state.height / Math.max(1, displayHeight));

    return {
      x: Math.max(0, Math.min(state.width, x)),
      y: Math.max(0, Math.min(state.height, y)),
    };
  }

  function exportSignature() {
    if (state.strokes.length === 0) {
      hiddenInput.value = '';
      return;
    }

    const pathData = state.strokes
      .map(points => {
        if (points.length === 1) {
          const point = points[0];
          return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}h0.1`;
        }
        return points.map((point, index) => {
          const command = index === 0 ? 'M' : 'L';
          return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        }).join('');
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.width} ${state.height}"><path d="${pathData}" fill="none" stroke="${SIGNATURE_STROKE_COLOR}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    hiddenInput.value = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    hiddenInput.closest('.form-group')?.classList.remove('has-error');
    hiddenInput.closest('.form-group')?.querySelector('.field-error')?.remove();
  }

  function startDrawing(event) {
    event.preventDefault();
    state.drawing = true;
    state.strokes.push([getPoint(event)]);
    canvas.setPointerCapture?.(event.pointerId);
    redraw();
  }

  function continueDrawing(event) {
    if (!state.drawing) return;
    event.preventDefault();
    const activeStroke = state.strokes[state.strokes.length - 1];
    activeStroke.push(getPoint(event));
    redraw();
  }

  function stopDrawing(event) {
    if (!state.drawing) return;
    event.preventDefault();
    state.drawing = false;
    canvas.releasePointerCapture?.(event.pointerId);
    exportSignature();
  }

  function clearSignature() {
    state.strokes = [];
    hiddenInput.value = '';
    redraw();
  }

  canvas.addEventListener('pointerdown', startDrawing);
  canvas.addEventListener('pointermove', continueDrawing);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);
  canvas.addEventListener('pointerleave', stopDrawing);
  clearButton?.addEventListener('click', clearSignature);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  return {
    clear: clearSignature,
  };
}

async function handleSubmit(kind, config, state, form) {
  state.loading = true;
  setLoadingButton(config, true);
  updateWindowStatus(config, state);

  try {
    state.settings = await loadHrShiftFormSettings({ allowDefaultFallback: false });
  } catch (error) {
    console.error('loadHrShiftFormSettings before submit failed:', error);
    showToast(`ไม่สามารถตรวจสอบช่วงเวลาจาก Settings ได้: ${error.message}`, 'error');
    state.loading = false;
    setLoadingButton(config, false);
    updateWindowStatus(config, state);
    return;
  }

  state.loading = false;
  setLoadingButton(config, false);
  const windowValidation = updateWindowStatus(config, state);
  if (!windowValidation.allowed) {
    showToast(windowValidation.message, 'warning');
    return;
  }

  const errors = kind === 'swap'
    ? validateSwapForm(config, state, form)
    : validateChangeForm(config, state, form);

  if (errors.length > 0) {
    showToast(`กรุณากรอกข้อมูลให้ครบ: ${errors.join(', ')}`, 'warning');
    form.querySelector('.form-group.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const payload = kind === 'swap'
    ? createSwapRecords(config, state)
    : createChangeRecords(config, state);
  const confirmed = await showConfirmModal(
    config.confirmTitle,
    buildConfirmMessage(kind, payload),
    config.icon,
    'บันทึก',
    'กลับไปแก้ไข'
  );

  if (!confirmed) return;

  state.saving = true;
  setLoadingButton(config, true);
  updateWindowStatus(config, state);

  try {
    if (Array.isArray(payload)) {
      for (const record of payload) {
        await appendHrShiftReport(kind, record);
      }
    } else {
      await appendHrShiftReport(kind, payload);
    }
    const countText = Array.isArray(payload) && payload.length > 1
      ? `${config.successText} (${payload.length} รายการ)`
      : config.successText;
    await showAlert('บันทึกสำเร็จ', countText, 'fa-circle-check');
    form.reset();
    resetEmployeeSelections(config, state);
    clearErrors(form);
  } catch (error) {
    console.error('appendHrShiftReport failed:', error);
    showToast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    state.saving = false;
    setLoadingButton(config, false);
    updateWindowStatus(config, state);
  }
}

function initShiftFormPage(kind) {
  const config = getConfig(kind);
  const form = document.getElementById(fieldId(config.prefix, 'form'));
  if (!form) return;

  const state = {
    employees: [],
    selectedEmployees: {
      primary: [],
      secondary: [],
      main: [],
    },
    settings: null,
    loading: true,
    saving: false,
  };
  const pickers = initDatePickers(config, kind);
  const signaturePad = initSignaturePad(config, kind);

  if (!window.__hrShiftFormWindowTimers) window.__hrShiftFormWindowTimers = {};
  if (window.__hrShiftFormWindowTimers[config.prefix]) {
    clearInterval(window.__hrShiftFormWindowTimers[config.prefix]);
  }
  window.__hrShiftFormWindowTimers[config.prefix] = setInterval(() => updateWindowStatus(config, state), 60_000);

  ['primary', 'secondary', 'main'].forEach(role => bindEmployeePicker(config, state, role));
  updateWindowStatus(config, state);

  Promise.allSettled([
    loadHrShiftEmployees(),
    loadHrShiftFormSettings(),
  ]).then(([employeeResult, settingsResult]) => {
    if (employeeResult.status === 'fulfilled') {
      state.employees = employeeResult.value.employees || [];
      populateEmployeeLists(config, state.employees);
      if (state.employees.length === 0) {
        showToast('ไม่พบรายชื่อพนักงาน active ในชีต Data', 'warning');
      }
    } else {
      console.error('loadHrShiftEmployees failed:', employeeResult.reason);
      showToast(`โหลดรายชื่อพนักงานไม่สำเร็จ: ${employeeResult.reason.message}`, 'error');
    }

    if (settingsResult.status === 'fulfilled') {
      state.settings = settingsResult.value;
    } else {
      console.warn('loadHrShiftFormSettings failed:', settingsResult.reason);
      state.settings = null;
    }
  }).finally(() => {
    state.loading = false;
    updateWindowStatus(config, state);
  });

  form.addEventListener('reset', () => {
    pickers.forEach(picker => picker.clear());
    signaturePad?.clear();
    setTimeout(() => {
      resetEmployeeSelections(config, state);
      clearErrors(form);
      updateWindowStatus(config, state);
    }, 0);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    handleSubmit(kind, config, state, form);
  });
}

export function renderShiftSwapPage() {
  return renderShiftFormPage('swap');
}

export function initShiftSwapPage() {
  initShiftFormPage('swap');
}

export function renderShiftChangePage() {
  return renderShiftFormPage('change');
}

export function initShiftChangePage() {
  initShiftFormPage('change');
}
