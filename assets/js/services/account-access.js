import {
  database,
  ref as engRef,
  get as engGet,
  set as engSet,
  update as engUpdate,
  remove as engRemove,
} from '../firebase.js';
import {
  hrDatabase,
  ref as hrRef,
  get as hrGet,
} from '../firebase-hr.js';
import {
  appendUserDirectoryRecord,
  getUserDirectoryRecords,
  updateUserDirectoryAccess,
} from './google-sheets.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value) {
  const normalized = normalizeKey(value);
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function decodeSheetPassword(value) {
  const text = normalizeText(value);
  if (!text) return '';

  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    return text;
  }
}

function getSheetEmployeeId(record) {
  return normalizeText(record?.['employee ID'] ?? record?.employeeId ?? record?.employeeid ?? record?.username);
}

function normalizeSheetRecord(record = {}) {
  return {
    username: normalizeText(record.username) || getSheetEmployeeId(record),
    firstname: normalizeText(record.firstname),
    lastname: normalizeText(record.lastname),
    department: normalizeText(record.department),
    password: decodeSheetPassword(record.password),
    email: normalizeText(record.email),
    level: normalizeText(record.level) || '0',
    level_Hr: normalizeText(record.levelHr ?? record.level_Hr) || '0',
    level_It: normalizeText(record.levelIt ?? record.level_It) || '0',
    remark: normalizeText(record.remark),
    active: normalizeBoolean(record.active) ? 'true' : 'false',
    code: normalizeText(record.code) || 'E',
  };
}

function getPreferredValue(...values) {
  return values.find(value => normalizeText(value) !== '') ?? '';
}

function buildMergedUserRecord(employeeId, engineeringRecord = null, hrRecord = null, sheetRecord = null) {
  const normalizedSheet = sheetRecord ? normalizeSheetRecord(sheetRecord) : null;
  const firstname = getPreferredValue(engineeringRecord?.firstname, hrRecord?.firstname, normalizedSheet?.firstname);
  const lastname = getPreferredValue(engineeringRecord?.lastname, hrRecord?.lastname, normalizedSheet?.lastname);

  return {
    employeeId,
    username: getPreferredValue(engineeringRecord?.username, hrRecord?.username, normalizedSheet?.username, employeeId),
    firstname,
    lastname,
    fullName: `${firstname} ${lastname}`.trim() || '-',
    department: getPreferredValue(engineeringRecord?.department, hrRecord?.department, normalizedSheet?.department, '-'),
    email: getPreferredValue(engineeringRecord?.email, hrRecord?.email, normalizedSheet?.email, '-'),
    password: getPreferredValue(engineeringRecord?.password, hrRecord?.password, normalizedSheet?.password),
    level: getPreferredValue(engineeringRecord?.level, hrRecord?.level, normalizedSheet?.level, '0'),
    level_Hr: getPreferredValue(engineeringRecord?.level_Hr, hrRecord?.level_Hr, normalizedSheet?.level_Hr, '0'),
    level_It: getPreferredValue(engineeringRecord?.level_It, hrRecord?.level_It, normalizedSheet?.level_It, '0'),
    remark: getPreferredValue(engineeringRecord?.remark, hrRecord?.remark, normalizedSheet?.remark),
    active: normalizeBoolean(
      getPreferredValue(engineeringRecord?.active, hrRecord?.active, normalizedSheet?.active, 'false')
    )
      ? 'true'
      : 'false',
    code: getPreferredValue(engineeringRecord?.code, hrRecord?.code, normalizedSheet?.code, 'E'),
    hasEngineering: Boolean(engineeringRecord),
    hasHr: Boolean(hrRecord),
    hasSheet: Boolean(sheetRecord),
  };
}

function buildSheetUserRecord(baseRecord, nextProfile) {
  return {
    employeeId: baseRecord.employeeId,
    username: baseRecord.username || baseRecord.employeeId,
    firstname: baseRecord.firstname || '',
    lastname: baseRecord.lastname || '',
    department: nextProfile.department || baseRecord.department || '',
    password: baseRecord.password || '',
    email: baseRecord.email || '',
    level: nextProfile.level,
    levelHr: nextProfile.level_Hr,
    levelIt: nextProfile.level_It,
    remark: baseRecord.remark || '',
    active: normalizeBoolean(nextProfile.active),
    code: baseRecord.code || 'E',
  };
}

async function loadFirebaseUsers() {
  const [engineeringSnapshot, hrSnapshot] = await Promise.all([
    engGet(engRef(database, 'DHR/User')),
    hrGet(hrRef(hrDatabase, 'DHR/User')),
  ]);

  return {
    engineeringUsers: engineeringSnapshot.exists() ? engineeringSnapshot.val() || {} : {},
    hrUsers: hrSnapshot.exists() ? hrSnapshot.val() || {} : {},
  };
}

export async function listUserAccessDirectory() {
  const [{ engineeringUsers, hrUsers }, directoryResult] = await Promise.all([
    loadFirebaseUsers(),
    getUserDirectoryRecords(),
  ]);

  const sheetMap = new Map(
    directoryResult.records
      .map(record => [getSheetEmployeeId(record), record])
      .filter(([employeeId]) => employeeId)
  );

  const employeeIds = new Set([
    ...Object.keys(engineeringUsers || {}),
    ...Object.keys(hrUsers || {}),
    ...sheetMap.keys(),
  ]);

  const users = [...employeeIds]
    .map(employeeId => buildMergedUserRecord(
      employeeId,
      engineeringUsers?.[employeeId] || null,
      hrUsers?.[employeeId] || null,
      sheetMap.get(employeeId) || null
    ))
    .sort((left, right) => {
      const departmentCompare = normalizeText(left.department).localeCompare(normalizeText(right.department), 'th');
      if (departmentCompare !== 0) return departmentCompare;
      return normalizeText(left.employeeId).localeCompare(normalizeText(right.employeeId), 'th');
    });

  return {
    users,
    sourceUrl: directoryResult.sourceUrl,
  };
}

async function updateFirebaseAccessRecord({
  databaseRef,
  refFactory,
  updateValue,
  setValue,
  removeValue,
  employeeId,
  exists,
  previousRecord,
  nextProfile,
  baseRecord,
}) {
  const path = `DHR/User/${employeeId}`;

  if (exists) {
    await updateValue(refFactory(databaseRef, path), {
      department: nextProfile.department,
      level: nextProfile.level,
      level_Hr: nextProfile.level_Hr,
      level_It: nextProfile.level_It,
      active: nextProfile.active,
    });

    return async () => {
      await updateValue(refFactory(databaseRef, path), {
        department: normalizeText(previousRecord?.department),
        level: normalizeText(previousRecord?.level) || '0',
        level_Hr: normalizeText(previousRecord?.level_Hr) || '0',
        level_It: normalizeText(previousRecord?.level_It) || '0',
        active: normalizeBoolean(previousRecord?.active) ? 'true' : 'false',
      });
    };
  }

  await setValue(refFactory(databaseRef, path), {
    username: baseRecord.username || employeeId,
    firstname: baseRecord.firstname || '',
    lastname: baseRecord.lastname || '',
    department: nextProfile.department || baseRecord.department || '',
    password: baseRecord.password || '',
    email: baseRecord.email || '',
    level: nextProfile.level,
    level_Hr: nextProfile.level_Hr,
    level_It: nextProfile.level_It,
    remark: baseRecord.remark || '',
    active: nextProfile.active,
    code: baseRecord.code || 'E',
  });

  return async () => {
    await removeValue(refFactory(databaseRef, path));
  };
}

export async function updateUserAccessProfile({ employeeId, department = '', level = '', level_Hr = '', level_It = '', active = '' }) {
  const normalizedEmployeeId = normalizeText(employeeId);
  if (!normalizedEmployeeId) {
    throw new Error('ไม่พบรหัสพนักงานที่ต้องการอัปเดต');
  }

  const requestedDepartment = normalizeText(department);
  const userPath = `DHR/User/${normalizedEmployeeId}`;

  const [engineeringSnapshot, hrSnapshot, directoryResult] = await Promise.all([
    engGet(engRef(database, userPath)),
    hrGet(hrRef(hrDatabase, userPath)),
    getUserDirectoryRecords(),
  ]);

  const engineeringRecord = engineeringSnapshot.exists() ? engineeringSnapshot.val() || {} : null;
  const hrRecord = hrSnapshot.exists() ? hrSnapshot.val() || {} : null;
  const sheetRecord = directoryResult.records.find(record => getSheetEmployeeId(record) === normalizedEmployeeId) || null;

  if (!engineeringRecord && !hrRecord && !sheetRecord) {
    throw new Error(`ไม่พบข้อมูลผู้ใช้รหัส ${normalizedEmployeeId} ในระบบ`);
  }

  const baseRecord = buildMergedUserRecord(normalizedEmployeeId, engineeringRecord, hrRecord, sheetRecord);
  const nextProfile = {
    department: requestedDepartment || baseRecord.department || '',
    level: normalizeText(level) || '0',
    level_Hr: normalizeText(level_Hr) || '0',
    level_It: normalizeText(level_It) || '0',
    active: normalizeBoolean(active) ? 'true' : 'false',
  };
  const rollbacks = [];

  try {
    rollbacks.push(await updateFirebaseAccessRecord({
      databaseRef: database,
      refFactory: engRef,
      updateValue: engUpdate,
      setValue: engSet,
      removeValue: engRemove,
      employeeId: normalizedEmployeeId,
      exists: Boolean(engineeringRecord),
      previousRecord: engineeringRecord,
      nextProfile,
      baseRecord,
    }));

    if (sheetRecord) {
      await updateUserDirectoryAccess(normalizedEmployeeId, {
        department: nextProfile.department,
        level: nextProfile.level,
        levelHr: nextProfile.level_Hr,
        levelIt: nextProfile.level_It,
        active: nextProfile.active,
      });
    } else {
      await appendUserDirectoryRecord(buildSheetUserRecord(baseRecord, nextProfile));
    }

    return {
      employeeId: normalizedEmployeeId,
      updatedTargets: [
        'Firebase DHR/User (ฝั่ง EN)',
        'Firebase DHR/User (ฝั่ง HR)',
        'Google Sheet / User Directory',
      ],
    };
  } catch (error) {
    const rollbackErrors = [];

    for (const rollback of rollbacks.reverse()) {
      try {
        await rollback();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error(`${error.message} | rollback ไม่สมบูรณ์: ${rollbackErrors.join(' | ')}`);
    }

    throw error;
  }
}
