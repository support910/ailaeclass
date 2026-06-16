import { json } from '@sveltejs/kit';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string, limit = 3): Promise<WebSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const encoded = encodeURIComponent(trimmed);
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encoded}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) return [];

    const html = await response.text();
    return parseDuckDuckGoResults(html, limit);
  } catch (err) {
    console.error('Web search fallback failed:', err instanceof Error ? err.message : 'unknown');
    return [];
  }
}

function parseDuckDuckGoResults(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)<\/a>/g;
  const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/g;

  const titles: { url: string; title: string }[] = [];
  let match;
  while ((match = resultRegex.exec(html)) !== null && titles.length < limit) {
    titles.push({ url: decodeHtmlEntities(match[1]), title: stripHtml(match[2]) });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit) {
    snippets.push(stripHtml(match[1]));
  }

  for (let i = 0; i < titles.length; i++) {
    results.push({
      url: titles[i].url,
      title: titles[i].title,
      snippet: snippets[i] ?? ''
    });
  }

  return results;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
