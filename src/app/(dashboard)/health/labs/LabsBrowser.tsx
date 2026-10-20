'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity, Baby, Bone, Brain, ChevronDown, Droplet, Droplets, Dna, FlaskConical, Flame, Gauge, HeartPulse, Hourglass, Leaf, Search,
  Shield, ShieldCheck, Sparkles, TestTube, Wheat, Zap,
} from 'lucide-react';
import type { LabsIndex, LabItem, LabStatus } from '@/lib/vitals/labs-pages';

type Filter = 'all' | LabStatus;

const STATUS: Record<LabStatus, { label: string; color: string }> = {
  in_range: { label: 'In Range', color: 'var(--viz-good)' },
  out_of_range: { label: 'Out of Range', color: 'var(--viz-down)' },
  other: { label: 'Other', color: 'var(--viz-muted)' },
};

// One icon per Function category; anything new gets the generic one.
const ICONS: Record<string, typeof Activity> = {
  Autoimmunity: ShieldCheck,
  'Biological Age': Hourglass,
  Blood: Droplet,
  'Brain Health': Brain,
  Electrolytes: Zap,
  'Environmental Toxins': Leaf,
  'Heavy Metals': FlaskConical,
  Heart: HeartPulse,
  'Immune Regulation': Shield,
  Kidney: Droplets,
  Liver: TestTube,
  'Male Health': Dna,
  'Female Health': Baby,
  Metabolic: Flame,
  Nutrients: Wheat,
  Pancreas: Gauge,
  'Stress & Aging': Sparkles,
  Thyroid: Activity,
  Urine: FlaskConical,
  'Bone Health': Bone,
};

const anchor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** The last two draws as dots on a short line, each dot in its status colour (the row says the status in words). */
function MiniTrend({ item }: { item: LabItem }) {
  const pts = item.draws.slice(-2);
  const nums = pts.filter((p) => p.value !== null);
  const W = 56;
  const H = 24;
  if (!pts.length) return <span className="w-14" />;
  const vs = nums.map((p) => p.value as number);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const y = (v: number | null) => (v === null || hi === lo ? H / 2 : H - 5 - ((v - lo) / (hi - lo)) * (H - 10));
  const x = (i: number) => (pts.length === 1 ? W - 6 : 6 + (i / (pts.length - 1)) * (W - 12));
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      {pts.length === 2 && <line x1={x(0)} y1={y(pts[0].value)} x2={x(1)} y2={y(pts[1].value)} stroke="var(--viz-axis)" strokeWidth={1.5} />}
      {pts.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === pts.length - 1 ? 4 : 3} fill={i === pts.length - 1 ? STATUS[p.status].color : 'var(--viz-surface)'} stroke={STATUS[p.status].color} strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function Row({ item }: { item: LabItem }) {
  const st = STATUS[item.status];
  const value = item.latest?.text ?? '-';
  const showStatus = item.status !== 'other';
  return (
    <li>
      <Link
        href={`/health/labs/${item.slug}`}
        className="flex items-center gap-3 rounded-md py-2.5 pl-0 pr-2 outline-none transition-colors hover:bg-[var(--viz-band)] focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
      >
        <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: st.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--viz-ink)]">{item.name}</span>
          <span className="block truncate text-xs text-[var(--viz-ink-2)]">
            {showStatus ? <span style={{ color: st.color }}>{st.label}</span> : <span>Other</span>}
            <span className="text-[var(--viz-muted)]"> · </span>
            <span className="tabular-nums">{value}</span>
            {item.latest && <span className="text-[var(--viz-muted)]"> · {fmtDate(item.latest.date)}</span>}
          </span>
        </span>
        <MiniTrend item={item} />
      </Link>
    </li>
  );
}

/** Function's "Data" page: search, status chips with counts, and the categories with their biomarkers. */
export default function LabsBrowser({ index }: { index: LabsIndex }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      index.sections
        .map((s) => ({ ...s, items: s.items.filter((i) => (filter === 'all' || i.status === filter) && (!q || i.name.toLowerCase().includes(q))) }))
        .filter((s) => s.items.length),
    [index.sections, filter, q]
  );
  const chips: { key: Filter; label: string; n: number; color?: string }[] = [
    { key: 'all', label: 'All', n: index.counts.all },
    { key: 'out_of_range', label: 'Out of Range', n: index.counts.out_of_range, color: STATUS.out_of_range.color },
    { key: 'in_range', label: 'In Range', n: index.counts.in_range, color: STATUS.in_range.color },
    { key: 'other', label: 'Other', n: index.counts.other, color: STATUS.other.color },
  ];
  const shown = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center print:hidden">
        <label className="relative flex min-w-0 items-center sm:w-64">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--viz-muted)]" aria-hidden />
          <span className="sr-only">Search biomarkers</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-full border bg-[var(--viz-surface)] pl-9 pr-3 text-sm text-[var(--viz-ink)] outline-none placeholder:text-[var(--viz-muted)] focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
          />
        </label>
        <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0" role="group" aria-label="Filter by status">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                filter === c.key ? 'border-[var(--viz-ink)] bg-[var(--viz-ink)] text-[var(--viz-surface)]' : 'bg-[var(--viz-surface)] text-[var(--viz-ink)] hover:bg-[var(--viz-band)]'
              }`}
            >
              {c.color && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />}
              {c.label}
              <span className="tabular-nums opacity-70">· {c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {shown === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No biomarker matches {q ? `“${query.trim()}”` : 'this filter'}.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sections.map((s) => {
            const Icon = ICONS[s.name] ?? FlaskConical;
            const open = !closed.has(s.key) || !!q;
            const out = s.items.filter((i) => i.status === 'out_of_range').length;
            return (
              <section key={s.key} id={anchor(s.name)} className="min-w-0 scroll-mt-20 self-start rounded-lg border bg-[var(--viz-surface)] px-4 py-2 print:break-inside-avoid">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--viz-band)]">
                    <Icon className="h-4 w-4 text-[var(--viz-ink-2)]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[var(--viz-ink)]">{s.name}</span>
                    <span className="block text-xs text-[var(--viz-muted)]">
                      {s.items.length} {s.items.length === 1 ? 'biomarker' : 'biomarkers'}
                      {out > 0 && <span style={{ color: STATUS.out_of_range.color }}> · {out} out of range</span>}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--viz-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open && <ul className="divide-y border-t">{s.items.map((i) => <Row key={`${s.key}-${i.key}`} item={i} />)}</ul>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
