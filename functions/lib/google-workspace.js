const {GoogleAuth} = require("google-auth-library");

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const googleAuth = new GoogleAuth({
  scopes: GOOGLE_SCOPES,
});

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
 * Gets a Google API client through the function runtime's attached identity.
 *
 * @return {Promise<object>} Authorized Google API client.
 */
async function getGoogleClient() {
  return googleAuth.getClient();
}

/**
 * Verifies that ADC can read every configured Sheet and Drive folder.
 *
 * @param {object} config Structured SHEETS_CONFIG secret.
 * @return {Promise<{verifiedSheets: number, verifiedFolders: number}>}
 *   Counts of resources verified successfully.
 */
async function verifyWorkspaceAccess(config) {
  const client = await getGoogleClient();
  const sheetEntries = Object.entries(config.sheets || {});
  let verifiedSheets = 0;

  for (const [, sheet] of sheetEntries) {
    const spreadsheetId = normalizeText(sheet?.id);
    if (!spreadsheetId) continue;

    await client.request({
      method: "GET",
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
      params: {
        fields: "spreadsheetId",
      },
    });
    verifiedSheets += 1;
  }

  const folderId = normalizeText(config?.drive?.shiftSignatureFolderId);
  let verifiedFolders = 0;

  if (folderId) {
    await client.request({
      method: "GET",
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}`,
      params: {
        fields: "id",
        supportsAllDrives: true,
      },
    });
    verifiedFolders = 1;
  }

  return {
    verifiedSheets,
    verifiedFolders,
  };
}

module.exports = {
  getGoogleClient,
  verifyWorkspaceAccess,
};
