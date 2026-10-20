import type { ClinicianNoteGroup } from '@/lib/vitals/queries';
import { parseNote } from '@/lib/vitals/note-markdown.mjs';

type Span = { text: string; bold: boolean };
const Spans = ({ spans }: { spans: Span[] }) => (
  <>{spans.map((s, i) => (s.bold ? <strong key={i} className="font-semibold">{s.text}</strong> : <span key={i}>{s.text}</span>))}</>
);

/** A note's Markdown as React text (headings, lists, paragraphs, bold). */
function NoteBody({ body }: { body: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-[var(--viz-ink)]">
      {parseNote(body).map((b: { type: string; level?: number; spans?: Span[]; items?: Span[][] }, i: number) =>
        b.type === 'heading' ? (
          <h4 key={i} className="pt-1 text-sm font-semibold">{<Spans spans={b.spans!} />}</h4>
        ) : b.type === 'list' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{b.items!.map((it, k) => <li key={k}><Spans spans={it} /></li>)}</ul>
        ) : (
          <p key={i}><Spans spans={b.spans!} /></p>
        )
      )}
    </div>
  );
}

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Function's clinician notes, one block per test order; the newest is open. Plain text, line breaks kept. */
export default function ClinicianNotes({ groups }: { groups: ClinicianNoteGroup[] }) {
  if (!groups.length) return null;
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Clinician notes</h2>
        <p className="text-sm text-muted-foreground">From Function Health, for each blood draw.</p>
      </div>
      {groups.map((g, i) => (
        <details key={g.requisitionId} open={i === 0} className="rounded-lg border bg-[var(--viz-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            {longDate(g.notedOn)} <span className="font-normal text-muted-foreground">· {g.notes.length} notes</span>
          </summary>
          <div className="space-y-6 border-t px-4 py-4">
            {g.notes.map((n, k) => (
              <div key={k} className="space-y-1">
                {n.category && <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--viz-muted)]">{n.category}</h3>}
                <NoteBody body={n.body} />
              </div>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
