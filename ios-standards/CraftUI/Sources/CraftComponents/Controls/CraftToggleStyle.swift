import CraftTokens
import SwiftUI

/// An iOS-style switch drawn from the theme: the track fills with the accent when on and the knob slides on
/// `Motion.snappy`. The whole label is the target, so a row toggles wherever it is tapped. It plays the toggle haptic.
///
///     Toggle("Auto-start rest timer", isOn: $autoRest).toggleStyle(.craft)
public struct CraftToggleStyle: ToggleStyle {
    @Environment(\.craftTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(spacing: Space.md) {
                configuration.label
                    .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                SwitchTrack(isOn: configuration.isOn)
            }
        }
        .buttonStyle(PressFeedbackStyle(.highlight))
        .accessibilityValue(configuration.isOn ? Text("On", bundle: .module) : Text("Off", bundle: .module))
        .accessibilityAddTraits(Self.toggleTrait)
        .craftFeedback(trigger: configuration.isOn) { _, isOn in HapticFeedback.toggle(isOn) }
    }

    /// The switch trait where the platform has it.
    private static var toggleTrait: AccessibilityTraits {
        #if os(iOS)
            .isToggle
        #else
            .isButton
        #endif
    }
}

extension ToggleStyle where Self == CraftToggleStyle {
    /// The CraftUI switch. See `CraftToggleStyle`.
    public static var craft: CraftToggleStyle { CraftToggleStyle() }
}

/// The switch itself: a capsule track and a round knob, sized like the system switch.
private struct SwitchTrack: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.colorScheme) private var colorScheme
    let isOn: Bool

    /// System switch geometry (51 × 31 with a 2pt inset knob): maths inside a shape.
    private enum Metrics {
        static let width: CGFloat = 51
        static let height: CGFloat = 31
        static let inset: CGFloat = 2
        static var knob: CGFloat { height - inset * 2 }
    }

    var body: some View {
        Capsule()
            .fill(trackFill)
            .frame(width: Metrics.width, height: Metrics.height)
            .overlay(alignment: isOn ? .trailing : .leading) {
                Circle()
                    .fill(knobFill)
                    .shadow(color: theme.palette.scrim, radius: Space.xxs, y: Space.xxs / 2)
                    .frame(width: Metrics.knob, height: Metrics.knob)
                    .padding(Metrics.inset)
            }
            .craftAnimation(.snappy, value: isOn)
            .accessibilityHidden(true)
    }

    private var trackFill: Color {
        switch (isOn, isEnabled) {
        case (true, true): theme.palette.accent
        case (true, false): theme.palette.accentSoft
        case (false, true): theme.palette.surfaceSunken
        case (false, false): theme.palette.surfaceRaised
        }
    }

    /// The knob stays light in both appearances, like the system switch.
    private var knobFill: Color {
        colorScheme == .dark ? theme.palette.textPrimary : theme.palette.surface
    }
}

#if DEBUG
    private struct CraftToggleGallery: View {
        @Environment(\.craftTheme) private var theme
        @State private var autoRest = true
        @State private var sounds = false

        var body: some View {
            VStack(spacing: Space.md) {
                Toggle("Auto-start rest timer", isOn: $autoRest)
                Toggle("Sounds", isOn: $sounds)
                Toggle("Locked", isOn: .constant(true)).disabled(true)
            }
            .toggleStyle(.craft)
            .font(theme.font(.body))
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Toggle style") { CraftToggleGallery() }
    #Preview("Toggle style · dark, Lift") { CraftToggleGallery().craftTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Toggle style · AX3") { CraftToggleGallery().dynamicTypeSize(.accessibility3) }
#endif
