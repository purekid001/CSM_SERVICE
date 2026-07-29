import { callAnalyzeEvaluationFunction } from '../firebase.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiAvailability() {
  return {
    enabled: true,
    model: GEMINI_MODEL,
  };
}

export async function analyzeEvaluationWithGemini({ record, employee, evaluator }) {
  try {
    return await callAnalyzeEvaluationFunction({
      record,
      employee,
      evaluator,
    });
  } catch (error) {
    const code = String(error?.code || '');
    return {
      analysis: '',
      analysisStatus: code.includes('resource-exhausted')
        ? 'skipped_limit'
        : 'skipped_error',
      analysisModel: GEMINI_MODEL,
      analysisGeneratedAt: new Date().toISOString(),
      analysisError: code || 'functions_error',
    };
  }
}
