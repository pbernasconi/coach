# iOS standards kit

A drop-in standard for building native iOS apps with coding agents. It is based on two of our shipped apps
(Trellis for discipline, Holdings for small size) and adds offline-first data rules that neither of them had.

| File | What it is | Where it goes in an app repo |
|---|---|---|
| `IOS_GUIDELINES.md` | The full standard, with rule ids and reasons | `ios/IOS_GUIDELINES.md` |
| `CLAUDE.md` | Short rules agents follow, pointing at the guidelines | repo root, or merged into the existing one |
| `scripts/ios-guard.sh` | Grep-based enforcement of the bans; runs anywhere | `ios/scripts/` |
| `scripts/lint.sh`, `test.sh`, `generate.sh` | One command per check, the same locally and in CI | `ios/scripts/` |
| `templates/Screen/` | The eight-file screen set, with a full test file | copy and rename per screen |
| `templates/Core/` | `Loadable`, `AppError`, `Log` | `Packages/<App>Kit/Sources/Core/` |
| `templates/Store/` | Repository protocol + GRDB implementation with outbox writes | `Sources/Store/` |
| `templates/Testing/` | Hand-written fakes and recorders | `Sources/Testing/` |
| `templates/config/` | `project.yml`, `Package.swift`, `.swift-format`, `.swiftlint.yml` | `ios/` |
| `templates/claude-settings.json` | Claude Code hook: runs the guard on every edited Swift file | `.claude/settings.json` |
| `templates/.github/` | PR template + CI workflow (Linux Core job + macOS app job) | `.github/` |

## How the rules are enforced

Most rules are written so a machine can check them:

1. **Compiler:** Swift 6, strict concurrency, MainActor by default and warnings as errors catch data races
   and isolation mistakes before anything runs.
2. **`ios-guard.sh`:** bans `Task.detached`, GCD, `URLSession.shared`, singletons, `print`, `try!`,
   `AnyView`, `.onTapGesture`, colour literals outside Design, services in `@Environment`, work in
   ViewModel `init`, files over 250 lines and junk-drawer names. It needs no build, so it runs in the agent's
   sandbox, in a Claude Code hook after every edit, and in CI on Linux.
3. **SwiftLint (`--strict`):** size limits and a few more bans. **swift-format** owns formatting.
4. **Tests:** one per Action, table tests for Core rules, migration tests, and a demo-mode UI smoke test.
5. **PR checklist:** covers what tools cannot check (light/dark/AX3 screenshots, VoiceOver, no real data).

As a check on the rules themselves:

- **Trellis:** one full feature package (149 Swift files) passes the guard with no findings.
- **Holdings:** the guard flags real issues: services passed through `@Environment`, `ForEach` over
  `\.self`, two files over the size limit, and real-clock sleeps in the API client.

## Adopting it in a new app

1. Copy the files to the places in the table, and replace `App`/`AppKit`/`com.example` with the app's names.
2. Set the newest GRDB release in `Package.swift`, and the toolchain pins (`.xcode-version`, formatter version).
3. Add `templates/claude-settings.json` to `.claude/settings.json`, so agents get guard feedback on every edit.
4. Start every screen by copying `templates/Screen/` and renaming `Example`.
5. Record each decision and its reason in the README "Foundations" section.
