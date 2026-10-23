import LiftNav from './LiftNav';

export default function LiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strength · Lean and strong</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lift</h1>
        </div>
        <LiftNav />
      </div>
      {children}
    </div>
  );
}
