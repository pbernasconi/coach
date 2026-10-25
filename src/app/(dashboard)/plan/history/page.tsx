import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { EmptyState, StatusPill } from '@kobo/web';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadPlanHistory, type HistoryItem, type PlanHistory } from '@/lib/plan/history';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { load } from '@/lib/safe';
import VerdictControl from './VerdictControl';

export const metadata: Metadata = { title: 'Past plans' };
export const dynamic = 'force-dynamic';

const weekLabel = (d: string) =>
  `Week of ${new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
const card = 'rounded-2xl bg-[var(--viz-surface)] p-5 shadow-sm ring-1 ring-[var(--viz-grid)]';

function Crumbs() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link href="/plan" className="hover:text-foreground hover:underline">Plan</Link>
      <span className="px-2">|</span>
      <span className="text-foreground">Past plans</span>
    </nav>
  );
}

/**
 * /plan/history: the weeks Coach planned and the plans the cloud coach proposed, checked against the planning rules,
 * with a good/bad verdict on each. Phase 0 of the planner evals (src/lib/plan/history.ts).
 */
export default async function PlanHistoryPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="plan-history" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(await cookieTimeZone());
  const page = await load('Past plans', () => loadPlanHistory(userId, today));
  if (!page.ok) {
    return (
      <div data-smoke="plan-history" className="space-y-4">
        <Crumbs />
        <SectionError label="Past plans" />
      </div>
    );
  }
  const h = page.value;
  return (
    <div data-smoke="plan-history" className="mx-auto max-w-5xl space-y-6">
      <Crumbs />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Past plans</h1>
        <p className="text-sm text-muted-foreground">
          {h.weeks} weeks and {h.proposals} coach plans from the last 6 months, checked against your rules. {h.rated} rated.
        </p>
      </header>
      {h.items.length === 0 ? (
        <EmptyState title="No plans yet" description="Weeks you plan show here." />
      ) : (
        <>
          <Baseline h={h} />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rate them: good or bad, and one line why</h2>
            <ul className="space-y-3">
              {h.items.map((i) => <Item key={i.key} i={i} />)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Baseline({ h }: { h: PlanHistory }) {
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold">How often each rule broke</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Rule</th>
              <th className="px-3 py-1 text-right font-medium">Weeks in Coach ({h.weeks})</th>
              <th className="py-1 pl-3 text-right font-medium">Coach plans ({h.proposals})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {h.baseline.map((b) => (
              <tr key={b.id}>
                <td className="py-1.5 pr-3"><span className="mr-2 text-xs text-muted-foreground">{b.id}</span>{b.rule}</td>
                <td className="px-3 py-1.5 text-right">{pct(b.weeks.fail, h.weeks)}{b.weeks.warn ? <span className="text-muted-foreground"> · {b.weeks.warn} warn</span> : null}</td>
                <td className="py-1.5 pl-3 text-right">{pct(b.proposals.fail, h.proposals)}{b.proposals.warn ? <span className="text-muted-foreground"> · {b.proposals.warn} warn</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Weeks in Coach are checked as they are now, after your edits and without the request (hours, days off) behind
        them. Coach plans are checked as the coach wrote them.
      </p>
    </section>
  );
}

const STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'info' }> = {
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  proposed: { label: 'Waiting', tone: 'info' },
};

function Item({ i }: { i: HistoryItem }) {
  const fails = i.issues.filter((x) => x.level === 'fail');
  const warns = i.issues.filter((x) => x.level === 'warn');
  const status = i.status ? STATUS[i.status] : null;
  return (
    <li className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/plan?week=${i.weekStart}`} className="font-semibold hover:underline">{weekLabel(i.weekStart)}</Link>
        <StatusPill tone="neutral">{i.kind === 'week' ? 'In Coach' : 'Coach plan'}</StatusPill>
        {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
        <span className="text-xs text-muted-foreground">{i.sessions} sessions</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {fails.length ? `${fails.length} broken` : 'No rule broken'}{warns.length ? ` · ${warns.length} to look at` : ''}
        </span>
      </div>
      {i.title && <p className="mt-1 text-sm text-muted-foreground">{i.title}</p>}
      {i.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] leading-snug">
          {[...fails, ...warns].map((x, n) => (
            <li key={n} className="flex gap-2">
              {x.level === 'fail'
                ? <CircleAlert aria-label="Breaks a rule" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                : <TriangleAlert aria-label="Worth a look" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span><span className="mr-1 text-xs text-muted-foreground">{x.id}</span>{x.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <VerdictControl item={i.key} weekStart={i.weekStart} verdict={i.verdict} note={i.note} />
      </div>
    </li>
  );
}
