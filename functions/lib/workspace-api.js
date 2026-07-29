const {getAuth} = require("firebase-admin/auth");
const {getDatabase} = require("firebase-admin/database");
const {HttpsError} = require("firebase-functions/v2/https");
const {getGoogleClient} = require("./google-workspace");
const {
  getHrUserRecord,
  removeHrUserRecord,
  setHrUserRecord,
  updateHrUserRecord,
} = require("./hr-database");

const LABOUR_GRIEVANCE_HEADERS = [
  "วันที่และเวลาที่ส่ง",
  "การเปิดเผยตัวตน",
  "ชื่อ-นามสกุล",
  "แผนก",
  "เบอร์โทร",
  "ประเภทปัญหา",
  "ปัญหาอื่น ๆ",
  "วันที่เกิดเหตุ",
  "สถานที่",
  "รายละเอียดเหตุการณ์",
  "บุคคลที่เกี่ยวข้อง",
  "ต้องการให้บริษัทดำเนินการอย่างไร",
  "ยืนยันข้อมูลเป็นความจริง",
];

const SHIFT_SWAP_DEFAULT_HEADERS = [
  "id",
  "วันที่บันทึก",
  "รหัสผู้บันทึก",
  "ผู้บันทึก",
  "แผนกผู้บันทึก",
  "รหัสพนักงาน",
  "พนักงาน",
  "ส่วน",
  "แผนก",
  "หน่วย",
  "ตำแหน่ง",
  "วันที่",
  "ถึงวันที่",
  "เวรเดิม",
  "เวรใหม่",
  "เหตุผล",
  "หมายเหตุ",
  "ลายเซ็นผู้อนุมัติ",
  "source",
];

const SHIFT_CHANGE_DEFAULT_HEADERS = [
  "id",
  "วันที่บันทึก",
  "รหัสผู้บันทึก",
  "ผู้บันทึก",
  "แผนกผู้บันทึก",
  "รหัสพนักงาน",
  "พนักงาน",
  "ส่วน",
  "แผนก",
  "หน่วย",
  "ตำแหน่ง",
  "วันที่",
  "ถึงวันที่",
  "กะเดิม",
  "กะใหม่",
  "เหตุผล",
  "หมายเหตุ",
  "ลายเซ็นผู้อนุมัติ",
  "source",
];

const PUBLIC_RATE_LIMIT = {
  maxRequests: 8,
  windowMs: 60 * 60 * 1000,
};

const publicRequestCounters = new Map();
const metadataCache = new Map();

/**
 * Normalizes a value to a trimmed string.
 *
 * @param {unknown} value Value to normalize.
 * @return {string} Normalized string.
 */
function normalizeText(value) {
  return String(value ?? "").trim();
}

/**
 * Produces a compact comparison key.
 *
 * @param {unknown} value Value to normalize.
 * @return {string} Compact lowercase key.
 */
function normalizeKey(value) {
  return normalizeText(value)
      .toLowerCase()
      .replace(/[\s_\-()/]+/g, "");
}

/**
 * Interprets legacy boolean values.
 *
 * @param {unknown} value Legacy value.
 * @return {boolean} Boolean interpretation.
 */
function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "true" ||
    normalized === "1" ||
    normalized === "yes";
}

/**
 * Converts a one-based column number to a Sheet column label.
 *
 * @param {number} index One-based column index.
 * @return {string} A1 column label.
 */
function getColumnLetter(index) {
  let current = index;
  let value = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }

  return value || "A";
}

/**
 * Converts structured values to safe Sheet cell values.
 *
 * @param {unknown} value Source value.
 * @return {unknown} Serialized cell value.
 */
function serializeForSheet(value) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }
  return value ?? "";
}

/**
 * Returns a configured Sheet without exposing its ID to callers.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {string} key Logical Sheet key.
 * @return {object} Sheet configuration.
 */
function getSheetConfig(config, key) {
  const sheet = config?.sheets?.[key];
  if (!sheet?.id) {
    throw new HttpsError("failed-precondition", `Unknown Sheet key: ${key}`);
  }
  return {
    key,
    id: normalizeText(sheet.id),
    gid: normalizeText(sheet.gid || "0"),
    sheetName: normalizeText(sheet.sheetName),
    settingsSheetName: normalizeText(sheet.settingsSheetName),
  };
}

/**
 * Loads the signed-in user's live legacy profile.
 *
 * @param {object} request Callable request.
 * @return {Promise<object>} Active user profile.
 */
async function requireActiveUser(request) {
  const uid = normalizeText(request.auth?.uid);
  if (!uid) {
    throw new HttpsError("unauthenticated", "Firebase Auth is required");
  }

  const snapshot = await getDatabase().ref(`DHR/User/${uid}`).get();
  const profile = snapshot.val() || null;
  if (!profile || !normalizeBoolean(profile.active)) {
    throw new HttpsError("permission-denied", "User account is inactive");
  }

  return {
    uid,
    profile,
  };
}

/**
 * Checks whether a user has system-administrator access.
 *
 * @param {object} profile Legacy user profile.
 * @return {boolean} Whether the user is a system administrator.
 */
function isSystemAdmin(profile) {
  const levelEn = normalizeText(profile?.level).toLowerCase();
  const levelHr = normalizeText(profile?.level_Hr).toLowerCase();
  return levelEn === "admin" || levelHr === "admin";
}

/**
 * Applies a conservative per-instance rate limit to public forms.
 *
 * @param {object} request Callable request.
 * @param {string} bucket Rate-limit bucket.
 * @return {void}
 */
function enforcePublicRateLimit(request, bucket) {
  const now = Date.now();
  const address = normalizeText(
      request.rawRequest?.headers?.["x-forwarded-for"] ||
      request.rawRequest?.ip ||
      "unknown",
  ).split(",")[0];
  const key = `${bucket}:${address}`;
  const current = publicRequestCounters.get(key);

  if (!current || current.expiresAt <= now) {
    publicRequestCounters.set(key, {
      count: 1,
      expiresAt: now + PUBLIC_RATE_LIMIT.windowMs,
    });
    return;
  }

  if (current.count >= PUBLIC_RATE_LIMIT.maxRequests) {
    throw new HttpsError(
        "resource-exhausted",
        "Too many public form submissions",
    );
  }

  current.count += 1;
}

/**
 * Loads Sheet metadata using ADC.
 *
 * @param {object} sheet Sheet configuration.
 * @return {Promise<object>} Google Sheets metadata.
 */
async function getSheetMetadata(sheet) {
  const cacheKey = `${sheet.id}:${sheet.gid}`;
  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey);
  }

  const client = await getGoogleClient();
  const response = await client.request({
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet.id)}`,
    params: {
      fields: "sheets(properties(sheetId,title,index,tabColor,tabColorStyle))",
    },
  });
  metadataCache.set(cacheKey, response.data);
  return response.data;
}

/**
 * Resolves the configured gid to a tab title.
 *
 * @param {object} sheet Sheet configuration.
 * @return {Promise<string>} Sheet tab title.
 */
async function getSheetTitle(sheet) {
  if (sheet.sheetName) return sheet.sheetName;
  const metadata = await getSheetMetadata(sheet);
  const targetGid = Number(sheet.gid || 0);
  const match = metadata.sheets?.find(
      (item) => Number(item?.properties?.sheetId) === targetGid,
  );
  const fallback = metadata.sheets?.[0];
  const title = normalizeText(
      match?.properties?.title || fallback?.properties?.title,
  );

  if (!title) {
    throw new HttpsError("failed-precondition", "Sheet tab was not found");
  }
  return title;
}

/**
 * Reads a values range.
 *
 * @param {object} sheet Sheet configuration.
 * @param {string} title Tab title.
 * @param {string} range Range within the tab.
 * @return {Promise<Array<Array<unknown>>>} Sheet rows.
 */
async function getValues(sheet, title, range = "A:ZZ") {
  const client = await getGoogleClient();
  const response = await client.request({
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet.id)}/values/${encodeURIComponent(`${title}!${range}`)}`,
  });
  return Array.isArray(response.data?.values) ? response.data.values : [];
}

/**
 * Writes one values range.
 *
 * @param {object} sheet Sheet configuration.
 * @param {string} range Full A1 range.
 * @param {Array<Array<unknown>>} values Rows to write.
 * @param {string} valueInputOption RAW or USER_ENTERED.
 * @return {Promise<object>} Google API response.
 */
async function updateValues(
    sheet,
    range,
    values,
    valueInputOption = "RAW",
) {
  const client = await getGoogleClient();
  const response = await client.request({
    method: "PUT",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet.id)}/values/${encodeURIComponent(range)}`,
    params: {valueInputOption},
    data: {
      majorDimension: "ROWS",
      values,
    },
  });
  return response.data;
}

/**
 * Appends one values row.
 *
 * @param {object} sheet Sheet configuration.
 * @param {string} title Target tab.
 * @param {Array<unknown>} values Row values.
 * @param {string} valueInputOption RAW or USER_ENTERED.
 * @return {Promise<object>} Google API response.
 */
async function appendValues(
    sheet,
    title,
    values,
    valueInputOption = "RAW",
) {
  const client = await getGoogleClient();
  const response = await client.request({
    method: "POST",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet.id)}/values/${encodeURIComponent(`${title}!A1`)}:append`,
    params: {
      valueInputOption,
      insertDataOption: "INSERT_ROWS",
    },
    data: {
      majorDimension: "ROWS",
      values: [values],
    },
  });
  return response.data;
}

/**
 * Adds missing headers and returns the complete header row.
 *
 * @param {object} sheet Sheet configuration.
 * @param {string} title Target tab.
 * @param {Array<string>} requiredHeaders Required headers.
 * @return {Promise<{headers: Array<string>, values: Array<Array<unknown>>}>}
 *   Complete headers and existing values.
 */
async function ensureHeaders(sheet, title, requiredHeaders) {
  const values = await getValues(sheet, title);
  const existingHeaders = Array.isArray(values[0]) ?
    values[0].map(normalizeText) :
    [];

  while (existingHeaders.length && !existingHeaders.at(-1)) {
    existingHeaders.pop();
  }

  const missingHeaders = requiredHeaders.filter((header) =>
    !existingHeaders.some((existing) =>
      normalizeKey(existing) === normalizeKey(header),
    ),
  );
  const headers = existingHeaders.length ?
    [...existingHeaders, ...missingHeaders] :
    [...requiredHeaders];

  if (!existingHeaders.length || missingHeaders.length) {
    const range = `${title}!A1:${getColumnLetter(headers.length)}1`;
    await updateValues(sheet, range, [headers]);
  }

  return {headers, values};
}

/**
 * Returns Sheet rows in the shape expected by the existing frontend parser.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {string} key Logical Sheet key.
 * @param {string} requestedTab Optional allowed tab name.
 * @return {Promise<object>} Columns and data rows.
 */
async function readSheet(config, key, requestedTab = "") {
  const sheet = getSheetConfig(config, key);
  const allowedTabs = [
    sheet.sheetName,
    sheet.settingsSheetName,
    key === "evaluatorCodes" ? "Settings" : "",
  ].filter(Boolean);
  const tab = normalizeText(requestedTab);
  if (tab && !allowedTabs.includes(tab)) {
    throw new HttpsError("invalid-argument", "Requested tab is not allowed");
  }

  const title = tab || await getSheetTitle(sheet);
  const values = await getValues(sheet, title);
  let columns = Array.isArray(values[0]) ? values[0].map(normalizeText) : [];
  let rows = values.slice(1);

  if (key === "userDirectory") {
    const passwordIndex = columns.findIndex(
        (header) => normalizeKey(header) === "password",
    );
    if (passwordIndex >= 0) {
      columns = columns.filter((unused, index) => index !== passwordIndex);
      rows = rows.map(
          (row) => row.filter((unused, index) => index !== passwordIndex),
      );
    }
  }

  return {
    columns,
    rows,
    sourceUrl: "",
  };
}

/**
 * Encodes a legacy Sheet password exactly as the existing frontend did.
 *
 * @param {unknown} value Password value.
 * @return {string} Base64-encoded UTF-8 string.
 */
function encodeSheetPassword(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64");
}

/**
 * Maps a user-directory record into an existing header.
 *
 * @param {object} record User record.
 * @param {string} header Sheet header.
 * @return {unknown} Cell value.
 */
function getUserDirectoryValue(record, header) {
  const key = normalizeKey(header);
  const values = {
    employeeid: record.employeeId ?? record.employeeid ?? "",
    firstname: record.firstname ?? "",
    lastname: record.lastname ?? "",
    department: record.department ?? "",
    level: record.level ?? "",
    levelhr: record.levelHr ?? record.level_Hr ?? "",
    levelit: record.levelIt ?? record.level_It ?? "",
    username: record.username ?? record.employeeId ?? "",
    password: encodeSheetPassword(record.password ?? ""),
    email: record.email ?? "",
    remark: record.remark ?? "",
    active: normalizeBoolean(record.active),
    code: record.code ?? "",
  };
  return values[key] ?? record[header] ?? "";
}

/**
 * Adds one user-directory record after verifying the corresponding legacy
 * record already exists.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record User record.
 * @return {Promise<object>} Sanitized append response.
 */
async function prepareUserDirectoryAppend(config, record) {
  const employeeId = normalizeText(record?.employeeId);
  if (!/^\d{6,8}$/.test(employeeId)) {
    throw new HttpsError("invalid-argument", "Invalid employee ID");
  }

  const legacySnapshot = await getDatabase()
      .ref(`DHR/User/${employeeId}`)
      .get();
  const legacy = legacySnapshot.val() || null;
  if (
    !legacy ||
    String(legacy.password ?? "") !== String(record.password ?? "") ||
    !normalizeBoolean(legacy.active)
  ) {
    throw new HttpsError(
        "failed-precondition",
        "Matching active legacy user was not found",
    );
  }

  const sheet = getSheetConfig(config, "userDirectory");
  const title = await getSheetTitle(sheet);
  const values = await getValues(sheet, title);
  const headers = Array.isArray(values[0]) ? values[0].map(normalizeText) : [];
  if (!headers.length) {
    throw new HttpsError("failed-precondition", "User headers were not found");
  }

  const employeeIdIndex = headers.findIndex(
      (header) => normalizeKey(header) === "employeeid",
  );
  const duplicate = values.slice(1).some(
      (row) => normalizeText(row?.[employeeIdIndex]) === employeeId,
  );
  if (duplicate) {
    throw new HttpsError("already-exists", "Employee already exists");
  }

  const row = headers.map(
      (header) => serializeForSheet(getUserDirectoryValue(record, header)),
  );
  return {
    employeeId,
    legacy,
    row,
    sheet,
    title,
  };
}

/**
 * Adds one user-directory record after verifying the corresponding legacy
 * record already exists.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record User record.
 * @return {Promise<object>} Sanitized append response.
 */
async function appendUserDirectoryRecord(config, record) {
  const prepared = await prepareUserDirectoryAppend(config, record);
  const previousHrRecord = await getHrUserRecord(prepared.employeeId);

  try {
    if (previousHrRecord) {
      await updateHrUserRecord(prepared.employeeId, {
        level: normalizeText(prepared.legacy.level) || "0",
        level_Hr: normalizeText(prepared.legacy.level_Hr) || "0",
        level_It: normalizeText(prepared.legacy.level_It) || "0",
        active: normalizeBoolean(prepared.legacy.active) ? "true" : "false",
      });
    } else {
      await setHrUserRecord(prepared.employeeId, prepared.legacy);
    }
    await appendValues(
        prepared.sheet,
        prepared.title,
        prepared.row,
    );
    return {status: "ok"};
  } catch (error) {
    try {
      if (previousHrRecord) {
        await setHrUserRecord(prepared.employeeId, previousHrRecord);
      } else {
        await removeHrUserRecord(prepared.employeeId);
      }
    } catch (rollbackError) {
      console.error("HR user append rollback failed", {
        code: rollbackError?.code || null,
        employeeId: prepared.employeeId,
      });
      throw new HttpsError("internal", "HR user rollback failed");
    }
    throw error;
  }
}

/**
 * Builds the internal Firebase Auth email for an employee ID.
 *
 * @param {string} employeeId Employee ID used as the Firebase Auth UID.
 * @return {string} Internal email used only for email/password authentication.
 */
function getEmployeeAuthEmail(employeeId) {
  return `${employeeId.toLowerCase()}@auth.csm.local`;
}

/**
 * Creates Firebase Auth and User Directory records as one registration unit.
 * The Auth user is deleted again if the Sheet append fails.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record User registration record.
 * @return {Promise<object>} Sanitized registration response.
 */
async function registerEmployeeAccount(config, record) {
  const password = String(record?.password ?? "");
  if (password.length < 6 || password.length > 128) {
    throw new HttpsError(
        "invalid-argument",
        "Password must contain 6 to 128 characters",
    );
  }

  const prepared = await prepareUserDirectoryAppend(config, record);
  const {employeeId, legacy} = prepared;
  const existingHrRecord = await getHrUserRecord(employeeId);
  if (existingHrRecord) {
    throw new HttpsError(
        "already-exists",
        "Employee already exists in the HR database",
    );
  }
  const displayName = [
    normalizeText(legacy.firstname),
    normalizeText(legacy.lastname),
  ].filter(Boolean).join(" ").slice(0, 128) || employeeId;
  let authUserCreated = false;
  let hrUserCreated = false;

  try {
    await setHrUserRecord(employeeId, legacy);
    hrUserCreated = true;

    await getAuth().createUser({
      uid: employeeId,
      email: getEmployeeAuthEmail(employeeId),
      password,
      displayName,
      disabled: false,
    });
    authUserCreated = true;

    await getAuth().setCustomUserClaims(employeeId, {
      active: true,
      employeeId,
      levelEn: normalizeText(legacy.level || "0"),
      levelHr: normalizeText(legacy.level_Hr || "0"),
      levelIt: normalizeText(legacy.level_It || "0"),
    });

    await appendValues(
        prepared.sheet,
        prepared.title,
        prepared.row,
    );

    return {
      status: "ok",
      authUid: employeeId,
    };
  } catch (error) {
    const rollbackErrors = [];

    if (authUserCreated) {
      try {
        await getAuth().deleteUser(employeeId);
      } catch (rollbackError) {
        console.error("Firebase Auth registration rollback failed", {
          code: rollbackError?.code || null,
          name: rollbackError?.name || "FirebaseAuthRollbackError",
          employeeId,
        });
        rollbackErrors.push("Firebase Auth");
      }
    }

    if (hrUserCreated) {
      try {
        await removeHrUserRecord(employeeId);
      } catch (rollbackError) {
        console.error("HR registration rollback failed", {
          code: rollbackError?.code || null,
          name: rollbackError?.name || "HrRegistrationRollbackError",
          employeeId,
        });
        rollbackErrors.push("HR database");
      }
    }

    if (rollbackErrors.length) {
      throw new HttpsError("internal", "Registration rollback failed");
    }

    if (
      error?.code === "auth/uid-already-exists" ||
      error?.code === "auth/email-already-exists"
    ) {
      throw new HttpsError(
          "already-exists",
          "Firebase Auth account already exists",
      );
    }
    if (error?.code === "auth/invalid-password") {
      throw new HttpsError(
          "invalid-argument",
          "Password does not meet the Firebase Auth policy",
      );
    }
    throw error;
  }
}

/**
 * Updates the signed-in user's password column in the user directory.
 *
 * @param {object} request Callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {string} employeeId Employee ID.
 * @param {string} nextPassword New plaintext password.
 * @return {Promise<object>} Sanitized result.
 */
async function updateUserDirectoryPassword(
    request,
    config,
    employeeId,
    nextPassword,
) {
  const user = await requireActiveUser(request);
  const normalizedEmployeeId = normalizeText(employeeId);
  if (user.uid !== normalizedEmployeeId) {
    throw new HttpsError("permission-denied", "Cannot update another user");
  }
  if (String(nextPassword ?? "").length < 6) {
    throw new HttpsError("invalid-argument", "Password is too short");
  }

  const legacySnapshot = await getDatabase()
      .ref(`DHR/User/${normalizedEmployeeId}`)
      .get();
  const legacy = legacySnapshot.val() || null;
  if (!legacy) {
    throw new HttpsError("not-found", "Legacy user was not found");
  }

  const sheet = getSheetConfig(config, "userDirectory");
  const title = await getSheetTitle(sheet);
  const values = await getValues(sheet, title);
  const headers = Array.isArray(values[0]) ? values[0].map(normalizeText) : [];
  const employeeIdIndex = headers.findIndex(
      (header) => normalizeKey(header) === "employeeid",
  );
  const passwordIndex = headers.findIndex(
      (header) => normalizeKey(header) === "password",
  );
  const rowIndex = values.findIndex(
      (row, index) => index > 0 &&
      normalizeText(row?.[employeeIdIndex]) === normalizedEmployeeId,
  );
  if (rowIndex < 1 || passwordIndex < 0) {
    throw new HttpsError("not-found", "User row was not found");
  }

  const rowNumber = rowIndex + 1;
  const range =
    `${title}!${getColumnLetter(passwordIndex + 1)}${rowNumber}`;
  const previousHrRecord = await getHrUserRecord(normalizedEmployeeId);

  try {
    if (previousHrRecord) {
      await updateHrUserRecord(normalizedEmployeeId, {
        password: String(nextPassword ?? ""),
      });
    } else {
      await setHrUserRecord(normalizedEmployeeId, {
        ...legacy,
        password: String(nextPassword ?? ""),
      });
    }

    await updateValues(sheet, range, [[encodeSheetPassword(nextPassword)]]);
    return {status: "ok", rowNumber};
  } catch (error) {
    try {
      if (previousHrRecord) {
        await setHrUserRecord(normalizedEmployeeId, previousHrRecord);
      } else {
        await removeHrUserRecord(normalizedEmployeeId);
      }
    } catch (rollbackError) {
      console.error("HR password rollback failed", {
        code: rollbackError?.code || null,
        employeeId: normalizedEmployeeId,
      });
      throw new HttpsError("internal", "Password rollback failed");
    }
    throw error;
  }
}

/**
 * Updates access fields in the user-directory Sheet.
 *
 * @param {object} request Callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} payload Access update.
 * @return {Promise<object>} Sanitized result.
 */
async function updateUserDirectoryAccess(request, config, payload) {
  const admin = await requireActiveUser(request);
  if (!isSystemAdmin(admin.profile)) {
    throw new HttpsError("permission-denied", "Administrator access required");
  }

  const employeeId = normalizeText(payload?.employeeId);
  const sheet = getSheetConfig(config, "userDirectory");
  const title = await getSheetTitle(sheet);
  const values = await getValues(sheet, title);
  const headers = Array.isArray(values[0]) ? values[0].map(normalizeText) : [];
  const indexes = {
    employeeId: headers.findIndex(
        (header) => normalizeKey(header) === "employeeid",
    ),
    level: headers.findIndex((header) => normalizeKey(header) === "level"),
    levelHr: headers.findIndex((header) => normalizeKey(header) === "levelhr"),
    levelIt: headers.findIndex((header) => normalizeKey(header) === "levelit"),
    active: headers.findIndex((header) => normalizeKey(header) === "active"),
  };
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new HttpsError("failed-precondition", "Access columns are missing");
  }

  const rowIndex = values.findIndex(
      (row, index) => index > 0 &&
      normalizeText(row?.[indexes.employeeId]) === employeeId,
  );
  if (rowIndex < 1) {
    throw new HttpsError("not-found", "User row was not found");
  }

  const row = Array.from(
      {length: headers.length},
      (unused, index) => values[rowIndex]?.[index] ?? "",
  );
  const previousRow = [...row];
  const previousValues = {
    level: row[indexes.level] ?? "",
    levelHr: row[indexes.levelHr] ?? "",
    levelIt: row[indexes.levelIt] ?? "",
    active: row[indexes.active] ?? "",
  };
  row[indexes.level] = normalizeText(payload.level) || "0";
  row[indexes.levelHr] = normalizeText(payload.levelHr) || "0";
  row[indexes.levelIt] = normalizeText(payload.levelIt) || "0";
  row[indexes.active] = normalizeBoolean(payload.active);

  const rowNumber = rowIndex + 1;
  const range =
    `${title}!A${rowNumber}:${getColumnLetter(row.length)}${rowNumber}`;
  const legacySnapshot = await getDatabase()
      .ref(`DHR/User/${employeeId}`)
      .get();
  const legacy = legacySnapshot.val() || null;
  if (!legacy) {
    throw new HttpsError("not-found", "Legacy user was not found");
  }

  const previousHrRecord = await getHrUserRecord(employeeId);
  let sheetUpdated = false;

  try {
    const hrAccessUpdate = {
      level: normalizeText(payload.level) || "0",
      level_Hr: normalizeText(payload.levelHr) || "0",
      level_It: normalizeText(payload.levelIt) || "0",
      active: normalizeBoolean(payload.active) ? "true" : "false",
    };
    if (previousHrRecord) {
      await updateHrUserRecord(employeeId, hrAccessUpdate);
    } else {
      await setHrUserRecord(employeeId, {
        ...legacy,
        ...hrAccessUpdate,
      });
    }

    await updateValues(sheet, range, [row]);
    sheetUpdated = true;

    try {
      const authUser = await getAuth().getUser(employeeId);
      await getAuth().updateUser(authUser.uid, {
        disabled: !normalizeBoolean(payload.active),
      });
      await getAuth().setCustomUserClaims(authUser.uid, {
        active: normalizeBoolean(payload.active),
        employeeId,
        levelEn: normalizeText(payload.level),
        levelHr: normalizeText(payload.levelHr),
        levelIt: normalizeText(payload.levelIt),
      });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    return {status: "ok", rowNumber, previousValues};
  } catch (error) {
    const rollbackErrors = [];
    try {
      if (previousHrRecord) {
        await setHrUserRecord(employeeId, previousHrRecord);
      } else {
        await removeHrUserRecord(employeeId);
      }
    } catch (rollbackError) {
      rollbackErrors.push("HR database");
      console.error("HR access rollback failed", {
        code: rollbackError?.code || null,
        employeeId,
      });
    }

    if (sheetUpdated) {
      try {
        await updateValues(sheet, range, [previousRow]);
      } catch (rollbackError) {
        rollbackErrors.push("User Directory");
        console.error("User Directory access rollback failed", {
          code: rollbackError?.code || null,
          employeeId,
        });
      }
    }

    if (rollbackErrors.length) {
      throw new HttpsError("internal", "Access update rollback failed");
    }
    throw error;
  }
}

/**
 * Upserts one evaluation result and ensures the evaluator is the signed-in
 * Firebase Auth user.
 *
 * @param {object} request Callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record Evaluation record.
 * @return {Promise<object>} Sanitized Google API result.
 */
async function upsertEvaluationResult(request, config, record) {
  const evaluator = await requireActiveUser(request);
  if (
    normalizeText(record?.evaluatorEmployeeId) !== evaluator.uid ||
    !normalizeText(record?.id)
  ) {
    throw new HttpsError(
        "permission-denied",
        "Evaluation ownership check failed",
    );
  }

  const sheet = getSheetConfig(config, "results");
  const title = await getSheetTitle(sheet);
  const values = await getValues(sheet, title);
  const currentHeaders = Array.isArray(values[0]) ?
    values[0].map(normalizeText) :
    [];
  const missingHeaders = Object.keys(record).filter(
      (key) => !currentHeaders.includes(key),
  );
  const headers = currentHeaders.length ?
    [...currentHeaders, ...missingHeaders] :
    Object.keys(record);
  if (!currentHeaders.length || missingHeaders.length) {
    await updateValues(
        sheet,
        `${title}!A1:${getColumnLetter(headers.length)}1`,
        [headers],
    );
  }

  const idIndex = headers.findIndex(
      (header) => normalizeKey(header) === "id",
  );
  const matchedIndex = values.findIndex(
      (row, index) => index > 0 &&
      normalizeText(row?.[idIndex]) === normalizeText(record.id),
  );
  const row = headers.map(
      (header) => serializeForSheet(record[header] ?? ""),
  );

  if (matchedIndex > 0) {
    const rowNumber = matchedIndex + 1;
    await updateValues(
        sheet,
        `${title}!A${rowNumber}:${getColumnLetter(headers.length)}${rowNumber}`,
        [row],
    );
    return {status: "ok", mode: "updated", rowNumber};
  }

  await appendValues(sheet, title, row);
  return {status: "ok", mode: "created"};
}

/**
 * Normalizes a shift-record key.
 *
 * @param {unknown} value Header value.
 * @return {string} Compact key.
 */
function normalizeShiftKey(value) {
  return normalizeKey(value);
}

/**
 * Reads a shift record value for a known header alias.
 *
 * @param {object} record Shift report record.
 * @param {string} header Header.
 * @return {unknown} Mapped value.
 */
function getShiftValue(record, header) {
  const key = normalizeShiftKey(header);
  const aliases = {
    id: "id",
    รหัสรายการ: "id",
    createdat: "createdAt",
    submittedat: "createdAt",
    วันที่บันทึก: "createdAt",
    วันที่ส่ง: "createdAt",
    reporterid: "reporterId",
    createdbyid: "reporterId",
    รหัสผู้บันทึก: "reporterId",
    รหัสผู้แจ้ง: "reporterId",
    reportername: "reporterName",
    createdby: "reporterName",
    ผู้บันทึก: "reporterName",
    ผู้แจ้ง: "reporterName",
    reporterdepartment: "reporterDepartment",
    แผนกผู้บันทึก: "reporterDepartment",
    แผนกผู้แจ้ง: "reporterDepartment",
    employeeid: "employeeId",
    รหัสพนักงาน: "employeeId",
    employeename: "employeeName",
    พนักงาน: "employeeName",
    ชื่อพนักงาน: "employeeName",
    section: "section",
    ส่วน: "section",
    department: "department",
    แผนก: "department",
    unit: "unit",
    หน่วย: "unit",
    position: "position",
    ตำแหน่ง: "position",
    workdate: "workDate",
    วันที่: "workDate",
    วันที่ทำงาน: "workDate",
    workenddate: "workEndDate",
    enddate: "workEndDate",
    ถึงวันที่: "workEndDate",
    วันที่สิ้นสุด: "workEndDate",
    oldshift: "oldShift",
    กะเดิม: "oldShift",
    เวรเดิม: "oldShift",
    newshift: "newShift",
    กะใหม่: "newShift",
    เวรใหม่: "newShift",
    reason: "reason",
    เหตุผล: "reason",
    remark: "remark",
    หมายเหตุ: "remark",
    approversignature: "approverSignature",
    approvalsignature: "approverSignature",
    ลายเซ็นผู้อนุมัติ: "approverSignature",
    รายเซ็นต์ผู้อนุมัติ: "approverSignature",
    source: "source",
  };
  const directKey = aliases[key] || header;
  const fallbacks = {
    employeeId: record.primaryEmployeeId,
    employeeName:
      record.primaryEmployeeDisplayName || record.primaryEmployeeName,
    section: record.primarySection,
    department: record.primaryDepartment,
    unit: record.primaryUnit,
    position: record.primaryPosition,
    workDate: record.primaryWorkDate,
    workEndDate: record.primaryWorkEndDate,
    oldShift: record.primaryShift,
    newShift: record.primaryNewShift,
  };
  return record[directKey] ?? fallbacks[directKey] ?? "";
}

/**
 * Converts a data URL into a Drive upload payload.
 *
 * @param {string} dataUrl Image data URL.
 * @return {{mimeType: string, bytes: Buffer}} Parsed data.
 */
function parseDataUrl(dataUrl) {
  const match = normalizeText(dataUrl).match(
      /^data:([^;,]+)(;base64)?,([\s\S]+)$/,
  );
  if (!match) {
    throw new HttpsError("invalid-argument", "Invalid signature image");
  }
  const bytes = match[2] ?
    Buffer.from(match[3], "base64") :
    Buffer.from(decodeURIComponent(match[3]), "utf8");
  if (bytes.length > 2 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Signature image is too large");
  }
  return {mimeType: match[1], bytes};
}

/**
 * Uploads a shift signature using ADC and returns an IMAGE formula.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record Shift report record.
 * @return {Promise<string>} Original value or IMAGE formula.
 */
async function uploadShiftSignature(config, record) {
  const signature = normalizeText(record?.approverSignature);
  if (!signature.startsWith("data:image/")) return signature;

  const {mimeType, bytes} = parseDataUrl(signature);
  const extension = mimeType.includes("png") ? "png" : "svg";
  const safeId = normalizeText(record.id).replace(/[^\w.-]+/g, "-") ||
    String(Date.now());
  const metadata = {
    name: `shift-signature-${safeId}.${extension}`,
    mimeType,
    parents: [normalizeText(config?.drive?.shiftSignatureFolderId)],
  };
  const boundary = `csm_signature_${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const client = await getGoogleClient();
  const uploadResponse = await client.request({
    method: "POST",
    url: "https://www.googleapis.com/upload/drive/v3/files",
    params: {
      uploadType: "multipart",
      supportsAllDrives: true,
      fields: "id",
    },
    headers: {
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    data: body,
  });
  const fileId = uploadResponse.data?.id;
  if (!fileId) {
    throw new HttpsError("internal", "Signature upload failed");
  }

  await client.request({
    method: "POST",
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    params: {
      supportsAllDrives: true,
      fields: "id",
    },
    data: {
      role: "reader",
      type: "anyone",
    },
  });

  const imageUrl =
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  return `=IMAGE("${imageUrl.replace(/"/g, "\"\"")}", 1)`;
}

/**
 * Appends a shift report after verifying reporter ownership.
 *
 * @param {object} request Callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {string} kind swap or change.
 * @param {object} record Shift report record.
 * @return {Promise<object>} Sanitized result.
 */
async function appendShiftReport(request, config, kind, record) {
  const reporter = await requireActiveUser(request);
  if (normalizeText(record?.reporterId) !== reporter.uid) {
    throw new HttpsError("permission-denied", "Reporter identity mismatch");
  }
  if (!["swap", "change"].includes(kind)) {
    throw new HttpsError("invalid-argument", "Invalid shift report kind");
  }

  const key = kind === "swap" ? "shiftSwapReport" : "shiftChangeReport";
  const sheet = getSheetConfig(config, key);
  const title = sheet.sheetName || await getSheetTitle(sheet);
  const requiredHeaders = kind === "swap" ?
    SHIFT_SWAP_DEFAULT_HEADERS :
    SHIFT_CHANGE_DEFAULT_HEADERS;
  const {headers} = await ensureHeaders(sheet, title, requiredHeaders);
  const preparedRecord = {
    ...record,
    approverSignature: await uploadShiftSignature(config, record),
  };
  const row = headers.map((header) => {
    const value = serializeForSheet(getShiftValue(preparedRecord, header));
    const text = String(value ?? "");
    if (!text || text.startsWith("=IMAGE(")) return text;
    return `'${text}`;
  });
  await appendValues(sheet, title, row, "USER_ENTERED");
  return {status: "ok"};
}

/**
 * Appends an anonymous or named labour grievance.
 *
 * @param {object} request Callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @param {object} record Grievance record.
 * @return {Promise<object>} Sanitized result.
 */
async function appendLabourGrievance(request, config, record) {
  enforcePublicRateLimit(request, "labour-grievance");
  const identityMode = record?.identityMode === "named" ?
    "named" :
    record?.identityMode === "anonymous" ? "anonymous" : "";
  const issueTypes = Array.isArray(record?.issueTypes) ?
    record.issueTypes.map(normalizeText).filter(Boolean) :
    [];
  const fullName = normalizeText(record?.fullName);
  const otherIssue = normalizeText(record?.otherIssue);
  const incidentDetails = normalizeText(record?.incidentDetails);
  const requestedAction = normalizeText(record?.requestedAction);
  const hasOtherIssue = issueTypes.some(
      (issue) => normalizeKey(issue) === normalizeKey("อื่น ๆ"),
  );

  if (
    !identityMode ||
    (identityMode === "named" && !fullName) ||
    !issueTypes.length ||
    (hasOtherIssue && !otherIssue) ||
    !incidentDetails ||
    !requestedAction ||
    record?.truthConfirmed !== true
  ) {
    throw new HttpsError("invalid-argument", "Grievance data is incomplete");
  }

  const sheet = getSheetConfig(config, "labourGrievance");
  const title = await getSheetTitle(sheet);
  const {headers} = await ensureHeaders(
      sheet,
      title,
      LABOUR_GRIEVANCE_HEADERS,
  );
  const anonymous = identityMode === "anonymous";
  const valuesByHeader = {
    "วันที่และเวลาที่ส่ง": normalizeText(record.submittedAt),
    "การเปิดเผยตัวตน":
      anonymous ? "ไม่เปิดเผยชื่อ (Anonymous)" : "เปิดเผยชื่อ",
    "ชื่อ-นามสกุล": anonymous ? "" : fullName,
    "แผนก": anonymous ? "" : normalizeText(record.department),
    "เบอร์โทร": anonymous ? "" : normalizeText(record.phone),
    "ประเภทปัญหา": issueTypes.join(" | "),
    "ปัญหาอื่น ๆ": otherIssue,
    "วันที่เกิดเหตุ": normalizeText(record.incidentDate),
    "สถานที่": normalizeText(record.location),
    "รายละเอียดเหตุการณ์": incidentDetails,
    "บุคคลที่เกี่ยวข้อง": normalizeText(record.involvedPeople),
    "ต้องการให้บริษัทดำเนินการอย่างไร": requestedAction,
    "ยืนยันข้อมูลเป็นความจริง": true,
  };
  const normalizedValues = new Map(
      Object.entries(valuesByHeader).map(
          ([header, value]) => [normalizeKey(header), value],
      ),
  );
  const row = headers.map(
      (header) => serializeForSheet(
          normalizedValues.get(normalizeKey(header)) ?? "",
      ),
  );
  await appendValues(sheet, title, row);
  return {status: "ok"};
}

/**
 * Handles the allow-listed Google Workspace callable API.
 *
 * @param {object} request Firebase callable request.
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @return {Promise<object>} Sanitized operation result.
 */
async function handleWorkspaceRequest(request, config) {
  const action = normalizeText(request.data?.action);
  const payload = request.data?.payload || {};

  switch (action) {
    case "read": {
      const key = normalizeText(payload.sheetKey);
      if (key !== "userDirectory") {
        await requireActiveUser(request);
      }
      return readSheet(
          config,
          key,
          normalizeText(payload.tabName),
      );
    }
    case "metadata": {
      await requireActiveUser(request);
      const sheet = getSheetConfig(config, normalizeText(payload.sheetKey));
      return getSheetMetadata(sheet);
    }
    case "appendShiftReport":
      return appendShiftReport(
          request,
          config,
          normalizeText(payload.kind),
          payload.record || {},
      );
    case "appendLabourGrievance":
      return appendLabourGrievance(request, config, payload.record || {});
    case "upsertEvaluationResult":
      return upsertEvaluationResult(
          request,
          config,
          payload.record || {},
      );
    case "updateUserDirectoryPassword":
      return updateUserDirectoryPassword(
          request,
          config,
          payload.employeeId,
          payload.nextPassword,
      );
    case "updateUserDirectoryAccess":
      return updateUserDirectoryAccess(request, config, payload);
    case "appendUserDirectoryRecord":
      {
        const admin = await requireActiveUser(request);
        if (!isSystemAdmin(admin.profile)) {
          throw new HttpsError(
              "permission-denied",
              "System administrator access is required",
          );
        }
      }
      return appendUserDirectoryRecord(config, payload.record || {});
    case "registerEmployeeAccount":
      enforcePublicRateLimit(request, "user-registration");
      return registerEmployeeAccount(config, payload.record || {});
    default:
      throw new HttpsError("invalid-argument", "Unknown workspace action");
  }
}

module.exports = {
  handleWorkspaceRequest,
  isSystemAdmin,
  requireActiveUser,
};
