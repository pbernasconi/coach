# CLAUDE.md (iOS)

Rules for agents working in this iOS codebase. The full standard, with reasons, is
`IOS_GUIDELINES.md`; rule ids below (`SCR-3`) point into it. If a rule blocks you, stop and say so.
Do not work around it.

## Commands

```bash
ios/scripts/generate.sh      # XcodeGen → .xcodeproj (never edit the project by hand)
ios/scripts/lint.sh          # quick loop: swift-format + SwiftLint --strict + ios-guard.sh
ios/scripts/lint-all.sh      # full suite (also shell, workflows, YAML, Markdown, typos, secrets); --fix formats
ios/scripts/install-tools.sh # once per machine: pinned lint tools into ios/.tools/
ios/scripts/test.sh          # Core package tests (macOS/Linux), then app tests on a simulator
ios/scripts/test.sh --ui     # demo-mode UI smoke test with screenshots
(cd ios/Packages/*Kit && swift test)   # Core logic only; works without Xcode
```

Run `lint-all.sh` and `test.sh` before saying anything is done. On Linux, run the package tests and say
plainly that the simulator tests were not run.

## Where code goes

- **Domain logic** (rules, parsers, maths, state machines): the `Core` target, as pure functions with no
  UIKit, SwiftUI or I/O. Test it with table-driven Swift Testing.
- **Database and repositories:** the `Store` target. **API and sync:** the `Sync` target.
  **Tokens and components:** the `Design` target. **Fakes and fixtures:** the `Testing` target.
- **Screens:** `ios/<App>/Features/<Feature>/<Screen>/`, using the eight-file set (copy `templates/Screen/`).
- **New targets:** do not add folders or targets called Utils, Helpers, Common, Shared or Manager.

## Screen pattern (SCR-1…9)

- **The eight files:** `State` (Equatable, Sendable struct), `Action` (enum), `ViewModel` (`@Observable final
  class`, `private(set) var state`, `run() async`, `@discardableResult send(_:) -> Task<Void, Never>?`),
  `Screen` (owns the VM in `@State`, `.task { await vm.run() }`), `Content` (`let state`, `let send`, nothing
  else), `Fixtures` (`#if DEBUG`), `Previews` (one per fixture), and `ViewModelTests` (one test per Action).
- **ViewModel `init`:** takes protocols, has no default arguments, and does no work.
- **States that exclude each other are enums** (`Loadable`, `Destination?`), never Boolean flags side by side.
- **Route arguments:** a Screen with route arguments gets `.id(route)` where it is created.

## Hard bans (the guard script enforces these)

- **Concurrency:** `Task.detached`, `DispatchQueue`, `DispatchSemaphore`, `NSLock`, `@unchecked Sendable`,
  `nonisolated(unsafe)`, `@preconcurrency`, `MainActor.assumeIsolated`, `Thread.sleep`.
- **Time:** `Date()` outside the composition root (inject `now`), and `Task.sleep` outside the live clock
  (inject `any Clock<Duration>`).
- **Shared state:** `URLSession.shared`, `static let shared`, `UserDefaults.standard` outside `Settings`,
  and services in `@Environment`.
- **Debug output and crashes:** `print(`, `debugPrint(`, `NSLog(`, `try!`, `fatalError(` (except unreachable
  `default:`), and force unwraps outside tests and previews.
- **SwiftUI:** `AnyView`, `.onTapGesture` on things that should be Buttons, and `ForEach(…, id: \.self)` on
  strings or indices.
- **Design:** colour literals or hex colours outside `Design`, and glass on content or glass on glass (UI-10).
- **Identity:** `UUID()` or `.id(UUID())` while building a view (PERF-5).
- **Size:** more than 250 lines per file, 40 per function, 80 per `body`.

## Data (DATA-1…8)

- **Reads:** the UI reads the local database only, through repository `AsyncStream`s.
- **Rows:** every row has a client-made `UUID` id, `createdAt`, `updatedAt` and `deletedAt`. Never hard-delete.
- **Writes:** each write is one transaction that updates the row and appends an outbox entry. Sync pushes the
  outbox with idempotency keys.
- **Schema:** schema changes are new migrations, each with a migration test. Never edit a shipped migration.
- **Logged values:** store target and actual on each logged unit, and stamp units and load mode on the row.

## Tests (TEST-1…8)

- **Framework:** Swift Testing only (XCTest only in the UI test target), with hand-written fakes and no mock
  libraries.
- **Async and time:** no sleeps and no real time. Await `send(...)?.value` and advance a test clock.
- **Fixtures:** fake data only, never real personal data.

## Done means

Lint and tests pass, and new screens have fixtures and previews. New Actions and Core rules have tests,
schema changes have migrations, and UI changes were checked in light, dark and AX3. Report anything you
could not run.
