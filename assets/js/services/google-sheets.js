import { callWorkspaceFunction } from '../firebase.js';

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

const metadataCache = new Map();

function getSheetConfig(key) {
  const maps = {
    evaluatorCodes: {
      key: 'evaluatorCodes',
      settingsSheetName: 'Settings',
      label: 'รหัสผู้ประเมิน',
    },
    employees: {
      key: 'employees',
      label: 'รายชื่อผู้ถูกประเมิน',
    },
    topics: {
      key: 'topics',
      label: 'หัวข้อการประเมิน',
    },
    weights: {
      key: 'weights',
      label: 'น้ำหนักการประเมิน',
    },
    results: {
      key: 'results',
      label: 'ผลการประเมิน',
    },
    userDirectory: {
      key: 'userDirectory',
      label: 'ข้อมูลผู้ใช้งาน',
    },
    shiftEmployees: {
      key: 'shiftEmployees',
      sheetName: 'Data',
      settingsSheetName: 'Settings',
      label: 'รายชื่อพนักงาน',
    },
    shiftSwapReport: {
      key: 'shiftSwapReport',
      sheetName: 'Data',
      label: 'รายงานเปลี่ยนแลกเวร',
    },
    shiftChangeReport: {
      key: 'shiftChangeReport',
      sheetName: 'Data',
      label: 'รายงานเปลี่ยนกะงาน',
    },
    labourGrievance: {
      key: 'labourGrievance',
      label: 'แบบฟอร์มแจ้งปัญหาด้านแรงงาน',
    },
  };

  const config = maps[key];
  if (!config) {
    throw new Error(`ไม่รู้จัก config ของชีต ${key}`);
  }

  return {
    key: config.key,
    spreadsheetId: '',
    sheetGid: '0',
    sheetName: String(config.sheetName || '').trim(),
    settingsSheetName: String(config.settingsSheetName || '').trim(),
    sourceUrl: '',
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

async function fetchGvizSheet(key) {
  return callWorkspaceFunction('read', {
    sheetKey: key,
  });
}

async function fetchGvizSheetByTabName(sheetKey, sheetName) {
  const normalizedSheetName = normalizeText(sheetName);

  if (!sheetKey || !normalizedSheetName) {
    throw new Error('ยังระบุชุดข้อมูลหรือชื่อแท็บไม่ครบสำหรับการโหลด settings');
  }

  return callWorkspaceFunction('read', {
    sheetKey,
    tabName: normalizedSheetName,
  });
}

async function getSheetMetadata(key) {
  const config = getSheetConfig(key);
  const cacheKey = config.key;
  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey);
  }

  const payload = await callWorkspaceFunction('metadata', {
    sheetKey: key,
  });
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
    fetchGvizSheetByTabName(evaluatorConfig.key, 'Settings'),
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

function encodeSheetPassword(value) {
  const text = String(value ?? '');
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function buildRowValues(headers, record) {
  return headers.map(header => serializeForSheet(record[header] ?? ''));
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
  const fetchedSheet = await fetchGvizSheetByTabName(config.key, sheetName);
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
    const fetchedSheet = await fetchGvizSheetByTabName(config.key, settingsSheetName);
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
  return callWorkspaceFunction('appendShiftReport', {
    kind,
    record,
  });
}

export async function appendLabourGrievance(record = {}) {
  return callWorkspaceFunction('appendLabourGrievance', {
    record,
  });
}

export async function upsertEvaluationResult(record, { existingRowIndex = null, headers = [] } = {}) {
  void existingRowIndex;
  void headers;
  return callWorkspaceFunction('upsertEvaluationResult', {
    record,
  });
}

export async function updateUserDirectoryPassword(employeeId, nextPassword, { alreadyEncoded = false } = {}) {
  if (alreadyEncoded) {
    throw new Error('ไม่รองรับการ rollback รหัสผ่านจากหน้าเว็บแล้ว');
  }
  return callWorkspaceFunction('updateUserDirectoryPassword', {
    employeeId,
    nextPassword,
  });
}

function findUserDirectoryColumnIndex(headers = [], aliases = []) {
  return headers.findIndex(header => aliases.includes(normalizeCompactKey(header)));
}

export async function updateUserDirectoryAccess(employeeId, { department = '', level = '', levelHr = '', levelIt = '', active = '' } = {}) {
  return callWorkspaceFunction('updateUserDirectoryAccess', {
    employeeId,
    department,
    level,
    levelHr,
    levelIt,
    active,
  });
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
  return callWorkspaceFunction('appendUserDirectoryRecord', {
    record,
  });
}

export async function registerEmployeeAccount(record) {
  return callWorkspaceFunction('registerEmployeeAccount', {
    record,
  });
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
