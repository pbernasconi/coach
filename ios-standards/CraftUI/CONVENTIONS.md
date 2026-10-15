# CraftUI conventions

Every component in CraftUI follows these rules. They are what make the library reusable across apps.

## API shape

1. **Data in, intents out.** A component takes plain values and closures (`title: String`,
   `action: () -> Void`, `value: Binding<Int>`). It never takes an app model, a ViewModel or a repository.
2. **Theme from the environment.** Read `@Environment(\.craftTheme) private var theme` and use
   `theme.palette.<role>`, `theme.font(.<role>)`, `Space`, `Radius`, `Size`, `Motion`. **No literal colours,
   font sizes or magic numbers.** The only exceptions are hairlines and maths inside a shape.
3. **Style protocols over flags.** Buttons, toggles and labels customise through SwiftUI style protocols
   (`ButtonStyle`, `ToggleStyle`, `LabelStyle`) with static accessors (`.buttonStyle(.craft(.primary))`),
   so system controls keep their accessibility and behaviour. Enum parameters (`variant:`, `size:`,
   `tone:`) are fine for visual choices; Boolean flags that combine into impossible states are not.
4. **Slots via `@ViewBuilder`.** Where content varies (leading icon, trailing accessory, footer), take a
   `@ViewBuilder` closure with a sensible `EmptyView` default overload, rather than adding parameters.
5. **Composable modifiers.** Cross-cutting behaviour is a `View` extension (`.craftCard()`, `.shimmering()`,
   `.shake(trigger:)`, `.pressFeedback()`), so it works on any view, not only ours.
6. **Generic, not domain.** Name things for what they are (`CountdownRing`, `StepperField`, `DayStrip`),
   never for one app (`RestTimer`, `SetRow`). Domain composites belong in the app.

## Behaviour

7. **Motion only through `Motion`.** Use `.craftAnimation(_:value:)`, `withCraftAnimation`, or a
   `Motion` transition, all of which respect Reduce Motion. No raw `.animation(.spring(...))`.
8. **Accessibility is part of the component.** Tappable things are `Button`s (never `.onTapGesture`).
   Touch targets are at least `Size.minTouch`. Composite rows read as one element
   (`.accessibilityElement(children: .combine)`) with a useful label. Section titles get `.isHeader`.
   Icon-only buttons take a required `accessibilityLabel`. Values (steppers, rings, timers) expose
   `accessibilityValue` and adjustable actions where it makes sense.
9. **Dynamic Type everywhere.** No fixed heights on text containers. Use `@ScaledMetric` for
   icon sizes and paddings that should grow with text. Every component must work at AX3.
10. **Status never by colour alone.** Toned components pair colour with an icon or text.
11. **Haptics through `HapticFeedback`.** Components that confirm something accept an optional
    feedback and use `.sensoryFeedback`, not UIKit generators.

## Code

12. **Swift 6, MainActor by default** (the package sets this). No `Task.detached`, GCD, `AnyView`,
    `print`, `try!`, singletons or `@unchecked Sendable`. Time-based components take
    `Date` targets (e.g. `Text(timerInterval:)`) or values from the caller; they never read the clock in
    logic.
13. **One component per file**, ≤ 250 lines, `body` ≤ 80 lines. Public API documented with a one-line
    `///` summary and a short usage example for anything non-obvious.
14. **Every component ships previews**: a `#Preview` covering its variants, light and dark, plus one at
    `.accessibility3`. The catalog (`CraftCatalog`) lists every component.
15. **Pure logic is separated and testable.** Formatting, clamping, layout maths and state machines live
    in small internal functions or types that tests can call without rendering.
