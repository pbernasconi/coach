'use client';

/** The last fallback: the root layout itself failed. It must render its own html and body. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Coach did not load</h1>
        <p style={{ fontSize: 14, color: '#555' }}>
          The server log has the error{error.digest ? ` (digest ${error.digest})` : ''}.
        </p>
        <button type="button" onClick={reset} style={{ marginTop: 12, padding: '6px 12px' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
