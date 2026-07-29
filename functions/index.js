const crypto = require("node:crypto");
const {getApps, initializeApp} = require("firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const {analyzeEvaluation} = require("./lib/gemini-service");
const {verifyWorkspaceAccess} = require("./lib/google-workspace");
const {
  handleWorkspaceRequest,
  isSystemAdmin,
  requireActiveUser,
} = require("./lib/workspace-api");
const {handleHrDatabaseRequest} = require("./lib/hr-database");
const {
  geminiApiKey,
  getSheetsConfig,
  sheetsConfig,
  workspaceDiagnosticToken,
} = require("./lib/secrets");

if (getApps().length === 0) {
  initializeApp();
}

setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 5,
});

/**
 * Lightweight callable used to verify that Cloud Functions is reachable.
 *
 * This endpoint intentionally returns no configuration or secret values.
 */
exports.health = onCall(() => ({
  status: "ok",
  service: "csm-functions",
  timestamp: new Date().toISOString(),
}));

/**
 * Compares a supplied diagnostic token without leaking timing information.
 *
 * @param {unknown} providedToken Value received from the callable request.
 * @param {unknown} expectedToken Secret Manager value.
 * @return {boolean} Whether both token values match.
 */
function isMatchingToken(providedToken, expectedToken) {
  const provided = Buffer.from(String(providedToken ?? ""), "utf8");
  const expected = Buffer.from(String(expectedToken ?? ""), "utf8");

  return provided.length > 0 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);
}

/**
 * Admin-only diagnostic that proves the runtime service account can reach every
 * configured Sheet and the signature folder through Application Default
 * Credentials. It never returns IDs, config values, access tokens, or secrets.
 */
exports.workspaceHealth = onCall(
    {
      secrets: [sheetsConfig, workspaceDiagnosticToken],
      timeoutSeconds: 120,
    },
    async (request) => {
      if (!isMatchingToken(
          request.data?.token,
          workspaceDiagnosticToken.value(),
      )) {
        throw new HttpsError("permission-denied", "Invalid diagnostic token");
      }

      try {
        const result = await verifyWorkspaceAccess(getSheetsConfig());
        return {
          status: "ok",
          service: "google-workspace",
          sheets: result.verifiedSheets,
          folders: result.verifiedFolders,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Workspace access verification failed", {
          code: error?.code || null,
          name: error?.name || "GoogleWorkspaceError",
        });
        throw new HttpsError(
            "failed-precondition",
            "Google Workspace access verification failed",
        );
      }
    },
);

/**
 * Auth-aware, allow-listed API for the frontend's Google Sheets and Drive
 * workflows. Resource IDs and Google OAuth credentials never leave Functions.
 */
exports.workspace = onCall(
    {
      secrets: [sheetsConfig],
      timeoutSeconds: 120,
      memory: "512MiB",
    },
    async (request) => {
      try {
        return await handleWorkspaceRequest(request, getSheetsConfig());
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Workspace operation failed", {
          code: error?.code || null,
          name: error?.name || "WorkspaceOperationError",
        });
        throw new HttpsError("internal", "Workspace operation failed");
      }
    },
);

/**
 * Authenticated, allow-listed proxy for the separate HR Realtime Database.
 * The HR Firebase web configuration and direct database access stay off the
 * browser, while the runtime uses ADC instead of a private key file.
 */
exports.hrDatabase = onCall(
    {
      timeoutSeconds: 120,
      memory: "256MiB",
    },
    async (request) => {
      try {
        return await handleHrDatabaseRequest(
            request,
            requireActiveUser,
            isSystemAdmin,
        );
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("HR database operation failed", {
          code: error?.code || null,
          name: error?.name || "HrDatabaseOperationError",
        });
        throw new HttpsError("internal", "HR database operation failed");
      }
    },
);

/**
 * Authenticated Gemini analysis. The API key remains bound only to this
 * function and is never returned to the browser.
 */
exports.analyzeEvaluation = onCall(
    {
      secrets: [geminiApiKey],
      timeoutSeconds: 120,
      memory: "512MiB",
    },
    async (request) => {
      try {
        return await analyzeEvaluation(request, geminiApiKey.value());
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Gemini analysis failed", {
          code: error?.code || null,
          name: error?.name || "GeminiAnalysisError",
        });
        throw new HttpsError("internal", "Gemini analysis failed");
      }
    },
);
