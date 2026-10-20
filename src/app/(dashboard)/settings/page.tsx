import { ownerForSignedInUser } from '@/lib/owner';
import { loadCoachingNotes, loadStatus, loadTargets, type Warning } from '@/lib/status';
import StravaService from '@/modules/strava/strava-service';
import QRCode from 'qrcode';
import { sql } from '@/db';
import { createEnrollmentCode } from '@/lib/lift-sync/enroll.mjs';
import { CoachingNotesForm, LocationForm, StravaSyncButton, TargetsForm } from './SettingsControls';
import GoalsForm from './GoalsForm';
import { loadGoals } from '@/lib/goals/goals.mjs';
import ConnectLift from './ConnectLift';

export const dynamic = 'force-dynamic';

function when(at: string | null) {
  if (!at) return 'never';
  return new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Dot({ level }: { level: 'ok' | Warning['level'] }) {
  const color = { ok: 'bg-emerald-500', info: 'bg-sky-500', warn: 'bg-amber-500', error: 'bg-rose-500' }[level];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function Section({ title, level, children }: { title: string; level: 'ok' | Warning['level']; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Dot level={level} /> {title}
      </h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const [status, targets, coachingNotes, goals] = await Promise.all([
    loadStatus(userId), loadTargets(userId), loadCoachingNotes(userId), loadGoals(sql, userId),
  ]);
  const levelOf = (source: Warning['source']) =>
    status.warnings.find((w) => w.source === source && w.level === 'error')?.level ??
    status.warnings.find((w) => w.source === source && w.level === 'warn')?.level ??
    status.warnings.find((w) => w.source === source)?.level ??
    'ok';
  // The Connect Lift card shows Lift's own state, so Lift's info note is left out here.
  const notes = (source: Warning['source']) =>
    status.warnings.filter((w) => w.source === source && !(source === 'lift' && w.level === 'info')).map((w) => (
      <p key={w.text} className="flex items-start gap-2 rounded bg-muted/50 p-2"><Dot level={w.level} /> {w.text}</p>
    ));
  // lift://sync carries a one-time code, never the token: Lift trades it for the token over HTTPS
  // (/api/lift/enroll). A new code each time the page renders, valid 15 minutes.
  const liftLink = process.env.LIFT_SYNC_TOKEN
    ? `lift://sync?code=${(await createEnrollmentCode(sql)).code}`
    : null;
  const liftQr = liftLink ? await QRCode.toString(liftLink, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : '';
  const connectUrl = status.strava.canConnect
    ? new StravaService({
        clientId: process.env.STRAVA_CLIENT_ID!,
        clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
        redirectUri: process.env.STRAVA_REDIRECT_URI!,
      }).getAuthorizationUrl()
    : null;

  return (
    <div className="space-y-6" data-smoke="settings">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Connections, sync status and weekly targets.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Strava" level={levelOf('strava')}>
          <Row label="Connection" value={status.strava.connected ? `Athlete ${status.strava.athleteId}` : 'Not connected'} />
          <Row label="Last sync" value={when(status.strava.lastSyncedAt)} />
          <Row label="Newest activity" value={status.strava.newestActivity ?? '-'} />
          <Row label="Auto sync" value={status.strava.canSync ? 'Webhook and daily at 13:00 UTC' : 'Off (Strava app secret not set)'} />
          {notes('strava')}
          <div className="flex flex-wrap gap-2 pt-1">
            {status.strava.canSync && <StravaSyncButton />}
            {connectUrl && (
              <a className="inline-flex h-10 items-center rounded-md border px-3 text-sm hover:bg-accent md:h-auto md:py-1.5" href={connectUrl}>
                {status.strava.connected ? 'Reconnect Strava' : 'Connect Strava'}
              </a>
            )}
          </div>
        </Section>

        <Section title="Lift (iPhone)" level={levelOf('lift')}>
          <Row label="Last change synced" value={when(status.lift.lastChangeAt)} />
          <Row label="Sessions on the server" value={status.lift.sessions} />
          {notes('lift')}
          {liftLink && <ConnectLift link={liftLink} qrSvg={liftQr} lastChangeAt={status.lift.lastChangeAt} sessions={status.lift.sessions} />}
        </Section>

        <Section title="Google Calendar" level={levelOf('calendar')}>
          {status.calendars.length === 0 && <p className="text-muted-foreground">No calendar connected.</p>}
          <Row label="Auto sync" value="Every 30 min (GitHub Actions)" />
          {status.calendars.map((c) => (
            <Row key={c.email} label={c.email} value={c.active ? `synced ${when(c.lastSyncedAt)}` : 'off'} />
          ))}
          {notes('calendar')}
        </Section>

        <Section title="Garmin Connect" level={levelOf('garmin')}>
          <Row label="Login" value={!status.garmin.connected ? 'Not set up' : status.garmin.status === 'auth_failed' ? 'Expired' : 'Stored (encrypted)'} />
          <Row label="Last success" value={when(status.garmin.lastSuccessAt)} />
          <Row label="Last run" value={when(status.garmin.lastAttemptAt)} />
          <Row label="Synced through" value={status.garmin.syncedThrough ?? '-'} />
          {status.garmin.backfill && (
            <Row label="Backfill" value={`from ${status.garmin.backfill.from}, through ${status.garmin.backfill.through ?? '(starting)'}`} />
          )}
          <Row label="Auto sync" value="Daily at 11:00 and 17:00 UTC (GitHub Actions)" />
          {notes('garmin')}
          {(!status.garmin.connected || status.garmin.status === 'auth_failed') && (
            <p className="text-muted-foreground">
              To log in again, run <code>scripts/garmin/.venv/bin/python scripts/garmin/login.py</code> on your Mac (see scripts/garmin/README.md).
            </p>
          )}
        </Section>

        <Section title="Weekly targets" level="ok">
          <p className="text-muted-foreground">The Today card, Performance and the start page measure the week against these.</p>
          <TargetsForm targets={targets} />
        </Section>
        <Section title="Weather location" level="ok">
          <p className="text-muted-foreground">The /plan week and month views show the forecast for this place.</p>
          <LocationForm />
        </Section>
      </div>

      <Section title="Goals" level="ok">
        <p className="text-muted-foreground">Milestones with a target and a deadline. Performance shows the progress from Strava and Garmin; /plan trains toward the next deadline.</p>
        <GoalsForm goals={goals} />
      </Section>

      <Section title="Coaching preferences" level="ok">
        <p className="text-muted-foreground">Weekly structure and rules in Markdown. /plan and /check-in read them; change them here, not in a chat.</p>
        <CoachingNotesForm notes={coachingNotes} />
      </Section>
    </div>
  );
}
