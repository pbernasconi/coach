# Kobo

Kobo (工房) is Japanese for a workshop or atelier: the place where well-made things are built.

A reusable SwiftUI component library for iOS 26 and macOS 26. It started from the parts of Trellis, Holdings
and the Lift prototype that kept being rebuilt: a calm token set, Liquid Glass controls, a rest-timer ring, a
week strip, toasts with undo, skeletons and loadable screens.

It knows nothing about any one app. Apps bring a `Theme` and their own domain composites; Kobo brings
accessible, motion-aware, tested building blocks.

## Layers

```text
KoboTokens      Space, Radius, Size, Palette, Tone, Typography, Theme, Motion   (no default isolation)
   ↑
KoboComponents  Controls · Selection · Fields · Search · Feedback · Status        (MainActor)
                Display · Layout · Navigation · Overlays · QuickActions · Utilities
   ↑
KoboPatterns    Loadable + LoadableView, ScreenScaffold, koboConfirm, StateGallery · Lists · Flows
   ↑
KoboCatalog     CatalogGallery: every component, live, with theme / dark / AX3 switches (debug only)
```

Edges point one way. An app links `KoboComponents` and `KoboPatterns`, and links `KoboCatalog` only
into a debug menu or a separate catalog target.

## Using it

```swift
// Package.swift
.package(path: "../Kobo")   // or a git URL pinned to a tag
.product(name: "KoboComponents", package: "Kobo")

// App root
WindowGroup { RootView().koboTheme(.amber) }

// A screen
ScreenScaffold("Week") {
    DayStrip(items: days, today: today, week: $week, onSelect: select)
    SegmentedProgress(done: 1, planned: 1, minimum: 2, goal: 3, accessibilityLabel: "Sessions this week")
    ListSection("Today") {
        ListRow(verbatim: exercise.name, subtitle: "3 × 8", value: "135 lb", action: open)
    }
} footer: {
    Button("Start workout", action: start).buttonStyle(.glassProminent)
}
.toastHost(toasts)
```

A brand is one value: `Palette.make(accent:onAccent:accentText:)` builds a full palette from an accent, and
`Theme(palette:surfaceStyle:)` picks glass or solid controls.

## What's inside

| Section | Components |
| --- | --- |
| Controls | `KoboButtonStyle` (`.kobo(.primary)`), `AsyncButton`, `IconButton`, `CloseButton`, `Chip`, `ChipGroup`, `KoboTag`, `SegmentedPicker`, `KoboToggleStyle`, `ToggleRow`, `StepperField`, `QuickPickRow`, `FlowLayout`, `.pressFeedback()`, `.shake(trigger:)`, `HapticFeedback` |
| Selection | `KoboCheckbox`, `KoboRadio`, `CheckRow`, `RadioRow`, `RadioGroup`, `ChoiceCard`, `ChoiceCardGroup`, `MenuRow`, `MenuSelectField`, `SelectField`, `MultiSelectField`, `SelectSheet`, `RangeSlider`, `AccordionGroup`, `ThemePicker` |
| Fields | `KoboTextField`, `KoboSecureField`, `KoboTextArea`, `FieldGroup`, `NumberEntry`, `CodeInput`, `DateField`, `KoboCalendar`, `CopyButton`, `CopyableValue`, `.tapToCopy`, `KeyboardAccessoryBar` |
| Search | `SearchField`, `HighlightedText`, `.koboSearchable`, `SearchMatch` |
| Feedback | `Toast` + `ToastCenter` + `.toastHost(_:)`, `Skeleton`, `.shimmering()`, `.skeletonBreath()`, `LoadingState`, `EmptyState`, `EmptyStateArt`, `ErrorState`, `NoticeBanner`, `StatusPill`, `.pulse(active:)` |
| Status | `BannerStack` + `.bannerStack`, `NudgeBanner`, `SystemNotice`, `OfflineBanner`, `InlineNotice`, `IconNotice`, `InlineProgress`, `SectionState`, `SlowWaitNote` |
| Display | `ProgressRing`, `CountdownRing`, `AnimatedNumber`, `StatTile`, `Avatar`, `Monogram`, `Thumbnail`, `ThumbnailBadge` |
| Layout | `.koboCard()`, `CardSection`, `ListRow`, `ListSection`, `KeyValueRow`, `KeyValueList`, `SectionHeader`, `Separator`, `Collapsible`, `.pinnedFooter`, `SheetHeader`, `DayStrip`, `SegmentedProgress`, `MiniPlayerBar` |
| Navigation | `AppHeader` + `.tabRootHeader`, `HeaderButton`, `HeaderProfileButton`, `CountBadge` + `.countBadge`, `TabShell`, `TextLink` |
| Overlays | `KoboSheet` + `.koboSheet`, `.koboActionSheet`, `ModalPage` + `.koboModalPage`, `InputModal`, `InfoButton`, `InfoSheet`, `.itemSheet` |
| QuickActions | `ActionChipRow`, `ActionCircle`, `SetupChecklistCard`, `SuggestionCard`, `SummaryStrip`, `TonalCardRow` |
| Utilities | `AccessibilitySizeReader`, `WideWindowReader`, `AdaptiveColumns`, `HoldsLastValue`, `MaskedValue`, `RevealableValue`, `DeferredRow`, `.pageGutter()`, `.readableWidth()`, `.screenCanvas()`, `.onArrival` |
| Patterns | `Loadable` + `LoadableView`, `ScreenScaffold`, `.koboConfirm`, `StateGallery`, `.previewMatrix()` |
| Lists | `ListRowSkeleton`, `LoadMoreFooter`, `LoadableSection`, `LoadableCaptionSection`, `SectionEmptyCard`, `.koboRefreshable` |
| Flows | `FlowStep`, `ProgressFlowStep`, `ValueStep`, `StepIndicator`, `ReviewScaffold`, `ReviewSection`, `ReviewRow`, `ReviewDisclosure`, `OutcomeScaffold`, `PrimerPage`, `UpdateGateScreen`, `FormFocus` |

Open `CatalogGallery()` to browse them all, interactively, under any theme, in light, dark and AX3.

## Rules

[CONVENTIONS.md](CONVENTIONS.md) is the contract every component follows. In short:

- **Values in, intents out.** No app models, ViewModels or repositories.
- **Theme from the environment.** No literal colours or magic numbers.
- **Accessibility built in.** Real `Button`s, 44 pt targets, one VoiceOver element per row, AX3 layouts.
- **Status is never colour alone.**
- **Motion only through `Motion`.** Every preset is `nil` under Reduce Motion.
- **Liquid Glass on controls, never on content.** It yields to `.solid` themes.
- **Pure logic in `Foundation`-only files.** Those files are tested on Linux.

## Checks

From the kit root (`ios-standards/`):

```bash
scripts/install-tools.sh --swiftlint   # once: pinned lint tools into .tools/
scripts/lint-all.sh                    # guard, parse, swift-format, SwiftLint, catalog coverage,
                                       # Linux logic tests, and the non-Swift linters
```

| Script | What it proves |
| --- | --- |
| `Kobo/scripts/catalog-coverage.sh` | Every public view appears in `KoboCatalog`. |
| `Kobo/scripts/linux-logic-tests.sh` | Every SwiftUI-free file compiles with the package's strict settings, and its tests pass. Today that is 325 tests in 47 suites, covering stepper maths, chip selection, flow layout, the async-button state machine, toast timing on a test clock, week maths across month, year and DST boundaries, countdown text, ring clamping, motion curves, `Loadable` and catalog search. |
| `swift test` (macOS) | Everything, including the SwiftUI-dependent tests. |

## Known gaps

- **Untested on a Mac.** SwiftUI views have only been syntax-checked and linted in a Linux sandbox. The
  first macOS build may surface type-check issues, most likely in generic `@ViewBuilder` initialisers and
  in iOS 26 glass API spellings. Fix them before tagging 0.1.0.
- **No snapshot tests yet.** Add swift-snapshot-testing, or the Xcode 26 preview snapshots, for the light,
  dark and AX3 matrix once the package builds on a Mac.
