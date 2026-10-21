import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import SectionError from '@/components/SectionError';
import BalanceBars from '@/components/dexa/BalanceBars';
import BodyMap from '@/components/dexa/BodyMap';
import CompositionBars from '@/components/dexa/CompositionBars';
import CopyReport from '@/components/dexa/CopyReport';
import FileGallery from '@/components/dexa/FileGallery';
import PercentileBars from '@/components/dexa/PercentileBars';
import RegionTable from '@/components/dexa/RegionTable';
import ScanTrends from '@/components/dexa/ScanTrends';
import UploadFiles from '@/components/dexa/UploadFiles';
import HeadlineTiles from '@/components/dexa/HeadlineTiles';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { historyReport } from '@/lib/vitals/dexa.mjs';
import { loadDexaPage, type DexaPage } from '@/lib/vitals/dexa-store';
import { deleteDexaFile } from './actions';

export const metadata: Metadata = { title: 'Body composition' };
export const dynamic = 'force-dynamic';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const f = (v: number | null, d: number) => (v === null ? '–' : v.toFixed(d));

function Crumbs() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link href="/health" className="hover:text-foreground hover:underline">Health</Link>
      <span className="px-2">|</span>
      <span className="text-foreground">Body composition</span>
    </nav>
  );
}

/** /health/dexa: every BodySpec DEXA scan. The latest on a body map, trends, regions, percentiles, scans and files. */
export default async function DexaPageRoute() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-dexa" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const page = await load('Body composition', () => loadDexaPage(userId));
  if (!page.ok) {
    return (
      <div data-smoke="health-dexa" className="space-y-4">
        <Crumbs />
        <SectionError label="Body composition" />
      </div>
    );
  }
  if (!page.value.trends.latest) {
    return (
      <div data-smoke="health-dexa" className="space-y-4">
        <Crumbs />
        <h1 className="text-2xl font-semibold tracking-tight">Body composition</h1>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No DEXA scans yet.</p>
          <p className="mt-1">
            <Link href="/settings#connections" className="underline underline-offset-4">Connect BodySpec in Settings</Link>.
          </p>
        </div>
      </div>
    );
  }
  return <Overview page={page.value} />;
}

/** The next scan on a 3-month cadence: its month, or how long it is overdue. */
function NextScan({ latest }: { latest: string }) {
  const due = new Date(`${latest}T12:00:00Z`);
  due.setUTCMonth(due.getUTCMonth() + 3);
  const days = Math.round((due.getTime() - Date.now()) / 864e5);
  if (days >= 0) return <>next scan {monthYear(due.toISOString().slice(0, 10))}</>;
  const months = Math.round(-days / 30.4);
  return <span className="text-[var(--viz-ink)]">next scan overdue{months >= 1 ? ` by ${months} ${months === 1 ? 'month' : 'months'}` : ''}</span>;
}

function Overview({ page }: { page: DexaPage }) {
  const { trends, files } = page;
  const { scans, first, previous } = trends;
  const latest = trends.latest!;
  const dateOf = new Map(scans.map((s) => [s.resultId, s.scanDate]));
  const fileCount = new Map<string, number>();
  for (const file of files) if (file.resultId) fileCount.set(file.resultId, (fileCount.get(file.resultId) ?? 0) + 1);

  return (
    <div className="space-y-8" data-smoke="health-dexa">
      <div className="space-y-3">
        <Crumbs />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">Body composition</h1>
            <p className="text-sm text-muted-foreground">
              {scans.length} DEXA {scans.length === 1 ? 'scan' : 'scans'} · BodySpec{first ? ` · ${monthYear(first.scanDate)} – ${monthYear(latest.scanDate)}` : ''} · <NextScan latest={latest.scanDate} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyReport text={historyReport(scans)} label="Copy all for AI" />
            <UploadFiles />
          </div>
        </div>
      </div>

      <section className="grid gap-6 rounded-lg border bg-[var(--viz-surface)] p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" aria-labelledby="latest-scan">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="latest-scan" className="font-semibold text-[var(--viz-ink)]">
              <Link href={`/health/dexa/${latest.scanDate}`} className="hover:underline">Latest · {fmtDate(latest.scanDate)}</Link>
            </h2>
            <Link href={`/health/dexa/${latest.scanDate}`} className="inline-flex items-center text-sm text-[var(--viz-ink-2)] hover:text-foreground">
              Scan <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <BodyMap scan={latest} title="Fat % by region" />
            {first ? (
              <BodyMap scan={latest} mode={{ kind: 'change', previous: first, field: 'leanKg' }} title={`Lean change since ${monthYear(first.scanDate)}`} />
            ) : (
              <BodyMap scan={latest} title="Fat % by region" />
            )}
          </div>
        </div>
        <HeadlineTiles scan={latest} previous={previous} first={first} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Trends</h2>
        <ScanTrends measures={trends.measures.filter((m) => m.key !== 'rmr')} firstDate={first?.scanDate ?? null} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border bg-[var(--viz-surface)] p-4">
          <h2 className="font-semibold">Fat, lean and bone</h2>
          <CompositionBars scans={scans} />
        </section>
        <section className="space-y-3 rounded-lg border bg-[var(--viz-surface)] p-4">
          <h2 className="font-semibold">Percentiles · {fmtDate(latest.scanDate)}</h2>
          <PercentileBars p={latest.percentiles} />
        </section>
      </div>

      <section className="grid gap-6 rounded-lg border bg-[var(--viz-surface)] p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <h2 className="font-semibold">Regions{previous ? ` · change since ${fmtDate(previous.scanDate)}` : ''}</h2>
          <RegionTable scan={latest} previous={previous} />
        </div>
        <BalanceBars scan={latest} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Scans</h2>
        <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-[var(--viz-muted)]">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Place</th>
                <th className="px-3 py-2 text-right font-medium">Body fat %</th>
                <th className="px-3 py-2 text-right font-medium">Visceral kg</th>
                <th className="px-3 py-2 text-right font-medium">Lean kg</th>
                <th className="px-3 py-2 text-right font-medium">Arms lean kg</th>
                <th className="px-3 py-2 text-right font-medium">Weight kg</th>
                <th className="px-3 py-2 text-right font-medium">Files</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {[...scans].reverse().map((s) => (
                <tr key={s.resultId} className="group relative border-b last:border-0 hover:bg-[var(--viz-band)]">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--viz-ink)]">
                    <Link href={`/health/dexa/${s.scanDate}`} className="after:absolute after:inset-0">{fmtDate(s.scanDate)}</Link>
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-[var(--viz-ink-2)]">{s.location?.replace(/^BodySpec\s*-\s*/, '') ?? '–'}</td>
                  <td className="px-3 py-2 text-right">{f(s.totals.fatPct, 1)}</td>
                  <td className="px-3 py-2 text-right">{f(s.vat.massKg, 2)}</td>
                  <td className="px-3 py-2 text-right">{f(s.totals.leanKg, 1)}</td>
                  <td className="px-3 py-2 text-right">{f(s.derived.armsLeanKg, 2)}</td>
                  <td className="px-3 py-2 text-right">{f(s.totals.totalKg, 1)}</td>
                  <td className="px-3 py-2 text-right text-[var(--viz-muted)]">{fileCount.get(s.resultId) ?? ''}</td>
                  <td className="pr-3 text-[var(--viz-muted)] group-hover:text-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Reports and images</h2>
          <UploadFiles label="Upload" />
        </div>
        {files.length ? (
          <FileGallery files={files} onDelete={deleteDexaFile} scanLabel={(id) => (id && dateOf.get(id) ? fmtDate(dateOf.get(id)!) : null)} />
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No files yet. BodySpec&rsquo;s report builder exports each scan as a PDF; upload it here and its text is kept for AI questions.
          </div>
        )}
      </section>
    </div>
  );
}
