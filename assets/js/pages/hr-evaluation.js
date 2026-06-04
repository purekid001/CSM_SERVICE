import { escapeHTML, escapeAttr, getUserAccessProfile } from '../utils.js';
import { showRichConfirmModal, showToast } from '../ui.js';
import {
  buildEvaluationRecordId,
  buildEvaluationResultKey,
  createEvaluationResultRecord,
  getCurrentEvaluationCycle,
  loadEvaluationReferenceData,
  normalizeEvaluationCycle,
  upsertEvaluationResult,
  waitForEvaluationResultSync,
} from '../services/google-sheets.js';
import { analyzeEvaluationWithGemini, getGeminiAvailability } from '../services/gemini-analysis.js';

const state = {
  refs: null,
  evaluator: null,
  assignedEmployees: [],
  selectedEmployeeId: '',
  selectedCycle: getCurrentEvaluationCycle(),
  loading: false,
  saving: false,
  aiAnalysisPreview: null,
};

const SCORE_OPTIONS = [
  { value: 1, label: 'ต้องปรับปรุง' },
  { value: 2, label: 'พอใช้' },
  { value: 3, label: 'มาตรฐาน' },
  { value: 4, label: 'ดี' },
  { value: 5, label: 'ดีมาก' },
];

export function render() {
  return `
    <div class="app-page evaluation-page">
      <section class="page-hero page-hero-hr evaluation-page-hero fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Evaluation</p>
          <h1 class="page-hero-title">Evaluation</h1>
          <p class="page-hero-subtitle">ยืนยันรหัสผู้ประเมิน แล้วเริ่มให้คะแนนพนักงานตามรอบประเมินได้ทันที</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ข้อมูลอ้างอิง</span>
            <strong>Google Sheets</strong>
          </div>
          <div class="page-hero-stat">
            <span>รูปแบบคะแนน</span>
            <strong>1 ถึง 5 คะแนน</strong>
          </div>
        </div>
      </section>

      <div class="page-note evaluation-page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>เริ่มจากยืนยันรหัส</strong>
          ระบบจะดึงรายชื่อผู้ถูกประเมินตามตำแหน่งผู้ประเมินให้อัตโนมัติ
        </div>
      </div>

      <section class="form-card fade-in evaluation-shell">
        <div class="evaluation-card-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-ocean">
              <i class="fa-solid fa-key"></i>
            </div>
            <div class="form-header-text">
              <h2>เริ่มต้นการประเมิน</h2>
              <p>กรอกรหัสเข้าประเมินเพื่อเปิดรายการพนักงานที่ต้องประเมิน</p>
            </div>
          </div>
          <div class="evaluation-head-actions">
            <button class="btn btn-secondary btn-compact" type="button" id="evaluation-open-report-btn">
              <i class="fa-solid fa-chart-column"></i>
              Evaluation Report
            </button>
            <button class="btn btn-secondary btn-compact" type="button" id="evaluation-reload-ref-btn">
              <i class="fa-solid fa-rotate-right"></i>
              รีโหลดชีต
            </button>
          </div>
        </div>

        <div class="evaluation-auth-grid">
          <div class="input-group">
            <label for="evaluation-code-input">รหัสเข้าประเมิน</label>
            <input type="password" id="evaluation-code-input" class="form-control" placeholder="กรอกรหัสเข้าประเมิน" autocomplete="off">
          </div>
          <div class="input-group">
            <label for="evaluation-cycle-input">รอบ / ปีประเมิน</label>
            <input type="text" id="evaluation-cycle-input" class="form-control" value="${escapeAttr(state.selectedCycle)}" placeholder="เช่น 2026/1" autocomplete="off" readonly aria-readonly="true">
          </div>
          <div class="evaluation-auth-actions">
            <button class="btn btn-primary" type="button" id="evaluation-verify-btn">
              <i class="fa-solid fa-unlock-keyhole"></i>
              ยืนยันรหัส
            </button>
          </div>
        </div>

        <div id="evaluation-evaluator-panel" class="evaluation-summary-panel" style="display:none;"></div>
      </section>

      <section class="form-card fade-in evaluation-shell" id="evaluation-workspace" style="display:none;">
        <div class="evaluation-card-head">
          <div class="form-header">
            <div class="form-header-icon ops-header-icon ops-icon-amber">
              <i class="fa-solid fa-users"></i>
            </div>
            <div class="form-header-text">
              <h2>Assigned Employees</h2>
              <p>เลือกพนักงานที่ต้องประเมิน ระบบจะดึงหัวข้อและน้ำหนักจากชีตกลางให้อัตโนมัติ</p>
            </div>
          </div>
        </div>

        <div class="evaluation-select-grid">
          <div class="input-group">
            <label for="evaluation-employee-select">รายชื่อผู้ถูกประเมิน</label>
            <select id="evaluation-employee-select" class="form-control">
              <option value="">เลือกรายชื่อพนักงาน</option>
            </select>
          </div>
        </div>

        <div id="evaluation-employee-panel" class="evaluation-employee-panel"></div>
        <div id="evaluation-form-panel" class="evaluation-form-panel"></div>
      </section>
    </div>
  `;
}

export function init() {
  bindStaticEvents();
  loadReferenceData();
}

function bindStaticEvents() {
  document.getElementById('evaluation-verify-btn')?.addEventListener('click', verifyEvaluationCode);
  document.getElementById('evaluation-reload-ref-btn')?.addEventListener('click', () => loadReferenceData({ silent: false }));
  document.getElementById('evaluation-open-report-btn')?.addEventListener('click', () => {
    if (typeof window.showPage === 'function') {
      window.showPage('hr-evaluation-report');
    }
  });
  document.getElementById('evaluation-employee-select')?.addEventListener('change', handleEmployeeSelection);

  const input = document.getElementById('evaluation-code-input');
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      verifyEvaluationCode();
    }
  });

}

function syncReportButtonVisibility() {
  const button = document.getElementById('evaluation-open-report-btn');
  if (!button) return;

  const access = getUserAccessProfile();
  const currentEmployeeId = String(sessionStorage.getItem('empId') || '').trim();
  const isPrivileged = access.isHrDispatchAdmin || access.isHrDocAdmin || access.isSystemAdmin;
  const isEvaluator = Array.isArray(state.refs?.evaluators)
    && state.refs.evaluators.some(item => item.active && String(item.employeeId || '').trim() === currentEmployeeId);

  button.style.display = isPrivileged || isEvaluator ? 'inline-flex' : 'none';
}

async function loadReferenceData({ silent = true } = {}) {
  if (state.loading) return;
  state.loading = true;

  try {
    state.refs = await loadEvaluationReferenceData();
    state.selectedCycle = state.selectedCycle || state.refs.cycle;
    const cycleInput = document.getElementById('evaluation-cycle-input');
    if (cycleInput) cycleInput.value = state.selectedCycle;

    syncReportButtonVisibility();
    refreshAssignments();
    renderEvaluatorPanel();

    if (!silent) {
      showToast('รีโหลดข้อมูลจาก Google Sheets แล้ว', 'success');
    }
  } catch (error) {
    console.error('loadReferenceData failed:', error);
    showToast(`โหลดข้อมูลอ้างอิงไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    state.loading = false;
  }
}

function verifyEvaluationCode() {
  if (!state.refs) {
    showToast('ข้อมูลอ้างอิงยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง', 'warning');
    return;
  }

  const codeInput = document.getElementById('evaluation-code-input');
  const cycleInput = document.getElementById('evaluation-cycle-input');
  const code = String(codeInput?.value || '').trim();
  const cycle = normalizeEvaluationCycle(cycleInput?.value) || getCurrentEvaluationCycle();

  if (!code) {
    showToast('กรุณากรอกรหัสเข้าประเมิน', 'warning');
    return;
  }

  if (!state.refs.settings?.evaluationOpen) {
    resetEvaluationAccess();
    showToast('ขณะนี้ระบบประเมินยังไม่เปิดใช้งาน', 'warning');
    return;
  }

  const loggedInEmployeeId = String(sessionStorage.getItem('empId') || '').trim();
  if (!loggedInEmployeeId) {
    resetEvaluationAccess();
    showToast('ไม่พบข้อมูลผู้ใช้งานที่เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
    return;
  }

  const evaluator = state.refs.evaluators.find(item => item.active && item.evaluationCode === code);
  if (!evaluator) {
    resetEvaluationAccess();
    showToast('ไม่พบรหัสเข้าประเมินนี้ในชีตผู้ประเมิน', 'error');
    return;
  }

  if (String(evaluator.employeeId || '').trim() !== loggedInEmployeeId) {
    resetEvaluationAccess();
    showToast('รหัสพนักงานในชีตผู้ประเมินไม่ตรงกับผู้ใช้ที่เข้าสู่ระบบ', 'error');
    return;
  }

  state.evaluator = evaluator;
  state.selectedCycle = cycle;
  if (cycleInput) cycleInput.value = cycle;
  refreshAssignments();
  renderEvaluatorPanel();
  showToast(`ยืนยันรหัสแล้ว: ${evaluator.fullName}`, 'success');
}

function resetEvaluationAccess() {
  state.evaluator = null;
  state.assignedEmployees = [];
  state.selectedEmployeeId = '';
  renderEvaluatorPanel();
  renderEmployeeSelect();
  renderEmployeePanel();
  renderFormPanel();
}

function refreshAssignments() {
  if (!state.refs || !state.evaluator) {
    state.assignedEmployees = [];
    state.selectedEmployeeId = '';
    state.aiAnalysisPreview = null;
    toggleWorkspace(false);
    renderEmployeeSelect();
    renderEmployeePanel();
    renderFormPanel();
    return;
  }

  const currentCycle = normalizeEvaluationCycle(state.selectedCycle) || getCurrentEvaluationCycle();
  const normalizedTitle = normalizeKey(state.evaluator.evaluatorTitle);

  state.assignedEmployees = state.refs.employees
    .filter(employee => normalizeKey(employee.evaluatorTitle) === normalizedTitle)
    .map(employee => {
      const targetRecordId = buildEvaluationRecordId(currentCycle, employee.employeeId, state.evaluator.employeeId);
      const targetResultKey = buildEvaluationResultKey({
        year: currentCycle,
        employeeId: employee.employeeId,
        evaluatorEmployeeId: state.evaluator.employeeId,
      });
      const existingResult = state.refs.results.find(result =>
        normalizeKey(result.resultKey) === normalizeKey(targetResultKey)
        || normalizeKey(result.id) === normalizeKey(targetRecordId)
      ) || null;

      return {
        ...employee,
        existingResult,
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'th'));

  if (!state.assignedEmployees.some(employee => employee.employeeId === state.selectedEmployeeId)) {
    state.selectedEmployeeId = state.assignedEmployees[0]?.employeeId || '';
  }

  toggleWorkspace(true);
  renderEmployeeSelect();
  renderEmployeePanel();
  renderFormPanel();
}

function toggleWorkspace(visible) {
  const workspace = document.getElementById('evaluation-workspace');
  if (workspace) {
    workspace.style.display = visible ? 'block' : 'none';
  }
}

function renderEvaluatorPanel() {
  const panel = document.getElementById('evaluation-evaluator-panel');
  if (!panel) return;

  if (!state.evaluator) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  panel.style.display = 'grid';
  panel.innerHTML = `
    <div class="evaluation-summary-card">
      <span>ผู้ประเมิน</span>
      <strong>${escapeHTML(state.evaluator.fullName)}</strong>
      <small>${escapeHTML(state.evaluator.evaluatorTitle)}</small>
    </div>
    <div class="evaluation-summary-card">
      <span>รหัสพนักงาน</span>
      <strong>${escapeHTML(state.evaluator.employeeId)}</strong>
      <small>รอบประเมิน ${escapeHTML(state.selectedCycle)}</small>
    </div>
    <div class="evaluation-summary-card">
      <span>จำนวนที่ต้องประเมิน</span>
      <strong>${escapeHTML(String(state.assignedEmployees.length))}</strong>
      <small>รายชื่อที่ผูกจากชีตผู้ถูกประเมิน</small>
    </div>
  `;
}

function renderEmployeeSelect() {
  const select = document.getElementById('evaluation-employee-select');
  if (!select) return;

  if (state.assignedEmployees.length === 0) {
    select.innerHTML = '<option value="">ไม่พบรายชื่อผู้ถูกประเมิน</option>';
    return;
  }

  select.innerHTML = `
    <option value="">เลือกรายชื่อพนักงาน</option>
    ${state.assignedEmployees.map(employee => `
      <option value="${escapeAttr(employee.employeeId)}" ${employee.employeeId === state.selectedEmployeeId ? 'selected' : ''}>
        ${escapeHTML(`${employee.employeeId} • ${employee.fullName}${employee.existingResult ? ' • ประเมินแล้ว' : ''}`)}
      </option>
    `).join('')}
  `;
}

function handleEmployeeSelection(event) {
  state.selectedEmployeeId = String(event.target.value || '').trim();
  renderEmployeePanel();
  renderFormPanel();
}

function getSelectedEmployee() {
  return state.assignedEmployees.find(employee => employee.employeeId === state.selectedEmployeeId) || null;
}

function renderEmployeePanel() {
  const panel = document.getElementById('evaluation-employee-panel');
  if (!panel) return;

  const employee = getSelectedEmployee();
  if (!employee) {
    panel.innerHTML = `
      <div class="evaluation-empty">
        <div class="evaluation-empty-icon"><i class="fa-solid fa-user-clock"></i></div>
        <div>
          <h3>ยังไม่ได้เลือกรายชื่อผู้ถูกประเมิน</h3>
          <p>เลือกพนักงานจากรายการด้านบนก่อน เพื่อให้ระบบแสดงหัวข้อการประเมินและคะแนนที่เคยบันทึกไว้ในรอบเดียวกัน</p>
        </div>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="evaluation-employee-card">
      <div class="evaluation-employee-head">
        <div>
          <h3>${escapeHTML(employee.displayName || employee.fullName)}</h3>
          <p>${escapeHTML(employee.position)}</p>
        </div>
        <span class="evaluation-status ${employee.existingResult ? 'is-active' : 'is-inactive'}">
          ${employee.existingResult ? 'มีผลประเมินรอบนี้แล้ว' : 'ยังไม่บันทึกผลรอบนี้'}
        </span>
      </div>
      <div class="evaluation-detail-grid">
        ${renderEmployeeDetail('รหัสพนักงาน', employee.employeeId)}
        ${renderEmployeeDetail('ส่วน / แผนก / หน่วย', [employee.section, employee.department, employee.unit].filter(Boolean).join(' / '))}
        ${renderEmployeeDetail('ระดับ', employee.level)}
        ${renderEmployeeDetail('อายุงาน', employee.serviceAge)}
        ${renderEmployeeDetail('วันที่เริ่มงาน', employee.startDate)}
        ${renderEmployeeDetail('ตำแหน่งผู้ประเมิน', employee.evaluatorTitle)}
      </div>
    </div>
  `;
}

function renderEmployeeDetail(label, value) {
  return `
    <div class="evaluation-detail-item">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value || '-')}</strong>
    </div>
  `;
}

function renderFormPanel() {
  const panel = document.getElementById('evaluation-form-panel');
  if (!panel) return;

  const employee = getSelectedEmployee();
  if (!employee || !state.refs) {
    panel.innerHTML = '';
    return;
  }

  const existingEntries = new Map(
    (Array.isArray(employee.existingResult?.entries) ? employee.existingResult.entries : [])
      .map(entry => [String(entry.key), entry])
  );

  const groupedTopics = groupTopicsBySection(state.refs.topics);
  const commentValue = employee.existingResult?.comment || '';
  const analysisPreview = state.aiAnalysisPreview?.employeeId === employee.employeeId
    ? state.aiAnalysisPreview
    : {
        employeeId: employee.employeeId,
        analysis: employee.existingResult?.analysis || '',
        analysisStatus: employee.existingResult?.analysisStatus || '',
        analysisModel: employee.existingResult?.analysisModel || '',
        analysisGeneratedAt: employee.existingResult?.analysisGeneratedAt || '',
        analysisError: employee.existingResult?.analysisError || '',
      };

  panel.innerHTML = `
    <div class="evaluation-form-header">
      <div>
        <h3>แบบประเมินประจำรอบ ${escapeHTML(state.selectedCycle)}</h3>
        <p>กรอกคะแนนทุกหัวข้อจาก 1 ถึง 5 คะแนน ระบบจะคำนวณคะแนนถ่วงน้ำหนักอัตโนมัติ</p>
      </div>
      <div class="evaluation-score-preview" id="evaluation-score-preview">
        ${renderScorePreviewMarkup(null, {
          answered: 0,
          totalTopics: state.refs.topics.length,
        })}
      </div>
    </div>

    ${groupedTopics.map(group => `
      <section class="evaluation-topic-group">
        <div class="evaluation-topic-group-head">
          <h4>${escapeHTML(group.section)}</h4>
          <span>${escapeHTML(String(group.items.length))} หัวข้อ</span>
        </div>
        <div class="evaluation-topic-list">
          ${group.items.map(topic => {
            const existing = existingEntries.get(topic.key);
            const selectedScore = Number(existing?.score || 0);
            return `
              <div class="evaluation-topic-item">
                <div class="evaluation-topic-copy">
                  <div class="evaluation-topic-meta">
                    <span class="evaluation-topic-index">ข้อ ${escapeHTML(topic.key)}</span>
                    <span class="evaluation-topic-weight">Weight ${escapeHTML(String(topic.weight))}</span>
                  </div>
                  <h5>${escapeHTML(topic.title)}</h5>
                  ${topic.detail ? `<p>${escapeHTML(topic.detail)}</p>` : ''}
                </div>
                <div class="evaluation-topic-control">
                  <label>คะแนน</label>
                  <input type="hidden" id="evaluation-score-${escapeAttr(topic.key)}" value="${selectedScore ? escapeAttr(String(selectedScore)) : ''}">
                  <div class="evaluation-score-button-group" data-topic-key="${escapeAttr(topic.key)}">
                    ${SCORE_OPTIONS.map(option => `
                      <button
                        type="button"
                        class="evaluation-score-btn ${selectedScore === option.value ? 'active' : ''}"
                        data-topic-key="${escapeAttr(topic.key)}"
                        data-score="${option.value}"
                        aria-pressed="${selectedScore === option.value ? 'true' : 'false'}"
                        aria-label="ให้คะแนน ${option.value} ${option.label}"
                      >
                        <span class="evaluation-score-value">${option.value}</span>
                      </button>
                    `).join('')}
                  </div>
                  <div class="evaluation-topic-weight-preview" id="evaluation-weight-preview-${escapeAttr(topic.key)}">
                    ${renderTopicWeightPreview(topic, selectedScore)}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `).join('')}

    <div class="input-group">
      <label for="evaluation-comment-input">ความคิดเห็นจากผู้ประเมิน</label>
      <textarea id="evaluation-comment-input" class="form-control evaluation-comment-input" rows="4" placeholder="เพิ่มความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมได้ที่นี่">${escapeHTML(commentValue)}</textarea>
      <small class="evaluation-comment-note">ระบบจะให้ Gemini ช่วยสรุปวิเคราะห์ก่อนบันทึก และถ้า AI ไม่พร้อมใช้งานจะบันทึกผลประเมินต่อทันที</small>
    </div>

    <div class="evaluation-ai-card" id="evaluation-ai-card">
      ${renderAiAnalysisContent(analysisPreview)}
    </div>

    <div class="evaluation-submit-bar">
      <button class="btn btn-primary" type="button" id="evaluation-submit-btn">
        <i class="fa-solid fa-floppy-disk"></i>
        ${employee.existingResult ? 'อัปเดตผลประเมิน' : 'บันทึกผลประเมิน'}
      </button>
    </div>
  `;

  panel.querySelectorAll('.evaluation-score-btn').forEach(button => {
    button.addEventListener('click', () => {
      const topicKey = String(button.dataset.topicKey || '').trim();
      const score = String(button.dataset.score || '').trim();
      const hiddenInput = document.getElementById(`evaluation-score-${topicKey}`);
      if (hiddenInput) {
        hiddenInput.value = score;
      }

      panel.querySelectorAll(`.evaluation-score-btn[data-topic-key="${topicKey}"]`).forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      updateTopicWeightPreview(topicKey, Number(score || 0));
      updateScorePreview();
    });
  });
  panel.querySelector('#evaluation-submit-btn')?.addEventListener('click', submitEvaluation);

  updateScorePreview();
}

function groupTopicsBySection(topics) {
  const groups = new Map();
  topics.forEach(topic => {
    const current = groups.get(topic.section) || { section: topic.section, items: [] };
    current.items.push(topic);
    groups.set(topic.section, current);
  });
  return [...groups.values()];
}

function collectScoreMap({ allowPartial = false } = {}) {
  const scoreMap = {};
  let answered = 0;

  for (const topic of state.refs?.topics || []) {
    const select = document.getElementById(`evaluation-score-${topic.key}`);
    const value = String(select?.value || '').trim();

    if (!value) {
      if (!allowPartial) return null;
      scoreMap[topic.key] = 0;
      continue;
    }

    scoreMap[topic.key] = Number(value);
    answered += 1;
  }

  return { scoreMap, answered };
}

function updateScorePreview() {
  const preview = document.getElementById('evaluation-score-preview');
  if (!preview || !state.refs) return;

  const partial = collectScoreMap({ allowPartial: true });
  if (!partial) return;

  const employee = getSelectedEmployee();
  if (!employee || !state.evaluator) return;

  const draft = createEvaluationResultRecord({
    cycleLabel: state.selectedCycle,
    employee,
    evaluator: state.evaluator,
    comment: '',
    scoresByKey: partial.scoreMap,
    topics: state.refs.topics,
  });

  preview.innerHTML = renderScorePreviewMarkup(draft, {
    answered: partial.answered,
    totalTopics: state.refs.topics.length,
  });
}

function renderScorePreviewMarkup(draft, { answered = 0, totalTopics = 0 } = {}) {
  const overallScore = Number(draft?.overallScore);
  const weightedTotal = Number(draft?.weightedTotal);

  return `
    <div class="evaluation-score-main">
      <span>คะแนนรวม</span>
      <strong>${Number.isFinite(overallScore) ? escapeHTML(overallScore.toFixed(2)) : '-'}</strong>
    </div>
    <div class="evaluation-score-subtotal">
      <span>คะแนนรวมถ่วงน้ำหนัก</span>
      <strong>${Number.isFinite(weightedTotal) ? escapeHTML(weightedTotal.toFixed(2)) : '-'}</strong>
    </div>
    <small>= ผลรวม ((คะแนนที่ได้ x Weight) / 100)</small>
    <small>ตอบแล้ว ${escapeHTML(String(answered))} / ${escapeHTML(String(totalTopics))} ข้อ</small>
  `;
}

function renderTopicWeightPreview(topic, selectedScore = 0) {
  return escapeHTML(buildTopicWeightPreviewText(topic, selectedScore));
}

function buildTopicWeightPreviewText(topic, selectedScore = 0) {
  const weight = Number(topic?.weight || 0);
  const hasSelectedScore = Number(selectedScore) > 0;
  const score = hasSelectedScore ? Number(selectedScore) : 5;
  const weightedScore = (score * weight) / 100;
  const prefix = hasSelectedScore ? 'คะแนนถ่วงน้ำหนัก' : 'ตัวอย่าง';

  return `${prefix}: (${score} x ${weight}) / 100 = ${weightedScore.toFixed(2)}`;
}

function updateTopicWeightPreview(topicKey, selectedScore = 0) {
  const preview = document.getElementById(`evaluation-weight-preview-${topicKey}`);
  const topic = state.refs?.topics?.find(item => String(item.key) === String(topicKey));
  if (!preview || !topic) return;

  preview.textContent = buildTopicWeightPreviewText(topic, selectedScore);
}

function renderAiAnalysisContent(analysis) {
  const status = normalizeKey(analysis?.analysisStatus);
  const text = String(analysis?.analysis || '').trim();
  const model = String(analysis?.analysisModel || '').trim();
  const generatedAt = String(analysis?.analysisGeneratedAt || '').trim();
  const error = String(analysis?.analysisError || '').trim();

  if (status === 'loading') {
    return `
      <div class="evaluation-ai-head">
        <div>
          <h4>ผลวิเคราะห์ AI</h4>
          <p>Gemini กำลังสรุปผลประเมินจากคะแนนและความคิดเห็นของผู้ประเมิน</p>
        </div>
        <span class="evaluation-ai-badge is-loading">Analyzing</span>
      </div>
      <div class="evaluation-ai-body is-muted">กำลังประมวลผล...</div>
    `;
  }

  if (text) {
    return `
      <div class="evaluation-ai-head">
        <div>
          <h4>ผลวิเคราะห์ AI</h4>
          <p>${model ? `สร้างโดย ${escapeHTML(model)}` : 'สรุปจากคะแนนและความคิดเห็นล่าสุด'}</p>
        </div>
        <span class="evaluation-ai-badge is-success">พร้อมใช้</span>
      </div>
      <div class="evaluation-ai-body">${escapeHTML(text).replace(/\n/g, '<br>')}</div>
      <div class="evaluation-ai-meta">${generatedAt ? `วิเคราะห์เมื่อ ${escapeHTML(generatedAt)}` : ''}</div>
    `;
  }

  if (
    status === 'skipped_limit'
    || status === 'skipped_error'
    || status === 'skipped_empty'
    || status === 'skipped_no_key'
    || status === 'skipped_disabled'
  ) {
    return `
      <div class="evaluation-ai-head">
        <div>
          <h4>ผลวิเคราะห์ AI</h4>
          <p>ระบบบันทึกผลประเมินต่อได้แม้ Gemini จะไม่พร้อมใช้งาน</p>
        </div>
        <span class="evaluation-ai-badge is-warning">Fallback</span>
      </div>
      <div class="evaluation-ai-body is-muted">ยังไม่มีผลวิเคราะห์ AI สำหรับรายการนี้</div>
      ${error ? `<div class="evaluation-ai-meta">รายละเอียด: ${escapeHTML(error)}</div>` : ''}
    `;
  }

  return `
    <div class="evaluation-ai-head">
      <div>
        <h4>ผลวิเคราะห์ AI</h4>
        <p>หลังจากกดบันทึก ระบบจะแสดงผลสรุปจาก Gemini ในส่วนนี้</p>
      </div>
      <span class="evaluation-ai-badge">Pending</span>
    </div>
    <div class="evaluation-ai-body is-muted">ยังไม่มีผลวิเคราะห์สำหรับรายการนี้</div>
  `;
}

function updateAiAnalysisPreview(analysis) {
  const employee = getSelectedEmployee();
  if (!employee) return;

  state.aiAnalysisPreview = {
    employeeId: employee.employeeId,
    ...analysis,
  };

  const panel = document.getElementById('evaluation-ai-card');
  if (panel) {
    panel.innerHTML = renderAiAnalysisContent(state.aiAnalysisPreview);
  }
}

function renderAiModalBody({ employee, record, aiAnalysis }) {
  const score = Number(record?.overallScore || 0).toFixed(2);
  const weightedTotal = Number(record?.weightedTotal || 0).toFixed(2);
  const comment = String(record?.comment || '').trim();
  const analysis = String(aiAnalysis?.analysis || '').trim();
  const status = normalizeKey(aiAnalysis?.analysisStatus);
  const model = String(aiAnalysis?.analysisModel || '').trim();
  const error = String(aiAnalysis?.analysisError || '').trim();

  const aiBlock = analysis
    ? `<div class="evaluation-ai-modal-block"><span>ผลวิเคราะห์ AI</span><div>${escapeHTML(analysis).replace(/\n/g, '<br>')}</div></div>`
    : `<div class="evaluation-ai-modal-block"><span>ผลวิเคราะห์ AI</span><div class="is-muted">${status === 'skipped_limit' ? 'Gemini ติดลิมิต ระบบจะบันทึกผลประเมินได้ตามปกติ' : status === 'skipped_error' ? 'Gemini วิเคราะห์ไม่สำเร็จ ระบบจะบันทึกผลประเมินได้ตามปกติ' : 'AI ไม่พร้อมใช้งาน ระบบจะบันทึกผลประเมินได้ตามปกติ'}</div></div>`;

  return `
    <div class="evaluation-ai-modal">
      <div class="evaluation-ai-modal-summary">
        <div class="evaluation-ai-modal-item">
          <span>ผู้ถูกประเมิน</span>
          <strong>${escapeHTML(employee.fullName)}</strong>
        </div>
        <div class="evaluation-ai-modal-item">
          <span>รอบประเมิน</span>
          <strong>${escapeHTML(state.selectedCycle)}</strong>
        </div>
        <div class="evaluation-ai-modal-item">
          <span>คะแนนรวม</span>
          <strong>${escapeHTML(score)}</strong>
          <small>คะแนนรวมถ่วงน้ำหนัก ${escapeHTML(weightedTotal)}</small>
        </div>
      </div>
      <div class="evaluation-ai-modal-block">
        <span>ความคิดเห็นจากผู้ประเมิน</span>
        <div class="${comment ? '' : 'is-muted'}">${comment ? escapeHTML(comment).replace(/\n/g, '<br>') : 'ไม่มีความคิดเห็นเพิ่มเติม'}</div>
      </div>
      ${aiBlock}
      <div class="evaluation-ai-modal-meta">
        ${model ? `<span>Model: ${escapeHTML(model)}</span>` : ''}
        ${!analysis && error ? `<span>${escapeHTML(error)}</span>` : ''}
      </div>
    </div>
  `;
}

async function submitEvaluation() {
  if (!state.refs || !state.evaluator) {
    showToast('กรุณายืนยันรหัสเข้าประเมินก่อน', 'warning');
    return;
  }

  const employee = getSelectedEmployee();
  if (!employee) {
    showToast('กรุณาเลือกรายชื่อผู้ถูกประเมิน', 'warning');
    return;
  }

  const collected = collectScoreMap();
  if (!collected) {
    showToast('กรุณาให้คะแนนให้ครบทุกหัวข้อ', 'warning');
    return;
  }

  const comment = String(document.getElementById('evaluation-comment-input')?.value || '').trim();
  const baseRecord = createEvaluationResultRecord({
    cycleLabel: state.selectedCycle,
    employee,
    evaluator: state.evaluator,
    comment,
    scoresByKey: collected.scoreMap,
    topics: state.refs.topics,
  });

  if (state.saving) return;
  state.saving = true;

  try {
    let aiAnalysis = {
      analysis: '',
      analysisStatus: 'skipped_disabled',
      analysisModel: '',
      analysisGeneratedAt: '',
      analysisError: '',
    };

    const gemini = getGeminiAvailability();
    if (gemini.enabled) {
      updateAiAnalysisPreview({
        analysis: '',
        analysisStatus: 'loading',
        analysisModel: gemini.model,
        analysisGeneratedAt: '',
        analysisError: '',
      });
      showToast('กำลังให้ Gemini ช่วยสรุปวิเคราะห์ผลประเมิน...', 'info');
      aiAnalysis = await analyzeEvaluationWithGemini({
        record: baseRecord,
        employee,
        evaluator: state.evaluator,
      });
      updateAiAnalysisPreview(aiAnalysis);

      if (aiAnalysis.analysisStatus === 'skipped_limit') {
        showToast('Gemini ติดลิมิต ระบบจะบันทึกผลประเมินต่อโดยไม่ใช้ AI', 'warning');
      } else if (aiAnalysis.analysisStatus === 'skipped_error') {
        showToast('Gemini วิเคราะห์ไม่สำเร็จ ระบบจะบันทึกผลประเมินต่อโดยไม่ใช้ AI', 'warning');
      }
    } else {
      updateAiAnalysisPreview(aiAnalysis);
    }

    const record = createEvaluationResultRecord({
      cycleLabel: state.selectedCycle,
      employee,
      evaluator: state.evaluator,
      comment,
      scoresByKey: collected.scoreMap,
      topics: state.refs.topics,
      aiAnalysis,
    });

    const confirmed = await showRichConfirmModal(
      employee.existingResult ? 'ยืนยันอัปเดตผลประเมิน' : 'ยืนยันบันทึกผลประเมิน',
      renderAiModalBody({ employee, record, aiAnalysis }),
      employee.existingResult ? 'fa-pen-to-square' : 'fa-floppy-disk',
      employee.existingResult ? 'อัปเดตผลประเมิน' : 'บันทึกผลประเมิน',
      'กลับไปแก้ไข'
    );

    if (!confirmed) return;

    await upsertEvaluationResult(record, {
      existingRowIndex: employee.existingResult?.rowIndex ?? null,
      headers: state.refs.resultHeaders,
    });

    const synced = await waitForEvaluationResultSync(record).catch(error => {
      console.warn('waitForEvaluationResultSync failed:', error);
      return false;
    });

    showToast(
      !synced
        ? 'บันทึกผลประเมินแล้ว ระบบกำลังซิงก์ข้อมูลรายงานจาก Google Sheets อีกเล็กน้อย'
        : (employee.existingResult ? 'อัปเดตผลประเมินแล้ว' : 'บันทึกผลประเมินแล้ว'),
      !synced ? 'warning' : 'success'
    );
    await loadReferenceData({ silent: true });
    refreshAssignments();
  } catch (error) {
    console.error('submitEvaluation failed:', error);
    showToast(`บันทึกผลประเมินไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    state.saving = false;
  }
}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase();
}
