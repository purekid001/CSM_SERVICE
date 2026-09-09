const {HttpsError} = require("firebase-functions/v2/https");
const {requireActiveUser} = require("./workspace-api");

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta";
const USER_LIMIT = 30;
const USER_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const userCounters = new Map();

/**
 * Normalizes a value to a trimmed string.
 *
 * @param {unknown} value Value to normalize.
 * @return {string} Normalized value.
 */
function normalizeText(value) {
  return String(value ?? "").trim();
}

/**
 * Rounds a numeric value.
 *
 * @param {unknown} value Numeric input.
 * @param {number} digits Decimal places.
 * @return {number} Rounded number.
 */
function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Enforces a conservative per-user generation limit.
 *
 * @param {string} uid Firebase Auth uid.
 * @return {void}
 */
function enforceUserLimit(uid) {
  const now = Date.now();
  const current = userCounters.get(uid);
  if (!current || current.expiresAt <= now) {
    userCounters.set(uid, {
      count: 1,
      expiresAt: now + USER_LIMIT_WINDOW_MS,
    });
    return;
  }
  if (current.count >= USER_LIMIT) {
    throw new HttpsError(
        "resource-exhausted",
        "Gemini request limit reached",
    );
  }
  current.count += 1;
}

/**
 * Builds a compact section summary.
 *
 * @param {Array<object>} sectionScores Section scores.
 * @return {string} Prompt summary.
 */
function buildSectionSummary(sectionScores = []) {
  return sectionScores.slice(0, 20).map((section) =>
    `${normalizeText(section.section)}: ` +
    `${roundTo(section.score, 2)} คะแนน, ` +
    `ตอบ ${Number(section.answered || 0)}/${Number(section.items || 0)} ข้อ`,
  ).join("\n");
}

/**
 * Builds a compact item summary.
 *
 * @param {Array<object>} entries Evaluation entries.
 * @return {string} Prompt summary.
 */
function buildItemSummary(entries = []) {
  return entries.slice(0, 100).map((entry) => ({
    key: normalizeText(entry.key),
    title: normalizeText(entry.title).slice(0, 200),
    score: Number(entry.score || 0),
    weight: Number(entry.weight || 0),
    weightedScore: Number(entry.weightedScore || 0),
  })).sort(
      (left, right) => left.key.localeCompare(right.key, "en"),
  ).map((entry) =>
    `ข้อ ${entry.key}: ${entry.title} | ` +
    `score ${entry.score}/5 | weight ${entry.weight} | ` +
    `weighted ${roundTo(entry.weightedScore, 2)}`,
  ).join("\n");
}

/**
 * Extracts the first Gemini text response.
 *
 * @param {object} payload Gemini response payload.
 * @return {string} Generated text.
 */
function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => normalizeText(part?.text))
      .filter(Boolean)
      .join("\n")
      .trim();
}

/**
 * Generates one evaluation analysis after verifying Firebase Auth ownership.
 *
 * @param {object} request Callable request.
 * @param {string} apiKey Gemini API key from Secret Manager.
 * @return {Promise<object>} Sanitized analysis result.
 */
async function analyzeEvaluation(request, apiKey) {
  const user = await requireActiveUser(request);
  enforceUserLimit(user.uid);

  const record = request.data?.record || {};
  const employee = request.data?.employee || {};
  const evaluator = request.data?.evaluator || {};
  if (
    normalizeText(evaluator.employeeId) !== user.uid ||
    normalizeText(record.evaluatorEmployeeId) !== user.uid
  ) {
    throw new HttpsError(
        "permission-denied",
        "Evaluator identity mismatch",
    );
  }

  const prompt = [
    "คุณคือผู้ช่วยวิเคราะห์ผลประเมินพนักงานสำหรับงาน HR",
    "ช่วยสรุปเป็นภาษาไทยแบบกระชับและใช้งานได้จริง",
    "รูปแบบคำตอบ: 3 บรรทัดเท่านั้น",
    "บรรทัด 1 ขึ้นต้นด้วย \"ภาพรวม:\"",
    "บรรทัด 2 ขึ้นต้นด้วย \"จุดเด่น:\"",
    "บรรทัด 3 ขึ้นต้นด้วย \"ข้อเสนอแนะ:\"",
    "ห้ามใช้ markdown, ตาราง, bullet, หรือข้อความเกินความจำเป็น",
    "",
    `รอบประเมิน: ${normalizeText(record.year)}`,
    `ผู้ถูกประเมิน: ${normalizeText(employee.fullName)} ` +
      `(${normalizeText(employee.employeeId)})`,
    `ตำแหน่ง: ${normalizeText(employee.position) || "-"}`,
    `ผู้ประเมิน: ${normalizeText(evaluator.fullName)}`,
    `คะแนนรวม: ${roundTo(record.overallScore, 2)} / 100`,
    `คะแนนดิบรวม: ${roundTo(record.rawTotalScore, 2)}`,
    "",
    "คะแนนรายหมวด:",
    buildSectionSummary(record.sectionScores),
    "",
    "คะแนนรายข้อ:",
    buildItemSummary(record.entries),
    "",
    `ความคิดเห็นจากผู้ประเมิน: ` +
      `${normalizeText(record.comment).slice(0, 2000) || "ไม่มี"}`,
  ].join("\n");
  const endpoint =
    `${GEMINI_ENDPOINT}/models/${encodeURIComponent(GEMINI_MODEL)}` +
    ":generateContent";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 480,
          thinkingConfig: {thinkingBudget: 0},
        },
      }),
    });

    if (!response.ok) {
      return {
        analysis: "",
        analysisStatus:
          response.status === 429 ? "skipped_limit" : "skipped_error",
        analysisModel: GEMINI_MODEL,
        analysisGeneratedAt: new Date().toISOString(),
        analysisError: `http_${response.status}`,
      };
    }

    const analysis = extractGeminiText(await response.json());
    return {
      analysis,
      analysisStatus: analysis ? "generated" : "skipped_empty",
      analysisModel: GEMINI_MODEL,
      analysisGeneratedAt: new Date().toISOString(),
      analysisError: analysis ? "" : "empty_response",
    };
  } catch (error) {
    return {
      analysis: "",
      analysisStatus: "skipped_error",
      analysisModel: GEMINI_MODEL,
      analysisGeneratedAt: new Date().toISOString(),
      analysisError: "unexpected_gemini_error",
    };
  }
}

module.exports = {
  analyzeEvaluation,
};
