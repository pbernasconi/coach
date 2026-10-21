import { Dumbbell, ScanLine } from 'lucide-react';

// Brand marks for the Connections list. Paths from Simple Icons (CC0, simpleicons.org).
const STRAVA = 'M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169';
const GOOGLE_CALENDAR = 'M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z';

const tile = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg';

export function StravaLogo() {
  return (
    <span className={`${tile} bg-[#FC4C02]`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d={STRAVA} /></svg>
    </span>
  );
}

export function GarminLogo() {
  return (
    <span className={`${tile} bg-black ring-1 ring-white/10`} aria-hidden>
      {/* Garmin's delta: the triangle in its wordmark. The full wordmark is too small to read at this size. */}
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#007CC3]"><path d="M12 3.5 22 20.5H2Z" strokeLinejoin="round" /></svg>
    </span>
  );
}

export function GoogleCalendarLogo() {
  return (
    <span className={`${tile} border bg-white`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#4285F4]"><path d={GOOGLE_CALENDAR} /></svg>
    </span>
  );
}

/** Lift, our own iPhone app: its app icon (lift/ios AppIcon), a black dumbbell on yellow. */
export function LiftLogo() {
  return (
    <span className={`${tile} bg-[#FFC21A] text-black`} aria-hidden>
      <Dumbbell className="h-5 w-5 rotate-45" strokeWidth={2.5} />
    </span>
  );
}

/** BodySpec (DEXA scans): no brand mark here, so a scan icon on BodySpec's green. */
export function BodyspecLogo() {
  return (
    <span className={`${tile} bg-[#1F3D2B] text-[#C8F169]`} aria-hidden>
      <ScanLine className="h-5 w-5" strokeWidth={2.25} />
    </span>
  );
}
