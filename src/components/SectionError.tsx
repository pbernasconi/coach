/** Shown in place of a page section whose data did not load. The server log has the error. */
export default function SectionError({ label }: { label: string }) {
  return (
    <div data-section-error={label} className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {label} did not load. The other sections are not affected. Reload to try again.
    </div>
  );
}
