import { parseContent } from '@/lib/vitals/labs-view.mjs';

type Span = { text: string; bold: boolean; href?: string };
type Block = { type: string; level?: number; spans?: Span[]; items?: Span[][] };

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        const t = s.bold ? <strong className="font-semibold">{s.text}</strong> : s.text;
        return s.href ? (
          <a key={i} href={s.href} target="_blank" rel="noreferrer" className="text-[var(--viz-ctl)] underline underline-offset-2">{t}</a>
        ) : (
          <span key={i}>{t}</span>
        );
      })}
    </>
  );
}

/** Function's reading text as React text: headings, lists, paragraphs, bold and https links. Nothing runs as HTML. */
export default function ContentBlocks({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-[var(--viz-ink)]">
      {(parseContent(text) as Block[]).map((b, i) =>
        b.type === 'heading' ? (
          <h4 key={i} className="pt-1 font-semibold"><Spans spans={b.spans!} /></h4>
        ) : b.type === 'list' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{b.items!.map((it, k) => <li key={k}><Spans spans={it} /></li>)}</ul>
        ) : (
          <p key={i}><Spans spans={b.spans!} /></p>
        )
      )}
    </div>
  );
}
