import KoboTokens
import SwiftUI

/// The drawn box of a checkbox: a rounded square with a rim when off, the accent fill with a check when on, and the
/// accent fill with a dash when mixed, so the state never rests on colour alone. The fill changes on `Motion.state`
/// and the glyph pops in on `Motion.snappy`. Decorative: the control that holds it speaks the state
/// (`CheckboxSpeech`).
struct CheckboxBox: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var side = Size.iconLg
    let state: CheckboxState

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.xs, style: .continuous)
        ZStack {
            shape.fill(fill)
            shape.strokeBorder(rim, lineWidth: state == .unchecked ? Space.xxs : 0)
            Image(systemName: state == .mixed ? "minus" : "checkmark")
                .font(theme.font(.footnote).weight(.bold))
                .foregroundStyle(isEnabled ? theme.palette.onAccent : theme.palette.textTertiary)
                .scaleEffect(state == .unchecked ? CheckboxBox.hiddenGlyphScale : 1)
                .opacity(state == .unchecked ? 0 : 1)
                .koboAnimation(.snappy, value: state)
        }
        .frame(width: side, height: side)
        .koboAnimation(.state, value: state)
        .accessibilityHidden(true)
    }

    /// The glyph grows from half size as the box turns on.
    static let hiddenGlyphScale: CGFloat = 0.5

    private var fill: Color {
        switch (state, isEnabled) {
        case (.unchecked, true): theme.palette.surface
        case (.unchecked, false): theme.palette.surfaceRaised
        case (_, true): theme.palette.accent
        case (_, false): theme.palette.accentSoft
        }
    }

    /// The resting rim is the secondary ink, which keeps 3:1 against the surface; a disabled rim fades to a hairline
    /// tone.
    private var rim: Color {
        isEnabled ? theme.palette.textSecondary : theme.palette.separator
    }
}

/// How a checkbox speaks its state: "Checked", "Not checked" or "Mixed".
enum CheckboxSpeech {
    static func value(_ state: CheckboxState) -> Text {
        switch state {
        case .checked: Text("Checked", bundle: .module)
        case .unchecked: Text("Not checked", bundle: .module)
        case .mixed: Text("Mixed", bundle: .module)
        }
    }

    /// The selected trait for a checked box, so VoiceOver and Switch Control see the state as well as hear it.
    static func traits(_ state: CheckboxState) -> AccessibilityTraits {
        state == .checked ? .isSelected : []
    }
}

/// The box and its label as one target, shared by `KoboCheckbox` and `KoboCheckboxStyle`: the whole label taps, the
/// target is at least 44pt, multi-line labels wrap beside the box, and a tap plays one toggle haptic.
struct CheckboxControl<Label: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @State private var taps = 0
    @State private var tappedOn = false
    private let state: CheckboxState
    private let accessibilityLabel: Text?
    private let toggle: () -> Void
    private let label: Label

    init(
        state: CheckboxState,
        accessibilityLabel: Text?,
        toggle: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.state = state
        self.accessibilityLabel = accessibilityLabel
        self.toggle = toggle
        self.label = label()
    }

    var body: some View {
        Button(action: tap) {
            HStack(alignment: .top, spacing: Space.md) {
                CheckboxBox(state: state)
                if Label.self != EmptyView.self {
                    label
                        .font(theme.font(.body))
                        .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.vertical, Space.sm)
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .modifier(CheckboxAccessibilityLabel(label: accessibilityLabel))
        .accessibilityValue(CheckboxSpeech.value(state))
        .accessibilityAddTraits(CheckboxSpeech.traits(state))
        .koboFeedback(trigger: taps) { [tappedOn] _, _ in HapticFeedback.toggle(tappedOn) }
    }

    /// The haptic plays at the tap with the new value, not when the binding changes, so a value set in code is silent.
    private func tap() {
        tappedOn = !state.isOn
        taps += 1
        toggle()
    }
}

/// Replaces the combined label only when the caller named the control (a bare box).
private struct CheckboxAccessibilityLabel: ViewModifier {
    let label: Text?

    func body(content: Content) -> some View {
        if let label {
            content.accessibilityLabel(label)
        } else {
            content
        }
    }
}
