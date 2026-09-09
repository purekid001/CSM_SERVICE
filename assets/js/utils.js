/**
 * Shared Utility Functions
 * Centralized helpers for Badges, Dates, and Pagination
 */

// ==========================================
// 1. Engineering Step Badges
// ==========================================
export function getEngStepText(step) {
  const map = {
    '1': 'รอหัวหน้าอนุมัติ',
    '2': 'รอช่างอนุมัติ',
    '3': 'กำลังซ่อม',
    '4': 'ซ่อมเสร็จแล้ว',
    '5': 'รอการประเมิณความเรียบร้อย',
    '6': 'ยกเลิก'
  };
  return map[String(step)] || `Step ${step}`;
}

export function getEngStepBadge(step) {
  const map = {
    '1': { label: 'รอหัวหน้าอนุมัติ', css: 'badge-warning' },
    '2': { label: 'รอช่างอนุมัติ', css: 'badge-info' },
    '3': { label: 'กำลังซ่อม', css: 'badge-primary' },
    '4': { label: 'ซ่อมเสร็จแล้ว', css: 'badge-success' },
    '5': { label: 'รอการประเมิณความเรียบร้อย', css: 'badge-purple' },
    '6': { label: 'ยกเลิก', css: 'badge-danger' },
  };
  const s = map[String(step)] || { label: `Step ${step}`, css: 'badge-default' };
  return `<span class="badge-status ${s.css}">${escapeHTML(s.label)}</span>`;
}

// ==========================================
// 2. HR (Booking) Step Badges
// ==========================================
export function getHrStepText(step) {
  const map = {
    '1': 'รอหัวหน้าอนุมัติ',
    '2': 'รอทีมจัดรถอนุมัติ',
    '3': 'ทีมจัดรถอนุมัติแล้ว',
    '4': 'ปิดงานแล้ว',
    '5': 'ยกเลิก'
  };
  return map[String(step)] || 'ไม่ทราบสถานะ';
}

export function getHrStepBadge(step) {
  const map = {
    '1': { label: 'รอหัวหน้าอนุมัติ', css: 'badge-warning' },
    '2': { label: 'รอทีมจัดรถอนุมัติ', css: 'badge-info' },
    '3': { label: 'ทีมจัดรถอนุมัติแล้ว', css: 'badge-primary' },
    '4': { label: 'ปิดงานแล้ว', css: 'badge-success' },
    '5': { label: 'ยกเลิก', css: 'badge-danger' }
  };
  const s = map[String(step)] || { label: `Status ${step}`, css: 'badge-default' };
  return `<span class="badge-status ${s.css}">${escapeHTML(s.label)}</span>`;
}

// ==========================================
// 3. Date Parsing & Formatting
// ==========================================

// Parse "dd/MM/yyyy" or "dd/MM/yyyy HH:mm:ss" -> Date object
export function parseDMY(str) {
  if (!str || str === '-') return null;
  const dateOnly = str.split(' ')[0];
  const p = dateOnly.split('/');
  if (p.length < 3) return null;
  return new Date(p[2], p[1] - 1, p[0]);
}

// Format Date object -> "dd/MM/yyyy"
export function formatDate(d) {
  if (!d) return '-';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Format Date object -> "dd/MM/yyyy HH:mm:ss"
export function dateToString(d) {
  if (!d) return '-';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Parse "dd/MM/yyyy HH:mm:ss" -> timestamp (milliseconds)
export function parseDateTime(str) {
  if (!str || str === '-') return 0;
  const parts = str.split(' ');
  if (parts.length < 2) return 0;
  const [d, m, y] = parts[0].split('/');
  const [hh, mm, ss] = parts[1].split(':');
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0).getTime();
}

// ==========================================
// 4. Security / Access Helpers
// ==========================================

export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeAttr(value) {
  return escapeHTML(value);
}

export function sanitizeUrl(value, fallback = '#') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch (error) {
    // Fall through to safe fallback for malformed or unsupported URLs.
  }

  return fallback;
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeDepartment(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

export function isActiveUserRecord(value) {
  const normalized = normalizeText(value);
  return normalized === 'true';
}

export function getApproversByDepartment(allUsers, department, scope = 'engineering') {
  const normalizedDepartment = normalizeDepartment(department);
  if (!allUsers || typeof allUsers !== 'object' || !normalizedDepartment) return [];

  const scopeKey = scope === 'hr' ? 'level_Hr' : 'level';
  const allowedLevels = scope === 'hr'
    ? new Set(['1', 'admin', 'admin_hr'])
    : new Set(['1', 'admin', 'admin_en']);

  return Object.entries(allUsers)
    .filter(([id, user]) => {
      if (!user || typeof user !== 'object') return false;

      const userDepartment = normalizeDepartment(user.department);
      const userLevel = normalizeText(user[scopeKey]);

      return userDepartment === normalizedDepartment
        && isActiveUserRecord(user.active)
        && allowedLevels.has(userLevel);
    })
    .sort(([, userA], [, userB]) => {
      const nameA = `${userA?.firstname || ''} ${userA?.lastname || ''}`.trim();
      const nameB = `${userB?.firstname || ''} ${userB?.lastname || ''}`.trim();
      return nameA.localeCompare(nameB, 'th');
    });
}

export function getUserAccessProfile() {
  const levelEn = String(sessionStorage.getItem('empLevel_en') || '').trim().toLowerCase();
  const levelHr = String(sessionStorage.getItem('empLevel_hr') || sessionStorage.getItem('level_Hr') || '').trim().toLowerCase();
  const levelIt = String(sessionStorage.getItem('empLevel_it') || sessionStorage.getItem('level_It') || '').trim().toLowerCase();

  return {
    isLoggedIn: sessionStorage.getItem('isLoggedIn') === 'true',
    levelEn,
    levelHr,
    levelIt,
    isEngineeringAdmin: levelEn === 'admin' || levelEn === 'admin_en',
    isEngineeringDocAdmin: levelEn === 'admin' || levelEn === 'admin_en',
    isHrDocAdmin: levelHr === 'admin' || levelHr === 'admin_hr',
    isHrDispatchAdmin: levelHr === 'admin' || levelHr === 'admin_hr' || levelHr === '1',
    isItAdmin: levelIt === 'admin' || levelIt === 'admin_it',
    isSystemAdmin: levelEn === 'admin' || levelHr === 'admin',
  };
}

export function canAccessPage(page) {
  const access = getUserAccessProfile();
  if (!access.isLoggedIn) return false;

  switch (page) {
    case 'eng-auto-close':
      return access.isSystemAdmin;
    case 'eng-doc':
      return access.isEngineeringDocAdmin;
    case 'hr-doc':
      return access.isHrDocAdmin;
    case 'hr-evaluation-report':
      return true;
    case 'hr-shuttle-group':
      return access.isHrDispatchAdmin;
    case 'admin-access':
    case 'admin-backup':
      return access.isSystemAdmin;
    default:
      return true;
  }
}

// ==========================================
// 5. Pagination Helpers
// ==========================================

// Generate array of page numbers with '...' for large lists
export function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

// Build HTML for the pagination bar
export function buildPaginationHTML(currentPg, totalPages, totalItems, rowsPerPage) {
  if (totalPages <= 1) return '';
  let html = '<div class="page-group">';
  
  html += `<button class="page-btn page-nav ${currentPg === 1 ? 'disabled' : ''}" data-page="prev" ${currentPg === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  
  getPageNumbers(currentPg, totalPages).forEach(p => {
    if (p === '...') html += '<span class="page-dots">···</span>';
    else html += `<button class="page-btn ${p === currentPg ? 'active' : ''}" data-page="${p}">${p}</button>`;
  });
  
  html += `<button class="page-btn page-nav ${currentPg === totalPages ? 'disabled' : ''}" data-page="next" ${currentPg === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  html += '</div>';
  
  const startRow = (currentPg - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPg * rowsPerPage, totalItems);
  html += `<span class="page-info">${startRow}–${endRow} จาก ${totalItems} รายการ</span>`;
  
  return html;
}

// Attach click events to pagination buttons
export function bindPaginationEvents(bar, scrollTarget, getPage, setPage, renderFn) {
  if (!bar) return;
  bar.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.page;
      if (val === 'prev') setPage(getPage() - 1);
      else if (val === 'next') setPage(getPage() + 1);
      else setPage(parseInt(val));
      
      renderFn();
      
      const target = document.getElementById(scrollTarget);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
