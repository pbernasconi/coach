import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SectionError from '@/components/SectionError';
import BalanceBars from '@/components/dexa/BalanceBars';
import BodyMap from '@/components/dexa/BodyMap';
import BoneTable from '@/components/dexa/BoneTable';
import CopyReport from '@/components/dexa/CopyReport';
import FileGallery from '@/components/dexa/FileGallery';
import HeadlineTiles from '@/components/dexa/HeadlineTiles';
import PercentileBars from '@/components/dexa/PercentileBars';
import RegionTable from '@/components/dexa/RegionTable';
import ScanImages from '@/components/dexa/ScanImages';
import HealthRanges from '@/components/dexa/HealthRanges';
import UploadFiles from '@/components/dexa/UploadFiles';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { neighbours, scanReport, type FullScan } from '@/lib/vitals/dexa.mjs';
import { healthRanges, rangeValue } from '@/lib/vitals/dexa-health.mjs';
import { findScan, loadDexaPage, type DexaPage } from '@/lib/vitals/dexa-store';
import { deleteDexaFile } from '../actions';

export const metadata: Metadata = { title: 'DEXA scan' };
export const dynamic = 'force-dynamic';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const card = 'rounded-2xl bg-[var(--viz-surface)] p-5 shadow-sm ring-1 ring-[var(--viz-grid)]';
const f = (v: number | null, d: number, unit = '') => (v === null ? '–' : `${v.toFixed(d)}${unit ? ` ${unit}` : ''}`);

function Crumbs({ scan }: { scan?: FullScan }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-muted-foreground">
      <Link href="/health" className="hover:text-foreground hover:underline">Health</Link>
      <span className="px-2">|</span>
      <Link href="/health/dexa" className="hover:text-foreground hover:underline">Body composition</Link>
      {scan && (
        <>
          <span className="px-2">|</span>
          <span className="text-foreground">{short(scan.scanDate)}</span>
        </>
      )}
    </nav>
  );
}

/** /health/dexa/[scan]: one DEXA scan in full. `scan` is a date, `latest` or a BodySpec result id. */
export default async function DexaScanPage({ params }: { params: Promise<{ scan: string }> }) {
  const key = (await params).scan.slice(0, 80);
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-dexa-scan" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const page = await load('DEXA scan', () => loadDexaPage(userId));
  if (!page.ok) {
    return (
      <div data-smoke="health-dexa-scan" className="space-y-4">
        <Crumbs />
        <SectionError label="DEXA scan" />
      </div>
    );
  }
  const scan = findScan(page.value.trends.scans, key);
  if (!scan) {
    return (
      <div data-smoke="health-dexa-scan" className="space-y-2">
        <Crumbs />
        <p className="text-sm text-muted-foreground">{page.value.trends.scans.length ? 'No scan on this date.' : 'No DEXA scans yet.'}</p>
        <Link href="/health/dexa" className="text-sm underline underline-offset-4">All scans</Link>
      </div>
    );
  }
  return <Scan scan={scan} page={page.value} />;
}

function Scan({ scan, page }: { scan: FullScan; page: DexaPage }) {
  const { scans, first } = page.trends;
  const { index, previous, next } = neighbours(scans, scan.resultId);
  const files = page.files.filter((x) => x.resultId === scan.resultId);
  const otherFiles = files.filter((x) => !(x.kind === 'image' && x.view));
  const d = scan.derived;
  const facts = [
    scan.location?.replace(/^BodySpec\s*-\s*/, ''),
    scan.scanner,
    scan.ageYears !== null ? `age ${scan.ageYears.toFixed(1)}` : null,
    scan.heightCm !== null ? `${scan.heightCm.toFixed(0)} cm` : null,
  ].filter(Boolean);
  const indices = [
    { label: 'FFMI', value: f(d.ffmi, 1, 'kg/m²'), help: 'Fat-free mass / height²' },
    { label: 'ALMI', value: f(d.almi, 2, 'kg/m²'), help: 'Arm and leg lean mass / height²' },
    { label: 'FMI', value: f(d.fmi, 1, 'kg/m²'), help: 'Fat mass / height²' },
    { label: 'Visceral volume', value: f(scan.vat.volumeCm3, 0, 'cm³'), help: '' },
    { label: 'Belly : hip fat', value: f(scan.androidGynoidRatio, 2), help: 'Android / gynoid fat ratio' },
    { label: 'Trunk : limb fat', value: f(d.trunkToLimbFat, 2), help: '' },
    { label: 'Lean : fat', value: f(d.leanToFat, 2), help: '' },
    { label: 'Bone mass', value: f(scan.totals.boneKg, 2, 'kg'), help: '' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-smoke="health-dexa-scan">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Crumbs scan={scan} />
          <div className="flex shrink-0 items-center gap-1" aria-label="Other scans">
            {previous ? (
              <Link href={`/health/dexa/${previous.scanDate}`} aria-label={`Scan before: ${short(previous.scanDate)}`} className="rounded-full border p-1.5 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></Link>
            ) : (
              <span className="rounded-full border p-1.5 opacity-40" aria-hidden><ChevronLeft className="h-4 w-4" /></span>
            )}
            <span className="px-1 text-xs tabular-nums text-muted-foreground">{index + 1} / {scans.length}</span>
            {next ? (
              <Link href={`/health/dexa/${next.scanDate}`} aria-label={`Scan after: ${short(next.scanDate)}`} className="rounded-full border p-1.5 hover:bg-accent"><ChevronRight className="h-4 w-4" /></Link>
            ) : (
              <span className="rounded-full border p-1.5 opacity-40" aria-hidden><ChevronRight className="h-4 w-4" /></span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">{fmtDate(scan.scanDate)}</h1>
            <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyReport text={scanReport(scan, previous)} />
            <UploadFiles resultId={scan.resultId} label="Upload" />
          </div>
        </div>
      </div>

      <section aria-label="Scan images" className={card}>
        <ScanImages resultId={scan.resultId} files={files} />
      </section>

      <section className={`${card} grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]`}>
        <HeadlineTiles scan={scan} previous={previous} first={first !== scan ? first : null} />
        <div className="space-y-3">
          <h2 className="font-semibold">Healthy for your age and height</h2>
          <HealthRanges rows={healthRanges({ gender: scan.percentiles.gender, age: scan.ageYears }).map((range) => ({ range, now: rangeValue(scan, range.key), then: previous ? rangeValue(previous, range.key) : null }))} thenDate={previous?.scanDate ?? null} />
        </div>
      </section>

      <section className={`${card} grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}>
        <BodyMap scan={scan} title="Fat % by region" />
        <div className="space-y-2">
          <h2 className="font-semibold">Regions{previous ? ` · change since ${short(previous.scanDate)}` : ''}</h2>
          <RegionTable scan={scan} previous={previous} />
          <BalanceBars scan={scan} />
        </div>
      </section>
      <details className={`${card} group py-1`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          Details
          <span className="flex items-center gap-1 text-sm font-normal text-[var(--viz-muted)]">
            BodySpec percentiles, bone sites, indices, resting burn
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
          </span>
        </summary>
        <div className="space-y-4 pb-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl bg-[var(--viz-band)] p-4">
          <h2 className="font-semibold">Percentiles</h2>
          <PercentileBars p={scan.percentiles} />
        </section>
        <section className="space-y-3 rounded-xl bg-[var(--viz-band)] p-4">
          <h2 className="font-semibold">Bone density</h2>
          <BoneTable bone={scan.bone} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl bg-[var(--viz-band)] p-4">
          <h2 className="font-semibold">Indices</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {indices.map((i) => (
              <div key={i.label} className="flex items-baseline justify-between gap-2 border-b border-[var(--viz-grid)] pb-1.5" title={i.help || undefined}>
                <dt className="text-[var(--viz-ink-2)]">{i.label}</dt>
                <dd className="tabular-nums text-[var(--viz-ink)]">{i.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="space-y-3 rounded-xl bg-[var(--viz-band)] p-4">
          <h2 className="font-semibold">Resting metabolic rate</h2>
          {scan.rmr.estimates.length ? (
            <ul className="space-y-1.5 text-sm">
              {scan.rmr.estimates.map((e) => (
                <li key={e.formula} className="flex items-baseline justify-between gap-3 border-b border-[var(--viz-grid)] pb-1.5">
                  <span className="text-[var(--viz-ink-2)]">{e.formula}</span>
                  <span className="tabular-nums text-[var(--viz-ink)]">{e.kcal.toLocaleString('en-US')} kcal</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 pt-0.5 font-medium">
                <span>Mean</span>
                <span className="tabular-nums">{scan.rmr.meanKcal?.toLocaleString('en-US')} kcal/day</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[var(--viz-muted)]">No estimate for this scan.</p>
          )}
        </section>
      </div>

        </div>
      </details>

      {otherFiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Files</h2>
          <FileGallery files={otherFiles} onDelete={deleteDexaFile} />
        </section>
      )}

      <details className="rounded-lg border bg-[var(--viz-surface)]">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Report as text</summary>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border-t px-4 py-3 text-xs leading-relaxed text-[var(--viz-ink-2)]">{scanReport(scan, previous)}</pre>
      </details>
    </div>
  );
}
