---
description: Import every Function Health lab result (all draws) into the Coach database, from the Function connector or a Function PDF.
---

# /labs — Import lab results

The Coach database is the source of truth for lab results (`lab_results`; the /health page and profile.md read it).
This command moves results from Function Health into it. It keeps no local copy: the temporary file is deleted at the end.

## Step 1 — Find the source

1. Look for the Function Health connector tools. In Claude Code they are named `mcp__claude_ai_Function__*` (a claude.ai
   connector) or `mcp__function__*` (added with `claude mcp add`).
2. If there are no such tools, tell Paolo how to connect it, then go to Step 3 (PDF) unless he connects it now:
   - claude.ai → Settings → Connectors → Function, or my.functionhealth.com/account/connected-apps. Claude Code
     logged in with the same claude.ai account loads it on the next start (`/mcp` shows it).
   - Or: `claude mcp add --transport http function https://services.functionhealth.com/ai-chat/mcp`, then `/mcp` to
     sign in (OAuth). This is not tested; Function may accept only Claude's own clients.

## Step 2 — Pull from the connector

1. Call every tool that returns results. As of v1.0 the tools are `overall-summary` (use `includeTrends: true`),
   `category-summary` (all categories) and `get-action-plans`. Newer versions may add result or history tools; use
   them, and ask for every draw, not only the latest.
2. Collect, for each biomarker and each draw: name, category, collection date, value as written, unit, reference
   range, optimal range, status, and the source's id.
3. If the tools return only counts (no value per biomarker and draw), say so and go to Step 3. Never invent a value,
   a date or a range from a count or a summary.

## Step 3 — Fallback: a Function PDF

1. Ask Paolo for the PDF path(s): my.functionhealth.com → results → download the lab report, one per draw.
2. Read each PDF with the Read tool (use `pages` for long files). Take every biomarker row: name, value as written
   ("<5", "Negative" stay text), unit, reference range, flag (H/L or "out of range"), and the collection date on the
   report. Function's optimal range is in the app, not always in the lab PDF: leave `optimalRange` out when it is not there.

## Step 4 — Write the import file

Write the JSON to a private temporary file. The format is at the top of `src/lib/vitals/labs.mjs`:

```json
{ "source": "function",
  "results": [{ "biomarker": "LDL Cholesterol", "category": "Heart", "collectedOn": "2026-03-04", "value": "104",
                "unit": "mg/dL", "referenceRange": "0-99", "optimalRange": "<70", "status": "out of range", "sourceId": "…" }] }
```

```bash
mktemp -t coach-labs    # prints a new private (0600) file path; use that literal path below as <file>
```

Write the JSON to `<file>` with the Write tool. Shell variables do not survive between Bash calls, so always type the
path. Rules: one entry per biomarker per draw;
`collectedOn` is the draw date, not the report or import date; copy names as written (the importer folds aliases).

## Step 5 — Import, then delete the file

```bash
node --env-file=.env.local scripts/labs-import.mjs --file <file> --dry-run
node --env-file=.env.local scripts/labs-import.mjs --file <file>
rm -f <file>
```

1. Run the dry run. If rows are rejected, fix the file and run it again.
2. Run the import. A re-import of the same draw replaces its rows, so the command is safe to run again.
3. Delete the temporary file, also when a step failed.

## Step 6 — Report

1. Show the counts from the importer: draws, results, status counts.
2. List the out-of-range biomarkers at their latest draw (`node --env-file=.env.local scripts/health-profile.mjs`
   prints them), and point to /health.
3. Do not give medical advice. Name the out-of-range markers and suggest Paolo reviews them with his clinician
   (Function's clinician notes, if the connector returned them).
