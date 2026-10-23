import { fmtDate } from '@/lib/vitals/health-view.mjs';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { sql } from '@/db';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { loadCoachingNotes, loadStatus, loadTargets, type Warning } from '@/lib/status';
import { loadEventsWithCountdown } from '@/lib/performance/events';
import { todayIn } from '@/lib/plan/week.mjs';
import { loadGoals } from '@/lib/goals/goals.mjs';
import { createEnrollmentCode } from '@/lib/lift-sync/enroll.mjs';
import { FlaskConical, Weight } from 'lucide-react';
import { loadThresholdSources } from '@/lib/strava-sync/thresholds.mjs';
import { resolveThresholds } from '@/lib/strava-sync/tss.mjs';
import SectionError from '@/components/SectionError';
import { InlineNotice } from '@kobo/web';
import { loadBodyspecStatus } from '@/lib/vitals/bodyspec-api';
import { connectionsFrom } from '@/lib/settings/connections.mjs';
import { BodyspecSyncButton, CoachingNotesForm, LocationForm, StravaSyncButton, TargetsForm, ThresholdsForm, type ThresholdView } from './SettingsControls';
import { BodyspecLogo, GarminLogo, GoogleCalendarLogo, LiftLogo, StravaLogo } from './BrandLogos';
import ConnectLift from './ConnectLift';
import EventsEditor from './EventsEditor';
import GoalsForm from './GoalsForm';
import SettingsNav from './SettingsNav';

export const metadata: Metadata = { title: 'Settings' };

export const dynamic = 'force-dynamic';

type Level = 'ok' | Warning['level'];

function when(at: string | null) {
  if (!at) return 'never';
  // In Coach's home zone: the server renders in UTC, which put sync times hours ahead.
  return new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

const DOT: Record<Level, string> = { ok: 'bg-emerald-500', info: 'bg-sky-500', warn: 'bg-amber-500', error: 'bg-rose-500' };

/** The state of a connection, as a small pill next to its name. */
function StatePill({ connected, level }: { connected: boolean; level: Level }) {
  const [text, tone] = !connected
    ? ['Not connected', level === 'error' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-muted text-muted-foreground']
    : level === 'error'
      ? ['Error', 'bg-rose-500/10 text-rose-700 dark:text-rose-400']
      : level === 'warn'
        ? ['Needs attention', 'bg-amber-500/10 text-amber-700 dark:text-amber-400']
        : ['Connected', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? DOT[level] : 'bg-current opacity-60'}`} aria-hidden />
      {text}
    </span>
  );
}

/** One connection: logo, name and state, a one-line summary, actions on the right, and the details folded away. */
function Connection({
  logo, name, connected, level, summary, actions, notes, details, children,
}: {
  logo: React.ReactNode;
  name: string;
  connected: boolean;
  level: Level;
  summary: React.ReactNode;
  actions?: React.ReactNode;
  notes: Pick<Warning, 'level' | 'text'>[];
  details: [string, React.ReactNode][];
  children?: React.ReactNode;
}) {
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {logo}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium leading-none">{name}</h3>
            <StatePill connected={connected} level={level} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground sm:truncate">{summary}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-2 space-y-2 pl-12 text-sm">
        {notes.map((w) => (
          <p key={w.text} className="flex items-start gap-2 text-muted-foreground">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[w.level]}`} aria-hidden /> {w.text}
          </p>
        ))}
        <details className="group">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">Details</summary>
          <dl className="mt-2 grid grid-cols-[minmax(0,auto)_1fr] gap-x-6 gap-y-1">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground [overflow-wrap:anywhere]">{k}</dt>
                <dd className="text-right sm:text-left">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
        {children}
      </div>
    </li>
  );
}

/** A titled group of settings (Connections, Training, Coach). */
function Group({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** A card inside a group: a header with a title, a short help line and an optional action, then the body. */
function Panel({ id, title, help, action, children }: { id: string; title: string; help: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
        {action}
      </header>
      <div className="p-4 text-sm">{children}</div>
    </section>
  );
}

const SECTIONS = [
  { id: 'connections', label: 'Connections' },
  { id: 'events', label: 'Events' },
  { id: 'goals', label: 'Goals' },
  { id: 'targets', label: 'Weekly targets' },
  { id: 'thresholds', label: 'Thresholds' },
  { id: 'preferences', label: 'Coaching preferences' },
  { id: 'location', label: 'Weather location' },
];

/** The notice after an OAuth redirect back to Settings (?success= or ?error=). */
function redirectNotice(q: { success?: string; error?: string; scans?: string }) {
  if (q.error) return { tone: 'danger' as const, title: q.error.slice(0, 200) };
  if (q.success === 'bodyspec_connected') {
    const n = Number(q.scans);
    return { tone: 'success' as const, title: `BodySpec is connected${Number.isFinite(n) ? `: ${n} ${n === 1 ? 'scan' : 'scans'} on /health` : ''}.` };
  }
  if (q.success === 'strava_connected') return { tone: 'success' as const, title: 'Strava is connected.' };
  return null;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; scans?: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="settings" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const notice = redirectNotice(await searchParams);
  const [status, targets, coachingNotes, goals, events, thresholds, bodyspec] = await Promise.all([
    loadStatus(userId),
    loadTargets(userId),
    loadCoachingNotes(userId),
    load('Goals', () => loadGoals(sql, userId)),
    load('Events', () => loadEventsWithCountdown(userId, today)),
    load('Thresholds', () => loadThresholdSources(sql, userId)),
    load('BodySpec', () => loadBodyspecStatus(userId)),
  ]);

  // One source for every connection's state, shared with the phone's Settings (GET /api/app/settings).
  const connections = connectionsFrom({ status, bodyspec: bodyspec.ok ? bodyspec.value : null, now: Date.now() });
  const byId = Object.fromEntries(connections.items.map((c) => [c.id, c]));
  const levelOf = (id: string): Level => byId[id]?.level ?? 'ok';
  // The Lift row shows Lift's own state, so Lift's info note is left out.
  const notes = (source: Warning['source']) => status.warnings.filter((w) => w.source === source && !(source === 'lift' && w.level === 'info'));

  // lift://sync carries a one-time code, never the token: Lift trades it for the token over HTTPS
  // (/api/lift/enroll). A new code each time the page renders, valid 15 minutes.
  const liftLink = process.env.LIFT_SYNC_TOKEN ? `lift://sync?code=${(await createEnrollmentCode(sql)).code}` : null;
  const liftQr = liftLink ? await QRCode.toString(liftLink, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : '';
  // The OAuth start route sets a random state cookie, which the callback checks.
  const connectUrl = status.strava.canConnect ? '/api/auth/strava/start' : null;
  // Each threshold: the athlete's own value, and the automatic one (Garmin, Strava, an estimate) for the hint.
  const thresholdView = thresholds.ok
    ? (() => {
        const auto = resolveThresholds({ ...thresholds.value, settings: null });
        const own = (thresholds.value.settings ?? {}) as Record<string, number | undefined>;
        return Object.fromEntries(
          (Object.keys(auto) as (keyof typeof auto)[]).map((k) => [k, { own: own[k] ?? null, auto: auto[k].value, source: auto[k].source }]),
        ) as ThresholdView;
      })()
    : null;
  const fn = status.functionSync;

  const garmin = status.garmin;
  const isOn = (id: string) => byId[id]?.state !== 'off';
  const garminOk = isOn('garmin');
  const liftConnected = isOn('lift');
  const newestCalendarSync = byId.calendar?.lastSyncedAt ?? null;
  const bs = bodyspec.ok ? bodyspec.value : null;
  const bodyspecLevel = levelOf('bodyspec');
  const connected = { strava: isOn('strava'), lift: liftConnected, calendar: isOn('calendar'), garmin: garminOk, bodyspec: isOn('bodyspec') };
  const { attention, text: attentionText } = connections.summary;
  const button = 'inline-flex h-10 items-center rounded-md border px-3 text-xs font-medium shadow-sm hover:bg-accent md:h-8';

  return (
    <div data-smoke="settings" className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
      <SettingsNav sections={SECTIONS} />

      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Connections, events, goals and how Coach plans your week.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${attention ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${attention ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
            {attentionText}
          </span>
        </div>

        {notice && <InlineNotice tone={notice.tone} title={notice.title} />}

        <Group id="connections" title="Connections" description="Where Coach gets your activities, workouts, sleep and calendar.">
          <ul className="divide-y rounded-lg border bg-card">
            <Connection
              logo={<StravaLogo />}
              name="Strava"
              connected={connected.strava}
              level={levelOf('strava')}
              summary={status.strava.connected ? `Synced ${when(status.strava.lastSyncedAt)} · newest ${status.strava.newestActivity ? fmtDate(status.strava.newestActivity) : '-'}` : 'Connect Strava to bring in your activities.'}
              actions={
                <>
                  {status.strava.canSync && <StravaSyncButton />}
                  {connectUrl && <a className={button} href={connectUrl}>{status.strava.connected ? 'Reconnect' : 'Connect Strava'}</a>}
                </>
              }
              notes={notes('strava')}
              details={[
                ['Athlete', status.strava.athleteId ?? '-'],
                ['Newest activity', status.strava.newestActivity ? fmtDate(status.strava.newestActivity) : '-'],
                ['Auto sync', status.strava.canSync ? 'Webhook, and every 3 hours' : 'Off (Strava app secret not set)'],
              ]}
            />

            <Connection
              logo={<GarminLogo />}
              name="Garmin Connect"
              connected={garminOk}
              level={levelOf('garmin')}
              summary={garmin.connected ? `Synced ${when(garmin.lastSuccessAt)} · data through ${garmin.syncedThrough ? fmtDate(garmin.syncedThrough) : '-'}` : 'Not set up. Sleep, HRV and readiness come from Garmin.'}
              notes={notes('garmin')}
              details={[
                ['Login', !garmin.connected ? 'Not set up' : garmin.status === 'auth_failed' ? 'Expired' : 'Stored (encrypted)'],
                ['Last success', when(garmin.lastSuccessAt)],
                ['Last run', when(garmin.lastAttemptAt)],
                ['Synced through', garmin.syncedThrough ? fmtDate(garmin.syncedThrough) : '-'],
                ...(garmin.backfill ? [['Backfill', `from ${garmin.backfill.from}, through ${garmin.backfill.through ?? '(starting)'}`] as [string, string]] : []),
                ['Auto sync', 'Daily at 11:00 and 17:00 UTC (GitHub Actions)'],
              ]}
            >
              {!garminOk && (
                <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                  To log in again, run <code className="text-foreground">scripts/garmin/.venv/bin/python scripts/garmin/login.py</code> on your Mac (see scripts/garmin/README.md).
                </p>
              )}
            </Connection>

            <Connection
              logo={<GoogleCalendarLogo />}
              name="Google Calendar"
              connected={connected.calendar}
              level={levelOf('calendar')}
              summary={connected.calendar ? `${status.calendars.length} ${status.calendars.length === 1 ? 'calendar' : 'calendars'} · synced ${when(newestCalendarSync)}` : 'No calendar connected.'}
              notes={notes('calendar')}
              details={[
                ...status.calendars.map((c) => [c.email, c.active ? `synced ${when(c.lastSyncedAt)}` : 'off'] as [string, string]),
                ['Auto sync', 'Every hour (GitHub Actions)'],
              ]}
            />

            <Connection
              logo={<LiftLogo />}
              name="Lift"
              connected={liftConnected}
              level={levelOf('lift')}
              summary={liftConnected ? `Last change ${when(status.lift.lastChangeAt)} · ${status.lift.sessions} sessions` : 'The iPhone app for strength sessions.'}
              notes={notes('lift')}
              details={[
                ['Last change synced', when(status.lift.lastChangeAt)],
                ['Sessions on the server', status.lift.sessions],
              ]}
            >
              {liftLink && <ConnectLift link={liftLink} qrSvg={liftQr} connected={liftConnected} />}
            </Connection>

            <Connection
              logo={<FlaskConical aria-hidden className="h-5 w-5 text-muted-foreground" />}
              name="Function Health (labs)"
              connected={Boolean(fn.lastSuccessAt)}
              level={levelOf('function')}
              summary={fn.lastSuccessAt ? `Synced ${when(fn.lastSuccessAt)} · runs by hand` : 'Lab results come from Function Health; the sync runs by hand.'}
              notes={notes('function')}
              details={[
                ['Last success', when(fn.lastSuccessAt)],
                ['Last run', when(fn.lastAttemptAt)],
                ['Sync', 'By hand: Actions → Function Health sync → Run workflow, or gh workflow run function.yml'],
              ]}
            />
            <Connection
              logo={<Weight aria-hidden className="h-5 w-5 text-muted-foreground" />}
              name="Bathroom scale"
              connected={Boolean(status.scale.lastWeighIn)}
              level={levelOf('scale')}
              summary={
                status.scale.lastWeighIn
                  ? `Last weigh-in ${status.scale.lastWeighIn} · Renpho Elis 1 through the scale bridge`
                  : 'The Renpho Elis 1 sends weigh-ins through an ESP32 bridge (devices/scale-bridge). None yet.'
              }
              notes={notes('scale')}
              details={[
                ['Last weigh-in', status.scale.lastWeighIn ?? 'never'],
                ['Bridge status page', 'http://scale-bridge.local/ (home Wi-Fi)'],
              ]}
            />
            <Connection
              logo={<BodyspecLogo />}
              name="BodySpec (DEXA)"
              connected={connected.bodyspec}
              level={bodyspecLevel}
              summary={
                !bs
                  ? 'The BodySpec status did not load.'
                  : bs.connected
                    ? `${bs.scans} ${bs.scans === 1 ? 'scan' : 'scans'} · newest ${bs.newest ? fmtDate(bs.newest) : '-'} · synced ${when(bs.lastSuccessAt)}`
                    : 'Connect BodySpec to bring your DEXA scans to /health.'
              }
              actions={
                <>
                  {bs?.connected && <BodyspecSyncButton />}
                  <a className={button} href="/api/auth/bodyspec/start">{bs?.connected ? 'Reconnect' : 'Connect BodySpec'}</a>
                </>
              }
              notes={
                bs?.lastError
                  ? [{ level: bs.status === 'auth_failed' ? 'error' : 'warn', text: bs.status === 'auth_failed' ? `${bs.lastError}. Reconnect to sign in again.` : bs.lastError }]
                  : []
              }
              details={[
                ['Scans', bs?.scans ?? '-'],
                ['Newest scan', bs?.newest ?? '-'],
                ['Last success', when(bs?.lastSuccessAt ?? null)],
                ['Last run', when(bs?.lastAttemptAt ?? null)],
                ['Auto sync', 'Daily (GitHub Actions), and when you connect'],
              ]}
            />
          </ul>
        </Group>

        <Group id="training" title="Training" description="What you train for. Today shows the progress; /plan builds each week toward it.">
          <Panel id="events" title="Events" help="Races and target days. A is the main event of the season; B and C are build-up events.">
            {events.ok ? <EventsEditor upcoming={events.value.upcoming} past={events.value.past} /> : <SectionError label="Events" />}
          </Panel>
          <Panel id="goals" title="Goals" help="Milestones with a target and a deadline, measured from Strava and Garmin.">
            {goals.ok ? <GoalsForm goals={goals.value} /> : <SectionError label="Goals" />}
          </Panel>
          <Panel id="targets" title="Weekly targets" help="Today measures each week against these.">
            <TargetsForm targets={targets} />
          </Panel>
          <Panel id="thresholds" title="Thresholds" help="TSS, and so fitness (CTL), fatigue (ATL) and form (TSB), comes from these. Leave a field empty for the automatic value from Garmin, Strava or your best runs.">
            {thresholdView ? <ThresholdsForm view={thresholdView} /> : <SectionError label="Thresholds" />}
          </Panel>
        </Group>

        <Group id="coach" title="Coach" description="How Coach writes your plan.">
          <Panel id="preferences" title="Coaching preferences" help="Weekly structure and rules in Markdown. /plan and /check-in read them; change them here, not in a chat.">
            <CoachingNotesForm notes={coachingNotes} />
          </Panel>
          <Panel id="location" title="Weather location" help="The /plan week and month views show the forecast for this place.">
            <LocationForm />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
