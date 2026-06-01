const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const RESULT_MAX_SCORE_PER_ITEM = 5;
const RESULT_SECTION_BREAKPOINT = 3;

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

async function signJwt(unsignedToken, privateKeyPem) {
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
    scope: GOOGLE_SHEETS_SCOPE,
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
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}?fields=sheets(properties(sheetId,title,index))`,
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
  const round = date.getMonth() + 1 < 6 ? 1 : 2;
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
        startDate: normalizeText(raw['วันที่เริ่มงาน']) || '-',
        serviceAge: normalizeText(raw['อายุงาน']) || '-',
        evaluatorTitle: normalizeText(raw['ตำแหน่งผู้ประเมิน']) || '-',
      };
    })
    .filter(item => item.employeeId && item.fullName);
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
    if (Number.isFinite(entry.score)) {
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
    const score = normalizeNumber(scoresByKey[topic.key], 0);
    const weightedScore = roundTo((score * topic.weight) / 100, 4);

    return {
      key: topic.key,
      title: topic.title,
      detail: topic.detail,
      weight: roundTo(topic.weight, 2),
      section: topic.section,
      score,
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
    submittedAt: new Date().toISOString(),
    comment: normalizeText(comment),
    entries,
    source: 'web-client',
    weightedEntries,
    'คะแนนรวม': overallScore,
    'คะแนนทั้งหมด': rawTotalScore,
    'คะแนนหาร Weight': dividedWeightEntries,
    rawTotalScore,
    dividedWeightEntries,
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
    throw new Error(`อัปเดต header ของชีตผลประเมินไม่สำเร็จ (${response.status}) ${detail}`);
  }
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

export async function upsertEvaluationResult(record, { existingRowIndex = null, headers = [] } = {}) {
  const config = getSheetConfig('results');
  const sheetTitle = await getSheetTitle('results');
  const fetchedResultSheet = await fetchGvizSheet('results');
  const normalizedResultSheet = normalizeHeaderSet(fetchedResultSheet.columns, fetchedResultSheet.rows);
  const baseHeaders = headers.length > 0 ? headers : normalizedResultSheet.headers;
  const missingHeaders = Object.keys(record).filter(key => !baseHeaders.includes(key));
  const resultHeaders = missingHeaders.length > 0 ? [...baseHeaders, ...missingHeaders] : baseHeaders;
  const accessToken = await getGoogleAccessToken();

  if (missingHeaders.length > 0) {
    await updateSheetHeaders(config, sheetTitle, accessToken, resultHeaders);
  }

  const rowValues = buildRowValues(resultHeaders, record);
  const isUpdate = Number.isInteger(existingRowIndex) && existingRowIndex >= 2;

  const range = isUpdate
    ? `${sheetTitle}!A${existingRowIndex}:${getColumnLetter(resultHeaders.length)}${existingRowIndex}`
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

export async function waitForEvaluationResultSync(recordId, { timeoutMs = 12000, intervalMs = 1200 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const fetchedResultSheet = await fetchGvizSheet('results');
    const normalizedResultSheet = normalizeHeaderSet(fetchedResultSheet.columns, fetchedResultSheet.rows);
    const results = normalizeResultRows(normalizedResultSheet.headers, normalizedResultSheet.dataRows);
    const hasRecord = results.some(item => normalizeText(item.id) === normalizeText(recordId));

    if (hasRecord) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}

export { getCurrentEvaluationCycle, normalizeEvaluationCycle, sortEvaluationCycles };
