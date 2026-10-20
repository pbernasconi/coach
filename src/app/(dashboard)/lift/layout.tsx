import Link from 'next/link';

const liftLinks = [
  { href: '/', label: '← Today' },
  { href: '/lift', label: 'Overview' },
  { href: '/lift/weekly', label: 'Weekly volume' },
];

export default function LiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--sport-strength)' }}>Strength · Lean and strong</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lift</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {liftLinks.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex h-10 items-center text-foreground/60 transition-colors hover:text-foreground md:h-auto">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
