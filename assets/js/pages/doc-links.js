import { database, ref, get } from '../firebase.js';

export function createDocumentPage(config) {
  const state = {
    links: [],
    searchTerm: '',
  };

  const {
    prefix,
    path,
    title,
    subtitle,
    emptyMessage,
    errorMessage,
    icon = 'fa-folder-open',
    theme = 'green',
    totalLabel = 'ลิงก์ทั้งหมด',
    visibleLabel = 'รายการที่แสดง',
    searchLabel = 'ค้นหาเอกสาร',
    searchPlaceholder = 'ค้นหาชื่อเอกสาร รายละเอียด หรือ URL',
    loadingMessage = 'กำลังโหลดเอกสาร...',
    noSearchResultsMessage = 'ไม่พบเอกสารตามเงื่อนไขที่ค้นหา',
    heroEyebrow = 'Document Center',
    heroTitle = title,
    heroSubtitle = subtitle,
    heroMetaLabelOne = 'แหล่งข้อมูล',
    heroMetaValueOne = path,
    heroMetaLabelTwo = 'รูปแบบการใช้งาน',
    heroMetaValueTwo = 'เปิดลิงก์ภายนอกโดยตรง',
    noteTitle = 'คลังเอกสารกลาง',
    noteMessage = 'ค้นหาและเปิดลิงก์เอกสารที่ต้องใช้ได้จากหน้าเดียว โดยข้อมูลจะดึงจาก Firebase ตามหมวดที่กำหนด',
  } = config;

  function render() {
    return `
      <div class="app-page">
        <section class="page-hero page-hero-${theme === 'blue' ? 'hr' : 'eng'} fade-in">
          <div class="page-hero-copy">
            <p class="page-hero-eyebrow">${escapeHTML(heroEyebrow)}</p>
            <h1 class="page-hero-title">${escapeHTML(heroTitle)}</h1>
            <p class="page-hero-subtitle">${escapeHTML(heroSubtitle)}</p>
          </div>
          <div class="page-hero-meta">
            <div class="page-hero-stat">
              <span>${escapeHTML(heroMetaLabelOne)}</span>
              <strong>${escapeHTML(heroMetaValueOne)}</strong>
            </div>
            <div class="page-hero-stat">
              <span>${escapeHTML(heroMetaLabelTwo)}</span>
              <strong>${escapeHTML(heroMetaValueTwo)}</strong>
            </div>
          </div>
        </section>

        <div class="page-note fade-in">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>${escapeHTML(noteTitle)}</strong>
            ${escapeHTML(noteMessage)}
          </div>
        </div>

        <div class="form-card fade-in doc-links-page doc-links-${theme}">
          <div class="form-header">
            <div class="form-header-copy">
              <div class="form-header-icon doc-links-header-icon">
                <i class="fa-solid ${icon}"></i>
              </div>
              <div class="form-header-text">
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(subtitle)}</p>
              </div>
            </div>
            <div class="form-header-badge">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              เปิดลิงก์ภายนอกโดยตรง
            </div>
          </div>

          <div class="doc-links-summary">
            <div class="doc-links-stat">
              <span class="doc-links-stat-icon"><i class="fa-solid fa-link"></i></span>
              <div>
                <strong id="${prefix}-doc-total">0</strong>
                <span>${escapeHTML(totalLabel)}</span>
              </div>
            </div>
            <div class="doc-links-stat">
              <span class="doc-links-stat-icon"><i class="fa-solid fa-filter"></i></span>
              <div>
                <strong id="${prefix}-doc-visible-total">0</strong>
                <span>${escapeHTML(visibleLabel)}</span>
              </div>
            </div>
          </div>

          <div class="list-filter-bar doc-links-filter-bar">
            <div class="filter-group">
              <div class="filter-item doc-links-search">
                <label><i class="fa-solid fa-magnifying-glass"></i> ${escapeHTML(searchLabel)}</label>
                <input type="search" class="form-control" id="${prefix}-doc-search" placeholder="${escapeAttr(searchPlaceholder)}">
              </div>
            </div>
            <div class="filter-actions">
              <button type="button" class="btn btn-secondary" id="${prefix}-doc-refresh">
                <i class="fa-solid fa-rotate-right"></i> โหลดใหม่
              </button>
            </div>
          </div>

          <div id="${prefix}-doc-content" class="doc-links-content">
            <div class="table-loading">
              <i class="fa-solid fa-spinner fa-spin"></i>
              ${escapeHTML(loadingMessage)}
            </div>
          </div>
        </div>
      </div>`;
  }

  function init() {
    const searchInput = document.getElementById(`${prefix}-doc-search`);
    const refreshBtn = document.getElementById(`${prefix}-doc-refresh`);

    searchInput?.addEventListener('input', (e) => {
      state.searchTerm = e.target.value.trim().toLowerCase();
      renderDocumentList();
    });

    refreshBtn?.addEventListener('click', loadDocuments);

    loadDocuments();
  }

  async function loadDocuments() {
    const content = document.getElementById(`${prefix}-doc-content`);
    const refreshBtn = document.getElementById(`${prefix}-doc-refresh`);

    if (content) {
      content.innerHTML = `
        <div class="table-loading">
          <i class="fa-solid fa-spinner fa-spin"></i>
          ${escapeHTML(loadingMessage)}
        </div>`;
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด';
    }

    try {
      const snapshot = await get(ref(database, path));
      state.links = snapshot.exists() ? normalizeDocumentLinks(snapshot.val()) : [];
      renderDocumentList();
    } catch (error) {
      console.error(`Error loading ${path} documents:`, error);
      if (content) {
        content.innerHTML = `
          <div class="table-empty table-error">
            <i class="fa-solid fa-circle-exclamation"></i>
            ${escapeHTML(errorMessage)}
          </div>`;
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> โหลดใหม่';
      }
    }
  }

  function renderDocumentList() {
    const content = document.getElementById(`${prefix}-doc-content`);
    if (!content) return;

    const filtered = state.links.filter(item => {
      const keyword = `${item.title} ${item.description || ''} ${item.url}`.toLowerCase();
      const passSearch = !state.searchTerm || keyword.includes(state.searchTerm);
      return passSearch;
    });

    updateSummary(filtered.length);

    if (state.links.length === 0) {
      content.innerHTML = `
        <div class="table-empty">
          <i class="fa-solid fa-folder-open"></i>
          ${escapeHTML(emptyMessage)}
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      content.innerHTML = `
        <div class="table-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          ${escapeHTML(noSearchResultsMessage)}
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="doc-links-grid">
        ${filtered.map(renderDocumentCard).join('')}
      </div>`;
  }

  function updateSummary(visibleCount) {
    setText(`${prefix}-doc-total`, state.links.length);
    setText(`${prefix}-doc-visible-total`, visibleCount);
  }

  return { render, init };
}

function normalizeDocumentLinks(data) {
  const links = [];
  const seen = new Set();

  walkChoiceNode(data, [], links, seen);

  return links.sort((a, b) => a.title.localeCompare(b.title, 'th'));
}

function walkChoiceNode(value, path, links, seen) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkChoiceNode(item, [...path, String(index + 1)], links, seen));
    return;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    const urlEntry = entries.find(([key, val]) => isUrlField(key) && isHttpUrl(val));

    if (urlEntry) {
      addDocumentLink(value, urlEntry[1], path, links, seen);
    }

    entries.forEach(([key, val]) => {
      if (key === urlEntry?.[0]) return;
      if (val && typeof val === 'object') {
        walkChoiceNode(val, [...path, key], links, seen);
      } else if (isHttpUrl(val)) {
        addDocumentLink({}, val, [...path, key], links, seen);
      }
    });
    return;
  }

  if (isHttpUrl(value)) {
    addDocumentLink({}, value, path, links, seen);
  }
}

function addDocumentLink(meta, url, path, links, seen) {
  const cleanUrl = String(url).trim();
  const uniqueKey = `${path.join('/')}:${cleanUrl}`;

  if (seen.has(uniqueKey)) return;
  seen.add(uniqueKey);

  const title = pickText(meta, ['title', 'name', 'label', 'text', 'document', 'docName', 'หัวข้อ', 'ชื่อ']) ||
    cleanPathLabel(path[path.length - 1]) ||
    cleanFileName(cleanUrl);

  links.push({
    id: uniqueKey,
    title,
    description: pickText(meta, ['description', 'desc', 'detail', 'remark', 'note', 'รายละเอียด', 'หมายเหตุ']),
    url: cleanUrl,
    type: getLinkType(cleanUrl, pickText(meta, ['fileType', 'extension', 'ชนิดไฟล์'])),
  });
}

function renderDocumentCard(item) {
  return `
    <a class="doc-links-card" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(item.url)}">
      <div class="doc-links-card-icon">
        <i class="fa-solid ${getTypeIcon(item.type)}"></i>
      </div>
      <div class="doc-links-card-body">
        <div class="doc-links-card-top">
          <span class="doc-links-type">${escapeHTML(item.type)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
        <span class="doc-links-url">${escapeHTML(shortenUrl(item.url))}</span>
      </div>
      <i class="fa-solid fa-arrow-up-right-from-square doc-links-open"></i>
    </a>`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function isUrlField(key) {
  return ['url', 'link', 'href', 'file', 'fileurl', 'docurl', 'documenturl', 'downloadurl'].includes(String(key).toLowerCase());
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+/i.test(value.trim());
}

function pickText(meta, keys) {
  if (!meta || typeof meta !== 'object') return '';
  const normalizedKeys = keys.map(k => k.toLowerCase());
  const found = Object.entries(meta).find(([key, value]) => (
    normalizedKeys.includes(String(key).toLowerCase()) &&
    typeof value === 'string' &&
    value.trim() &&
    !isHttpUrl(value)
  ));
  return found ? found[1].trim() : '';
}

function cleanPathLabel(value) {
  if (!value || /^\d+$/.test(String(value))) return '';
  return String(value).replace(/[_-]+/g, ' ').trim();
}

function cleanFileName(url) {
  try {
    const pathname = new URL(url).pathname;
    const file = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'เอกสาร');
    return file.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
  } catch {
    return 'เอกสาร';
  }
}

function getLinkType(url, explicitType = '') {
  const type = explicitType.trim().toUpperCase();
  if (type) return type;

  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.pdf')) return 'PDF';
  if (cleanUrl.endsWith('.xlsx') || cleanUrl.endsWith('.xls')) return 'Excel';
  if (cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc')) return 'Word';
  if (cleanUrl.endsWith('.pptx') || cleanUrl.endsWith('.ppt')) return 'PowerPoint';
  if (cleanUrl.includes('docs.google.com/spreadsheets')) return 'Sheet';
  if (cleanUrl.includes('docs.google.com/document')) return 'Doc';
  if (cleanUrl.includes('docs.google.com/presentation')) return 'Slide';
  if (cleanUrl.includes('drive.google.com')) return 'Drive';
  return 'Link';
}

function getTypeIcon(type) {
  const normalized = type.toLowerCase();
  if (normalized === 'pdf') return 'fa-file-pdf';
  if (normalized === 'excel' || normalized === 'sheet') return 'fa-file-excel';
  if (normalized === 'word' || normalized === 'doc') return 'fa-file-word';
  if (normalized === 'powerpoint' || normalized === 'slide') return 'fa-file-powerpoint';
  if (normalized === 'drive') return 'fa-google-drive';
  return 'fa-link';
}

function shortenUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHTML(value);
}
