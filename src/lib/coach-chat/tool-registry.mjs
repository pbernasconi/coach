// @ts-check
// The Coach chat's toolbox (lift/COACH-CHAT.md, "Tools"): every tool Claude can call, in one list, with what kind it
// is. Adding a tool is one entry here plus, for a read tool, one runner in tools.ts. Pure.
//
// Three kinds:
// - read:   Coach's server answers with text (the database, Lift). They run in parallel, MAX_READS per answer.
// - server: Anthropic runs them (web search, web fetch); their results come back inside Claude's own message.
// - card:   they show Paolo something under the reply (the change card, a data card, questions, quick replies);
//           chat.mjs handles each one by name.

/**
 * What the phone shows while a tool runs (lift/APP-API.md, "Coach answer stream"). An app that doesn't know a step
 * ignores it and keeps the last one.
 * @typedef {'reading' | 'searching' | 'thinking' | 'writing' | 'proposing' | 'card' | 'fixing'} Step
 * @typedef {'read' | 'server' | 'card'} ToolKind
 * @typedef {{ name: string, kind: ToolKind, step: Step | null, definition: Record<string, unknown> }} ChatTool
 */

/** @param {ToolKind} kind @param {Record<string, unknown> & { name: string }} definition @param {Step | null} step @returns {ChatTool} */
const tool = (kind, definition, step) => {
  if (!definition || typeof definition.name !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(definition.name)) {
    throw new Error(`a chat tool needs a snake_case name: ${JSON.stringify(definition?.name)}`);
  }
  if (kind !== 'server' && (typeof definition.description !== 'string' || !definition.input_schema)) {
    throw new Error(`chat tool ${definition.name} needs a description and an input_schema`);
  }
  return { name: definition.name, kind, step, definition };
};

/** A tool Coach's server answers (tools.ts runs it). @param {any} definition @param {Step} [step] */
export const readTool = (definition, step = 'reading') => tool('read', definition, step);
/** A tool Anthropic runs (`type` names its version). @param {any} definition @param {Step} [step] */
export const serverTool = (definition, step = 'searching') => {
  if (typeof definition?.type !== 'string') throw new Error(`server tool ${definition?.name} needs its type`);
  return tool('server', definition, step);
};
/** A tool that shows Paolo a card; chat.mjs handles it. @param {any} definition @param {Step | null} [step] */
export const cardTool = (definition, step = null) => tool('card', definition, step);

/**
 * The tools of one chat, in the order they go to Claude (the order is part of the cached prefix: keep it stable).
 * @param {ChatTool[]} tools
 */
export function toolbox(tools) {
  /** @type {Map<string, ChatTool>} */
  const byName = new Map();
  for (const t of tools) {
    if (byName.has(t.name)) throw new Error(`two chat tools are called ${t.name}`);
    byName.set(t.name, t);
  }
  return {
    tools,
    /** The `tools` of a request. */
    definitions: () => tools.map((t) => t.definition),
    /** @param {string} name */
    get: (name) => byName.get(name) ?? null,
    /** @param {string} name */
    isRead: (name) => byName.get(name)?.kind === 'read',
    /** The step to show while `name` runs, or null. @param {string} name */
    stepOf: (name) => byName.get(name)?.step ?? null,
    /** The names of one kind. @param {ToolKind} kind */
    names: (kind) => tools.filter((t) => t.kind === kind).map((t) => t.name),
  };
}

/** @typedef {ReturnType<typeof toolbox>} Toolbox */
