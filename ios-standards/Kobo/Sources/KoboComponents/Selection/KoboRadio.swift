import KoboTokens
import SwiftUI

/// One radio choice on its own: the disc and its label as one target, for a short inline choice ("kg" or "lb") laid
/// out by the caller. A tap calls `action`; the caller sets the selection. VoiceOver reads the label with the selected
/// trait. For a list of choices use `RadioGroup` (or `RadioRow` rows in a `ListSection`).
///
///     HStack { KoboRadio("kg", isSelected: unit == .kg) { unit = .kg }; KoboRadio("lb", isSelected: unit == .lb) { unit = .lb } }
///     KoboRadio(verbatim: template.name, isSelected: template.id == chosen) { chosen = template.id }
public struct KoboRadio: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @State private var taps = 0
    private let title: Text?
    private let accessibilityLabel: Text?
    private let isSelected: Bool
    private let action: () -> Void

    /// A radio choice with a localized label.
    public init(_ title: LocalizedStringKey, isSelected: Bool, action: @escaping () -> Void) {
        self.init(title: Text(title), accessibilityLabel: nil, isSelected: isSelected, action: action)
    }

    /// A radio choice whose label is shown as is (a template name).
    public init(verbatim title: String, isSelected: Bool, action: @escaping () -> Void) {
        self.init(title: Text(verbatim: title), accessibilityLabel: nil, isSelected: isSelected, action: action)
    }

    /// A bare disc with no visible label, named for VoiceOver.
    public init(isSelected: Bool, accessibilityLabel: LocalizedStringKey, action: @escaping () -> Void) {
        self.init(title: nil, accessibilityLabel: Text(accessibilityLabel), isSelected: isSelected, action: action)
    }

    private init(title: Text?, accessibilityLabel: Text?, isSelected: Bool, action: @escaping () -> Void) {
        self.title = title
        self.accessibilityLabel = accessibilityLabel
        self.isSelected = isSelected
        self.action = action
    }

    public var body: some View {
        Button(action: tap) {
            HStack(alignment: .top, spacing: Space.md) {
                RadioDisc(isSelected: isSelected)
                if let title {
                    title
                        .font(theme.font(.body))
                        .foregroundStyle(isEnabled ? theme.palette.textPrimary : theme.palette.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, Space.sm)
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title ?? accessibilityLabel ?? Text(verbatim: ""))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .koboFeedback(.selection, trigger: taps)
    }

    /// Only a tap that changes the choice plays the selection haptic.
    private func tap() {
        if !isSelected { taps += 1 }
        action()
    }
}

#if DEBUG
    private struct KoboRadioGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var unit = "kg"
        @State private var side = "both"

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(spacing: Space.xl) {
                    KoboRadio(verbatim: "kg", isSelected: unit == "kg") { unit = "kg" }
                    KoboRadio(verbatim: "lb", isSelected: unit == "lb") { unit = "lb" }
                }
                VStack(alignment: .leading, spacing: 0) {
                    KoboRadio("Both sides", isSelected: side == "both") { side = "both" }
                    KoboRadio("Left side first, then the right side after a short rest", isSelected: side == "left") {
                        side = "left"
                    }
                    KoboRadio("One side only", isSelected: false) {}.disabled(true)
                }
                KoboRadio(isSelected: side == "both", accessibilityLabel: "Use both sides") { side = "both" }
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Radio") { KoboRadioGallery() }
    #Preview("Radio · dark, Lift") { KoboRadioGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Radio · AX3") { KoboRadioGallery().dynamicTypeSize(.accessibility3) }
#endif
