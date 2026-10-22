import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import SectionError from '@/components/SectionError';
import CopyReport from '@/components/dexa/CopyReport';
import FileGallery from '@/components/dexa/FileGallery';
import FocusList from '@/components/dexa/FocusList';
import HealthRanges from '@/components/dexa/HealthRanges';
import ImageStrip from '@/components/dexa/ImageStrip';
import MassTrend from '@/components/dexa/MassTrend';
import ProgressHero from '@/components/dexa/ProgressHero';
import UploadFiles from '@/components/dexa/UploadFiles';
import type { Point } from '@/components/dexa/BandChart';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { historyReport } from '@/lib/vitals/dexa.mjs';
import { healthRanges, rangeValue } from '@/lib/vitals/dexa-health.mjs';
import { loadDexaPage, type DexaPage } from '@/lib/vitals/dexa-store';
import { deleteDexaFile } from './actions';

export const metadata: Metadata = { title: 'Body composition' };
export const dynamic = 'force-dynamic';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const card = 'rounded-2xl bg-[var(--viz-surface)] p-5 shadow-sm ring-1 ring-[var(--viz-grid)]';

function Crumbs() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link href="/health" className="hover:text-foreground hover:underline">Health</Link>
      <span className="px-2">|</span>
      <span className="text-foreground">Body composition</span>
    </nav>
  );
}

/** /health/dexa: progress across every BodySpec DEXA scan, judged against healthy ranges for the athlete's age. */
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

/** The next scan on a 3-month cadence: its month, or that it is overdue. */
function NextScan({ latest }: { latest: string }) {
  const due = new Date(`${latest}T12:00:00Z`);
  due.setUTCMonth(due.getUTCMonth() + 3);
  const days = Math.round((due.getTime() - Date.now()) / 864e5);
  if (days >= 0) return <>next scan {monthYear(due.toISOString().slice(0, 10))}</>;
  return <span className="font-medium text-[var(--viz-warn-ink)]">next scan overdue</span>;
}

/** A measure's dated values, without the scans that lack it. */
function series(page: DexaPage, key: string): Point[] {
  const m = page.trends.measures.find((x) => x.key === key);
  return (m?.series ?? []).filter((p): p is Point => p.value !== null);
}

function Overview({ page }: { page: DexaPage }) {
  const { trends, files } = page;
  const { scans, first } = trends;
  const latest = trends.latest!;
  const who = { gender: latest.percentiles.gender, age: latest.ageYears };
  const ranges = healthRanges(who);
  const focus = ['androidFatPct', 'vatKg', 'armsLeanKg', 'legsLeanKg']
    .map((k) => trends.measures.find((m) => m.key === k))
    .filter((m): m is NonNullable<typeof m> => !!m && m.series.filter((p) => p.value !== null).length > 0);
  const fat = series(page, 'fatKg');
  const lean = series(page, 'leanKg');
  const images = files.filter((f) => f.kind === 'image' && f.view);
  const peer = latest.percentiles.metrics.find((m) => m.key === 'total_body_fat_pct');
  const otherFiles = files.filter((f) => !(f.kind === 'image' && f.view));
  const dateOf = new Map(scans.map((s) => [s.resultId, s.scanDate]));

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-smoke="health-dexa">
      <div className="space-y-3">
        <Crumbs />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">Body composition</h1>
            <p className="text-sm text-muted-foreground">
              {scans.length} DEXA {scans.length === 1 ? 'scan' : 'scans'}
              {first ? ` · ${monthYear(first.scanDate)} – ${monthYear(latest.scanDate)}` : ''} · <NextScan latest={latest.scanDate} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyReport text={historyReport(scans)} label="Copy for AI" />
            <UploadFiles label="Upload reports or images" />
          </div>
        </div>
      </div>

      <ProgressHero points={series(page, 'fatPct')} range={ranges[0]} />

      <div className="grid gap-6 lg:grid-cols-2">
        {fat.length > 1 && (
          <section aria-labelledby="dexa-mass" className={`${card} space-y-3`}>
            <h2 id="dexa-mass" className="font-semibold">Fat and lean mass</h2>
            <div className="sm:hidden">
              <MassTrend fat={fat} lean={lean} width={340} />
            </div>
            <div className="hidden sm:block">
              <MassTrend fat={fat} lean={lean} />
            </div>
          </section>
        )}
        {focus.length > 0 && (
          <section aria-labelledby="dexa-focus" className={card}>
            <h2 id="dexa-focus" className="font-semibold">Focus areas</h2>
            <FocusList measures={focus} firstDate={first?.scanDate ?? null} />
          </section>
        )}
      </div>

      <section aria-labelledby="dexa-health" className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dexa-health" className="font-semibold">Healthy for your age and height</h2>
          {peer && latest.percentiles.minAge !== null && (
            <span className="text-xs text-[var(--viz-muted)]">
              Body fat ranks {peer.percentile}th of {latest.percentiles.gender === 'female' ? 'women' : 'men'} {latest.percentiles.minAge}–{latest.percentiles.maxAge} on BodySpec
            </span>
          )}
        </div>
        <HealthRanges rows={ranges.map((range) => ({ range, now: rangeValue(latest, range.key), then: first ? rangeValue(first, range.key) : null }))} thenDate={first?.scanDate ?? null} />
      </section>

      <section aria-labelledby="dexa-images" className="space-y-3">
        <h2 id="dexa-images" className="text-lg font-semibold tracking-tight">Scans side by side</h2>
        {images.length ? (
          <ImageStrip scans={scans.map((s) => ({ resultId: s.resultId, scanDate: s.scanDate, fatPct: s.totals.fatPct }))} images={images.map((f) => ({ id: f.id, resultId: f.resultId, view: f.view }))} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--viz-axis)] p-5">
            <p className="max-w-xl text-sm text-[var(--viz-ink-2)]">
              No scan images yet. Upload your BodySpec PDF reports: Coach takes the body scan out of each one and files it under its scan.
            </p>
            <UploadFiles label="Upload reports" />
          </div>
        )}
      </section>

      <section aria-labelledby="dexa-scans" className={`${card} py-1`}>
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <h2 id="dexa-scans" className="font-semibold">All scans and files</h2>
            <span className="flex items-center gap-1 text-sm text-[var(--viz-muted)]">
              {scans.length} scans{otherFiles.length ? ` · ${otherFiles.length} files` : ''}
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
            </span>
          </summary>
          <ul className="divide-y divide-[var(--viz-grid)] border-t border-[var(--viz-grid)]">
            {[...scans].reverse().map((s) => (
              <li key={s.resultId}>
                <Link href={`/health/dexa/${s.scanDate}`} className="flex min-h-12 items-center gap-3 text-sm hover:text-foreground">
                  <span className="flex-1 font-medium text-[var(--viz-ink)]">{fmtDate(s.scanDate)}</span>
                  <span className="hidden text-[var(--viz-muted)] sm:inline">{s.location?.replace(/^BodySpec\s*-\s*/, '')}</span>
                  <span className="w-16 text-right tabular-nums text-[var(--viz-ink)]">{s.totals.fatPct === null ? '–' : `${s.totals.fatPct.toFixed(1)}%`}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--viz-muted)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {otherFiles.length > 0 && (
            <div className="border-t border-[var(--viz-grid)] py-4">
              <FileGallery files={otherFiles} onDelete={deleteDexaFile} scanLabel={(id) => (id && dateOf.get(id) ? fmtDate(dateOf.get(id)!) : null)} />
            </div>
          )}
        </details>
      </section>
    </div>
  );
}
