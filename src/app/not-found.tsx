import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Not found' };

/** Any URL with no page: a short note and a way back to Today. */
export default function NotFound() {
  return (
    <main data-smoke="not-found" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold tracking-tight">No page here</h1>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to Today
      </Link>
    </main>
  );
}
