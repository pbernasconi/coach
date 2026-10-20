# iOS engineering guidelines

The standard for every native iOS app we build: Lift first, then anything after it. It is written for small
teams (often one person) whose code is mostly written by coding agents, so the rules favour things a
compiler, a linter or a script can check over things a reviewer has to remember.

It distils two of our own shipped apps:

- **A large team app** with very strict architecture rules. We keep its screen
  pattern, concurrency settings, dependency injection and test style. We drop its scale (34 packages, multi-brand
  builds, a custom SwiftSyntax linter).
- **A small single-target app** with zero dependencies that shipped to
  TestFlight and unlisted App Store. We keep its size, its demo mode, its client resilience and its release
  pipeline.

Neither app stores data offline. Section 6 (local data and sync) is new and applies to any app that must work
without a network.

**How to read the rules.** Each rule has an id, so code review and commit messages can cite it.

- **MUST**: required. Most MUST rules are enforced by the compiler, `swift-format`, SwiftLint or
  `scripts/ios-guard.sh`. A MUST rule that cannot be enforced automatically is listed in the PR checklist
  (section 15).
- **NEVER**: a banned API or pattern. Every NEVER rule is enforced by the guard script or SwiftLint.
- **SHOULD**: the default. Breaking one needs a one-line reason in the code or the PR.

---

## 1. Stack

| Concern | Choice | Not |
| --- | --- | --- |
| UI | SwiftUI, `@Observable` | UIKit screens, Combine, TCA |
| Language | Swift 6 language mode | Swift 5 mode |
| Project | XcodeGen `project.yml` + one local SPM package | committed `.xcodeproj`, Tuist, CocoaPods |
| Persistence | GRDB (SQLite) with migrations | Core Data; SwiftData until it supports strict concurrency and sync cleanly |
| Networking | `URLSession` + async/await behind a protocol | Alamofire, a generated client for fewer than ~15 endpoints |
| Tests | Swift Testing; XCTest only for UI tests | Quick/Nimble, XCTest unit tests |
| Snapshots | swift-snapshot-testing (key screens only) | snapshotting every screen |
| Format / lint | `swift-format` (Apple) + SwiftLint (bans only) | SwiftFormat and swift-format together |
| Logging | `os.Logger` per category | `print`, third-party loggers |
| Crash reports | none until TestFlight; then Sentry with PII off | several crash handlers |
| Release | fastlane + GitHub Actions, manual signing | fastlane match for a single app |

- `STACK-1` **MUST** Each third-party dependency needs a reason in the README "Foundations" section, an
  `exact:` version pin and a committed `Package.resolved`. Budget: at most three runtime dependencies.
- `STACK-2` **MUST** The deployment target is the newest iOS the app's users run. For a personal app that is
  the current major (iOS 26). Use newer APIs directly; do not write `#available` branches for versions you
  do not ship.

## 2. Project layout

```text
<app>/
├── CLAUDE.md                      agent rules (short; points here)
├── ios/
│   ├── project.yml                XcodeGen spec: the source of truth
│   ├── .swift-format  .swiftlint.yml
│   ├── <App>/                     app target: composition root only
│   │   ├── App/                   @main, AppDependencies, Router, root tab shell
│   │   └── Features/<Feature>/<Screen>/   the screen file set (section 3)
│   ├── <App>Widgets/              Live Activity, widgets, App Intents
│   ├── Packages/<App>Kit/         ONE Package.swift, several targets
│   │   ├── Sources/Core           domain models + pure logic. No UI, no I/O
│   │   ├── Sources/Store          persistence + repository implementations
│   │   ├── Sources/Sync           API client, outbox, sync engine
│   │   ├── Sources/Design         tokens, components, motion
│   │   └── Sources/Testing        fakes, fixtures, test clocks (test-only)
│   ├── <App>Tests/  <App>UITests/
│   └── scripts/                   generate.sh, test.sh, ios-guard.sh, release.sh
└── api/                           backend, if any
```

- `LAY-1` **MUST** Keep `project.yml` committed and `*.xcodeproj` in `.gitignore`. Agents edit YAML safely
  and corrupt `project.pbxproj`. Regenerate with `scripts/generate.sh`; never hand-edit the project.
- `LAY-2` **MUST** Use one local package with a few targets, not one package per feature. Allowed edges:
  `Design → (nothing)`, `Core → (nothing)`, `Store → Core`, `Sync → Core, Store`, `Testing → Core, Store`,
  app target → all. Features live in the app target until there are more than about eight of them.
- `LAY-3` **MUST** `Core` builds for macOS too (`platforms: [.iOS(.v26), .macOS(.v15)]`) and contains no
  UIKit or SwiftUI. Then `swift test` runs on any Mac, and on Linux CI, without a simulator. All domain
  logic (progression rules, parsers, calculators, date maths) goes in `Core` so it can be tested this way.
- `LAY-4` **NEVER** create targets or folders named `Common`, `Utils`, `Helpers`, `Shared`, `Misc` or
  `Manager`. Name things for what they do.
- `LAY-5` **MUST** File size: at most 250 lines per file, 40 lines per function, 80 lines per SwiftUI `body`.
  Split anything larger. (Enforced by SwiftLint.)

## 3. Screens: one pattern, always

Every screen is the same set of files in `Features/<Feature>/<Screen>/`:

| File | Contains | Rules |
| --- | --- | --- |
| `<Screen>State.swift` | `struct <Screen>State: Equatable, Sendable` | everything the screen renders; enums for exclusive states |
| `<Screen>Action.swift` | `enum <Screen>Action: Equatable, Sendable` | every user intent, named for what happened (`saveTapped`) |
| `<Screen>ViewModel.swift` | `@Observable final class` | `private(set) var state`, `run() async`, `send(_:)` |
| `<Screen>Screen.swift` | the binding view | owns the ViewModel in `@State`, starts `.task { await vm.run() }` |
| `<Screen>Content.swift` | the dumb view | `let state`, `let send: (Action) -> Void`, nothing else |
| `<Screen>Fixtures.swift` | `#if DEBUG` named states | `.default`, `.loading`, `.empty`, `.error`, `.longText`, `.ax3` |
| `<Screen>Previews.swift` | one `#Preview` per fixture | renders `Content` only |
| `<Screen>ViewModelTests.swift` | in the test target | one test per `Action` case |

- `SCR-1` **MUST** Use exactly this shape. No base ViewModel, no generic Store, no Presenter, Interactor,
  Coordinator or UseCase types. Templates are in `templates/Screen/`.
- `SCR-2` **MUST** Only `<Screen>Screen` holds the ViewModel. `Content` and its subviews get `state` and
  `send`, never the ViewModel. No `@Bindable` ViewModel, no ViewModel in `@Environment`.
- `SCR-3` **MUST** A ViewModel `init` takes its dependencies as protocol parameters, has no default values
  and does no work: no loading, no `Task {}`, no subscriptions. Work starts in `run()`.
- `SCR-4` **MUST** Reads start only from `.task { await viewModel.run() }` or `.task(id:)`. SwiftUI cancels
  them when the view goes away. Never store a `Task` property for a read.
- `SCR-5` **MUST** Writes go through `send(_:)`, which returns `Task<Void, Never>?` marked
  `@discardableResult` so tests can `await vm.send(.x)?.value`. Set the pending state synchronously,
  before the task starts, so a double tap cannot write twice.
- `SCR-6` **MUST** Use enums for states that exclude each other: `Loadable<Value>` (`loading`, `loaded`,
  `empty`, `failed`), and an optional `Destination` enum for sheets. **NEVER** put `isLoading`, `hasError`
  and `data` side by side, or a Boolean next to an enum that already says the same thing.
- `SCR-7` **MUST** If a ViewModel takes route arguments, apply `.id(route)` to its Screen at the call site.
  Otherwise SwiftUI keeps the first instance and shows stale data.
- `SCR-8` **MUST** Build form bindings from `state` plus `send`, using one shared helper
  (`binding(state.reps) { send(.repsChanged($0)) }`). Content never writes into the ViewModel directly.
- `SCR-9` **SHOULD** A flow with real rules (a workout session, the rest timer, sync) gets a pure machine:
  `func reduce(_ state: S, _ event: E) -> (S, [Command])`, where commands are values, not closures. It lives
  in `Core` and is tested without UI. A plain load-and-render screen does not get a machine.

## 4. Dependencies

- `DI-1` **MUST** Inject dependencies by hand. Each feature declares what it needs as a protocol
  (`protocol WorkoutDeps: AnyObject { var workouts: any WorkoutRepository { get }; var clock: any Clock<Duration> { get } }`),
  and one `@MainActor final class AppDependencies` conforms to all of them. A missing dependency is then a
  compile error. Do not use a DI framework.
- `DI-2` **MUST** Build `AppDependencies` once in `App.init`. Nothing else is created at launch.
- `DI-3` **NEVER** use singletons or static shared state in app code (`static let shared`,
  `URLSession.shared`, `UserDefaults.standard` outside one settings type, `NotificationCenter.default`
  for app events).
- `DI-4` **NEVER** pass services through `@Environment(Type.self)`. A missing object crashes at runtime.
  `@Environment` is for SwiftUI values only (theme, `dismiss`, `openURL`, `scenePhase`).
- `DI-5` **MUST** Every side effect sits behind a protocol received in `init`: repositories, the router, the
  clock, haptics, HealthKit, notifications and Live Activities. That is what lets tests replace them.

## 5. Concurrency (Swift 6)

Build settings (in `project.yml` and the package manifest; see the templates):

```text
SWIFT_VERSION: 6.0
SWIFT_STRICT_CONCURRENCY: complete
SWIFT_DEFAULT_ACTOR_ISOLATION: MainActor        # app + Design
SWIFT_APPROACHABLE_CONCURRENCY: YES
SWIFT_TREAT_WARNINGS_AS_ERRORS: YES
```

- `CONC-1` **MUST** The app target and `Design` default to `MainActor` isolation. `Core`, `Store` and `Sync`
  use `.defaultIsolation(nil)`, so their models and `Codable` conformances are not tied to the main actor.
- `CONC-2` **MUST** In packages, enable `NonisolatedNonsendingByDefault`, `InferIsolatedConformances`,
  `ExistentialAny`, `MemberImportVisibility` and `.treatAllWarnings(as: .error)` by name, from one helper.
  SwiftPM does not read Xcode's approachable-concurrency setting.
- `CONC-3` **MUST** Use actors only to protect shared mutable state (the database writer, the sync engine).
  Inside an actor, store an in-flight `Task` before the first `await`, and after every `await` check the
  state again. Never make a stateless type an actor.
- `CONC-4` **MUST** Mark heavy decoding or mapping functions `@concurrent` so they leave the main actor.
  Never wrap a whole repository to do this.
- `CONC-5` **MUST** Time comes from an injected `any Clock<Duration>`; wall-clock instants come from an
  injected `now: @Sendable () -> Date`. Timers, rest countdowns and "auto-log after N seconds" use the
  clock, so tests run instantly on a test clock.
- `CONC-6` **NEVER** in app or feature code: `Task.detached`, `DispatchQueue`, `DispatchSemaphore`,
  `NSLock`, `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`,
  `MainActor.assumeIsolated`, `Thread.sleep`, `Task.sleep` on a real clock, `Date()` in logic.
- `CONC-7` **MUST** Treat `CancellationError` and `URLError(.cancelled)` as normal. They never become UI
  state, an error log or a crash report.
- `CONC-8` **MUST** Repository streams use `AsyncStream.makeStream(bufferingPolicy: .bufferingNewest(1))`
  with one continuation per subscriber, removed in `onTermination`. Never share one stream between two
  consumers.
- `CONC-9` **MUST** Pure types (maths, models, state machines, formatters) are declared `nonisolated` even in
  MainActor-default targets, so they run and test anywhere, and keep them in files that import only
  `Foundation`. Do not add `@MainActor` where default isolation already provides it; reach for
  `@concurrent` only for measured CPU-heavy work (Swift 6.2 nonisolated async functions stay on the
  caller's actor, SE-0461).

## 6. Local data and sync (offline-first)

The app must work fully with no network. The local database is the source of truth; the server is a backup
and a second reader (web dashboard, coach scripts).

- `DATA-1` **MUST** The UI reads only from the local database, through repository streams built on GRDB
  `ValueObservation`. A screen never waits on the network to show data.
- `DATA-2` **MUST** Every row has a client-generated `id: UUID` (UUIDv7, so ids sort by time),
  `createdAt`, `updatedAt` and `deletedAt` (a tombstone; nothing is hard-deleted before it syncs). The
  same ids are the primary keys on the server.
- `DATA-3` **MUST** A write is one local transaction that changes the row and appends to an `outbox`
  table in the same transaction. The sync engine (an actor) pushes the outbox in order, with an idempotency
  key per entry, and deletes an entry only after the server acknowledges it. A retry can never create a
  duplicate.
- `DATA-4` **MUST** Pull changes with a server cursor (`updatedAt` plus id), and resolve conflicts with
  last-writer-wins per row. Set rows (logged lifts) are append-mostly, so per-row last-writer-wins is
  enough. Document any field that needs a different rule.
- `DATA-5` **MUST** Schema changes are numbered GRDB migrations, never edited after they ship, each with a
  test that migrates a fixture database from the previous version.
- `DATA-6` **MUST** Stamp facts that can change meaning onto the row when it is written (for example the
  load mode "per dumbbell" vs "total", and the unit), never into a global setting that reinterprets
  history later.
- `DATA-7` **MUST** Store both target and actual on each logged unit of work (`targetReps`, `actualReps`,
  `targetWeight`, `actualWeight`, `status: done | skipped`). Prefill, progression and plateau detection
  then become queries rather than inference.
- `DATA-8` **SHOULD** Keep the sync protocol to two endpoints (`POST /sync/push`, `GET /sync/pull?cursor=`),
  defined in one shared schema file that both the app and the API are tested against.

## 7. Networking

- `NET-1` **MUST** Use one `APIClient` behind a protocol, built on an injected `URLSession` (never
  `.shared`). Tests swap the transport with a `URLProtocol` mock and make no live network calls.
- `NET-2` **MUST** Retry only idempotent requests, and only for transport errors and 502, 503 and 504, with
  backoff (0.4 s, then 1.2 s). Never retry a 4xx or a decoding failure. Writes are retried by the outbox
  (with an idempotency key), not by the client.
- `NET-3` **MUST** Coalesce identical in-flight GETs through a small actor.
- `NET-4` **MUST** Decode tolerantly at the boundary: lossy arrays (one bad row does not blank a screen),
  numbers that may arrive as strings, and unknown enum cases mapped to an `.unknown` case. Inside the app,
  types are strict.
- `NET-5` **MUST** Keep credentials in the Keychain behind one `KeychainStore`. **NEVER** put them in
  `UserDefaults`, logs, fixtures or screenshots.
- `NET-6` **MUST** ATS stays on. The only allowed exception is `NSAllowsLocalNetworking` for local
  development.

## 8. Navigation

- `NAV-1` **MUST** Use a `Route` enum per area that is `Hashable` and `Codable` and carries ids only, never
  models. One `@Observable Router` owns the selected tab and one path per tab. `NavigationStack` appears
  only in the app shell.
- `NAV-2` **MUST** ViewModels navigate through a `Navigating` protocol (`push`, `present`, `dismiss`),
  never by setting presentation Booleans.
- `NAV-3` **MUST** Deep links, widget taps, Live Activity buttons and App Intents resolve to a `Route` or a
  command through one router. They validate their input, wait until the app is ready, and never perform a
  destructive action without the app open (logging a set from a Live Activity is not destructive; deleting
  a workout is).

## 9. UI, design system and Liquid Glass

- `UI-1` **MUST** All spacing, radius, type and colour come from `Design` tokens. **NEVER** use literal
  colours or magic numbers in feature views. (The guard script flags `Color(red:`, `#colorLiteral`
  and hex strings outside `Design`.)
- `UI-2` **MUST** Use system materials and controls: `.glassEffect`, `.buttonStyle(.glass)` and
  `.glassProminent`, `TabView` with the system tab bar, `.tabViewBottomAccessory` for the mini player,
  `.sheet` with detents, and toolbar items. Draw custom glass only if the system cannot produce the effect.
- `UI-3` **MUST** Use Dynamic Type everywhere (`.font(.body)` or token fonts with `relativeTo:`), and
  render correctly at AX3. Never fix a text height.
- `UI-4` **MUST** Every tappable thing is a `Button` (or `Link`/`Toggle`), never `.onTapGesture`. Touch
  targets are at least 44×44 pt.
- `UI-5` **MUST** Accessibility: one VoiceOver element per row with a composed label, `.isHeader` on
  section titles, labels on icon-only controls, `accessibilityValue` on steppers and timers, and
  `accessibilityAction`s for swipe-only actions.
- `UI-6` **MUST** Every animation goes through a `Motion` token that returns `nil` when Reduce Motion is on.
- `UI-7` **NEVER** use `AnyView`, `GeometryReader` for layout that a stack or `Layout` can do, `ForEach`
  over `\.self` on strings or indices, or `some View` helper functions that grow a body past the size limit
  (make a subview struct).
- `UI-8` **MUST** Write user-facing strings in a String Catalog (`Localizable.xcstrings`), even with one
  language, so copy is reviewable in one place. Views that show copy take `LocalizedStringKey` (literals
  localize) with a `verbatim:`/`StringProtocol` overload for user data, as SwiftUI's own initialisers do.
  Strings inside a package resolve from the package's catalog (`Text("Close", bundle: .module)`,
  `String(localized: "Close", bundle: .module)`), never the host app's main bundle.
- `UI-9` **SHOULD** Use haptics through the injected `Haptics` protocol, for meaningful moments only (set
  logged, rest over, personal record).
- `UI-10` **MUST** Liquid Glass belongs to the navigation and control layer (bars, toolbars, floating
  buttons, the mini player, sheets), never to content (rows, cards, body text). Never stack glass on glass.
  Group neighbouring glass views in one `GlassEffectContainer(spacing:)` (glass cannot sample glass) and
  morph between them with `glassEffectID(_:in:)` inside an animation. Use `.interactive()` only on views
  that respond to touch, and tint only the primary action, never as the only signal of state. Apply
  `.glassEffect` after layout and appearance modifiers, and let the system adapt it for Reduce
  Transparency and Increase Contrast; never override its opacity by hand.

- `UI-11` **MUST** Kobo (`ios-standards/Kobo`) is the component library for every app. Screens are built from
  Kobo components, patterns and tokens; an app adds only domain composites (a set row, a workout screen) that
  are assembled from Kobo parts. Before writing any reusable view, check the Kobo catalogue and reference; if
  it is missing and would be useful to a second app, build it in Kobo first (with previews, tests, a catalogue
  entry and a reference page), then use it. Never fork or restyle a Kobo component inside an app; change Kobo.
- `UI-12` **MUST** Use Kobo's wrappers instead of raw SwiftUI where Kobo provides one: `KoboTextField` /
  `KoboTextArea` / `NumberEntry` over `TextField`, `.koboSearchable` over `.searchable`, `.koboSheet` /
  `.koboActionSheet` / `.koboModalPage` over `.sheet` and `.confirmationDialog`, `.koboConfirm` for
  confirmations, `Toast` via `ToastCenter` for transient messages. The wrappers carry the accessibility,
  Dynamic Type, unsaved-changes and haptic behaviour that raw controls leave to each screen.

## 10. Platform features

- `PLAT-1` **MUST** Live Activities and Dynamic Island live in the widget extension. Their `ActivityAttributes`
  type sits in a small target shared by the app and the extension, and holds only display values (names,
  set label, timer end date). Countdowns use `Text(timerInterval:)` so the system renders them; never push
  an update every second.
- `PLAT-2` **MUST** Buttons in a Live Activity or widget are `AppIntent`s that write to the local database
  through the same repository as the app. No logic is duplicated in the extension.
- `PLAT-3` **MUST** HealthKit: ask for the narrowest permissions (write `workoutType`, read nothing unless a
  feature needs it), write on finish through `HKWorkoutBuilder`, and handle "not authorised" as a normal
  state.
- `PLAT-4` **SHOULD** Offer App Shortcuts for the main verbs ("Start workout", "Log set").
- `PLAT-5` **MUST** Ask for each permission (notifications, Health) only at the moment the feature needs it,
  with a pre-prompt screen, never at launch.

## 11. Errors and logging

- `ERR-1` **MUST** Use one `AppError` struct with a closed `Kind` enum. Code branches on `kind`, never on
  message text. User-facing copy comes from one `ErrorCopy` mapping.
- `ERR-2` **MUST** Use static per-category loggers (`Log.store`, `Log.sync`, `Log.ui`). Interpolate with
  `privacy: .public` only for closed values (status codes, enum cases, durations). Everything else stays private.
- `ERR-3` **NEVER** use `print`, `debugPrint`, `NSLog`, `dump`, `fatalError` outside unreachable programmer
  errors, or `try!`. Force unwraps (`!`) are allowed only in tests and in `#Preview`.
- `ERR-4` **SHOULD** Add `OSSignposter` intervals for launch-to-first-frame and the hot path (log a set →
  rest timer visible).

## 12. Testing

- `TEST-1` **MUST** Use Swift Testing (`@Suite`, `@Test`, `#expect`) for all unit tests. XCTest only in the
  UI test target.
- `TEST-2` **MUST** Write one test per `Action` case, through hand-written fakes (`FakeWorkoutRepository`,
  `RecordingRouter`, `TestClock`). Assert whole recorded call lists (`#expect(router.calls == [.dismiss])`).
  No mocking frameworks.
- `TEST-3` **NEVER** use sleeps or real time in tests. Await the work (`await vm.send(.x)?.value`) and
  advance a test clock.
- `TEST-4` **MUST** Test all `Core` logic with table-driven tests (`@Test(arguments:)`): progression rules,
  the Notes importer (with real note text as fixtures), plate maths and unit conversion.
- `TEST-5` **MUST** Test the database: each migration from a fixture, each repository query, and the outbox
  (write → outbox entry → acknowledged → removed; retry → no duplicate).
- `TEST-6` **MUST** Add one UI smoke test that launches with `--demo` (bundled sample data, same code path),
  walks every tab and main flow, asserts real content and saves a screenshot at each stop. A passing run
  doubles as the App Store screenshot set.
- `TEST-7` **SHOULD** Snapshot `Content` for about five key screens in light, dark and AX3. Record only on
  purpose (`RECORD=1`), never automatically.
- `TEST-8` **MUST** Fixtures contain fake data only. Never put real personal data in fixtures, demo mode or
  screenshots.

## 13. Tooling and CI

- `TOOL-1` **MUST** Pin the toolchain: `.xcode-version`, the `xcodegen` version in `scripts/`, and every lint
  tool in `scripts/tools.lock`. `scripts/install-tools.sh` installs exactly those versions into `.tools/`
  (git-ignored), so a laptop, CI and an agent sandbox run the same binaries.
- `TOOL-2` **MUST** Run one command per check, the same locally and in CI:
  - `scripts/generate.sh`: XcodeGen.
  - `scripts/lint.sh`: the quick Swift loop (swift-format, SwiftLint `--strict`, `ios-guard.sh`).
  - `scripts/lint-all.sh`: the full static suite, runnable on Linux with no Xcode. It keeps going past
    failures and exits 1 if any step failed. `--fix` auto-formats first; `--deep` adds the macOS-only build
    with warnings as errors and Periphery dead-code scanning.
  - `scripts/test.sh`: package tests on macOS, then app tests on a simulator. Pick the simulator dynamically;
    never hard-code a device name.
  - `scripts/test.sh --ui`: the UI smoke test.
- `TOOL-3` **MUST** CI runs `lint-all.sh` on Linux and `lint-all.sh --deep` + `test.sh` on `macos-26` for
  every PR that touches `ios/**`. Pin actions by full commit SHA with the tag in a comment, set
  `permissions: contents: read`, `persist-credentials: false` on checkout, and a `timeout-minutes` per job.
  zizmor must report no findings.
- `TOOL-6` **MUST** Every check in the suite has one job and no overlap:

  | Tool | Checks | Why it is here |
  | --- | --- | --- |
  | `ios-guard.sh` | Our bans, file sizes, names, ViewModel `init` | Encodes this document; no build needed |
  | `swiftc -parse` | Every Swift file parses with the pinned toolchain | Catches syntax errors on Linux, where SwiftUI cannot compile |
  | swift-format (`--strict`) | Formatting and a few lint rules | Apple's formatter, bundled with the toolchain |
  | SwiftLint (`--strict`) | Size limits, correctness and opt-in rules | The widest Swift rule set; analyzer rules in `--deep` |
  | Periphery | Unused code (`--deep`, macOS) | Dead code is the debt agents create fastest |
  | shellcheck | `scripts/*.sh` | Scripts run in CI and hooks; quoting bugs are silent |
  | actionlint + zizmor | Workflow correctness and security | Injection, unpinned actions, excessive permissions |
  | yamllint | `project.yml`, configs, workflows | XcodeGen silently ignores mistyped keys |
  | markdownlint | Docs, including this one | Agents read these files; keep them regular |
  | typos | Spelling in code, comments and docs | Low noise; misspelt identifiers spread |
  | detect-secrets | New secrets against `.secrets.baseline` | Signing keys and API tokens never enter git |

- `TOOL-4` **MUST** Releases are tag-driven: `ios-v1.2.3` → TestFlight, with the build number taken from
  `git rev-list --count HEAD`. Signing secrets live in GitHub secrets, never in the repo.
- `TOOL-5` **SHOULD** Run the guard script from a Claude Code `PostToolUse` hook on every edited `.swift` file,
  so agents see violations immediately (`templates/claude-settings.json`).
- `TOOL-7` **SHOULD** Keep Dependabot (or Renovate) on for GitHub Actions and Swift packages, so SHA pins
  and package versions move forward with reviewed PRs instead of rotting.

## 14. Performance budgets

- `PERF-1` **SHOULD** Time to first frame is at most 400 ms warm. Nothing heavy runs in `App.init`: open the
  database lazily and start sync after the first frame.
- `PERF-2` **MUST** The hot path (tap ✓ → set saved → rest timer visible) does no network work and no
  main-thread I/O beyond one database write, and takes under 100 ms.
- `PERF-3` **SHOULD** Formatters (`NumberFormatter`, `DateFormatter`, `Duration.UnitsFormatStyle`) are static
  or `FormatStyle` values, never created inside `body`.
- `PERF-4` **SHOULD** Long lists use rows that take an `Equatable` value, so SwiftUI can skip unchanged rows.
- `PERF-5` **MUST** View identity is stable: never create `UUID()` (or any new id) while building a body,
  never `.id(UUID())`. Rows read only the state they show, so one change does not invalidate every row,
  and long scrolling content uses `List` or lazy stacks.
- `PERF-6` **SHOULD** Profile hitches in a Release build on a device with Instruments' SwiftUI template.
  Fix *long* updates (expensive `body` or layout) by splitting views or caching derived values, and
  *frequent* updates (broad observation) by narrowing what each view reads. Note the before and after in
  the PR.

## 15. Definition of done (every PR)

- [ ] `scripts/lint.sh` and `scripts/test.sh` pass locally. CI is green.
- [ ] New screens use the full file set (`SCR-1`), with fixtures and a preview per fixture.
- [ ] One test per new `Action` case. Every new `Core` rule has table-driven tests.
- [ ] No new third-party dependency, or the README "Foundations" section explains it (`STACK-1`).
- [ ] Database changes have a new migration and a migration test (`DATA-5`).
- [ ] Writes go through a repository that appends to the outbox (`DATA-3`).
- [ ] UI changes are checked in light, dark and AX3 (screenshots attached), and with VoiceOver for new
      controls.
- [ ] No real personal data in fixtures, logs or screenshots (`TEST-8`).
- [ ] The README "Foundations" section is updated if a decision changed.
