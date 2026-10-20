import { InlineNotice } from "@kobo/web";

/** Shown in place of a page section whose data did not load. The server log has the error. */
export default function SectionError({ label }: { label: string }) {
  return (
    <InlineNotice data-section-error={label} tone="warning" title={`${label} did not load.`}>
      The other sections are not affected. Reload to try again.
    </InlineNotice>
  );
}
