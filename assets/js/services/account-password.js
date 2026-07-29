import {
  changeFirebaseAuthPassword,
  database,
  ref as engRef,
  get as engGet,
  update as engUpdate,
} from '../firebase.js';
import { updateUserDirectoryPassword } from './google-sheets.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

async function getRequiredUserRecord(db, refFactory, getValue, path, label) {
  const snapshot = await getValue(refFactory(db, path));
  if (!snapshot.exists()) {
    throw new Error(`ไม่พบข้อมูลผู้ใช้ใน ${label}`);
  }
  return snapshot.val() || {};
}

async function updatePasswordField(db, refFactory, updateValue, path, password) {
  await updateValue(refFactory(db, path), { password });
}

export async function changeUserPassword({ employeeId, currentPassword, newPassword }) {
  const normalizedEmployeeId = normalizeText(employeeId);
  if (!normalizedEmployeeId) {
    throw new Error('ไม่พบรหัสพนักงานของผู้ใช้ที่เข้าสู่ระบบ');
  }

  const engPath = `DHR/User/${normalizedEmployeeId}`;
  const engineeringRecord = await getRequiredUserRecord(
    database,
    engRef,
    engGet,
    engPath,
    'Firebase DHR/User (ฝั่ง EN)',
  );

  if (String(engineeringRecord.password ?? '') !== String(currentPassword ?? '')) {
    throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }

  const rollbacks = [];

  try {
    await changeFirebaseAuthPassword(currentPassword, newPassword);
    rollbacks.push(() => changeFirebaseAuthPassword(newPassword, currentPassword));

    await updatePasswordField(database, engRef, engUpdate, engPath, newPassword);
    rollbacks.push(() => updatePasswordField(database, engRef, engUpdate, engPath, engineeringRecord.password ?? ''));

    const sheetResult = await updateUserDirectoryPassword(normalizedEmployeeId, newPassword);

    return {
      employeeId: normalizedEmployeeId,
      sheetRowNumber: sheetResult.rowNumber,
      updatedTargets: [
        'Firebase Authentication',
        'Google Sheet / User',
        'Firebase DHR/User (ฝั่ง EN)',
        'Firebase DHR/User',
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
