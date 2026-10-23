import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { loadBiomarker, type BiomarkerView, type LabStatus } from '@/lib/vitals/labs-pages';
import BiomarkerChart from '../BiomarkerChart';
import BiomarkerTabs from '../BiomarkerTabs';
import ContentBlocks from '../ContentBlocks';

export const metadata: Metadata = { title: 'Lab result' };

export const dynamic = 'force-dynamic';

const STATUS: Record<LabStatus, { label: string; color: string }> = {
  in_range: { label: 'In Range', color: 'var(--viz-good)' },
  out_of_range: { label: 'Out of Range', color: 'var(--viz-down)' },
  other: { label: 'Other', color: 'var(--viz-muted)' },
};
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const anchor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = (v: number) => String(+v.toPrecision(4));

/** One biomarker, like Function's biomarker page: status, history against the range bands, and Function's text. */
export default async function BiomarkerPage({ params }: { params: Promise<{ biomarker: string }> }) {
  const { biomarker } = await params;
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-lab" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const view = await load('Biomarker', () => loadBiomarker(userId, biomarker.slice(0, 160)));
  if (!view.ok) {
    return (
      <div data-smoke="health-lab" className="space-y-4">
        <Link href="/health/labs" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Lab results</Link>
        <SectionError label="Biomarker" />
      </div>
    );
  }
  if (!view.value) {
    return (
      <div data-smoke="health-lab" className="space-y-2">
        <p className="text-sm text-muted-foreground">No biomarker with this name in your results.</p>
        <Link href="/health/labs" className="text-sm underline underline-offset-4">All lab results</Link>
      </div>
    );
  }
  return <Biomarker b={view.value} />;
}

function Biomarker({ b }: { b: BiomarkerView }) {
  const st = STATUS[b.status];
  const today = new Date().toISOString().slice(0, 10);
  const nd = b.nextDraw;
  const nextDate = nd?.visitOn ?? (nd?.windowEnd && nd.windowEnd > today ? nd.windowEnd : null);
  const next = nextDate && nd
    ? { date: nextDate, label: nd.visitOn ? `Next ${monthYear(nd.visitOn)}` : `Next by ${monthYear(nextDate)}` }
    : null;
  const hasChart = b.draws.some((d) => d.value !== null);
  return (
    <div className="space-y-6" data-smoke="health-lab">
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-muted-foreground">
          <Link href="/health" className="hover:text-foreground hover:underline">Health</Link>
          <span className="px-2">|</span>
          <Link href="/health/labs" className="hover:text-foreground hover:underline">Lab results</Link>
          {b.category && (
            <>
              <span className="px-2">|</span>
              <Link href={`/health/labs#${anchor(b.category)}`} className="hover:text-foreground hover:underline">{b.category}</Link>
            </>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-1 print:hidden" aria-label="Other biomarkers">
          {b.prev ? (
            <Link href={`/health/labs/${b.prev.slug}`} aria-label={`Previous biomarker: ${b.prev.name}`} className="rounded-full border p-1.5 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></Link>
          ) : (
            <span className="rounded-full border p-1.5 opacity-40" aria-hidden><ChevronLeft className="h-4 w-4" /></span>
          )}
          <span className="px-1 text-xs tabular-nums text-muted-foreground">{b.position} / {b.total}</span>
          {b.next ? (
            <Link href={`/health/labs/${b.next.slug}`} aria-label={`Next biomarker: ${b.next.name}`} className="rounded-full border p-1.5 hover:bg-accent"><ChevronRight className="h-4 w-4" /></Link>
          ) : (
            <span className="rounded-full border p-1.5 opacity-40" aria-hidden><ChevronRight className="h-4 w-4" /></span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
        {b.description && <p className="max-w-3xl text-muted-foreground">{b.description}</p>}
      </div>

      <section className="space-y-5 rounded-lg border bg-[var(--viz-surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-2 text-lg font-semibold" style={{ color: st.color }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} aria-hidden />
            {st.label}
          </span>
          {b.latest && (
            <span className="text-lg tabular-nums text-[var(--viz-ink)]">
              {b.latest.text} <span className="text-sm text-[var(--viz-muted)]">· {longDate(b.latest.date)}</span>
            </span>
          )}
        </div>
        {hasChart ? (
          <BiomarkerChart bands={b.bands} draws={b.draws} next={next} />
        ) : (
          <p className="text-sm text-[var(--viz-ink-2)]">This result is text, so it has no chart. Every result is in the list below.</p>
        )}
        <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--viz-muted)]">Results</h2>
            <ul className="space-y-1">
              {[...b.draws].reverse().map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--viz-ink-2)]">{longDate(d.date)}</span>
                  <span className="tabular-nums text-[var(--viz-ink)]">
                    {d.text} <span className="text-xs" style={{ color: STATUS[d.status].color }}>· {STATUS[d.status].label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1 text-[var(--viz-ink-2)]">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--viz-muted)]">Ranges</h2>
            <p>Lab reference range: <span className="tabular-nums text-[var(--viz-ink)]">{b.rangeText || 'none'}</span></p>
            {b.optimalRange && (
              <p>
                Function&apos;s optimal range:{' '}
                <span className="tabular-nums text-[var(--viz-ink)]">
                  {b.optimalRange.low !== null && b.optimalRange.high !== null
                    ? `${fmt(b.optimalRange.low)}–${fmt(b.optimalRange.high)}`
                    : b.optimalRange.high !== null ? `< ${fmt(b.optimalRange.high)}` : `> ${fmt(b.optimalRange.low as number)}`}
                </span>
              </p>
            )}
            {nd && (
              <p>
                Next draw:{' '}
                <span className="text-[var(--viz-ink)]">
                  {nd.visitOn ? longDate(nd.visitOn) : nd.windowEnd ? `not booked; Function's window ends ${longDate(nd.windowEnd)}` : 'not booked'}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <BiomarkerTabs tabs={b.tabs} />

      {b.notes.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Clinician notes on {b.notes[0].category}</h2>
            <p className="text-sm text-muted-foreground">From Function Health&apos;s clinician, for the whole category.</p>
          </div>
          {b.notes.map((n, i) => (
            <details key={`${n.notedOn}-${i}`} open={i === 0} className="rounded-lg border bg-[var(--viz-surface)]">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
                {longDate(n.notedOn)} <span className="font-normal text-muted-foreground">· {n.category}</span>
              </summary>
              <div className="border-t px-4 py-4"><ContentBlocks text={n.body} /></div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
