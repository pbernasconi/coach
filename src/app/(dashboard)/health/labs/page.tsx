import Link from 'next/link';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { loadLabsIndex } from '@/lib/vitals/labs-pages';
import LabsBrowser from './LabsBrowser';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** All lab results, like Function Health's "Data" page. */
export default async function LabsPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-labs" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const index = await load('Lab results', () => loadLabsIndex(userId));
  return (
    <div className="space-y-6" data-smoke="health-labs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link href="/health" className="text-sm text-muted-foreground underline-offset-4 hover:underline print:hidden">← Health</Link>
          <h1 className="text-3xl font-bold tracking-tight">Lab results</h1>
          <p className="text-muted-foreground">
            Blood and urine tests from Function Health
            {index.ok && index.value.latestDraw ? `: ${index.value.drawCount} draws, the latest on ${longDate(index.value.latestDraw)}.` : '.'}
          </p>
        </div>
        <PrintButton />
      </div>
      {!index.ok ? (
        <SectionError label="Lab results" />
      ) : index.value.counts.all === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No lab results yet.</p>
          <p className="mt-1">
            The Function sync (scripts/function-sync.mjs, run by hand after new results) copies every result, its range and Function&apos;s explanations into Coach.
            Results appear here after its next run.
          </p>
        </div>
      ) : (
        <LabsBrowser index={index.value} />
      )}
    </div>
  );
}
