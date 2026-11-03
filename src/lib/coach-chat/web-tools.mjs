// @ts-check
// Web search and web fetch for the Coach chat (lift/COACH-CHAT.md, "The web"): Anthropic runs both, so Coach can check
// the research, a race's page, a gym's hours or a physio article instead of saying it can't browse (Paolo,
// 2026-11-03). Pure: the tool definitions and the sources line under a reply that used them.

/** Searches per answer. A search costs $0.01 (cost.mjs) plus the result tokens. */
export const MAX_SEARCHES = 5;
/** Pages read per answer, and the most of one page Claude reads (tokens), so one long page can't eat the budget. */
export const MAX_FETCHES = 4;
export const FETCH_MAX_TOKENS = 20000;
/** Links in the Sources line. */
export const MAX_SOURCES = 5;

/** The version with dynamic filtering (Claude trims the results before reading them); Sonnet 5.5 has it. */
export const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: MAX_SEARCHES,
  // Results near home: gyms, races, weather, shops.
  user_location: { type: 'approximate', city: 'San Francisco', region: 'California', country: 'US', timezone: 'America/Los_Angeles' },
};

/** Reads a page whose URL is already in the chat (Paolo's message or a search result). */
export const WEB_FETCH_TOOL = {
  type: 'web_fetch_20260209',
  name: 'web_fetch',
  max_uses: MAX_FETCHES,
  max_content_tokens: FETCH_MAX_TOKENS,
};

/** How many searches and fetches one response used. @param {any} usage */
export function webUses(usage) {
  const s = usage?.server_tool_use ?? {};
  return { searches: Number(s.web_search_requests ?? 0) || 0, fetches: Number(s.web_fetch_requests ?? 0) || 0 };
}

/**
 * The pages a reply leaned on: its citations first, then the pages it fetched, each once, at most MAX_SOURCES.
 * @param {any[]} content  Claude's messages' blocks, in order
 * @returns {{ title: string, url: string }[]}
 */
export function sourcesOf(content) {
  /** @type {Map<string, string>} */
  const found = new Map();
  const add = (/** @type {unknown} */ url, /** @type {unknown} */ title) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || found.has(url)) return;
    found.set(url, typeof title === 'string' && title.trim() ? title.trim() : hostOf(url));
  };
  for (const b of content ?? []) {
    if (b?.type === 'text') for (const c of b.citations ?? []) add(c?.url, c?.title);
  }
  for (const b of content ?? []) {
    if (b?.type === 'web_fetch_tool_result' && b.content?.type === 'web_fetch_result') add(b.content.url, b.content.content?.title);
  }
  // No citation and no page read: the top search results it read, so the reply still says where it looked.
  if (!found.size) {
    for (const b of content ?? []) {
      if (b?.type !== 'web_search_tool_result' || !Array.isArray(b.content)) continue;
      for (const r of b.content.slice(0, 3)) if (r?.type === 'web_search_result') add(r.url, r.title);
    }
  }
  return [...found].slice(0, MAX_SOURCES).map(([url, title]) => ({ url, title: title.slice(0, 80) }));
}

/** @param {string} url */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * The line under a reply that looked things up: "Sources: [PubMed](…), [ACSM](…)". Empty without sources.
 * @param {{ title: string, url: string }[]} sources
 */
export function sourcesLine(sources) {
  if (!sources.length) return '';
  const md = (/** @type {string} */ s) => s.replace(/[[\]]/g, '');
  return `Sources: ${sources.map((s) => `[${md(s.title)}](${s.url})`).join(', ')}`;
}
