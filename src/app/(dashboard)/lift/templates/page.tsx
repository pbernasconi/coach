import type { Metadata } from 'next';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadTemplateLibrary } from '@/lib/lift/templates';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { load } from '@/lib/safe';
import TemplateLibrary from './TemplateLibrary';

export const metadata: Metadata = { title: 'Lift templates' };

export const dynamic = 'force-dynamic';

/**
 * The Lift templates: every exercise of each with its sets, reps, load and rest, and the lifts planned on it. Edit
 * changes a template in place; the iPhone pulls it and the lifts on it that have not started are planned again.
 */
export default async function LiftTemplatesPage() {
  const userId = await ownerForSignedInUser();
  const today = todayIn(await cookieTimeZone());
  const loaded = await load('Templates', () => loadTemplateLibrary(userId ?? '', today));
  if (!loaded.ok) {
    return (
      <div data-smoke="lift-templates">
        <SectionError label="Templates" />
      </div>
    );
  }
  const { templates, library } = loaded.value;
  if (templates.length === 0) {
    return (
      <div data-smoke="lift-templates" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No templates yet</p>
        Templates come from the Lift app on the iPhone (Lift → Templates → New template).
      </div>
    );
  }
  return (
    <div data-smoke="lift-templates">
      <TemplateLibrary templates={templates} library={library} today={today} />
    </div>
  );
}
