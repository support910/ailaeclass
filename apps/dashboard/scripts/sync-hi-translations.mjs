import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translationsDir = path.resolve(__dirname, '../src/lib/utils/translations');
const englishPath = path.join(translationsDir, 'en.json');
const hindiPath = path.join(translationsDir, 'hi.json');

const english = JSON.parse(await fs.readFile(englishPath, 'utf8'));
const hindi = JSON.parse(await fs.readFile(hindiPath, 'utf8'));

function flatten(value, prefix = '', output = {}) {
  for (const [key, child] of Object.entries(value || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, fullKey, output);
    } else {
      output[fullKey] = child;
    }
  }
  return output;
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] ||= {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function protectTokens(text) {
  const tokens = [];
  const protectedText = text.replace(/\{[^}]+\}|https?:\/\/\S+|\bAilaeclass\b/gi, (token) => {
    const marker = `XQPH${Buffer.from(token).toString('hex')}QX`;
    tokens.push([marker, token]);
    return marker;
  });
  return { protectedText, tokens };
}

function restoreTokens(text, tokens) {
  return tokens.reduce(
    (result, [marker, token]) => result.replace(new RegExp(marker, 'gi'), token),
    text
  );
}

async function translate(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  const { protectedText, tokens } = protectTokens(text);
  const query = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'hi',
    dt: 't',
    q: protectedText
  });
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${query.toString()}`
  );
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translated = payload?.[0]?.map((part) => part?.[0] || '').join('');
  if (!translated) throw new Error('Translation response was empty');
  return restoreTokens(translated, tokens);
}

const englishFlat = flatten(english);
const hindiFlat = flatten(hindi);
const pending = Object.entries(englishFlat).filter(
  ([key, value]) => !(key in hindiFlat) || hindiFlat[key] === value
);

const concurrency = 6;
let cursor = 0;
let completed = 0;
const failures = [];

async function worker() {
  while (cursor < pending.length) {
    const index = cursor++;
    const [key, source] = pending[index];
    try {
      const translated = await translate(source);
      setPath(hindi, key, translated);
      completed += 1;
      if (completed % 50 === 0 || completed === pending.length) {
        console.log(`Translated ${completed}/${pending.length}`);
      }
    } catch (error) {
      failures.push({ key, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} translations failed; hi.json was not changed.`);
}

await fs.writeFile(hindiPath, `${JSON.stringify(hindi, null, 2)}\n`, 'utf8');
console.log(`Updated ${completed} Hindi translations.`);
