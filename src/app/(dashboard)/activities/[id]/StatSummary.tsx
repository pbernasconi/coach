import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { ActivityView } from '@/lib/activity/queries';
import { heroStats, statGroups, tssNote, zoneShares } from '@/lib/activity/summary.mjs';
import { achievementsText, gearView, weatherView } from '@/lib/activity/view.mjs';

type Tone = 'good' | 'ok' | 'warn' | 'bad';
type Scale = { min: number; max: number; cuts: number[]; value: number; lowerIsBetter?: boolean };
type Row = { key: string; label: string; valueText: string; unit?: string; sub?: string; word?: string; tone?: Tone; scale?: Scale };

const TICK: Record<Tone, string> = { good: 'var(--viz-good)', ok: 'var(--viz-ink)', warn: 'var(--viz-warn)', bad: 'var(--viz-down)' };
const WORD: Record<Tone, string> = { good: 'var(--viz-up)', ok: 'var(--viz-ink-2)', warn: 'var(--viz-warn-ink)', bad: 'var(--viz-down)' };

/** A track split into bands with the value as a tick. Better is always to the right (lower-is-better scales flip). */
function BandTrack({ s, tone }: { s: Scale; tone: Tone }) {
  const at = (x: number) => {
    const f = Math.max(0, Math.min(1, (x - s.min) / (s.max - s.min)));
    return (s.lowerIsBetter ? 1 - f : f) * 100;
  };
  const edges = [s.min, ...s.cuts, s.max].map(at).sort((a, b) => a - b);
  const v = at(s.value);
  return (
    <div className="relative h-1.5 flex-1" aria-hidden>
      {edges.slice(0, -1).map((from, i) => {
        const to = edges[i + 1];
        const here = v >= from && v <= to;
        return (
          <div
            key={i}
            className="absolute inset-y-0 rounded-[2px]"
            style={{ left: `calc(${from}% + ${i ? 1 : 0}px)`, width: `calc(${to - from}% - ${i ? 1 : 0}px - ${i < edges.length - 2 ? 1 : 0}px)`, background: here ? 'var(--viz-axis)' : 'var(--viz-grid)' }}
          />
        );
      })}
      <div className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${v}%`, background: TICK[tone] }} />
    </div>
  );
}

function StatRow({ r }: { r: Row }) {
  const tone = r.tone ?? 'ok';
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-[var(--viz-ink-2)]">{r.label}</span>
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--viz-ink)]">
          {r.valueText}
          {r.unit && <span className="ml-0.5 text-xs font-normal text-[var(--viz-ink-2)]">{r.unit}</span>}
        </span>
      </div>
      {(r.scale || r.word) && (
        <div className="mt-1 flex items-center gap-3">
          {r.scale ? <BandTrack s={r.scale} tone={tone} /> : <div className="flex-1" />}
          {r.word && <span className="w-28 shrink-0 text-right text-xs" style={{ color: WORD[tone] }}>{r.word}</span>}
        </div>
      )}
    </div>
  );
}

function GroupCard({ title, tag, children, footer }: { title: string; tag?: string; children: React.ReactNode; footer?: string[] }) {
  return (
    <section className="flex flex-col rounded-lg border p-4" aria-label={title}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--viz-muted)]">{title}</h3>
        {tag && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{tag}</span>}
      </div>
      <div className="flex-1 divide-y divide-[var(--viz-grid)]">{children}</div>
      {footer && footer.length > 0 && <p className="mt-2 border-t pt-2 text-xs tabular-nums text-[var(--viz-muted)]">{footer.join(' · ')}</p>}
    </section>
  );
}

/** Time in heart-rate zones as one stacked bar, with the share of each zone that has time under it. */
function ZoneStrip({ zones }: { zones: NonNullable<ReturnType<typeof zoneShares>> }) {
  const shown = zones.filter((z) => z.share >= 0.01);
  return (
    <div className="py-1.5">
      <a href="#heart-rate" className="text-sm text-[var(--viz-ink-2)] hover:underline">Time in zones</a>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--viz-grid)]" aria-hidden>
        {shown.map((z) => <div key={z.zone} style={{ width: `${z.share * 100}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-[var(--viz-ink-2)]">
        {shown.map((z) => (
          <span key={z.zone} title={z.name}>
            <b className="font-medium text-[var(--viz-ink)]">Z{z.zone}</b> {Math.round(z.share * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The top of the activity page: the headline numbers, then the rest in groups (effort, heart, running form or power,
 * conditions), each value with a word that places it.
 */
export default function StatSummary({ v }: { v: ActivityView }) {
  const hero = heroStats(v) as Row[];
  const groups = statGroups(v);
  const zones = zoneShares(v.hrZones);
  const note = tssNote(v);
  const achievements = achievementsText(v.stats);
  const w = v.weather ? weatherView(v.weather) : null;
  const gear = gearView(v);
  const heart = groups.find((g) => g.id === 'heart');
  const cards = groups.filter((g) => g.id !== 'heart');
  const showHeart = Boolean(heart || zones);
  const showConditions = Boolean(w || gear || v.device);
  const count = cards.length + (showHeart ? 1 : 0) + (showConditions ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
        <div className={`grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 ${hero.length > 4 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
          {hero.map((s) => (
            <div key={s.key} className="min-w-0">
              <div className="flex items-center gap-1 text-xs text-[var(--viz-muted)]">
                {s.label}
                {s.key === 'tss' && note && <HelpTooltip label="About Coach TSS" icon={<Info aria-hidden />}>{note}</HelpTooltip>}
              </div>
              <div className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)] sm:text-3xl">
                {s.valueText}
                {s.unit && <span className="ml-0.5 text-base font-normal text-[var(--viz-ink-2)]">{s.unit}</span>}
              </div>
              {s.sub && <div className="text-xs tabular-nums text-[var(--viz-ink-2)]">{s.sub}</div>}
            </div>
          ))}
        </div>
        {achievements && <p className="mt-3 text-xs text-[var(--viz-muted)]">{achievements}</p>}
      </div>

      {count > 0 && (
        <div className={`grid gap-4 md:grid-cols-2 ${count >= 4 ? '2xl:grid-cols-4' : count === 3 ? 'xl:grid-cols-3' : ''}`}>
          {cards.filter((g) => g.id === 'effort').map((g) => (
            <GroupCard key={g.id} title={g.title} tag={g.tag} footer={g.footer}>{g.rows.map((r) => <StatRow key={r.key} r={r as Row} />)}</GroupCard>
          ))}
          {showHeart && (
            <GroupCard title={heart?.title ?? 'Heart & lungs'}>
              {zones && <ZoneStrip zones={zones} />}
              {heart?.rows.map((r) => <StatRow key={r.key} r={r as Row} />)}
            </GroupCard>
          )}
          {cards.filter((g) => g.id !== 'effort').map((g) => (
            <GroupCard key={g.id} title={g.title} footer={g.footer}>{g.rows.map((r) => <StatRow key={r.key} r={r as Row} />)}</GroupCard>
          ))}
          {showConditions && (
            <GroupCard title="Conditions">
              {w && (
                <div className="py-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-[var(--viz-ink-2)]">Weather</span>
                    <span className="font-semibold">{w.headline}</span>
                  </div>
                  {w.rows.length > 0 && <div className="mt-0.5 text-right text-xs tabular-nums text-[var(--viz-ink-2)]">{w.rows.map((r) => `${r.label.toLowerCase()} ${r.valueText}`).join(' · ')}</div>}
                </div>
              )}
              {gear && (
                <div className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-sm text-[var(--viz-ink-2)]">{gear.label}</span>
                  <span className="min-w-0 truncate text-right font-medium">{gear.name}{gear.distanceText && <span className="font-normal text-[var(--viz-ink-2)]"> {gear.distanceText}</span>}</span>
                </div>
              )}
              {v.device && (
                <div className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-sm text-[var(--viz-ink-2)]">Device</span>
                  <span className="min-w-0 truncate text-right font-medium">{v.device}</span>
                </div>
              )}
            </GroupCard>
          )}
        </div>
      )}
    </div>
  );
}
