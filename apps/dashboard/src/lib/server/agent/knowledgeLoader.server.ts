import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface KnowledgeChunk {
  source: string;
  type: string;
  page: number | null;
  block: number;
  level: string;
  chunk_id: string;
  char_len: number;
  text: string;
}

export interface SourceMeta {
  source: string;
  type: string;
  count: number;
}

export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
}

let _chunks: KnowledgeChunk[] | null = null;
let _sources: SourceMeta[] | null = null;

const KNOWLEDGE_FILES = ['chunks.jsonl', 'global-eagle-manual.jsonl'];

const STOP_TERMS = new Set([
  '什么',
  '怎么',
  '怎么样',
  '需要',
  '可以',
  '关于',
  '请问',
  '简单',
  '说明',
  '今天',
  '现在',
  '最新',
  '哪些',
  '如何',
  '为什么',
  '帮我',
  '一首'
]);

const DOMAIN_TERMS = [
  '无人机',
  '无人驾驶',
  '航空',
  '飞行',
  '飞控',
  '起飞',
  '着陆',
  '降落',
  '空域',
  '机场',
  '净空',
  '航线',
  '航路',
  '民航',
  '管制',
  '驾驶员',
  '合格证',
  '适航',
  '机长',
  '气象',
  '风向',
  '风速',
  '能见度',
  '编队',
  '航拍',
  '遥控',
  '遥测',
  '旋翼',
  '固定翼',
  '多旋翼',
  '电池',
  '载荷',
  '螺旋桨',
  '飞行前',
  '飞行手册',
  '全球鹰',
  '全球鷹',
  '驾驶技术概论',
  '駕駛技術概論',
  '地面站',
  '飞行训练模拟器',
  '飛行訓練模擬器',
  '空中交通管制',
  'drone',
  'uav',
  'uas',
  'airspace',
  'aviation',
  'flight',
  'pilot',
  'weather'
];

function loadChunks(): KnowledgeChunk[] {
  if (_chunks) return _chunks;
  _chunks = KNOWLEDGE_FILES.flatMap((filename) => {
    const path = resolveKnowledgePath(filename);
    const raw = readFileSync(path, 'utf-8');
    const lines = raw.split(/\r?\n/).filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line) as KnowledgeChunk);
  });
  return _chunks;
}

function resolveKnowledgePath(filename: string) {
  const candidates = [
    resolve(process.cwd(), 'src/lib/server/agent/knowledge', filename),
    resolve(process.cwd(), 'apps/dashboard/src/lib/server/agent/knowledge', filename)
  ];

  if (typeof import.meta.dirname === 'string') {
    candidates.push(resolve(import.meta.dirname, 'knowledge', filename));
  }

  const found = candidates.find((path) => existsSync(path));

  if (!found) {
    throw new Error(`ailaeclass Agent knowledge file not found: ${filename}`);
  }

  return found;
}

function buildSources(chunks: KnowledgeChunk[]): SourceMeta[] {
  const map = new Map<string, { source: string; type: string; count: number }>();
  for (const c of chunks) {
    const key = `${c.source}::${c.type}`;
    const entry = map.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      map.set(key, { source: c.source, type: c.type, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getKnowledgeStats(): { chunkCount: number; sources: SourceMeta[] } {
  const chunks = loadChunks();
  if (!_sources) {
    _sources = buildSources(chunks);
  }
  return { chunkCount: chunks.length, sources: _sources };
}

export function getAllChunks(): KnowledgeChunk[] {
  return loadChunks();
}

export function searchChunks(query: string, limit = 10): KnowledgeChunk[] {
  const scored = searchChunksScored(query, limit);
  return scored.map((s) => s.chunk);
}

export function searchChunksScored(query: string, limit = 10): ScoredChunk[] {
  const chunks = loadChunks();
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const normalizedQuery = query.toLowerCase();
  const requestsGlobalEagle =
    normalizedQuery.includes('全球鹰') || normalizedQuery.includes('全球鷹');

  const totalDocs = chunks.length;
  const idf = new Map<string, number>();

  for (const t of terms) {
    let docFreq = 0;
    for (const c of chunks) {
      if (`${c.source}\n${c.text}`.toLowerCase().includes(t)) docFreq += 1;
    }
    if (docFreq > 0 && docFreq / totalDocs < 0.35) {
      idf.set(t, Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1));
    }
  }

  const usableTerms = [...idf.keys()];

  const avgDocLen =
    chunks.reduce((sum, c) => sum + c.text.length, 0) / (totalDocs || 1);
  const k1 = 1.2;
  const b = 0.75;

  const scored = chunks
    .map((c) => {
      const text = `${c.source}\n${c.text}`.toLowerCase();
      const docLen = c.text.length;
      let score = 0;
      for (const t of usableTerms) {
        const tf = text.split(t).length - 1;
        if (tf === 0) continue;
        const termIdf = idf.get(t) ?? 0;
        const denom = tf + k1 * (1 - b + b * (docLen / avgDocLen));
        score += termIdf * ((tf * (k1 + 1)) / denom);
      }

      if (
        requestsGlobalEagle &&
        (c.source.includes('全球鹰') || c.source.includes('全球鷹'))
      ) {
        score += 12;
      }

      return { chunk: c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

function tokenize(query: string): string[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];

  const tokens: string[] = [];
  const latinTerms = lower.match(/[a-z0-9][a-z0-9_-]{1,}/g) ?? [];
  tokens.push(...latinTerms);

  const cjkSequences = lower.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  for (const sequence of cjkSequences) {
    if (!STOP_TERMS.has(sequence) && sequence.length <= 8) {
      tokens.push(sequence);
    }

    for (const size of [2, 3, 4]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        const term = sequence.slice(index, index + size);
        if (!STOP_TERMS.has(term)) {
          tokens.push(term);
        }
      }
    }
  }

  return [...new Set(tokens)].filter((term) => term.length > 1 && !STOP_TERMS.has(term));
}

export function hasAgentKnowledgeIntent(query: string): boolean {
  const normalized = query.toLowerCase();
  return DOMAIN_TERMS.some((term) => normalized.includes(term));
}
