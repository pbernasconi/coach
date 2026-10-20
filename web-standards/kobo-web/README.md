# Kobo web

The web twin of Kobo (`ios-standards/Kobo`): a calm token set, accessible React components and data-state patterns.
It uses React 19, Tailwind CSS v4, Radix primitives, `class-variance-authority` and lucide icons.

It knows nothing about any one app. Apps bring a brand and their own domain composites. Kobo web brings tested
building blocks.

## Layers

```text
tokens      src/tokens/tokens.css     colour roles, type roles, space, radius, shadow, layers, motion
   ↑
lib         src/lib                   cn(), tones, money and number formats
   ↑
components  src/components            controls · fields · feedback · display · overlays
   ↑
patterns    src/patterns              QueryBoundary, SkeletonRegion, SkipLink
   ↑
catalog     catalog/                  every component, live, with dark and brand switches (not shipped)
```

Edges point one way.

## Using it

The package ships TypeScript source. A Next.js app adds it to `transpilePackages`.

```css
/* app/globals.css */
@import 'tailwindcss';
@import '@kobo/web/tokens.css';
@import '@kobo/web/shadcn-aliases.css'; /* only while the app still has shadcn components */
@source '../node_modules/@kobo/web/src';
```

```tsx
// app/layout.tsx: theme and brand go on <html>, so dialogs in portals get them too.
<html lang="en" className="dark" data-brand="amber">
  <body>
    <ConfirmProvider>
      <SkipLink />
      {children}
    </ConfirmProvider>
  </body>
</html>
```

```tsx
// A screen
<QueryBoundary query={notes} errorTitle="We could not load your notes" loading={<RowsSkeleton />}
  isEmpty={(items) => items.length === 0} empty={<EmptyState icon={Inbox} title="No notes yet" />}>
  {(items) => <NoteList items={items} />}
</QueryBoundary>
<StatTile label="Spend" value={formatCompactMoney(1_240_000)} delta={statDelta(-0.08, '−8%', { goodWhen: 'down' })} />
<Button loading={saving} onClick={save}>Save</Button>
```

## Kobo role names on the web

| Kobo (SwiftUI) | Kobo web utility |
| --- | --- |
| `accent`, `onAccent`, `accentSoft`, `accentText` | `bg-brand`, `text-on-brand`, `bg-brand-soft`, `text-brand-ink` |
| `canvas`, `surface`, `surfaceRaised`, `surfaceSunken` | `bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-surface-sunken` |
| `separator`, `scrim` | `border-line`, `bg-scrim` (plus `border-line-strong` for field borders) |
| `textPrimary`, `textSecondary`, `textTertiary` | `text-ink`, `text-ink-muted`, `text-ink-faint` |
| `status(tone).ink`, `.soft` | `text-success-ink`, `bg-success-soft` (plus `border-success-line`) |
| `Tone.accent` | tone `brand` |
| `Space.gutter`, `cardInset`, `section`, `rowVertical` | `px-gutter`, `p-card`, `gap-section`, `py-row` |
| `Radius.xs`, `sm`, `md`, `lg`, `xl` | `rounded-badge`, `rounded-inner`, `rounded-control`, `rounded-card`, `rounded-sheet` |
| `Motion.Duration.state`, `Curve.standard` | `duration-(--motion-state)`, `ease-standard` |

The web uses `brand` and `ink` in place of `accent` and `text`: shadcn already uses `accent` for a hover grey, and
Tailwind uses `text-` as a prefix. The optional `shadcn-aliases.css` maps the shadcn names onto these roles.

## What's inside

| Section | Components |
| --- | --- |
| Controls | `Button`, `Spinner`, `Checkbox` + `CheckboxField`, `Switch`, `ToggleRow`, `RadioGroup`, `RadioCards`, `ChoiceCard`, `Tabs`, `TextLink`, `CopyButton`, `CopyableValue`, `ResendCodeButton` |
| Fields | `Field` family, `Label` (with `help`), `Input`, `Textarea`, `CountedTextarea`, `CharacterCount`, `OptionalFieldDisclosure`, `LabeledField`, `Form` family (react-hook-form), `Select`, `SearchInput`, `PasswordInput`, `PasswordRequirements` (zxcvbn), `OtpInput`, `PinInput`, `EmailChipsInput` |
| Pickers | `CurrencyInput` (cents in and out, `null` for invalid), `DateTextInput`, `DatePicker`, `Calendar` (react-day-picker), `InternationalPhoneInput`, `CountryCombobox`, `CountryFlagIcon`, `FileDropzone` |
| Feedback | `StatusPill`, `InlineNotice`, `Skeleton`, `RowsSkeleton`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, `StatusCard`, `SuccessState`, `IdleSessionWarning` |
| Display | `Card`, `Separator`, `Avatar`, `AvatarGroup`, `MaskedValue`, `TruncatedText`, `StepIndicator`, `Collapsible`, `MoneyDisplay`, `StatTile`, `Meter` |
| Data | `Table` family, `DataTable`, `SortableColumnHeader`, `clickableRowProps`, `LoadMoreRow`, `KeyValueList`, `KeyValueRow`, `DetailPanel`, `FloatingSelectionBar`, `Timeline`, `ReviewSection`, `ReviewDisclosure`, `ReviewAcknowledgement` |
| Overlays | `Dialog` family, `AlertDialog` family, `Sheet` family (four sides and a non-modal panel), `Popover`, `Tooltip`, `StandardTooltip`, `HelpTooltip`, `DropdownMenu` family, `Command` family + `CommandDialog` (cmdk), `Toaster` + `toast` (sonner), `FormDialog`, `ConfirmDialog`, `ConfirmProvider` + `useConfirm` |
| Layout | `PageHeader`, `StepHeader`, `SectionRail`, `FlowShell`, `FlowFooter`, `FlowFooterSlot`, `FullScreenWizard`, `WizardStepRail` |
| Navigation | `Breadcrumb`, `CollapsibleNavGroup`, `FilterPills`, `StepNav`, `Sidebar` family (collapses to icons, a sheet on a phone) |
| Patterns | `QueryBoundary`, `SkeletonRegion`, `SkipLink`, `RouteErrorScreen`, `PageGateState` |
| Print | `PrintDocument`, `PrintButton` (paper always uses the light palette) |
| Hooks | `useStoredValue`, `useIsMobile`, `useMountEffect` |
| Formats | money from cents, `formatNumber`, `formatPercent`, `formatMultiple`, `formatDelta`, `formatCompactMoney`, `formatBytes`, `parseMoney`, date text helpers, `toE164` |

The `tests/vectors/` files (money, currency input, date field, one-time code, password strength, email chips, select
search, list paging, flags) hold input and output cases as JSON. Kobo (SwiftUI) can test against the same files.

## Rules

[CONVENTIONS.md](CONVENTIONS.md) is the contract every component follows.

## Checks

```bash
npm install
npm run check          # type check + conformance + tests
npm run catalog        # the live catalog on http://localhost:4310
node scripts/conformance.mjs --self-test
```

## Next components

1. **Dense data tools:** `FinancialGrid` (freeze panes, sticky total row), `MatrixTable`, the Excel-style
   `ColumnFilter`, a chart theme module over the `viz-*` hues, the units toggle.
2. **Hooks:** `useUrlState`, `useHotkey`, `useEscapeKey`.

## Known gaps

- **One use in an app.** The coach app uses only `InlineNotice` (in `SectionError`) so far.
- **Bundle size.** Import from `@kobo/web` and let the bundler drop what a page does not use (`sideEffects` is
  CSS only). `PasswordRequirements` brings the zxcvbn dictionaries into any page that uses it.
- **Contrast is not checked by a script.** The values come from Kobo. Add a
  contrast gate before you add a brand.
- **No visual tests.** The catalog is checked by eye in light, dark and the amber brand, at desktop and phone width.
