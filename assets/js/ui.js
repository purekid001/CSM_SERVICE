/**
 * UI Components (Standardized Modals & Toasts)
 */

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeIcon(icon, fallback = 'fa-circle-info') {
  return /^[a-z0-9- ]+$/i.test(String(icon || '').trim()) ? String(icon).trim() : fallback;
}

/**
 * --- ฟังก์ชันสลับการแสดงผล Dropdown (Sidebar) ---
 */
window.toggleDropdown = (btn) => {
  const parent = btn.parentElement;
  const isShow = parent.classList.contains('show');
  
  // 1. ปิดตัวอื่นก่อน (Accordion Effect)
  document.querySelectorAll('.dropdown-group').forEach(item => {
    item.classList.remove('show');
  });

  // 2. ถ้าตัวที่กดไม่ได้เปิดอยู่ → ให้เปิด
  if (!isShow) {
    parent.classList.add('show');
  }
};

const mobileMenuMedia = window.matchMedia('(max-width: 768px)');
const dashboardLayout = document.getElementById('dashboard-layout');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');
const appSidebar = document.getElementById('app-sidebar');
const sidebarMenu = document.querySelector('.sidebar-menu');

function setMobileMenuOpen(isOpen, { restoreFocus = false } = {}) {
  if (!dashboardLayout || !mobileMenuToggle || !appSidebar) return;

  const shouldOpen = mobileMenuMedia.matches && Boolean(isOpen);
  dashboardLayout.classList.toggle('mobile-menu-open', shouldOpen);
  mobileMenuToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  mobileMenuToggle.setAttribute('aria-label', shouldOpen ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก');

  if (mobileMenuMedia.matches) {
    appSidebar.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  } else {
    appSidebar.removeAttribute('aria-hidden');
  }

  if (!shouldOpen && restoreFocus && mobileMenuMedia.matches) {
    mobileMenuToggle.focus();
  }
}

window.toggleMobileMenu = () => {
  const isOpen = dashboardLayout?.classList.contains('mobile-menu-open');
  setMobileMenuOpen(!isOpen);
};

window.closeMobileMenu = (restoreFocus = false) => {
  setMobileMenuOpen(false, { restoreFocus });
};

mobileMenuToggle?.addEventListener('click', window.toggleMobileMenu);
mobileSidebarBackdrop?.addEventListener('click', () => window.closeMobileMenu(true));

sidebarMenu?.addEventListener('click', (event) => {
  const menuItem = event.target.closest('.menu-item');
  if (!menuItem || menuItem.classList.contains('dropdown-btn')) return;
  window.closeMobileMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dashboardLayout?.classList.contains('mobile-menu-open')) {
    window.closeMobileMenu(true);
  }
});

const syncMobileMenuState = () => {
  if (!mobileMenuMedia.matches) {
    setMobileMenuOpen(false);
    return;
  }

  const isOpen = dashboardLayout?.classList.contains('mobile-menu-open');
  setMobileMenuOpen(isOpen);
};

if (typeof mobileMenuMedia.addEventListener === 'function') {
  mobileMenuMedia.addEventListener('change', syncMobileMenuState);
} else {
  mobileMenuMedia.addListener(syncMobileMenuState);
}

syncMobileMenuState();


/**
 * Global Confirm Modal (Standardized Ocean Design)
 */
export function showConfirmModal(title, message, icon = 'fa-paper-plane', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const safeIcon = sanitizeIcon(icon, 'fa-paper-plane');
    
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-icon" style="background: linear-gradient(135deg, var(--ocean-start), var(--ocean-end)); color: white; border: none;">
          <i class="fa-solid ${safeIcon}"></i>
        </div>
        <h3 class="modal-title">${escapeHTML(title)}</h3>
        <p class="modal-message">${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" id="global-modal-cancel">${escapeHTML(cancelText)}</button>
          <button class="modal-btn modal-btn-primary" id="global-modal-confirm">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const closeOverlay = (result) => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
      resolve(result);
    };

    overlay.querySelector('#global-modal-confirm').addEventListener('click', () => closeOverlay(true));
    overlay.querySelector('#global-modal-cancel').addEventListener('click', () => closeOverlay(false));
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeOverlay(false); });
  });
}

export function showRichConfirmModal(title, html, icon = 'fa-paper-plane', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const safeIcon = sanitizeIcon(icon, 'fa-paper-plane');

    overlay.innerHTML = `
      <div class="modal-card modal-card-rich">
        <div class="modal-icon" style="background: linear-gradient(135deg, var(--ocean-start), var(--ocean-end)); color: white; border: none;">
          <i class="fa-solid ${safeIcon}"></i>
        </div>
        <h3 class="modal-title">${escapeHTML(title)}</h3>
        <div class="modal-rich-content">${html}</div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" id="global-rich-modal-cancel">${escapeHTML(cancelText)}</button>
          <button class="modal-btn modal-btn-primary" id="global-rich-modal-confirm">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const closeOverlay = (result) => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
      resolve(result);
    };

    overlay.querySelector('#global-rich-modal-confirm').addEventListener('click', () => closeOverlay(true));
    overlay.querySelector('#global-rich-modal-cancel').addEventListener('click', () => closeOverlay(false));
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeOverlay(false); });
  });
}

/**
 * Global Alert Modal (Standardized Ocean Design)
 */
export function showAlert(title, message, icon = 'fa-circle-info', btnText = 'ตกลง') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const safeIcon = sanitizeIcon(icon, 'fa-circle-info');

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-icon" style="background: linear-gradient(135deg, var(--ocean-start), var(--ocean-end)); color: white; border: none;">
          <i class="fa-solid ${safeIcon}"></i>
        </div>
        <h3 class="modal-title">${escapeHTML(title)}</h3>
        <p class="modal-message">${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-primary" id="global-alert-ok" style="width: 100%;">${escapeHTML(btnText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
      resolve();
    };

    overlay.querySelector('#global-alert-ok').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeOverlay(); });
  });
}

/**
 * Global Toast Notification (Standardized Design)
 */
export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
  };
  const safeType = Object.prototype.hasOwnProperty.call(icons, type) ? type : 'info';

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${safeType}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[safeType] || icons.info}"></i>
    <span>${escapeHTML(message)}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

// Attach to window for global access (Compatibility for older code)
window.showConfirmModal = showConfirmModal;
window.showRichConfirmModal = showRichConfirmModal;
window.showAlert = showAlert;
window.showToast = showToast;

/**
 * --- ฟังก์ชันสลับเปิด/ปิดคลื่นพื้นหลัง ---
 */
window.toggleWaves = () => {
  const waves = document.querySelector('.waves-container');
  const btn = document.querySelector('#toggle-waves-btn');
  if (!waves) return;
  
  if (waves.style.display === 'none') {
    waves.style.display = 'block';
    localStorage.setItem('csm_waves_disabled', 'false');
    if (btn) {
      btn.style.color = 'var(--neutral-400)';
    }
    showToast('เปิดคลื่นพื้นหลังแล้ว', 'success');
  } else {
    waves.style.display = 'none';
    localStorage.setItem('csm_waves_disabled', 'true');
    if (btn) {
      btn.style.color = '#ef4444'; // สีแดงเมื่อปิด
    }
    showToast('ปิดคลื่นพื้นหลังแล้ว', 'info');
  }
};

// เช็คสถานะการปิด/เปิดคลื่นเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('csm_waves_disabled') === 'true') {
    const waves = document.querySelector('.waves-container');
    const btn = document.querySelector('#toggle-waves-btn');
    if (waves) waves.style.display = 'none';
    if (btn) btn.style.color = '#ef4444';
  }
});
