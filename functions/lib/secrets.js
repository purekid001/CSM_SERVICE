const {defineJsonSecret, defineSecret} = require("firebase-functions/params");

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const sheetsConfig = defineJsonSecret("SHEETS_CONFIG");
const workspaceDiagnosticToken = defineSecret("WORKSPACE_DIAGNOSTIC_TOKEN");

const REQUIRED_SHEET_KEYS = [
  "evaluatorCodes",
  "employees",
  "topics",
  "weights",
  "results",
  "userDirectory",
  "shiftEmployees",
  "shiftSwapReport",
  "shiftChangeReport",
  "labourGrievance",
];

/**
 * Normalizes a configuration value.
 *
 * @param {unknown} value Value to normalize.
 * @return {string} Trimmed string value.
 */
function normalizeText(value) {
  return String(value ?? "").trim();
}

/**
 * Reads and validates the structured Google Workspace configuration.
 *
 * @return {object} Validated SHEETS_CONFIG payload.
 */
function getSheetsConfig() {
  const config = sheetsConfig.value();
  const configuredSheets = config?.sheets;

  if (!configuredSheets || typeof configuredSheets !== "object") {
    throw new Error("SHEETS_CONFIG does not contain a sheets object");
  }

  for (const key of REQUIRED_SHEET_KEYS) {
    if (!normalizeText(configuredSheets[key]?.id)) {
      throw new Error(`SHEETS_CONFIG is missing sheets.${key}.id`);
    }
  }

  return config;
}

module.exports = {
  geminiApiKey,
  getSheetsConfig,
  sheetsConfig,
  workspaceDiagnosticToken,
};
