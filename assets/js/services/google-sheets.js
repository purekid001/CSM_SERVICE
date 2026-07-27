const GOOGLE_API_SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const RESULT_MAX_SCORE_PER_ITEM = 5;
const RESULT_SECTION_BREAKPOINT = 3;
const LABOUR_GRIEVANCE_HEADERS = [
  'วันที่และเวลาที่ส่ง',
  'การเปิดเผยตัวตน',
  'ชื่อ-นามสกุล',
  'แผนก',
  'เบอร์โทร',
  'ประเภทปัญหา',
  'ปัญหาอื่น ๆ',
  'วันที่เกิดเหตุ',
  'สถานที่',
  'รายละเอียดเหตุการณ์',
  'บุคคลที่เกี่ยวข้อง',
  'ต้องการให้บริษัทดำเนินการอย่างไร',
  'ยืนยันข้อมูลเป็นความจริง',
];

const tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

const metadataCache = new Map();

function getSheetConfig(key) {
  const maps = {
    evaluatorCodes: {
      id: import.meta.env.VITE_HR_EVALUATION_CODE_SHEET_ID || import.meta.env.VITE_HR_EVALUATION_SHEET_ID,
      gid: import.meta.env.VITE_HR_EVALUATION_CODE_SHEET_GID || import.meta.env.VITE_HR_EVALUATION_SHEET_GID || '0',
      sourceUrl: import.meta.env.VITE_HR_EVALUATION_CODE_SHEET_SOURCE_URL || import.meta.env.VITE_HR_EVALUATION_SHEET_SOURCE_URL,
      label: 'รหัสผู้ประเมิน',
    },
    employees: {
      id: import.meta.env.VITE_HR_EVALUATION_EMPLOYEE_SHEET_ID,
      gid: import.meta.env.VITE_HR_EVALUATION_EMPLOYEE_SHEET_GID || '0',
      sourceUrl: import.meta.env.VITE_HR_EVALUATION_EMPLOYEE_SHEET_SOURCE_URL,
      label: 'รายชื่อผู้ถูกประเมิน',
    },
    topics: {
      id: import.meta.env.VITE_HR_EVALUATION_TOPIC_SHEET_ID,
      gid: import.meta.env.VITE_HR_EVALUATION_TOPIC_SHEET_GID || '0',
      sourceUrl: import.meta.env.VITE_HR_EVALUATION_TOPIC_SHEET_SOURCE_URL,
      label: 'หัวข้อการประเมิน',
    },
    weights: {
      id: import.meta.env.VITE_HR_EVALUATION_WEIGHT_SHEET_ID,
      gid: import.meta.env.VITE_HR_EVALUATION_WEIGHT_SHEET_GID || '0',
      sourceUrl: import.meta.env.VITE_HR_EVALUATION_WEIGHT_SHEET_SOURCE_URL,
      label: 'น้ำหนักการประเมิน',
    },
    results: {
      id: import.meta.env.VITE_HR_EVALUATION_RESULT_SHEET_ID,
      gid: import.meta.env.VITE_HR_EVALUATION_RESULT_SHEET_GID || '0',
      sourceUrl: import.meta.env.VITE_HR_EVALUATION_RESULT_SHEET_SOURCE_URL,
      label: 'ผลการประเมิน',
    },
    userDirectory: {
      id: import.meta.env.VITE_USER_DIRECTORY_SHEET_ID,
      gid: import.meta.env.VITE_USER_DIRECTORY_SHEET_GID,
      sourceUrl: import.meta.env.VITE_USER_DIRECTORY_SHEET_SOURCE_URL,
      label: 'ข้อมูลผู้ใช้งาน',
    },
    shiftEmployees: {
      id: import.meta.env.VITE_HR_SHIFT_EMPLOYEE_SHEET_ID,
      gid: import.meta.env.VITE_HR_SHIFT_EMPLOYEE_SHEET_GID,
      sheetName: import.meta.env.VITE_HR_SHIFT_EMPLOYEE_SHEET_NAME || 'Data',
      settingsSheetName: import.meta.env.VITE_HR_SHIFT_SETTINGS_SHEET_NAME || 'Settings',
      sourceUrl: import.meta.env.VITE_HR_SHIFT_EMPLOYEE_SHEET_SOURCE_URL,
      label: 'รายชื่อพนักงาน',
    },
    shiftSwapReport: {
      id: import.meta.env.VITE_HR_SHIFT_SWAP_REPORT_SHEET_ID,
      gid: import.meta.env.VITE_HR_SHIFT_SWAP_REPORT_SHEET_GID,
      sheetName: import.meta.env.VITE_HR_SHIFT_SWAP_REPORT_SHEET_NAME || 'Data',
      sourceUrl: import.meta.env.VITE_HR_SHIFT_SWAP_REPORT_SHEET_SOURCE_URL,
      label: 'รายงานเปลี่ยนแลกเวร',
    },
    shiftChangeReport: {
      id: import.meta.env.VITE_HR_SHIFT_CHANGE_REPORT_SHEET_ID,
      gid: import.meta.env.VITE_HR_SHIFT_CHANGE_REPORT_SHEET_GID,
      sheetName: import.meta.env.VITE_HR_SHIFT_CHANGE_REPORT_SHEET_NAME || 'Data',
      sourceUrl: import.meta.env.VITE_HR_SHIFT_CHANGE_REPORT_SHEET_SOURCE_URL,
      label: 'รายงานเปลี่ยนกะงาน',
    },
    labourGrievance: {
      id: import.meta.env.VITE_LABOUR_GRIEVANCE_SHEET_ID,
      gid: import.meta.env.VITE_LABOUR_GRIEVANCE_SHEET_GID,
      sourceUrl: import.meta.env.VITE_LABOUR_GRIEVANCE_SHEET_SOURCE_URL,
      label: 'แบบฟอร์มแจ้งปัญหาด้านแรงงาน',
    },
  };

  const config = maps[key];
  if (!config) {
    throw new Error(`ไม่รู้จัก config ของชีต ${key}`);
  }

  const spreadsheetId = String(config.id || '').trim();
  const sheetGid = String(config.gid || '0').trim() || '0';
  const sourceUrl = String(
    config.sourceUrl || (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetGid}` : '')
  ).trim();

  if (!spreadsheetId) {
    throw new Error(`ยังไม่ได้ตั้งค่า Sheet: ${config.label}`);
  }

  return {
    spreadsheetId,
    sheetGid,
    sheetName: String(config.sheetName || '').trim(),
    settingsSheetName: String(config.settingsSheetName || '').trim(),
    sourceUrl,
    label: config.label,
  };
}

function parseGvizResponse(text) {
  const payloadStart = text.indexOf('(');
  const payloadEnd = text.lastIndexOf(');');

  if (payloadStart === -1 || payloadEnd === -1) {
    throw new Error('รูปแบบข้อมูลจาก Google Sheet ไม่ถูกต้อง');
  }

  return JSON.parse(text.slice(payloadStart + 1, payloadEnd));
}

function readCellValue(cell) {
  if (!cell) return '';
  if (typeof cell.v === 'boolean' || typeof cell.v === 'number') return cell.v;
  if (cell.v == null) return '';
  return String(cell.f ?? cell.v ?? '').trim();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeKey(value);
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(normalized) ? normalized : fallback;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function base64UrlEncodeBytes(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

let jsrsasignLoadingPromise = null;

function loadJsrsasign() {
  if (window.KJUR) return Promise.resolve();
  if (jsrsasignLoadingPromise) return jsrsasignLoadingPromise;

  jsrsasignLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/10.9.0/jsrsasign-all-min.js';
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      jsrsasignLoadingPromise = null;
      reject(new Error('ไม่สามารถโหลด jsrsasign จาก CDN ได้: ' + err.message));
    };
    document.head.appendChild(script);
  });

  return jsrsasignLoadingPromise;
}

async function signJwt(unsignedToken, privateKeyPem) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    await loadJsrsasign();
    const sig = new window.KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    sig.init(privateKeyPem);
    sig.updateString(unsignedToken);
    const sigHex = sig.sign();
    const bytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return base64UrlEncodeBytes(bytes);
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return base64UrlEncodeBytes(signature);
}

async function getGoogleAccessToken() {
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const clientEmail = normalizeText(import.meta.env.VITE_GOOGLE_CLIENT_EMAIL || import.meta.env.VITE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(import.meta.env.VITE_GOOGLE_SHEET_API_KEY || import.meta.env.VITE_GOOGLE_PRIVATE_KEY);
  const tokenUri = normalizeText(import.meta.env.VITE_TOKEN_URI || 'https://oauth2.googleapis.com/token');

  if (!clientEmail || !privateKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Google Service Account สำหรับการบันทึกผลประเมิน');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtClaim = {
    iss: clientEmail,
    scope: GOOGLE_API_SCOPE,
    aud: tokenUri,
    exp: expiresAt,
    iat: issuedAt,
  };

  const unsignedToken = `${base64UrlEncodeText(JSON.stringify(jwtHeader))}.${base64UrlEncodeText(JSON.stringify(jwtClaim))}`;
  const signedToken = `${unsignedToken}.${await signJwt(unsignedToken, privateKey)}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedToken,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ขอ access token จาก Google ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  const payload = await response.json();
  tokenCache.accessToken = payload.access_token;
  tokenCache.expiresAt = Date.now() + (Number(payload.expires_in || 3600) * 1000);
  return tokenCache.accessToken;
}

async function fetchGvizSheet(key) {
  const { spreadsheetId, sheetGid, sourceUrl } = getSheetConfig(key);
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(sheetGid)}&cb=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`โหลดข้อมูลจากชีต ${key} ไม่สำเร็จ (${response.status})`);
  }

  const payload = parseGvizResponse(await response.text());
  if (payload.status !== 'ok' || !payload.table) {
    throw new Error(`Google Sheet (${key}) ตอบกลับไม่สำเร็จ`);
  }

  const columns = Array.isArray(payload.table.cols)
    ? payload.table.cols.map(col => normalizeText(col?.label ?? col?.id ?? ''))
    : [];
  const rows = Array.isArray(payload.table.rows)
    ? payload.table.rows.map(row => Array.isArray(row?.c) ? row.c.map(readCellValue) : [])
    : [];

  return {
    sourceUrl,
    spreadsheetId,
    sheetGid,
    columns,
    rows,
  };
}

async function fetchGvizSheetByTabName(spreadsheetId, sheetName) {
  const normalizedSpreadsheetId = normalizeText(spreadsheetId);
  const normalizedSheetName = normalizeText(sheetName);

  if (!normalizedSpreadsheetId || !normalizedSheetName) {
    throw new Error('ยังระบุ spreadsheet หรือชื่อแท็บไม่ครบสำหรับการโหลด settings');
  }

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(normalizedSpreadsheetId)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(normalizedSheetName)}&cb=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`โหลดข้อมูลจากแท็บ ${normalizedSheetName} ไม่สำเร็จ (${response.status})`);
  }

  const payload = parseGvizResponse(await response.text());
  if (payload.status !== 'ok' || !payload.table) {
    throw new Error(`Google Sheet ตอบกลับไม่สำเร็จสำหรับแท็บ ${normalizedSheetName}`);
  }

  const columns = Array.isArray(payload.table.cols)
    ? payload.table.cols.map(col => normalizeText(col?.label ?? col?.id ?? ''))
    : [];
  const rows = Array.isArray(payload.table.rows)
    ? payload.table.rows.map(row => Array.isArray(row?.c) ? row.c.map(readCellValue) : [])
    : [];

  return {
    sourceUrl: `https://docs.google.com/spreadsheets/d/${normalizedSpreadsheetId}/edit#gid=0`,
    spreadsheetId: normalizedSpreadsheetId,
    sheetName: normalizedSheetName,
    columns,
    rows,
  };
}

async function getSheetMetadata(key) {
  const config = getSheetConfig(key);
  const cacheKey = `${config.spreadsheetId}:${config.sheetGid}`;
  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey);
  }

  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}?fields=sheets(properties(sheetId,title,index,tabColor,tabColorStyle))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`โหลด metadata ของชีต ${key} ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  const payload = await response.json();
  metadataCache.set(cacheKey, payload);
  return payload;
}

function getSheetPropertiesByGid(metadata, sheetGid) {
  const targetGid = normalizeNumber(sheetGid, -1);
  if (targetGid < 0 || !Array.isArray(metadata?.sheets)) return null;
  return metadata.sheets.find(sheet => Number(sheet?.properties?.sheetId) === targetGid)?.properties || null;
}

async function getSheetTitle(key) {
  const metadata = await getSheetMetadata(key);
  const targetGid = normalizeNumber(getSheetConfig(key).sheetGid, 0);
  const match = Array.isArray(metadata.sheets)
    ? metadata.sheets.find(sheet => Number(sheet?.properties?.sheetId) === targetGid)
    : null;
  const fallback = Array.isArray(metadata.sheets) ? metadata.sheets[0] : null;
  const title = normalizeText(match?.properties?.title || fallback?.properties?.title);

  if (!title) {
    throw new Error(`ไม่พบชื่อแท็บของชีต ${key}`);
  }

  return title;
}

function buildObjectsFromHeaderRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = rows[0].map(header => normalizeText(header));
  return rows.slice(1).map(cells => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cells[index] ?? '';
    });
    return obj;
  });
}

function isSpreadsheetColumnHeader(value) {
  return /^[A-Z]+$/.test(normalizeText(value));
}

function normalizeHeaderSet(columns = [], rows = []) {
  const normalizedColumns = columns.map(column => normalizeText(column)).filter(Boolean);

  if (
    normalizedColumns.length > 0
    && normalizedColumns.every(isSpreadsheetColumnHeader)
    && Array.isArray(rows)
    && rows.length > 0
  ) {
    return {
      headers: rows[0].map(header => normalizeText(header)).filter(Boolean),
      dataRows: rows.slice(1),
    };
  }

  return {
    headers: normalizedColumns,
    dataRows: rows,
  };
}

function getCurrentEvaluationCycle(date = new Date()) {
  const round = date.getMonth() + 1 < 11 ? 1 : 2;
  return `${date.getFullYear()}/${round}`;
}

function normalizeEvaluationCycle(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getCurrentEvaluationCycle(value);
  }

  const text = normalizeText(value);
  if (!text) return '';

  const dateMatch = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (dateMatch) {
    const parsedDate = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]),
      Number(dateMatch[3])
    );
    return getCurrentEvaluationCycle(parsedDate);
  }

  const cycleMatch = text.match(/^(\d{4})\s*\/\s*(\d+)$/);
  if (cycleMatch) {
    return `${cycleMatch[1]}/${cycleMatch[2]}`;
  }

  const yearOnlyMatch = text.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return `${yearOnlyMatch[1]}/${getCurrentEvaluationCycle(new Date()).split('/')[1]}`;
  }

  return text;
}

function sortEvaluationCycles(cycles, direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  return [...new Set(cycles.filter(Boolean))].sort((left, right) => {
    const [leftYear, leftRound] = normalizeEvaluationCycle(left).split('/').map(part => normalizeNumber(part, 0));
    const [rightYear, rightRound] = normalizeEvaluationCycle(right).split('/').map(part => normalizeNumber(part, 0));

    if (leftYear !== rightYear) return (leftYear - rightYear) * factor;
    return (leftRound - rightRound) * factor;
  });
}

function formatDepartmentPath(section, department, unit) {
  return [section, department, unit]
    .map(part => normalizeText(part))
    .filter(part => part && part !== '-')
    .join(' / ') || '-';
}

function extractSectionFromDepartmentPath(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === '-') return '-';

  const [section] = normalized.split('/').map(part => normalizeText(part));
  return section || normalized;
}

function deriveTopicSection(key) {
  return normalizeNumber(key, 0) <= RESULT_SECTION_BREAKPOINT
    ? 'ผลสัมฤทธิ์ของงาน'
    : 'สมรรถนะในการทำงาน';
}

function normalizeEvaluatorRows(rows) {
  return rows
    .map(cells => {
      const raw = {};
      ['Active', 'รหัสพนักงาน', 'รหัสเข้าประเมิน', 'ชื่อ', 'สกุล', 'ส่วน', 'แผนก', 'หน่วย', 'ตำแหน่งผู้ประเมิน'].forEach((header, index) => {
        raw[header] = cells[index] ?? '';
      });

      const firstName = normalizeText(raw['ชื่อ']);
      const lastName = normalizeText(raw['สกุล']);

      return {
        active: normalizeBoolean(raw.Active),
        employeeId: normalizeText(raw['รหัสพนักงาน']),
        evaluationCode: normalizeText(raw['รหัสเข้าประเมิน']),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        section: normalizeText(raw['ส่วน']) || '-',
        department: normalizeText(raw['แผนก']) || '-',
        unit: normalizeText(raw['หน่วย']) || '-',
        evaluatorTitle: normalizeText(raw['ตำแหน่งผู้ประเมิน']) || '-',
      };
    })
    .filter(item => item.employeeId && item.evaluationCode);
}

function normalizeEmployeeRows(rows) {
  return buildObjectsFromHeaderRow(rows)
    .map(raw => {
      const titlePrefix = normalizeText(raw['คำนำหน้าชื่อ']);
      const firstName = normalizeText(raw['ชื่อ']);
      const lastName = normalizeText(raw['สกุล']);
      const startDateRaw = normalizeText(raw['วันที่เริ่มงาน']) || '-';
      const startDate = normalizeEmployeeStartDate(startDateRaw);

      return {
        employeeId: normalizeText(raw['รหัสพนักงาน']),
        titlePrefix,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        displayName: `${titlePrefix}${firstName} ${lastName}`.trim(),
        section: normalizeText(raw['ส่วน']) || '-',
        department: normalizeText(raw['แผนก']) || '-',
        unit: normalizeText(raw['หน่วย']) || '-',
        level: normalizeText(raw['ระดับ']) || '-',
        position: normalizeText(raw['ตำแหน่ง']) || '-',
        startDate: startDate ? formatDateForDisplay(startDate) : startDateRaw,
        serviceAge: calculateServiceAge(startDate),
        evaluatorTitle: normalizeText(raw['ตำแหน่งผู้ประเมิน']) || '-',
      };
    })
    .filter(item => item.employeeId && item.fullName);
}

function normalizeEmployeeStartDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return atStartOfDay(value);
  }

  const text = normalizeText(value);
  if (!text || text === '-') return null;

  const dateMatch = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (dateMatch) {
    return atStartOfDay(new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]),
      Number(dateMatch[3])
    ));
  }

  const dmyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return atStartOfDay(new Date(
      Number(dmyMatch[3]),
      Number(dmyMatch[2]) - 1,
      Number(dmyMatch[1])
    ));
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return atStartOfDay(new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    ));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : atStartOfDay(parsed);
}

function atStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateForDisplay(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateTimeForStorage(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function calculateServiceAge(startDate, today = new Date()) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return '-';
  }

  const currentDate = atStartOfDay(today);
  if (startDate.getTime() > currentDate.getTime()) {
    return '0 วัน';
  }

  let years = currentDate.getFullYear() - startDate.getFullYear();
  let months = currentDate.getMonth() - startDate.getMonth();
  let days = currentDate.getDate() - startDate.getDate();

  if (days < 0) {
    const previousMonthLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    days += previousMonthLastDay;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ปี`);
  if (months > 0) parts.push(`${months} เดือน`);
  if (days > 0 || parts.length === 0) parts.push(`${days} วัน`);

  return parts.join(' ');
}

function normalizeTopicRows(topicRows, weightRows) {
  const weightMap = new Map(
    weightRows.map(cells => {
      const key = normalizeText(cells[0]);
      const rawWeight = normalizeNumber(cells[1], 0);
      const weight = rawWeight <= 1 ? rawWeight * 100 : rawWeight;
      return [key, roundTo(weight, 2)];
    })
  );

  return topicRows
    .map(cells => {
      const key = normalizeText(cells[0]);
      return {
        key,
        title: normalizeText(cells[1]),
        detail: normalizeText(cells[2]),
        weight: weightMap.get(key) ?? 0,
        section: deriveTopicSection(key),
      };
    })
    .filter(item => item.key && item.title)
    .sort((left, right) => normalizeNumber(left.key) - normalizeNumber(right.key));
}

function safeParseJson(value, fallback) {
  const text = normalizeText(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function normalizeResultRows(columns, rows) {
  return rows.map((cells, index) => {
    const raw = {};
    columns.forEach((column, cellIndex) => {
      raw[column] = cells[cellIndex] ?? '';
    });

    const cycle = normalizeEvaluationCycle(raw.year);
    const parsedRecordId = parseEvaluationRecordId(raw.id);
    const entries = safeParseJson(raw.entries, []);
    const sectionScores = safeParseJson(raw.sectionScores, []);
    const weightedEntries = safeParseJson(raw.weightedEntries, []);
    const dividedWeightEntries = safeParseJson(raw.dividedWeightEntries, []);

    return {
      rowIndex: index + 2,
      id: normalizeText(raw.id),
      year: cycle,
      employeeId: normalizeText(raw.employeeId || raw['รหัสพนักงาน']),
      employeeName: normalizeText(raw.employeeName),
      employeePosition: normalizeText(raw.employeePosition),
      employeeSection: normalizeText(raw.employeeSection || raw['ส่วน'] || extractSectionFromDepartmentPath(raw.employeeDepartment)),
      employeeDepartment: normalizeText(raw.employeeDepartment),
      evaluatorEmployeeId: normalizeText(raw.evaluatorEmployeeId || parsedRecordId.evaluatorEmployeeId),
      evaluatorName: normalizeText(raw.evaluatorName),
      overallScore: normalizeNumber(raw.overallScore ?? raw['คะแนนรวม'], 0),
      sectionScores,
      analysis: normalizeText(raw.analysis),
      analysisStatus: normalizeText(raw.analysisStatus),
      analysisModel: normalizeText(raw.analysisModel),
      analysisGeneratedAt: normalizeText(raw.analysisGeneratedAt),
      analysisError: normalizeText(raw.analysisError),
      submittedAt: normalizeText(raw.submittedAt),
      comment: normalizeText(raw.comment),
      entries,
      source: normalizeText(raw.source),
      weightedEntries,
      rawTotalScore: normalizeNumber(raw.rawTotalScore ?? raw['คะแนนทั้งหมด'], 0),
      dividedWeightEntries,
      weightedTotal: normalizeNumber(raw['คะแนนหาร Weight รวม'] ?? raw['คะแนนหาร Weight'], 0),
      resultKey: buildEvaluationResultKey({
        year: cycle,
        employeeId: raw.employeeId || raw['รหัสพนักงาน'],
        evaluatorEmployeeId: raw.evaluatorEmployeeId || parsedRecordId.evaluatorEmployeeId,
      }),
    };
  }).filter(item => item.employeeId && item.evaluatorName && item.year);
}

function findResultRowIndexByRecordId(results, recordId) {
  const normalizedRecordId = normalizeText(recordId);
  if (!normalizedRecordId) return null;

  const matched = results.find(item => normalizeText(item.id) === normalizedRecordId);
  return Number.isInteger(matched?.rowIndex) ? matched.rowIndex : null;
}

function normalizeSettingsRows(columns, rows) {
  const keyIndex = columns.findIndex(column => normalizeKey(column) === 'key');
  const valueIndex = columns.findIndex(column => normalizeKey(column) === 'value');

  if (keyIndex === -1 || valueIndex === -1) {
    return {};
  }

  return rows.reduce((acc, cells) => {
    const key = normalizeText(cells[keyIndex]);
    if (!key) return acc;
    acc[key] = cells[valueIndex] ?? '';
    return acc;
  }, {});
}

function parseEvaluationRecordId(recordId) {
  const normalized = normalizeText(recordId);
  const match = normalized.match(/^EV-(\d{4})-(\d+)-([^-]+)-([^-]+)$/i);
  if (!match) {
    return {
      year: '',
      round: '',
      employeeId: '',
      evaluatorEmployeeId: '',
    };
  }

  return {
    year: match[1],
    round: match[2],
    employeeId: match[3],
    evaluatorEmployeeId: match[4],
  };
}

export function buildEvaluationResultKey({ year, employeeId, evaluatorEmployeeId }) {
  return [
    normalizeEvaluationCycle(year),
    normalizeText(employeeId),
    normalizeText(evaluatorEmployeeId),
  ].join('::');
}

function enrichEvaluationResults(results, employees = [], evaluators = []) {
  const employeeMap = new Map(
    employees.map(employee => [
      normalizeText(employee.employeeId),
      employee,
    ])
  );
  const evaluatorMap = new Map(
    evaluators.map(evaluator => [
      normalizeText(evaluator.employeeId),
      evaluator,
    ])
  );
  const evaluatorNameMap = new Map(
    evaluators
      .filter(evaluator => normalizeText(evaluator.fullName))
      .map(evaluator => [
        normalizeText(evaluator.fullName),
        evaluator,
      ])
  );

  return results.map(result => {
    const employee = employeeMap.get(normalizeText(result.employeeId));
    const evaluatorById = evaluatorMap.get(normalizeText(result.evaluatorEmployeeId));
    const evaluatorByName = evaluatorNameMap.get(normalizeText(result.evaluatorName));
    const evaluator = evaluatorById || evaluatorByName || null;
    const evaluatorEmployeeId = evaluator?.employeeId || result.evaluatorEmployeeId;
    const year = result.year;

    return {
      ...result,
      employeeName: employee?.displayName || employee?.fullName || result.employeeName,
      employeePosition: employee?.position || result.employeePosition,
      employeeSection: employee?.section || result.employeeSection || extractSectionFromDepartmentPath(result.employeeDepartment),
      employeeDepartment: employee
        ? formatDepartmentPath(employee.section, employee.department, employee.unit)
        : result.employeeDepartment,
      evaluatorEmployeeId,
      evaluatorName: evaluator?.fullName || result.evaluatorName,
      resultKey: buildEvaluationResultKey({
        year,
        employeeId: result.employeeId,
        evaluatorEmployeeId,
      }),
    };
  });
}

export async function loadEvaluationReferenceData() {
  const evaluatorConfig = getSheetConfig('evaluatorCodes');
  const [evaluatorSheet, employeeSheet, topicSheet, weightSheet, resultSheet, settingsSheet] = await Promise.all([
    fetchGvizSheet('evaluatorCodes'),
    fetchGvizSheet('employees'),
    fetchGvizSheet('topics'),
    fetchGvizSheet('weights'),
    fetchGvizSheet('results'),
    fetchGvizSheetByTabName(evaluatorConfig.spreadsheetId, 'Settings'),
  ]);

  const settings = normalizeSettingsRows(settingsSheet.columns, settingsSheet.rows);
  const normalizedResultSheet = normalizeHeaderSet(resultSheet.columns, resultSheet.rows);
  const evaluators = normalizeEvaluatorRows(evaluatorSheet.rows);
  const employees = normalizeEmployeeRows(employeeSheet.rows);
  const results = enrichEvaluationResults(
    normalizeResultRows(normalizedResultSheet.headers, normalizedResultSheet.dataRows),
    employees,
    evaluators
  );

  return {
    cycle: getCurrentEvaluationCycle(),
    sources: {
      evaluatorCodes: evaluatorSheet.sourceUrl,
      settings: settingsSheet.sourceUrl,
      employees: employeeSheet.sourceUrl,
      topics: topicSheet.sourceUrl,
      weights: weightSheet.sourceUrl,
      results: resultSheet.sourceUrl,
    },
    settings: {
      evaluationOpen: normalizeBoolean(settings.evaluationOpen),
    },
    evaluators,
    employees,
    topics: normalizeTopicRows(topicSheet.rows, weightSheet.rows),
    resultHeaders: normalizedResultSheet.headers,
    results,
  };
}

function buildSectionScores(entries) {
  const groups = new Map();

  entries.forEach(entry => {
    const key = entry.section;
    const current = groups.get(key) || {
      section: key,
      completion: 0,
      score: 0,
      items: 0,
      answered: 0,
      weightedTotal: 0,
      weightedMax: 0,
    };

    current.items += 1;
    if (entry.isAnswered) {
      current.answered += 1;
    }
    current.weightedTotal += entry.weightedScore;
    current.weightedMax += (entry.weight * RESULT_MAX_SCORE_PER_ITEM) / 100;
    groups.set(key, current);
  });

  return [...groups.values()].map(group => ({
    section: group.section,
    completion: group.items > 0 ? roundTo(group.answered / group.items, 4) : 0,
    score: group.weightedMax > 0 ? roundTo((group.weightedTotal / group.weightedMax) * 100, 2) : 0,
    items: group.items,
    answered: group.answered,
  }));
}

function buildWeightedEntries(entries) {
  return entries.map(entry => ({
    key: entry.key,
    score: entry.score,
    weight: entry.weight,
    weightedScore: entry.weightedScore,
  }));
}

function buildDividedWeightEntries(entries) {
  return entries.map(entry => ({
    key: entry.key,
    score: entry.score,
    weight: entry.weight,
    dividedWeightScore: entry.dividedWeightScore,
  }));
}

export function buildEvaluationRecordId(cycleLabel, employeeId, evaluatorEmployeeId) {
  const cycle = normalizeEvaluationCycle(cycleLabel) || getCurrentEvaluationCycle();
  const safeCycle = normalizeText(cycle).replace(/\s+/g, '').replace(/\//g, '-');
  return `EV-${safeCycle}-${normalizeText(employeeId)}-${normalizeText(evaluatorEmployeeId)}`;
}

export function createEvaluationResultRecord({ cycleLabel, employee, evaluator, comment = '', scoresByKey = {}, topics = [], aiAnalysis = {} }) {
  const entries = topics.map(topic => {
    const rawScore = scoresByKey[topic.key];
    const isAnswered = normalizeText(rawScore) !== '';
    const score = isAnswered ? normalizeNumber(rawScore, 0) : 0;
    const weightedScore = roundTo((score * topic.weight) / 100, 4);

    return {
      key: topic.key,
      title: topic.title,
      detail: topic.detail,
      weight: roundTo(topic.weight, 2),
      section: topic.section,
      score,
      isAnswered,
      weightedScore,
      dividedWeightScore: weightedScore,
    };
  });

  const weightedTotal = roundTo(entries.reduce((sum, entry) => sum + entry.weightedScore, 0), 4);
  const rawTotalScore = roundTo(entries.reduce((sum, entry) => sum + entry.score, 0), 2);
  const overallScore = roundTo(weightedTotal * 20, 2);
  const sectionScores = buildSectionScores(entries);
  const weightedEntries = buildWeightedEntries(entries);
  const dividedWeightEntries = buildDividedWeightEntries(entries);

  const payload = {
    id: buildEvaluationRecordId(cycleLabel, employee.employeeId, evaluator.employeeId),
    year: normalizeEvaluationCycle(cycleLabel) || getCurrentEvaluationCycle(),
    employeeId: employee.employeeId,
    employeeName: employee.fullName,
    employeePosition: employee.position,
    employeeSection: employee.section,
    employeeDepartment: formatDepartmentPath(employee.section, employee.department, employee.unit),
    evaluatorEmployeeId: normalizeText(evaluator.employeeId),
    evaluatorName: evaluator.fullName,
    overallScore,
    sectionScores,
    analysis: normalizeText(aiAnalysis.analysis),
    analysisStatus: normalizeText(aiAnalysis.analysisStatus),
    analysisModel: normalizeText(aiAnalysis.analysisModel),
    analysisGeneratedAt: normalizeText(aiAnalysis.analysisGeneratedAt),
    analysisError: normalizeText(aiAnalysis.analysisError),
    submittedAt: formatDateTimeForStorage(),
    comment: normalizeText(comment),
    entries,
    source: 'web-client',
    weightedEntries,
    'คะแนนรวม': overallScore,
    'คะแนนทั้งหมด': rawTotalScore,
    'คะแนนหาร Weight': dividedWeightEntries,
    rawTotalScore,
    dividedWeightEntries,
    weightedTotal,
    'คะแนนหาร Weight รวม': weightedTotal,
  };

  entries.forEach(entry => {
    payload[`หัวข้อที่ ${entry.key}`] = entry.score;
    payload[`คะแนนหาร Weight ข้อ ${entry.key}`] = entry.dividedWeightScore;
    payload[`คะแนนถ่วงน้ำหนัก ข้อ ${entry.key}`] = entry.weightedScore;
    payload[`Weight ข้อ ${entry.key}`] = entry.weight;
  });

  return payload;
}

function serializeForSheet(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : roundTo(value, 4);
  }
  return value ?? '';
}

function formulaString(value) {
  return String(value ?? '').replace(/"/g, '""');
}

function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)(;base64|;utf8)?,(.*)$/);
  if (!match) {
    throw new Error('รูปแบบลายเซ็นไม่ถูกต้อง');
  }

  const mimeType = match[1] || 'image/svg+xml';
  const encoding = match[2] || '';
  const payload = match[3] || '';

  if (encoding === ';base64') {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { mimeType, bytes };
  }

  return {
    mimeType,
    bytes: new TextEncoder().encode(decodeURIComponent(payload)),
  };
}

function normalizeDriveFolderId(value) {
  const text = normalizeText(value);
  if (!text) return '';

  const folderPathMatch = text.match(/\/folders\/([^/?#]+)/);
  if (folderPathMatch) return folderPathMatch[1];

  const queryMatch = text.match(/[?&]id=([^&#]+)/);
  if (queryMatch) return queryMatch[1];

  return text;
}

async function uploadShiftSignatureImage(record, accessToken) {
  const signature = normalizeText(record?.approverSignature);
  if (!signature || !signature.startsWith('data:image/')) {
    return signature;
  }

  const { mimeType, bytes } = dataUrlToBytes(signature);
  const extension = mimeType.includes('png') ? 'png' : 'svg';
  const safeId = normalizeText(record.id).replace(/[^\w.-]+/g, '-') || Date.now();
  const metadata = {
    name: `shift-signature-${safeId}.${extension}`,
    mimeType,
  };
  const folderId = normalizeDriveFolderId(import.meta.env.VITE_HR_SHIFT_SIGNATURE_DRIVE_FOLDER_ID);
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = `shift_signature_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadResponse = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    }
  );

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    throw new Error(`อัปโหลดรูปลายเซ็นไป Google Drive ไม่สำเร็จ (${uploadResponse.status}) ${detail}`);
  }

  const uploadedFile = await uploadResponse.json();
  const fileId = uploadedFile.id;
  const permissionResponse = await fetch(
    `${GOOGLE_DRIVE_API_URL}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  if (!permissionResponse.ok) {
    const detail = await permissionResponse.text();
    throw new Error(`ตั้งค่าสิทธิ์รูปลายเซ็นไม่สำเร็จ (${permissionResponse.status}) ${detail}`);
  }

  const imageUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  return `=IMAGE("${formulaString(imageUrl)}", 1)`;
}

async function prepareShiftReportRecord(record, accessToken) {
  return {
    ...record,
    approverSignature: await uploadShiftSignatureImage(record, accessToken),
  };
}

function buildGoogleSheetApiError(action, config, status, detail) {
  const permissionHint = status === 403
    ? ' กรุณาแชร์ไฟล์ Google Sheet ให้ Google Service Account ที่ตั้งค่าไว้ในระบบมีสิทธิ์ Editor หรือแก้ Sheet ID ให้ชี้ไปยังไฟล์ที่แชร์แล้ว'
    : '';
  const sourceHint = config?.sourceUrl ? ` (${config.sourceUrl})` : '';
  return new Error(`${action} ${config.label} ไม่สำเร็จ (${status})${permissionHint}${sourceHint} ${detail}`);
}

function encodeSheetPassword(value) {
  const text = String(value ?? '');
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function buildRowValues(headers, record) {
  return headers.map(header => serializeForSheet(record[header] ?? ''));
}

async function updateSheetHeaders(config, sheetTitle, accessToken, headers) {
  const headerRange = `${sheetTitle}!A1:${getColumnLetter(headers.length)}1`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [headers],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('อัปเดต header ของชีต', config, response.status, detail);
  }
}

async function fetchSheetValues(config, sheetTitle, accessToken, range = 'A:ZZ') {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(`${sheetTitle}!${range}`)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('โหลดข้อมูลจากชีต', config, response.status, detail);
  }

  return response.json();
}

function normalizeCompactKey(value) {
  return normalizeKey(value).replace(/[\s_-]+/g, '');
}

function mapRowsToObjects(headers = [], rows = []) {
  return rows.map(cells => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] ?? '';
    });
    return item;
  });
}

function getUserDirectoryRecordValue(record, key) {
  switch (key) {
    case 'employeeid':
      return record.employeeId ?? record['employee ID'] ?? record.employeeid ?? '';
    case 'firstname':
      return record.firstname ?? '';
    case 'lastname':
      return record.lastname ?? '';
    case 'department':
      return record.department ?? '';
    case 'level':
      return record.level ?? '';
    case 'levelhr':
      return record.levelHr ?? record.level_Hr ?? '';
    case 'levelit':
      return record.levelIt ?? record.level_It ?? '';
    case 'username':
      return record.username ?? '';
    case 'password':
      return encodeSheetPassword(record.password ?? '');
    case 'email':
      return record.email ?? '';
    case 'remark':
      return record.remark ?? '';
    case 'active':
      return typeof record.active === 'boolean'
        ? record.active
        : normalizeBoolean(record.active);
    case 'code':
      return record.code ?? '';
    default:
      return record[key] ?? '';
  }
}

function buildUserDirectoryRowValues(headers = [], record = {}) {
  return headers.map(header => serializeForSheet(getUserDirectoryRecordValue(record, normalizeCompactKey(header))));
}

function getColumnLetter(index) {
  let value = '';
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }

  return value || 'A';
}

const SHIFT_FORM_DEFAULT_SETTINGS = {
  allowedDays: [1, 2, 3, 4, 5, 6],
  startTime: '08:30',
  endTime: '17:30',
  enabled: true,
};

const SHIFT_SWAP_DEFAULT_HEADERS = [
  'id',
  'วันที่บันทึก',
  'รหัสผู้บันทึก',
  'ผู้บันทึก',
  'แผนกผู้บันทึก',
  'รหัสพนักงาน',
  'พนักงาน',
  'ส่วน',
  'แผนก',
  'หน่วย',
  'ตำแหน่ง',
  'วันที่',
  'ถึงวันที่',
  'เวรเดิม',
  'เวรใหม่',
  'เหตุผล',
  'หมายเหตุ',
  'ลายเซ็นผู้อนุมัติ',
  'source',
];

const SHIFT_CHANGE_DEFAULT_HEADERS = [
  'id',
  'วันที่บันทึก',
  'รหัสผู้บันทึก',
  'ผู้บันทึก',
  'แผนกผู้บันทึก',
  'รหัสพนักงาน',
  'พนักงาน',
  'ส่วน',
  'แผนก',
  'หน่วย',
  'ตำแหน่ง',
  'วันที่',
  'ถึงวันที่',
  'กะเดิม',
  'กะใหม่',
  'เหตุผล',
  'หมายเหตุ',
  'ลายเซ็นผู้อนุมัติ',
  'source',
];

function normalizeSheetKey(value) {
  return normalizeKey(value).replace(/[\s_\-()/]+/g, '');
}

function pickRecordValue(record = {}, aliases = []) {
  const aliasSet = new Set(aliases.map(normalizeSheetKey));
  const matchKey = Object.keys(record).find(key => aliasSet.has(normalizeSheetKey(key)));
  return matchKey ? normalizeText(record[matchKey]) : '';
}

function normalizeShiftEmployeeRows(headers = [], rows = []) {
  return mapRowsToObjects(headers, rows)
    .map(record => {
      const employeeId = pickRecordValue(record, ['รหัสพนักงาน', 'employee id', 'employeeid']);
      const titlePrefix = pickRecordValue(record, ['คำนำหน้าชื่อ', 'title']);
      const firstName = pickRecordValue(record, ['ชื่อ ( Thai )', 'ชื่อ Thai', 'ชื่อ', 'firstname']);
      const lastName = pickRecordValue(record, ['สกุล ( Thai )', 'สกุล Thai', 'สกุล', 'lastname']);
      const section = pickRecordValue(record, ['ส่วน ( Thai )', 'ส่วน Thai', 'ส่วน', 'section']);
      const department = pickRecordValue(record, ['แผนก ( Thai )', 'แผนก Thai', 'แผนก', 'department']);
      const unit = pickRecordValue(record, ['หน่วย ( Thai )', 'หน่วย Thai', 'หน่วย', 'unit']);
      const position = pickRecordValue(record, ['ตำแหน่ง ( Thai )', 'ตำแหน่ง Thai', 'ตำแหน่ง', 'position']);
      const activeRaw = pickRecordValue(record, ['Active', 'ใช้งาน']);
      const fullName = `${firstName} ${lastName}`.trim();
      const activeKey = normalizeKey(activeRaw);
      const isActive = !activeKey
        || activeKey === '-'
        || normalizeBoolean(activeRaw)
        || activeKey === 'active'
        || activeKey === 'ใช้งาน';

      return {
        employeeId,
        titlePrefix,
        firstName,
        lastName,
        fullName,
        displayName: fullName || employeeId,
        section: section || '-',
        department: department || '-',
        unit: unit || '-',
        position: position || '-',
        active: isActive,
        searchText: [
          employeeId,
          titlePrefix,
          firstName,
          lastName,
          fullName,
          section,
          department,
          unit,
          position,
        ].join(' ').toLowerCase(),
      };
    })
    .filter(employee => employee.employeeId && employee.fullName && employee.active)
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'th'));
}

function parseSettingsRows(headers = [], rows = []) {
  const settings = {};
  const normalizedHeaders = headers.map(normalizeSheetKey);
  const keyIndex = normalizedHeaders.findIndex(header => header === 'key' || header === 'name' || header === 'setting');
  const valueIndex = normalizedHeaders.findIndex(header => header === 'value' || header === 'val');

  if (keyIndex !== -1 && valueIndex !== -1) {
    rows.forEach(row => {
      const key = normalizeText(row?.[keyIndex]);
      if (key) settings[key] = row?.[valueIndex] ?? '';
    });
    return settings;
  }

  if (normalizedHeaders.some(header => header.startsWith('shiftform'))) {
    const valueRow = rows.find(row => Array.isArray(row) && row.some(cell => normalizeText(cell) !== '')) || [];
    headers.forEach((header, index) => {
      const key = normalizeText(header);
      if (normalizeSheetKey(key).startsWith('shiftform')) {
        settings[key] = valueRow[index] ?? '';
      }
    });
    return settings;
  }

  if (normalizeSheetKey(headers[0]).startsWith('shiftform')) {
    settings[normalizeText(headers[0])] = headers[1] ?? '';
  }

  rows.forEach(row => {
    const key = normalizeText(row?.[0]);
    if (key) settings[key] = row?.[1] ?? '';
  });
  return settings;
}

function parseAllowedDays(value) {
  if (value == null || normalizeText(value) === '') {
    return SHIFT_FORM_DEFAULT_SETTINGS.allowedDays;
  }

  if (Array.isArray(value)) {
    const days = value
      .filter(day => normalizeText(day) !== '')
      .map(day => normalizeNumber(day, -1))
      .filter(day => day >= 0 && day <= 6);
    return days.length > 0 ? days : SHIFT_FORM_DEFAULT_SETTINGS.allowedDays;
  }

  const days = String(value ?? '')
    .split(',')
    .map(day => day.trim())
    .filter(Boolean)
    .map(day => normalizeNumber(day, -1))
    .filter(day => day >= 0 && day <= 6);

  return days.length > 0 ? days : SHIFT_FORM_DEFAULT_SETTINGS.allowedDays;
}

function normalizeTimeValue(value, fallback) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = normalizeNumber(match[1], -1);
  const minute = normalizeNumber(match[2], -1);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || '00:00').split(':').map(part => normalizeNumber(part, 0));
  return (hour * 60) + minute;
}

function formatAllowedDays(days = []) {
  const names = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return days
    .map(day => names[day] || '')
    .filter(Boolean)
    .join(', ');
}

function createShiftWindowMessage(settings) {
  return `เปิดให้บันทึกวัน ${formatAllowedDays(settings.allowedDays)} เวลา ${settings.startTime}-${settings.endTime}`;
}

function normalizeShiftFormSettings(rawSettings = {}) {
  const hasExplicitSettings = [
    'shiftFormAllowedDays',
    'allowedDays',
    'shiftFormStartTime',
    'startTime',
    'shiftFormEndTime',
    'endTime',
    'shiftFormEnabled',
    'enabled',
  ].some(key => Object.prototype.hasOwnProperty.call(rawSettings, key));

  if (!hasExplicitSettings) {
    return {
      ...SHIFT_FORM_DEFAULT_SETTINGS,
      source: rawSettings.source || 'default',
    };
  }

  const rawEnabledValue = rawSettings.shiftFormEnabled ?? rawSettings.enabled;
  const enabledValue = normalizeText(rawEnabledValue) === ''
    ? SHIFT_FORM_DEFAULT_SETTINGS.enabled
    : rawEnabledValue;
  const enabled = typeof enabledValue === 'boolean'
    ? enabledValue
    : normalizeBoolean(enabledValue);

  return {
    allowedDays: parseAllowedDays(rawSettings.shiftFormAllowedDays ?? rawSettings.allowedDays),
    startTime: normalizeTimeValue(rawSettings.shiftFormStartTime ?? rawSettings.startTime, SHIFT_FORM_DEFAULT_SETTINGS.startTime),
    endTime: normalizeTimeValue(rawSettings.shiftFormEndTime ?? rawSettings.endTime, SHIFT_FORM_DEFAULT_SETTINGS.endTime),
    enabled,
    source: rawSettings.source || 'Settings',
  };
}

function getShiftReportConfig(kind) {
  if (kind === 'swap') return getSheetConfig('shiftSwapReport');
  if (kind === 'change') return getSheetConfig('shiftChangeReport');
  throw new Error(`ไม่รู้จักประเภทรายงาน ${kind}`);
}

function getShiftReportDefaultHeaders(kind) {
  return kind === 'swap' ? SHIFT_SWAP_DEFAULT_HEADERS : SHIFT_CHANGE_DEFAULT_HEADERS;
}

function getShiftReportValue(record = {}, key) {
  switch (key) {
    case 'id':
    case 'รหัสรายการ':
      return record.id;
    case 'createdat':
    case 'submittedat':
    case 'วันที่บันทึก':
    case 'วันที่ส่ง':
      return record.createdAt;
    case 'reporterid':
    case 'createdbyid':
    case 'รหัสผู้บันทึก':
    case 'รหัสผู้แจ้ง':
      return record.reporterId;
    case 'reportername':
    case 'createdby':
    case 'ผู้บันทึก':
    case 'ผู้แจ้ง':
      return record.reporterName;
    case 'reporterdepartment':
    case 'แผนกผู้บันทึก':
    case 'แผนกผู้แจ้ง':
      return record.reporterDepartment;
    case 'primaryemployeeid':
    case 'employee1id':
    case 'รหัสพนักงานคนที่1':
      return record.primaryEmployeeId;
    case 'primaryemployeename':
    case 'employee1name':
    case 'พนักงานคนที่1':
      return record.primaryEmployeeName;
    case 'primarysection':
    case 'ส่วนคนที่1':
      return record.primarySection;
    case 'primarydepartment':
    case 'แผนกคนที่1':
      return record.primaryDepartment;
    case 'primaryunit':
    case 'หน่วยคนที่1':
      return record.primaryUnit;
    case 'primaryposition':
    case 'ตำแหน่งคนที่1':
      return record.primaryPosition;
    case 'primaryworkdate':
    case 'employee1workdate':
    case 'วันที่เวรคนที่1':
      return record.primaryWorkDate;
    case 'primaryworkenddate':
    case 'employee1workenddate':
    case 'ถึงวันที่คนที่1':
    case 'วันที่สิ้นสุดคนที่1':
      return record.primaryWorkEndDate;
    case 'primaryshift':
    case 'employee1shift':
    case 'กะเวรเดิมคนที่1':
    case 'กะเดิมคนที่1':
      return record.primaryShift;
    case 'primarynewshift':
    case 'employee1newshift':
    case 'กะเวรใหม่คนที่1':
    case 'กะใหม่คนที่1':
      return record.primaryNewShift;
    case 'secondaryemployeeid':
    case 'employee2id':
    case 'รหัสพนักงานคนที่2':
      return record.secondaryEmployeeId;
    case 'secondaryemployeename':
    case 'employee2name':
    case 'พนักงานคนที่2':
      return record.secondaryEmployeeName;
    case 'secondarysection':
    case 'ส่วนคนที่2':
      return record.secondarySection;
    case 'secondarydepartment':
    case 'แผนกคนที่2':
      return record.secondaryDepartment;
    case 'secondaryunit':
    case 'หน่วยคนที่2':
      return record.secondaryUnit;
    case 'secondaryposition':
    case 'ตำแหน่งคนที่2':
      return record.secondaryPosition;
    case 'secondaryworkdate':
    case 'employee2workdate':
    case 'วันที่เวรคนที่2':
      return record.secondaryWorkDate;
    case 'secondaryshift':
    case 'employee2shift':
    case 'กะเวรเดิมคนที่2':
    case 'กะเดิมคนที่2':
      return record.secondaryShift;
    case 'employeeid':
    case 'รหัสพนักงาน':
      return record.employeeId ?? record.primaryEmployeeId;
    case 'employeename':
    case 'พนักงาน':
    case 'ชื่อพนักงาน':
      return record.employeeName ?? record.primaryEmployeeDisplayName ?? record.primaryEmployeeName;
    case 'section':
    case 'ส่วน':
      return record.section ?? record.primarySection;
    case 'department':
    case 'แผนก':
      return record.department ?? record.primaryDepartment;
    case 'unit':
    case 'หน่วย':
      return record.unit ?? record.primaryUnit;
    case 'position':
    case 'ตำแหน่ง':
      return record.position ?? record.primaryPosition;
    case 'workdate':
    case 'วันที่':
    case 'วันที่ทำงาน':
      return record.workDate ?? record.primaryWorkDate;
    case 'workenddate':
    case 'enddate':
    case 'ถึงวันที่':
    case 'วันที่สิ้นสุด':
      return record.workEndDate ?? record.primaryWorkEndDate;
    case 'oldshift':
    case 'กะเดิม':
    case 'เวรเดิม':
      return record.oldShift ?? record.primaryShift;
    case 'newshift':
    case 'กะใหม่':
    case 'เวรใหม่':
      return record.newShift ?? record.primaryNewShift;
    case 'reason':
    case 'เหตุผล':
      return record.reason;
    case 'remark':
    case 'หมายเหตุ':
      return record.remark;
    case 'approversignature':
    case 'approvalsignature':
    case 'ลายเซ็นผู้อนุมัติ':
    case 'รายเซ็นต์ผู้อนุมัติ':
    case 'ผู้อนุมัติ':
      return record.approverSignature;
    case 'source':
      return record.source;
    default:
      return record[key] ?? '';
  }
}

function serializeForUserEnteredSheet(value) {
  const serializedValue = serializeForSheet(value);
  const text = String(serializedValue ?? '');

  if (!text) return '';
  if (text.startsWith('=IMAGE(')) return text;
  return `'${text}`;
}

function buildShiftReportUserEnteredRowValues(headers = [], record = {}) {
  return headers.map(header =>
    serializeForUserEnteredSheet(getShiftReportValue(record, normalizeSheetKey(header)))
  );
}

function getAppendedRowNumber(appendResponse = {}) {
  const updatedRange = normalizeText(appendResponse?.updates?.updatedRange);
  const match = updatedRange.match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/);
  return match ? normalizeNumber(match[1], 0) : 0;
}

const SHIFT_ROW_FORMATS = {
  dateGroups: [
    {
      backgroundColor: { red: 1, green: 1, blue: 1 },
    },
    {
      backgroundColor: { red: 0.937, green: 0.969, blue: 1 },
    },
  ],
  dateRangeAlert: {
    backgroundColor: { red: 1, green: 0.949, blue: 0.769 },
    textFormat: {
      foregroundColor: { red: 0.573, green: 0.251, blue: 0.054 },
      bold: true,
    },
  },
};

function getShiftRecordDateRange(record = {}) {
  return {
    startDate: normalizeText(record.workDate ?? record.primaryWorkDate),
    endDate: normalizeText(record.workEndDate ?? record.primaryWorkEndDate),
  };
}

function shouldHighlightShiftDateRange(record = {}) {
  const { startDate, endDate } = getShiftRecordDateRange(record);
  return Boolean(startDate && endDate && startDate !== endDate);
}

function getDatePart(value) {
  const text = normalizeText(value);
  return text ? text.split(' ')[0] : '';
}

function getShiftReportCreatedAtColumnIndex(headers = []) {
  return headers.findIndex(header => {
    const normalizedHeader = normalizeSheetKey(header);
    return normalizedHeader === 'createdat'
      || normalizedHeader === 'submittedat'
      || normalizedHeader === 'วันที่บันทึก'
      || normalizedHeader === 'วันที่ส่ง';
  });
}

function getShiftReportDateGroupIndex(values = [], headers = [], record = {}) {
  const recordDate = getDatePart(record.createdAt);
  if (!recordDate) return 0;

  const headerRow = Array.isArray(values[0]) && values[0].length > 0 ? values[0] : headers;
  const createdAtColumnIndex = getShiftReportCreatedAtColumnIndex(headerRow);
  if (createdAtColumnIndex === -1) return 0;

  const seenDates = [];
  const seenDateSet = new Set();

  values.slice(1).forEach(row => {
    const rowDate = getDatePart(row?.[createdAtColumnIndex]);
    if (!rowDate || seenDateSet.has(rowDate)) return;
    seenDateSet.add(rowDate);
    seenDates.push(rowDate);
  });

  if (!seenDateSet.has(recordDate)) {
    seenDates.push(recordDate);
  }

  const groupIndex = seenDates.indexOf(recordDate);
  return groupIndex >= 0 ? groupIndex : 0;
}

function buildShiftRowFormat(values = [], headers = [], record = {}) {
  if (shouldHighlightShiftDateRange(record)) {
    return {
      userEnteredFormat: SHIFT_ROW_FORMATS.dateRangeAlert,
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    };
  }

  const groupIndex = getShiftReportDateGroupIndex(values, headers, record);
  const backgroundFormat = SHIFT_ROW_FORMATS.dateGroups[groupIndex % SHIFT_ROW_FORMATS.dateGroups.length];

  return {
    userEnteredFormat: backgroundFormat,
    fields: 'userEnteredFormat(backgroundColor)',
  };
}

async function formatShiftReportRow(config, accessToken, headers, values, record, appendResponse) {
  const rowFormat = buildShiftRowFormat(values, headers, record);
  if (!rowFormat) return;

  const rowNumber = getAppendedRowNumber(appendResponse);
  const sheetId = normalizeNumber(config.sheetGid, -1);
  if (rowNumber <= 0 || sheetId < 0) return;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowNumber - 1,
                endRowIndex: rowNumber,
                startColumnIndex: 0,
                endColumnIndex: Math.max(1, headers.length),
              },
              cell: {
                userEnteredFormat: rowFormat.userEnteredFormat,
              },
              fields: rowFormat.fields,
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('จัดรูปแบบสีแถวในชีตเปลี่ยนแลกเวร', config, response.status, detail);
  }
}

async function syncShiftChangeSheetTabColor(accessToken) {
  const sourceConfig = getSheetConfig('shiftSwapReport');
  const targetConfig = getSheetConfig('shiftChangeReport');
  const [sourceMetadata, targetMetadata] = await Promise.all([
    getSheetMetadata('shiftSwapReport'),
    getSheetMetadata('shiftChangeReport'),
  ]);
  const sourceProperties = getSheetPropertiesByGid(sourceMetadata, sourceConfig.sheetGid);
  const targetProperties = getSheetPropertiesByGid(targetMetadata, targetConfig.sheetGid);

  if (!sourceProperties || !targetProperties) return;

  const nextProperties = {
    sheetId: Number(targetProperties.sheetId),
  };
  let fields = '';

  if (sourceProperties.tabColorStyle?.rgbColor) {
    nextProperties.tabColorStyle = sourceProperties.tabColorStyle;
    fields = 'tabColorStyle';
  } else if (sourceProperties.tabColor) {
    nextProperties.tabColor = sourceProperties.tabColor;
    fields = 'tabColor';
  }

  if (!fields) return;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetConfig.spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: nextProperties,
              fields,
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('ซิงก์สีแท็บชีตรายงานเปลี่ยนกะงาน', targetConfig, response.status, detail);
  }

  metadataCache.delete(`${targetConfig.spreadsheetId}:${targetConfig.sheetGid}`);
}

export async function loadHrShiftEmployees() {
  const config = getSheetConfig('shiftEmployees');
  const sheetName = config.sheetName || 'Data';
  const fetchedSheet = await fetchGvizSheetByTabName(config.spreadsheetId, sheetName);
  const normalizedSheet = normalizeHeaderSet(fetchedSheet.columns, fetchedSheet.rows);

  return {
    employees: normalizeShiftEmployeeRows(normalizedSheet.headers, normalizedSheet.dataRows),
    sourceUrl: config.sourceUrl,
  };
}

export async function loadHrShiftFormSettings({ allowDefaultFallback = true } = {}) {
  const config = getSheetConfig('shiftEmployees');
  const settingsSheetName = config.settingsSheetName || 'Settings';

  try {
    const fetchedSheet = await fetchGvizSheetByTabName(config.spreadsheetId, settingsSheetName);
    const normalizedSheet = normalizeHeaderSet(fetchedSheet.columns, fetchedSheet.rows);
    const rawSettings = parseSettingsRows(normalizedSheet.headers, normalizedSheet.dataRows);
    const hasShiftSettings = Object.keys(rawSettings).some(key => normalizeSheetKey(key).startsWith('shiftform'));
    if (!hasShiftSettings) {
      console.warn(`ไม่พบ key shiftForm ในแท็บ ${settingsSheetName} ใช้ค่าเริ่มต้นแทน`);
    }
    return normalizeShiftFormSettings({
      ...rawSettings,
      source: hasShiftSettings ? settingsSheetName : 'default',
    });
  } catch (error) {
    if (!allowDefaultFallback) {
      throw error;
    }

    console.warn(`โหลด Settings ของฟอร์มเปลี่ยนเวรไม่สำเร็จ ใช้ค่าเริ่มต้นแทน: ${error.message}`);
    return normalizeShiftFormSettings({
      shiftFormAllowedDays: SHIFT_FORM_DEFAULT_SETTINGS.allowedDays.join(','),
      shiftFormStartTime: SHIFT_FORM_DEFAULT_SETTINGS.startTime,
      shiftFormEndTime: SHIFT_FORM_DEFAULT_SETTINGS.endTime,
      shiftFormEnabled: SHIFT_FORM_DEFAULT_SETTINGS.enabled,
      source: 'default',
    });
  }
}

export function validateHrShiftFormWindow(settings = SHIFT_FORM_DEFAULT_SETTINGS, date = new Date()) {
  const normalizedSettings = normalizeShiftFormSettings(settings);
  const day = date.getDay();
  const currentMinutes = (date.getHours() * 60) + date.getMinutes();
  const startMinutes = timeToMinutes(normalizedSettings.startTime);
  const endMinutes = timeToMinutes(normalizedSettings.endTime);
  const dayAllowed = normalizedSettings.allowedDays.includes(day);
  const timeAllowed = startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  const windowText = createShiftWindowMessage(normalizedSettings);

  if (!normalizedSettings.enabled) {
    return {
      allowed: false,
      message: 'ระบบปิดรับการบันทึกข้อมูลแลกเวร/เปลี่ยนกะงานชั่วคราว',
      windowText,
      settings: normalizedSettings,
    };
  }

  if (!dayAllowed || !timeAllowed) {
    return {
      allowed: false,
      message: `ไม่สามารถบันทึกได้นอกช่วงเวลาที่กำหนด (${windowText})`,
      windowText,
      settings: normalizedSettings,
    };
  }

  return {
    allowed: true,
    message: `สามารถบันทึกได้ (${windowText})`,
    windowText,
    settings: normalizedSettings,
  };
}

export async function appendHrShiftReport(kind, record) {
  const config = getShiftReportConfig(kind);
  const sheetTitle = config.sheetName || 'Data';
  const accessToken = await getGoogleAccessToken();

  if (kind === 'change') {
    try {
      await syncShiftChangeSheetTabColor(accessToken);
    } catch (error) {
      console.warn('syncShiftChangeSheetTabColor failed:', error);
    }
  }

  const preparedRecord = await prepareShiftReportRecord(record, accessToken);
  const payload = await fetchSheetValues(config, sheetTitle, accessToken);
  const values = Array.isArray(payload.values) ? payload.values : [];
  const defaultHeaders = getShiftReportDefaultHeaders(kind);
  const existingHeaders = Array.isArray(values[0])
    ? values[0].map(header => normalizeText(header)).filter(Boolean)
    : [];
  const missingHeaders = defaultHeaders.filter(header =>
    !existingHeaders.some(existingHeader => normalizeSheetKey(existingHeader) === normalizeSheetKey(header))
  );
  const headers = existingHeaders.length > 0
    ? [...existingHeaders, ...missingHeaders]
    : defaultHeaders;

  if (existingHeaders.length === 0 || missingHeaders.length > 0) {
    await updateSheetHeaders(config, sheetTitle, accessToken, headers);
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(`${sheetTitle}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [buildShiftReportUserEnteredRowValues(headers, preparedRecord)],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('บันทึกข้อมูลลง', config, response.status, detail);
  }

  const responsePayload = await response.json();
  try {
    await formatShiftReportRow(config, accessToken, headers, values, preparedRecord, responsePayload);
  } catch (error) {
    console.warn('formatShiftReportRow failed:', error);
  }

  return {
    ...responsePayload,
    sourceUrl: config.sourceUrl,
  };
}

export async function appendLabourGrievance(record = {}) {
  const identityMode = record.identityMode === 'named'
    ? 'named'
    : record.identityMode === 'anonymous'
      ? 'anonymous'
      : '';
  const issueTypes = Array.isArray(record.issueTypes)
    ? record.issueTypes.map(normalizeText).filter(Boolean)
    : [];
  const fullName = normalizeText(record.fullName);
  const otherIssue = normalizeText(record.otherIssue);
  const incidentDetails = normalizeText(record.incidentDetails);
  const requestedAction = normalizeText(record.requestedAction);
  const hasOtherIssue = issueTypes.some(issueType => normalizeSheetKey(issueType) === normalizeSheetKey('อื่น ๆ'));

  if (
    !identityMode
    || (identityMode === 'named' && !fullName)
    || issueTypes.length === 0
    || (hasOtherIssue && !otherIssue)
    || !incidentDetails
    || !requestedAction
    || record.truthConfirmed !== true
  ) {
    throw new Error('ข้อมูลแบบฟอร์มแจ้งปัญหาด้านแรงงานไม่ครบถ้วน');
  }

  const config = getSheetConfig('labourGrievance');
  const sheetTitle = await getSheetTitle('labourGrievance');
  const accessToken = await getGoogleAccessToken();
  const payload = await fetchSheetValues(config, sheetTitle, accessToken, '1:1');
  const existingHeaders = Array.isArray(payload.values?.[0])
    ? payload.values[0].map(header => normalizeText(header))
    : [];

  while (existingHeaders.length > 0 && !existingHeaders.at(-1)) {
    existingHeaders.pop();
  }

  const missingHeaders = LABOUR_GRIEVANCE_HEADERS.filter(header =>
    !existingHeaders.some(existingHeader => normalizeSheetKey(existingHeader) === normalizeSheetKey(header))
  );
  const headers = existingHeaders.length > 0
    ? [...existingHeaders, ...missingHeaders]
    : [...LABOUR_GRIEVANCE_HEADERS];

  if (existingHeaders.length === 0 || missingHeaders.length > 0) {
    await updateSheetHeaders(config, sheetTitle, accessToken, headers);
  }

  const isAnonymous = identityMode === 'anonymous';
  const sheetRecord = {
    'วันที่และเวลาที่ส่ง': normalizeText(record.submittedAt),
    'การเปิดเผยตัวตน': isAnonymous ? 'ไม่เปิดเผยชื่อ (Anonymous)' : 'เปิดเผยชื่อ',
    'ชื่อ-นามสกุล': isAnonymous ? '' : fullName,
    'แผนก': isAnonymous ? '' : normalizeText(record.department),
    'เบอร์โทร': isAnonymous ? '' : normalizeText(record.phone),
    'ประเภทปัญหา': issueTypes.join(' | '),
    'ปัญหาอื่น ๆ': otherIssue,
    'วันที่เกิดเหตุ': normalizeText(record.incidentDate),
    'สถานที่': normalizeText(record.location),
    'รายละเอียดเหตุการณ์': incidentDetails,
    'บุคคลที่เกี่ยวข้อง': normalizeText(record.involvedPeople),
    'ต้องการให้บริษัทดำเนินการอย่างไร': requestedAction,
    'ยืนยันข้อมูลเป็นความจริง': true,
  };
  const normalizedSheetRecord = new Map(
    Object.entries(sheetRecord).map(([header, value]) => [normalizeSheetKey(header), value])
  );
  const rowValues = headers.map(header =>
    serializeForSheet(normalizedSheetRecord.get(normalizeSheetKey(header)) ?? '')
  );

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(`${sheetTitle}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw buildGoogleSheetApiError('บันทึกข้อมูลลง', config, response.status, detail);
  }

  return {
    ...(await response.json()),
    sourceUrl: config.sourceUrl,
  };
}

export async function upsertEvaluationResult(record, { existingRowIndex = null, headers = [] } = {}) {
  const config = getSheetConfig('results');
  const sheetTitle = await getSheetTitle('results');
  const fetchedResultSheet = await fetchGvizSheet('results');
  const normalizedResultSheet = normalizeHeaderSet(fetchedResultSheet.columns, fetchedResultSheet.rows);
  const normalizedResults = normalizeResultRows(normalizedResultSheet.headers, normalizedResultSheet.dataRows);
  const baseHeaders = headers.length > 0 ? headers : normalizedResultSheet.headers;
  const missingHeaders = Object.keys(record).filter(key => !baseHeaders.includes(key));
  const resultHeaders = missingHeaders.length > 0 ? [...baseHeaders, ...missingHeaders] : baseHeaders;
  const accessToken = await getGoogleAccessToken();
  const matchedRowIndex = findResultRowIndexByRecordId(normalizedResults, record.id);
  const safeExistingRowIndex = matchedRowIndex
    ?? (Number.isInteger(existingRowIndex) && existingRowIndex >= 2 ? existingRowIndex : null);

  if (missingHeaders.length > 0) {
    await updateSheetHeaders(config, sheetTitle, accessToken, resultHeaders);
  }

  const rowValues = buildRowValues(resultHeaders, record);
  const isUpdate = Number.isInteger(safeExistingRowIndex) && safeExistingRowIndex >= 2;

  const range = isUpdate
    ? `${sheetTitle}!A${safeExistingRowIndex}:${getColumnLetter(resultHeaders.length)}${safeExistingRowIndex}`
    : `${sheetTitle}!A1`;

  const endpoint = isUpdate
    ? `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
    : `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(endpoint, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`บันทึกผลประเมินลง Google Sheet ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  return response.json();
}

export async function updateUserDirectoryPassword(employeeId, nextPassword, { alreadyEncoded = false } = {}) {
  const config = getSheetConfig('userDirectory');
  const sheetTitle = await getSheetTitle('userDirectory');
  const accessToken = await getGoogleAccessToken();
  const payload = await fetchSheetValues(config, sheetTitle, accessToken);
  const values = Array.isArray(payload.values) ? payload.values : [];

  if (values.length === 0) {
    throw new Error('ไม่พบข้อมูลในชีตผู้ใช้งาน');
  }

  const headerRow = Array.isArray(values[0]) ? values[0] : [];
  const employeeIdColumnIndex = headerRow.findIndex(header => {
    const normalized = normalizeKey(header).replace(/\s+/g, '');
    return normalized === 'employeeid' || normalized === 'employee_id';
  });
  const passwordColumnIndex = headerRow.findIndex(header => normalizeKey(header) === 'password');

  if (employeeIdColumnIndex === -1 || passwordColumnIndex === -1) {
    throw new Error('ไม่พบคอลัมน์ employee ID หรือ password ในชีตผู้ใช้งาน');
  }

  const normalizedEmployeeId = normalizeText(employeeId);
  const matchedRowIndex = values.findIndex((row, index) => {
    if (index === 0) return false;
    return normalizeText(row?.[employeeIdColumnIndex]) === normalizedEmployeeId;
  });

  if (matchedRowIndex === -1) {
    throw new Error(`ไม่พบ employee ID ${normalizedEmployeeId} ในชีตผู้ใช้งาน`);
  }

  const rowNumber = matchedRowIndex + 1;
  const previousPassword = values[matchedRowIndex]?.[passwordColumnIndex] ?? '';
  const encodedPassword = alreadyEncoded ? String(nextPassword ?? '') : encodeSheetPassword(nextPassword);
  const passwordCell = `${sheetTitle}!${getColumnLetter(passwordColumnIndex + 1)}${rowNumber}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(passwordCell)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [[encodedPassword]],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`อัปเดตรหัสผ่านใน Google Sheet ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  return {
    rowNumber,
    previousPassword,
    encodedPassword,
    sourceUrl: config.sourceUrl,
  };
}

function findUserDirectoryColumnIndex(headers = [], aliases = []) {
  return headers.findIndex(header => aliases.includes(normalizeCompactKey(header)));
}

export async function updateUserDirectoryAccess(employeeId, { level = '', levelHr = '', levelIt = '', active = '' } = {}) {
  const config = getSheetConfig('userDirectory');
  const sheetTitle = await getSheetTitle('userDirectory');
  const accessToken = await getGoogleAccessToken();
  const payload = await fetchSheetValues(config, sheetTitle, accessToken);
  const values = Array.isArray(payload.values) ? payload.values : [];

  if (values.length === 0) {
    throw new Error('ไม่พบข้อมูลในชีตผู้ใช้งาน');
  }

  const headerRow = Array.isArray(values[0]) ? values[0].map(header => normalizeText(header)) : [];
  const employeeIdColumnIndex = findUserDirectoryColumnIndex(headerRow, ['employeeid']);
  const levelColumnIndex = findUserDirectoryColumnIndex(headerRow, ['level']);
  const levelHrColumnIndex = findUserDirectoryColumnIndex(headerRow, ['levelhr']);
  const levelItColumnIndex = findUserDirectoryColumnIndex(headerRow, ['levelit']);
  const activeColumnIndex = findUserDirectoryColumnIndex(headerRow, ['active']);

  if (employeeIdColumnIndex === -1) {
    throw new Error('ไม่พบคอลัมน์ employee ID ในชีตผู้ใช้งาน');
  }

  if (levelColumnIndex === -1 || levelHrColumnIndex === -1 || levelItColumnIndex === -1 || activeColumnIndex === -1) {
    throw new Error('ไม่พบคอลัมน์ level, levelHr, levelIt หรือ active ในชีตผู้ใช้งาน');
  }

  const normalizedEmployeeId = normalizeText(employeeId);
  const matchedRowIndex = values.findIndex((row, index) => {
    if (index === 0) return false;
    return normalizeText(row?.[employeeIdColumnIndex]) === normalizedEmployeeId;
  });

  if (matchedRowIndex === -1) {
    throw new Error(`ไม่พบ employee ID ${normalizedEmployeeId} ในชีตผู้ใช้งาน`);
  }

  const nextRowLength = Math.max(
    headerRow.length,
    Array.isArray(values[matchedRowIndex]) ? values[matchedRowIndex].length : 0
  );
  const nextRowValues = Array.from({ length: nextRowLength }, (_, index) => values[matchedRowIndex]?.[index] ?? '');
  const previousValues = {
    level: nextRowValues[levelColumnIndex] ?? '',
    levelHr: nextRowValues[levelHrColumnIndex] ?? '',
    levelIt: nextRowValues[levelItColumnIndex] ?? '',
    active: nextRowValues[activeColumnIndex] ?? '',
  };

  nextRowValues[levelColumnIndex] = serializeForSheet(level);
  nextRowValues[levelHrColumnIndex] = serializeForSheet(levelHr);
  nextRowValues[levelItColumnIndex] = serializeForSheet(levelIt);
  nextRowValues[activeColumnIndex] = serializeForSheet(normalizeBoolean(active));

  const rowNumber = matchedRowIndex + 1;
  const targetRange = `${sheetTitle}!A${rowNumber}:${getColumnLetter(nextRowValues.length)}${rowNumber}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(targetRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [nextRowValues],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`อัปเดตสิทธิ์ใน Google Sheet ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  return {
    rowNumber,
    previousValues,
    sourceUrl: config.sourceUrl,
  };
}

export async function getUserDirectoryRecords() {
  const fetchedSheet = await fetchGvizSheet('userDirectory');
  const normalizedSheet = normalizeHeaderSet(fetchedSheet.columns, fetchedSheet.rows);
  const headers = normalizedSheet.headers;
  const records = mapRowsToObjects(headers, normalizedSheet.dataRows);

  return {
    headers,
    records,
    sourceUrl: fetchedSheet.sourceUrl,
  };
}

export async function getUserDirectoryDepartments() {
  const { records, sourceUrl } = await getUserDirectoryRecords();
  const departments = [...new Set(
    records
      .map(record => normalizeText(record.department))
      .filter(value => value && value !== '-')
  )].sort((left, right) => left.localeCompare(right, 'th'));

  return {
    departments,
    sourceUrl,
  };
}

export async function appendUserDirectoryRecord(record) {
  const config = getSheetConfig('userDirectory');
  const sheetTitle = await getSheetTitle('userDirectory');
  const accessToken = await getGoogleAccessToken();
  const payload = await fetchSheetValues(config, sheetTitle, accessToken);
  const values = Array.isArray(payload.values) ? payload.values : [];

  if (values.length === 0) {
    throw new Error('ไม่พบ header ในชีตผู้ใช้งาน');
  }

  const headerRow = Array.isArray(values[0]) ? values[0].map(header => normalizeText(header)) : [];
  if (headerRow.length === 0) {
    throw new Error('ไม่พบ header ในชีตผู้ใช้งาน');
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(`${sheetTitle}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [buildUserDirectoryRowValues(headerRow, record)],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`เพิ่มข้อมูลผู้ใช้ลง Google Sheet ไม่สำเร็จ (${response.status}) ${detail}`);
  }

  return {
    ...(await response.json()),
    sourceUrl: config.sourceUrl,
  };
}

function isSyncedEvaluationResult(item, expectedRecord) {
  if (!item || !expectedRecord) return false;

  return normalizeText(item.id) === normalizeText(expectedRecord.id)
    && normalizeText(item.submittedAt) === normalizeText(expectedRecord.submittedAt)
    && normalizeText(item.comment) === normalizeText(expectedRecord.comment)
    && normalizeText(item.analysis) === normalizeText(expectedRecord.analysis)
    && normalizeText(item.analysisStatus) === normalizeText(expectedRecord.analysisStatus)
    && roundTo(item.overallScore, 2) === roundTo(expectedRecord.overallScore, 2)
    && roundTo(item.weightedTotal, 4) === roundTo(expectedRecord.weightedTotal, 4);
}

export async function waitForEvaluationResultSync(recordOrId, { timeoutMs = 12000, intervalMs = 1200 } = {}) {
  const startedAt = Date.now();
  const expectedRecord = typeof recordOrId === 'string' ? null : recordOrId;
  const expectedRecordId = typeof recordOrId === 'string'
    ? recordOrId
    : recordOrId?.id;

  while (Date.now() - startedAt <= timeoutMs) {
    const fetchedResultSheet = await fetchGvizSheet('results');
    const normalizedResultSheet = normalizeHeaderSet(fetchedResultSheet.columns, fetchedResultSheet.rows);
    const results = normalizeResultRows(normalizedResultSheet.headers, normalizedResultSheet.dataRows);
    const hasRecord = expectedRecord
      ? results.some(item => isSyncedEvaluationResult(item, expectedRecord))
      : results.some(item => normalizeText(item.id) === normalizeText(expectedRecordId));

    if (hasRecord) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}

export { getCurrentEvaluationCycle, normalizeEvaluationCycle, sortEvaluationCycles };
