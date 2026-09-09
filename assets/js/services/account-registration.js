import { database, ref as engRef, get as engGet, set as engSet, remove as engRemove } from '../firebase.js';
import { getUserDirectoryRecords, registerEmployeeAccount } from './google-sheets.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function getDirectoryEmployeeId(record) {
  return normalizeText(record?.['employee ID'] ?? record?.employeeId ?? record?.employeeid);
}

function buildFirebaseUserRecord({ employeeId, password, firstname, lastname, department, email }) {
  return {
    username: employeeId,
    firstname,
    lastname,
    department,
    password,
    email,
    level: '0',
    level_Hr: '0',
    level_It: '0',
    remark: '',
    active: 'true',
    code: 'E',
  };
}

function buildSheetUserRecord({ employeeId, password, firstname, lastname, department, email }) {
  return {
    employeeId,
    username: employeeId,
    firstname,
    lastname,
    department,
    password,
    email,
    level: '0',
    levelHr: '0',
    levelIt: '0',
    remark: '',
    active: true,
    code: 'E',
  };
}

export async function registerUserAccount({ employeeId, password, firstname, lastname, department, email }) {
  const normalizedEmployeeId = normalizeText(employeeId);
  const normalizedFirstname = normalizeText(firstname);
  const normalizedLastname = normalizeText(lastname);
  const normalizedDepartment = normalizeText(department);
  const normalizedEmail = normalizeText(email);
  const normalizedPassword = String(password ?? '');
  const userPath = `DHR/User/${normalizedEmployeeId}`;

  const [engineeringSnapshot, directoryResult] = await Promise.all([
    engGet(engRef(database, userPath)),
    getUserDirectoryRecords(),
  ]);

  if (engineeringSnapshot.exists()) {
    throw new Error(`รหัสพนักงาน ${normalizedEmployeeId} มีอยู่ในระบบแล้ว`);
  }

  const alreadyExistsInSheet = directoryResult.records.some(record => getDirectoryEmployeeId(record) === normalizedEmployeeId);
  if (alreadyExistsInSheet) {
    throw new Error(`รหัสพนักงาน ${normalizedEmployeeId} มีอยู่ในชีตผู้ใช้งานแล้ว`);
  }

  const firebaseRecord = buildFirebaseUserRecord({
    employeeId: normalizedEmployeeId,
    password: normalizedPassword,
    firstname: normalizedFirstname,
    lastname: normalizedLastname,
    department: normalizedDepartment,
    email: normalizedEmail,
  });

  const rollbacks = [];

  try {
    await engSet(engRef(database, userPath), firebaseRecord);
    rollbacks.push(() => engRemove(engRef(database, userPath)));

    const registrationResult = await registerEmployeeAccount(buildSheetUserRecord({
      employeeId: normalizedEmployeeId,
      password: normalizedPassword,
      firstname: normalizedFirstname,
      lastname: normalizedLastname,
      department: normalizedDepartment,
      email: normalizedEmail,
    }));

    if (registrationResult.authUid !== normalizedEmployeeId) {
      throw new Error('สร้าง Firebase Auth UID ไม่ตรงกับรหัสพนักงาน');
    }

    return {
      employeeId: normalizedEmployeeId,
      authUid: registrationResult.authUid,
      sheetSourceUrl: registrationResult.sourceUrl || directoryResult.sourceUrl || '',
      createdTargets: [
        'Firebase Authentication',
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
