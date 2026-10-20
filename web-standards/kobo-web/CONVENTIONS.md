# Kobo web conventions

Every component in Kobo web follows these rules. They match Kobo (SwiftUI) `CONVENTIONS.md` where the two
platforms are the same. A rule that a script checks names its check id (`R-PALETTE`). The other rules are for review.

## API shape

1. **Data in, intents out.** A component takes plain values and callbacks. It never takes an app model, a query
   client or a store. `QueryBoundary` takes the small `QueryLike` shape, not a React Query type.
2. **Tokens only.** Use the role utilities (`bg-surface`, `text-ink-muted`, `border-line`, `rounded-md`, `z-modal`,
   `text-body`). No hex, `rgb()` or `hsl()` (`R-COLOR`). No palette ramps, `bg-white` or `text-black` (`R-PALETTE`).
   No Tailwind font sizes (`R-TYPE`). No raw z-index (`R-LAYER`). A missing value is a token change in
   `src/tokens/tokens.css`.
3. **Variants are enums.** Use `cva` variants (`variant`, `size`, `tone`). Do not add Boolean flags that combine into
   impossible states.
4. **Slots are `ReactNode` props or children.** Use an `action`, `icon` or `children` slot in place of more props.
   Keep a component at 15 props or less.
5. **`cn()` only.** Build a `className` with `cn()`, never a template literal (`R-CN`). `cn()` knows the Kobo type
   roles, so `cn('text-title', 'text-ink')` keeps both.
6. **Generic, not domain.** Name things for what they are (`StatTile`, `Meter`), never for one app. Samples, tests
   and the catalog use neutral content: notes, tasks, trips, recipes (`DOMAIN`).

## Behaviour

7. **Motion only through tokens.** Use `duration-(--motion-state)`, `ease-standard`, `ease-enter`, `ease-exit` and
   the `animate-*` tokens (`R-MOTION`). Exits are faster than entrances. `tokens.css` stops all motion under
   Reduce Motion, with 0.01ms so Radix still closes overlays.
8. **Accessibility is part of the component.** Clickable things are `<button>` or `<a href>`, never a `div` with
   `onClick` (`R-CLICK`). Icon-only buttons take an `aria-label`. Decorative icons are `aria-hidden`. Every dialog
   has a title.
9. **Status is never colour alone.** A toned component also shows an icon or words. `StatTile` deltas always have
   a glyph. A `Meter` has a label and a spoken value.
10. **One loading voice.** A loading region uses `SkeletonRegion`: one `role="status"`, silent bars. A pending
    button uses `<Button loading>`. Never import a lucide loader (`R-SPINNER`).
11. **Failures never look like "no data".** Use `ErrorState` or `QueryBoundary`. Permission and not-found are
    final and show no retry.
12. **No browser dialogs.** Use `useConfirm()`, never `window.confirm`, `alert` or `prompt` (`R-DIALOG`).
13. **Money is integer cents.** Invalid input is `null`, never 0. Format with `lib/format`, never with `/100`,
    `toFixed` or `toLocaleString` in a component. A hidden amount shows `$••••`.
14. **Theme and brand go on `<html>`.** Dialogs render in a portal under `<body>`, so a `data-brand` or `.dark` on an
    inner element does not reach them.

## Code

15. **TypeScript strict, React 19.** `ref` is a normal prop (no `forwardRef`). No `any`. No
    `dangerouslySetInnerHTML` (`R-HTML`).
16. **One component per file**, PascalCase `.tsx` names (`R-CASING`), 250 lines or less (`R-SIZE`). Every exported
    component has a `/** */` summary (`R-DOC`), with a short example when the use is not obvious.
17. **Pure logic in plain `.ts` files** next to the component (`meterMath.ts`, `confirmRules.ts`), tested without a
    DOM.
18. **Every component is in the catalog** (`R-CATALOG`), and every behaviour has a test. Tests drive the component
    with `userEvent` and find elements by role or label. No snapshot tests, no class-name assertions.
19. **Shared vectors.** A format that Kobo (SwiftUI) also has keeps its cases in `tests/vectors/*.json`, so both
    platforms test against one file.

## Enforcement

`npm run check` runs the type check, `scripts/conformance.mjs` and the tests. `node scripts/conformance.mjs
--self-test` proves that each check finds what it should.

A justified exception carries its reason on the same line or the line above:
`// kobo: allow R-TYPE 16px on small screens stops iOS Safari from zooming on focus`.
