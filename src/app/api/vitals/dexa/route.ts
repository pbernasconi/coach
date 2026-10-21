/**
 * GET /api/vitals/dexa: every DEXA scan in full, for AI questions (COACH-API.md, "BodySpec (DEXA)"). Bearer
 * CRON_SECRET. JSON by default: each scan with every region, bone site, percentile, RMR formula, the derived
 * measures and its Markdown report, plus the uploaded files (with a PDF's text). `?format=md` answers one Markdown
 * document of the whole history instead.
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { historyReport, scanReport } from '@/lib/vitals/dexa.mjs';
import { loadFileTexts, loadFiles, loadScans } from '@/lib/vitals/dexa-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no owner' }, { status: 500, headers });
  const origin = new URL(request.url).origin;
  const [scans, files, texts] = await Promise.all([loadScans(userId), loadFiles(userId), loadFileTexts(userId)]);
  const dateOf = new Map(scans.map((s) => [s.resultId, s.scanDate]));
  const fileList = files.map((f) => ({
    ...f,
    scanDate: f.resultId ? dateOf.get(f.resultId) ?? null : null,
    url: `${origin}/api/vitals/dexa/files/${f.id}`,
    text: texts.get(f.id) ?? null,
  }));
  if (new URL(request.url).searchParams.get('format') === 'md') {
    return new Response(historyReport(scans, fileList), { headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' } });
  }
  return Response.json(
    {
      scans: scans.map((s, i) => ({ ...s, reportMd: scanReport(s, i > 0 ? scans[i - 1] : null) })),
      files: fileList,
    },
    { headers }
  );
}
