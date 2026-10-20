import Link from 'next/link';

const liftLinks = [
  { href: '/lift', label: 'Overview' },
  { href: '/lift/weekly', label: 'Weekly volume' },
];

export default function LiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lift</h1>
          <p className="text-muted-foreground">Strength sessions synced from the Lift app. Read-only.</p>
        </div>
        <nav className="flex items-center space-x-4 text-sm font-medium">
          {liftLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-10 items-center transition-colors hover:text-foreground/80 text-foreground/60 md:h-auto"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
