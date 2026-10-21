# iOS standards kit

A drop-in standard for building native iOS apps with coding agents. It is based on two of our shipped apps
(a large team app for discipline, a small app for size) and adds offline-first data rules that neither of them had.

| File | What it is | Where it goes in an app repo |
| --- | --- | --- |
| `IOS_GUIDELINES.md` | The full standard, with rule ids and reasons | `ios/IOS_GUIDELINES.md` |
| `CLAUDE.md` | Short rules agents follow, pointing at the guidelines | repo root, or merged into the existing one |
| `scripts/ios-guard.sh` | Grep-based enforcement of the bans; runs anywhere | `ios/scripts/` |
| `scripts/lint.sh`, `test.sh`, `generate.sh` | One command per check, the same locally and in CI | `ios/scripts/` |
| `scripts/lint-all.sh`, `install-tools.sh`, `tools.lock` | Full static suite with pinned tools; runs on Linux and in an agent session | `ios/scripts/` |
| `RUNNING.md` | How to build, run and screenshot an app on a simulator or a real iPhone, and signing checks | `ios/RUNNING.md` |
| `scripts/ios-run.sh`, `ios-screenshots.sh`, `ios-signing.sh` | Simulator and device runs, screenshots, signing health (see `RUNNING.md`) | `ios/scripts/` |
| `scripts/package-tests.sh`, `check-vendor-pins.py`, `asc-revoke-ci-certs.py` | Parallel package tests, exact package pins, CI certificate cleanup | `ios/scripts/` |
| `scripts/tests/run-tools-test.sh` | Tests for the run scripts, with a fake `xcrun` | `ios/scripts/tests/` |
| `templates/config/.ios-run.env` | Project values for `ios-run.sh` | next to `project.yml` |
| `.yamllint.yml`, `.markdownlint-cli2.yaml`, `_typos.toml` | Configs for the non-Swift linters | `ios/` |
| `Kobo/` | Reusable SwiftUI component library (tokens, components, patterns, catalog) | its own package or repo |
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
   `scripts/lint-all.sh` runs these plus shellcheck, actionlint, zizmor, yamllint, markdownlint, typos and
   detect-secrets, all pinned in `scripts/tools.lock` (see `TOOL-6`).
4. **Tests:** one per Action, table tests for Core rules, migration tests, and a demo-mode UI smoke test.
5. **PR checklist:** covers what tools cannot check (light/dark/AX3 screenshots, VoiceOver, no real data).

As a check on the rules themselves:

- **The large app:** one full feature package (149 Swift files) passes the guard with no findings.
- **The small app:** the guard flags real issues: services passed through `@Environment`, `ForEach` over
  `\.self`, two files over the size limit, and real-clock sleeps in the API client.

## Adopting it in a new app

1. Copy the files to the places in the table, and replace `App`/`AppKit`/`com.example` with the app's names.
2. Set the newest GRDB release in `Package.swift`, and the toolchain pins (`.xcode-version`, formatter version).
3. Add `templates/claude-settings.json` to `.claude/settings.json`, so agents get guard feedback on every edit.
4. Start every screen by copying `templates/Screen/` and renaming `Example`.
5. Record each decision and its reason in the README "Foundations" section.
