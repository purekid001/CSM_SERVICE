const {getApps, initializeApp} = require("firebase-admin/app");
const {getDatabase} = require("firebase-admin/database");
const {HttpsError} = require("firebase-functions/v2/https");

const HR_APP_NAME = "hr-database";
const HR_PROJECT_ID = "api--sheet";
const HR_DATABASE_URL =
  "https://api--sheet-default-rtdb.asia-southeast1.firebasedatabase.app";
const MAX_WRITE_BYTES = 512 * 1024;

/**
 * Returns the named Admin app that accesses the HR Firebase project through
 * Application Default Credentials.
 *
 * @return {object} HR Firebase Admin app.
 */
function getHrApp() {
  const existing = getApps().find((app) => app.name === HR_APP_NAME);
  if (existing) return existing;

  return initializeApp(
      {
        projectId: HR_PROJECT_ID,
        databaseURL: HR_DATABASE_URL,
      },
      HR_APP_NAME,
  );
}

/**
 * Returns the HR Realtime Database instance.
 *
 * @return {object} HR database.
 */
function getHrDatabase() {
  return getDatabase(getHrApp());
}

/**
 * Normalizes and validates a client-supplied database path.
 *
 * @param {unknown} value Path supplied by the frontend.
 * @return {string} Normalized path.
 */
function normalizePath(value) {
  const path = String(value ?? "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
  if (
    !path ||
    path.length > 512 ||
    path.includes("..") ||
    ["#", "$", "[", "]"].some((character) => path.includes(character)) ||
    [...path].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new HttpsError("invalid-argument", "Invalid HR database path");
  }
  return path;
}

/**
 * Normalizes legacy access values.
 *
 * @param {unknown} value Legacy access value.
 * @return {string} Normalized access value.
 */
function normalizeAccess(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Checks whether an active user has HR management access.
 *
 * @param {object} profile Legacy user profile.
 * @param {Function} isSystemAdmin Admin checker.
 * @return {boolean} Whether HR mutation access is allowed.
 */
function hasHrManagementAccess(profile, isSystemAdmin) {
  const levelHr = normalizeAccess(profile?.level_Hr);
  return isSystemAdmin(profile) ||
    (levelHr !== "" && levelHr !== "0" && levelHr !== "false");
}

/**
 * Removes legacy plaintext passwords before HR user data reaches a browser.
 *
 * @param {unknown} value User record.
 * @return {unknown} Sanitized record.
 */
function sanitizeUserRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const sanitized = {...value};
  delete sanitized.password;
  return sanitized;
}

/**
 * Sanitizes data returned from an allowed HR path.
 *
 * @param {string} path Database path.
 * @param {unknown} value Snapshot value.
 * @return {unknown} Browser-safe value.
 */
function sanitizeReadValue(path, value) {
  if (path === "DHR/User") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    return Object.fromEntries(
        Object.entries(value).map(
            ([employeeId, record]) => [
              employeeId,
              sanitizeUserRecord(record),
            ],
        ),
    );
  }

  if (/^DHR\/User\/[^/]+$/.test(path)) {
    return sanitizeUserRecord(value);
  }

  return value;
}

/**
 * Checks whether a read path is explicitly supported by the frontend proxy.
 *
 * @param {string} path Database path.
 * @return {boolean} Whether the path is allowed.
 */
function isAllowedReadPath(path) {
  return path === "DHR/User" ||
    /^DHR\/User\/[^/]+$/.test(path) ||
    /^Booking\/(Type|Location|Car|Driver|Booking1|Booking2)(?:\/.*)?$/
        .test(path);
}

/**
 * Checks whether a path identifies one booking record.
 *
 * @param {string} path Database path.
 * @return {boolean} Whether the path is a supported booking record.
 */
function isBookingRecordPath(path) {
  return /^Booking\/(Booking1|Booking2)\/\d{4}\/[^/]{1,160}$/.test(path);
}

/**
 * Validates a JSON payload before sending it to Realtime Database.
 *
 * @param {unknown} value Payload.
 * @param {boolean} requireObject Whether a plain object is required.
 * @return {unknown} Validated payload.
 */
function validateWriteValue(value, requireObject = false) {
  if (
    value === undefined ||
    (requireObject &&
      (!value || typeof value !== "object" || Array.isArray(value)))
  ) {
    throw new HttpsError("invalid-argument", "Invalid HR database value");
  }

  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new HttpsError("invalid-argument", "HR database value is not JSON");
  }

  if (!serialized || Buffer.byteLength(serialized, "utf8") > MAX_WRITE_BYTES) {
    throw new HttpsError("invalid-argument", "HR database value is too large");
  }
  return value;
}

/**
 * Validates an employee ID before a privileged server-side user operation.
 *
 * @param {unknown} value Employee ID.
 * @return {string} Normalized employee ID.
 */
function normalizeEmployeeId(value) {
  const employeeId = String(value ?? "").trim();
  if (!/^\d{6,8}$/.test(employeeId)) {
    throw new HttpsError("invalid-argument", "Invalid employee ID");
  }
  return employeeId;
}

/**
 * Reads one full HR user record for trusted server-side workflows.
 *
 * @param {unknown} employeeId Employee ID.
 * @return {Promise<object|null>} Full legacy record.
 */
async function getHrUserRecord(employeeId) {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  const snapshot = await getHrDatabase()
      .ref(`DHR/User/${normalizedEmployeeId}`)
      .get();
  return snapshot.val() || null;
}

/**
 * Replaces one HR user record for trusted server-side workflows.
 *
 * @param {unknown} employeeId Employee ID.
 * @param {object} value Full legacy record.
 * @return {Promise<void>}
 */
async function setHrUserRecord(employeeId, value) {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  validateWriteValue(value, true);
  await getHrDatabase()
      .ref(`DHR/User/${normalizedEmployeeId}`)
      .set(value);
}

/**
 * Updates one HR user record for trusted server-side workflows.
 *
 * @param {unknown} employeeId Employee ID.
 * @param {object} value Partial legacy record.
 * @return {Promise<void>}
 */
async function updateHrUserRecord(employeeId, value) {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  validateWriteValue(value, true);
  await getHrDatabase()
      .ref(`DHR/User/${normalizedEmployeeId}`)
      .update(value);
}

/**
 * Removes one HR user record during a trusted server-side rollback.
 *
 * @param {unknown} employeeId Employee ID.
 * @return {Promise<void>}
 */
async function removeHrUserRecord(employeeId) {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  await getHrDatabase()
      .ref(`DHR/User/${normalizedEmployeeId}`)
      .remove();
}

/**
 * Handles the allow-listed HR database proxy used by authenticated clients.
 *
 * @param {object} request Callable request.
 * @param {Function} requireActiveUser Authorizer.
 * @param {Function} isSystemAdmin Admin checker.
 * @return {Promise<object>} Operation result.
 */
async function handleHrDatabaseRequest(
    request,
    requireActiveUser,
    isSystemAdmin,
) {
  const user = await requireActiveUser(request);
  const operation = String(request.data?.operation ?? "").trim().toLowerCase();
  const path = normalizePath(request.data?.path);
  const reference = getHrDatabase().ref(path);

  if (operation === "get") {
    if (!isAllowedReadPath(path)) {
      throw new HttpsError("permission-denied", "HR read path is not allowed");
    }
    const snapshot = await reference.get();
    return {
      status: "ok",
      value: sanitizeReadValue(path, snapshot.val()),
    };
  }

  if (!isBookingRecordPath(path)) {
    throw new HttpsError("permission-denied", "HR write path is not allowed");
  }

  if (operation === "set") {
    await reference.set(validateWriteValue(request.data?.value));
    return {status: "ok"};
  }

  if (operation === "update") {
    if (!hasHrManagementAccess(user.profile, isSystemAdmin)) {
      throw new HttpsError(
          "permission-denied",
          "HR management access is required",
      );
    }
    await reference.update(validateWriteValue(request.data?.value, true));
    return {status: "ok"};
  }

  if (operation === "remove") {
    if (!isSystemAdmin(user.profile)) {
      throw new HttpsError(
          "permission-denied",
          "System administrator access is required",
      );
    }
    await reference.remove();
    return {status: "ok"};
  }

  throw new HttpsError("invalid-argument", "Unknown HR database operation");
}

module.exports = {
  getHrUserRecord,
  handleHrDatabaseRequest,
  removeHrUserRecord,
  setHrUserRecord,
  updateHrUserRecord,
};
