'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** A page that failed keeps the navigation and the banner (the layout), and offers a retry. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div data-page-error className="space-y-3 rounded-lg border p-6">
      <h1 className="text-lg font-semibold">This page did not load</h1>
      <p className="text-sm text-muted-foreground">
        The other pages still work. The server log has the error{error.digest ? ` (digest ${error.digest})` : ''}.
      </p>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </div>
  );
}
