import { callHealthFunction } from '../firebase.js';

let activeHealthCheck = null;

function getHealthIndicators() {
  return Array.from(document.querySelectorAll('[data-functions-health-status]'));
}

function updateHealthIndicator(state, label, title) {
  const indicators = getHealthIndicators();

  indicators.forEach(indicator => {
    indicator.dataset.state = state;
    indicator.title = title;

    const labelElement = indicator.querySelector('[data-functions-health-label]');
    if (labelElement) labelElement.textContent = label;
  });

  return indicators;
}

export function checkFunctionsHealth() {
  if (activeHealthCheck) return activeHealthCheck;

  const indicators = updateHealthIndicator(
    'checking',
    'กำลังตรวจสอบ Functions...',
    'กำลังตรวจสอบการเชื่อมต่อ Firebase Functions'
  );

  if (!indicators.length) return Promise.resolve(null);

  indicators.forEach(indicator => {
    indicator.disabled = true;
  });

  activeHealthCheck = callHealthFunction()
    .then(result => {
      if (!result || result.status !== 'ok') {
        throw new Error('Health Function returned an unexpected response.');
      }

      const checkedAt = result.timestamp
        ? new Date(result.timestamp).toLocaleString('th-TH')
        : 'ไม่ระบุเวลา';

      updateHealthIndicator(
        'ready',
        'Functions พร้อมใช้งาน',
        `เชื่อมต่อ Firebase Functions สำเร็จ (${checkedAt}) — คลิกเพื่อตรวจสอบอีกครั้ง`
      );

      return result;
    })
    .catch(error => {
      console.error('[Functions health] Connection failed:', error);
      updateHealthIndicator(
        'error',
        'Functions ไม่พร้อมใช้งาน',
        'เชื่อมต่อ Firebase Functions ไม่สำเร็จ — คลิกเพื่อลองใหม่'
      );
      return null;
    })
    .finally(() => {
      indicators.forEach(indicator => {
        indicator.disabled = false;
      });
      activeHealthCheck = null;
    });

  return activeHealthCheck;
}

export function initFunctionsHealthIndicator() {
  const indicators = getHealthIndicators();
  if (!indicators.length) return;

  indicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
      void checkFunctionsHealth();
    });
  });

  void checkFunctionsHealth();
}
