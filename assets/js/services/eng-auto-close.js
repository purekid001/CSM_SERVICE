import { database, ref, get, update } from '../firebase.js';
import { canAccessPage, dateToString, parseDMY, parseDateTime } from '../utils.js';
import { showToast } from '../ui.js';

const AUTO_CLOSE_INTERVAL_MS = 10 * 60 * 60 * 1000;
const AUTO_CLOSE_TARGET_STEP = '5';
const AUTO_CLOSE_SUCCESS_STEP = '4';
const AUTO_CLOSE_ACCEPT_TEXT = 'รับงานซ่อม';
const STORAGE_KEY_ENABLED = 'eng_auto_close_enabled';
const HISTORY_LIMIT = 12;

let timerId = null;
let state = {
  enabled: false,
  running: false,
  lastRunAt: 0,
  nextRunAt: 0,
  lastError: '',
  lastResult: null,
  history: [],
};

const listeners = new Set();

function cloneState() {
  return {
    ...state,
    history: state.history.map(item => ({ ...item, ids: [...item.ids] })),
    lastResult: state.lastResult
      ? { ...state.lastResult, ids: [...state.lastResult.ids] }
      : null,
  };
}

function notify() {
  const snapshot = cloneState();
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('eng-auto-close listener error:', error);
    }
  });
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

function pushHistory(entry) {
  state.history = [entry, ...state.history].slice(0, HISTORY_LIMIT);
}

function parseFlexibleDate(value) {
  if (!value || value === '-') return 0;
  const precise = parseDateTime(value);
  if (precise) return precise;
  const dateOnly = parseDMY(value);
  return dateOnly ? dateOnly.getTime() : 0;
}

function getEvaluationBaseTime(item) {
  return parseFlexibleDate(item.den_end_real)
    || parseFlexibleDate(item.dateUpdate)
    || parseFlexibleDate(item.date);
}

function isEnabledPreference() {
  return localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false';
}

function persistEnabledPreference(enabled) {
  localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
}

function hasAccess() {
  return canAccessPage('eng-auto-close');
}

function scheduleNextRun() {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }

  if (!state.enabled || !hasAccess()) {
    setState({ nextRunAt: 0 });
    return;
  }

  const nextRunAt = Date.now() + AUTO_CLOSE_INTERVAL_MS;
  timerId = window.setTimeout(async () => {
    await runEngAutoClose({ manual: false, showSuccessToast: false });
    scheduleNextRun();
  }, AUTO_CLOSE_INTERVAL_MS);

  setState({ nextRunAt });
}

function buildResult(now, stats) {
  return {
    runAt: now.getTime(),
    runAtText: dateToString(now),
    scanned: stats.scanned,
    queued: stats.queued,
    due: stats.due,
    closed: stats.closed,
    ids: stats.ids,
  };
}

export function getEngAutoCloseState() {
  return cloneState();
}

export function subscribeEngAutoCloseState(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(cloneState());
  return () => {
    listeners.delete(listener);
  };
}

export async function runEngAutoClose({ manual = false, showSuccessToast = false } = {}) {
  if (!hasAccess()) {
    const error = 'เฉพาะ admin ฝั่ง Engineer เท่านั้นที่ใช้งาน Auto Close ได้';
    setState({ lastError: error });
    if (manual) showToast(error, 'error');
    return { ok: false, reason: 'denied' };
  }

  if (state.running) {
    if (manual) showToast('ระบบกำลังประมวลผลรอบก่อนหน้าอยู่', 'info');
    return { ok: false, reason: 'running' };
  }

  setState({ running: true, lastError: '' });
  const now = new Date();

  try {
    const snapshot = await get(ref(database, 'DEN/FIX'));
    const stats = {
      scanned: 0,
      queued: 0,
      due: 0,
      closed: 0,
      ids: [],
    };
    const updates = [];

    if (snapshot.exists()) {
      const allYears = snapshot.val();
      Object.entries(allYears).forEach(([year, items]) => {
        Object.entries(items || {}).forEach(([id, item]) => {
          stats.scanned += 1;
          if (String(item.step) !== AUTO_CLOSE_TARGET_STEP) return;

          stats.queued += 1;
          const baseTime = getEvaluationBaseTime(item);
          if (!baseTime) return;

          const dueAt = baseTime + AUTO_CLOSE_INTERVAL_MS;
          if (dueAt > now.getTime()) return;

          stats.due += 1;
          updates.push(
            update(ref(database, `DEN/FIX/${year}/${id}`), {
              dateUpdate: dateToString(now),
              step: AUTO_CLOSE_SUCCESS_STEP,
              den_end_real: dateToString(now),
              clean: AUTO_CLOSE_ACCEPT_TEXT,
            }).then(() => {
              stats.closed += 1;
              stats.ids.push(id);
            })
          );
        });
      });
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    const result = buildResult(now, stats);
    pushHistory(result);
    setState({
      running: false,
      lastRunAt: now.getTime(),
      lastResult: result,
      lastError: '',
    });

    if (showSuccessToast) {
      showToast(
        stats.closed > 0
          ? `Auto Close ปิดงานแล้ว ${stats.closed} รายการ`
          : 'Auto Close ทำงานแล้ว แต่ยังไม่มีงานที่ครบกำหนด 10 ชั่วโมง',
        stats.closed > 0 ? 'success' : 'info'
      );
    }

    return { ok: true, result };
  } catch (error) {
    console.error('runEngAutoClose failed:', error);
    setState({
      running: false,
      lastRunAt: now.getTime(),
      lastError: error.message || 'Unknown error',
    });
    if (manual) {
      showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
    return { ok: false, reason: 'error', error };
  } finally {
    if (state.enabled && hasAccess()) {
      scheduleNextRun();
    } else {
      setState({ nextRunAt: 0 });
    }
  }
}

export function setEngAutoCloseEnabled(enabled) {
  persistEnabledPreference(enabled);
  setState({ enabled: enabled && hasAccess() });

  if (!enabled || !hasAccess()) {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    setState({ nextRunAt: 0 });
    return;
  }

  void runEngAutoClose({ manual: false, showSuccessToast: false });
}

export function syncEngAutoCloseForSession() {
  if (!hasAccess()) {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    setState({
      enabled: false,
      nextRunAt: 0,
    });
    return;
  }

  const enabled = isEnabledPreference();
  setState({ enabled });

  if (!enabled) {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    setState({ nextRunAt: 0 });
    return;
  }

  if (!timerId && !state.running) {
    void runEngAutoClose({ manual: false, showSuccessToast: false });
  }
}

export function getEngAutoCloseIntervalHours() {
  return AUTO_CLOSE_INTERVAL_MS / (60 * 60 * 1000);
}
