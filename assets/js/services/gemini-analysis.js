const DEFAULT_MODEL = normalizeText(import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash');
const DEFAULT_ENDPOINT = normalizeText(import.meta.env.VITE_GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function getGeminiApiKey() {
  return normalizeText(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_AI_API_KEY);
}

function buildSectionSummary(sectionScores = []) {
  return sectionScores
    .map(section => `${section.section}: ${roundTo(section.score, 2)} คะแนน, ตอบ ${section.answered}/${section.items} ข้อ`)
    .join('\n');
}

function buildItemSummary(entries = []) {
  return entries
    .map(entry => ({
      key: entry.key,
      title: entry.title,
      score: Number(entry.score || 0),
      weight: Number(entry.weight || 0),
      weightedScore: Number(entry.weightedScore || 0),
    }))
    .sort((left, right) => left.key.localeCompare(right.key, 'en'))
    .map(entry => `ข้อ ${entry.key}: ${entry.title} | score ${entry.score}/5 | weight ${entry.weight} | weighted ${roundTo(entry.weightedScore, 2)}`)
    .join('\n');
}

function extractTextFromGeminiResponse(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => normalizeText(part?.text))
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function requestGeminiAnalysis({ endpoint, apiKey, body }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  return response;
}

export function getGeminiAvailability() {
  const apiKey = getGeminiApiKey();
  return {
    enabled: Boolean(apiKey),
    apiKey,
    model: DEFAULT_MODEL,
    endpoint: DEFAULT_ENDPOINT,
  };
}

export async function analyzeEvaluationWithGemini({ record, employee, evaluator }) {
  const config = getGeminiAvailability();
  if (!config.enabled) {
    return {
      analysis: '',
      analysisStatus: 'skipped_no_key',
      analysisModel: '',
      analysisGeneratedAt: '',
      analysisError: 'missing_api_key',
    };
  }

  try {
    const prompt = [
      'คุณคือผู้ช่วยวิเคราะห์ผลประเมินพนักงานสำหรับงาน HR',
      'ช่วยสรุปเป็นภาษาไทยแบบกระชับและใช้งานได้จริง',
      'รูปแบบคำตอบ: 3 บรรทัดเท่านั้น',
      'บรรทัด 1 ขึ้นต้นด้วย "ภาพรวม:"',
      'บรรทัด 2 ขึ้นต้นด้วย "จุดเด่น:"',
      'บรรทัด 3 ขึ้นต้นด้วย "ข้อเสนอแนะ:"',
      'ห้ามใช้ markdown, ตาราง, bullet, หรือข้อความเกินความจำเป็น',
      '',
      `รอบประเมิน: ${record.year}`,
      `ผู้ถูกประเมิน: ${employee.fullName} (${employee.employeeId})`,
      `ตำแหน่ง: ${employee.position || '-'}`,
      `ผู้ประเมิน: ${evaluator.fullName}`,
      `คะแนนรวม: ${roundTo(record.overallScore, 2)} / 100`,
      `คะแนนดิบรวม: ${roundTo(record.rawTotalScore, 2)}`,
      '',
      'คะแนนรายหมวด:',
      buildSectionSummary(record.sectionScores),
      '',
      'คะแนนรายข้อ:',
      buildItemSummary(record.entries),
      '',
      `ความคิดเห็นจากผู้ประเมิน: ${normalizeText(record.comment) || 'ไม่มี'}`
    ].join('\n');

    const endpoint = `${config.endpoint}/models/${encodeURIComponent(config.model)}:generateContent`;
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 320,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    };

    const response = await requestGeminiAnalysis({
      endpoint,
      apiKey: config.apiKey,
      body: requestBody,
    });

    if (!response.ok) {
      const detailText = await response.text();
      const normalizedDetail = normalizeText(detailText);
      const isRateLimit = response.status === 429
        || normalizedDetail.includes('RESOURCE_EXHAUSTED')
        || normalizedDetail.includes('quota')
        || normalizedDetail.includes('rate limit');

      return {
        analysis: '',
        analysisStatus: isRateLimit ? 'skipped_limit' : 'skipped_error',
        analysisModel: config.model,
        analysisGeneratedAt: new Date().toISOString(),
        analysisError: normalizedDetail || `http_${response.status}`,
      };
    }

    let payload = await response.json();
    let analysis = extractTextFromGeminiResponse(payload);

    if (!analysis) {
      const retryResponse = await requestGeminiAnalysis({
        endpoint,
        apiKey: config.apiKey,
        body: {
          ...requestBody,
          generationConfig: {
            ...requestBody.generationConfig,
            maxOutputTokens: 480,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
      });

      if (retryResponse.ok) {
        payload = await retryResponse.json();
        analysis = extractTextFromGeminiResponse(payload);
      }
    }

    return {
      analysis,
      analysisStatus: analysis ? 'generated' : 'skipped_empty',
      analysisModel: config.model,
      analysisGeneratedAt: new Date().toISOString(),
      analysisError: analysis ? '' : 'empty_response',
    };
  } catch (error) {
    return {
      analysis: '',
      analysisStatus: 'skipped_error',
      analysisModel: config.model,
      analysisGeneratedAt: new Date().toISOString(),
      analysisError: normalizeText(error?.message || error) || 'unexpected_gemini_error',
    };
  }
}
