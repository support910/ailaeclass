import Papa from 'papaparse';
import { SimulatorError } from './drive.js';

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function numeric(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  return NUMBER.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
const ALIASES = {
  metric: ['metric', 'name', '指標', '指标', '項目', '项目'],
  value: ['value', 'actual', '實際值', '实际值', '數值', '数值'],
  target: ['target', '目標', '目标', '標準', '标准'],
  unit: ['unit', '單位', '单位'],
  direction: ['direction', '方向']
};
const pick = (row, key) => ALIASES[key].map((name) => row[name]).find((v) => v !== undefined);
const text = (value, max) => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '';

export function parseResults(input) {
  const source = input.replace(/^\uFEFF/, '').trim();
  if (!source || /^\s*</.test(source)) throw new SimulatorError('invalid_data', 422);
  let rows;
  if (/^[\[{]/.test(source)) {
    try {
      const data = JSON.parse(source);
      rows = Array.isArray(data) ? data : data.metrics;
    } catch { throw new SimulatorError('invalid_data', 422); }
  } else {
    const parsed = Papa.parse(source, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim().toLowerCase() });
    if (parsed.errors.length) throw new SimulatorError('invalid_data', 422);
    rows = parsed.data;
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000 || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
    throw new SimulatorError('invalid_data', 422);
  }
  const normalized = rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v])));
  const isMetrics = pick(normalized[0], 'metric') !== undefined && pick(normalized[0], 'value') !== undefined;
  if (!isMetrics) throw new SimulatorError('columns_required', 422);
  if (rows.length > 200) throw new SimulatorError('too_many_metrics', 422);
  const metrics = [];
  const issues = [];
  for (const [index, row] of normalized.entries()) {
    const name = text(pick(row, 'metric'), 120);
    const value = numeric(pick(row, 'value'));
    if (!name || value === null) { issues.push({ row: index + 1, code: 'invalid_value' }); continue; }
    const targetRaw = pick(row, 'target');
    const directionRaw = text(pick(row, 'direction'), 30).toLowerCase();
    const direction = ['lower', '<=', '≤'].includes(directionRaw) ? 'lower' : ['higher', '>=', '≥'].includes(directionRaw) ? 'higher' : ['equal', '=', '=='].includes(directionRaw) ? 'equal' : null;
    const target = numeric(targetRaw);
    const comparable = target !== null && direction !== null;
    if (!comparable) issues.push({ row: index + 1, code: 'missing_standard' });
    const good = comparable && (direction === 'lower' ? value <= target : direction === 'higher' ? value >= target : value === target);
    metrics.push({ row: index + 1, name, value, unit: text(pick(row, 'unit'), 20), target, direction,
      status: comparable ? good ? 'good' : 'improve' : 'unknown', deviation: comparable ? value - target : null });
  }
  if (!metrics.length) throw new SimulatorError('invalid_data', 422);
  return { totalRows: rows.length, metrics, issues, good: metrics.filter((m) => m.status === 'good').length,
    improve: metrics.filter((m) => m.status === 'improve').length, unknown: metrics.filter((m) => m.status === 'unknown').length,
    invalidRows: rows.length - metrics.length, standardSource: 'learner_file_unverified' };
}

export const RESULT_TEMPLATE = 'metric,value,unit,target,direction\nLateral deviation,0.42,m,0.8,lower\nAltitude deviation,1.2,m,1,lower\nTask completion,95,%,100,higher\nHeading error,5,deg,,\n';
