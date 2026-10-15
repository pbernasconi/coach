import KoboTokens
import SwiftUI

/// A labelled value that copies on a tap (a member number, an invite code), and for a sensitive one a mask with a
/// reveal toggle. A tap on the value copies the whole value, masked or not, with the `tapToCopy` feedback; a value
/// the user may not copy (`value: nil`) shows only its mask. Stacked puts the label over the value; row puts them on
/// one line, like a `KeyValueRow`, and stacks at accessibility sizes.
///
///     CopyableValue("Member number", value: "0042 7781 3390", what: "member number")
///     CopyableValue("Recovery code", value: code, maskedValue: "•••• 7781", revealable: true, layout: .row)
public struct CopyableValue: View {
    /// Where the label sits.
    public enum Layout: Sendable, Hashable {
        /// The label over the value.
        case stacked
        /// The label leading and the value trailing, stacked at accessibility sizes.
        case row
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isRevealed = false
    private var label: Text
    private let value: String?
    private let maskedValue: String?
    private let revealable: Bool
    private let what: LocalizedStringResource?
    private let layout: Layout

    /// - Parameters:
    ///   - value: the full value, or `nil` when the user may not see or copy it.
    ///   - maskedValue: what shows until revealed ("•••• 7781").
    ///   - revealable: adds the eye toggle; needs both a value and a mask.
    ///   - what: names the value for the copy confirmation and VoiceOver.
    public init(
        _ label: LocalizedStringKey,
        value: String?,
        maskedValue: String? = nil,
        revealable: Bool = false,
        what: LocalizedStringResource? = nil,
        layout: Layout = .stacked
    ) {
        self.label = Text(label)
        self.value = value
        self.maskedValue = maskedValue
        self.revealable = revealable
        self.what = what
        self.layout = layout
    }

    /// A value whose label is shown as is (a user-defined field).
    public init(
        verbatim label: String,
        value: String?,
        maskedValue: String? = nil,
        revealable: Bool = false,
        what: LocalizedStringResource? = nil,
        layout: Layout = .stacked
    ) {
        self.init("", value: value, maskedValue: maskedValue, revealable: revealable, what: what, layout: layout)
        self.label = Text(verbatim: label)
    }

    public var body: some View {
        switch (layout, dynamicTypeSize.isAccessibilitySize) {
        case (.row, false):
            HStack(alignment: .firstTextBaseline, spacing: Space.md) {
                labelText.frame(maxWidth: .infinity, alignment: .leading)
                valueLine
            }
        default:
            VStack(alignment: .leading, spacing: Space.xxs) {
                labelText
                valueLine.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// The visible label; the value speaks it, so VoiceOver skips it here.
    private var labelText: some View {
        label
            .font(layout == .row ? theme.font(.body) : theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .accessibilityHidden(true)
    }

    private var valueLine: some View {
        let shown = CopyRules.displayed(value: value, maskedValue: maskedValue, revealed: isRevealed) ?? ""
        return HStack(spacing: Space.md) {
            Text(verbatim: shown)
                .font(theme.font(.numeric))
                .foregroundStyle(theme.palette.textPrimary)
                .contentTransition(.numericText())
                .privacySensitive()
                .accessibilityLabel(label)
                .accessibilityValue(Text(verbatim: shown))
                .tapToCopy(value, what: what)
            if CopyRules.canReveal(value: value, maskedValue: maskedValue, revealable: revealable) {
                RevealToggle(
                    isRevealed: isRevealed,
                    showLabel: Text("Show value", bundle: .module),
                    hideLabel: Text("Hide value", bundle: .module)
                ) {
                    withKoboAnimation(.defaultSpatial, reduceMotion: reduceMotion) { isRevealed.toggle() }
                }
                .padding(.vertical, -Space.md)
            }
        }
    }
}

#if DEBUG
    private struct CopyableValueGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.lg) {
                    CopyableValue("Member number", value: "0042 7781 3390", what: "member number")
                    CopyableValue(
                        "Recovery code",
                        value: "K7Q2-PX9M-4TRA",
                        maskedValue: "•••• 4TRA",
                        revealable: true,
                        what: "recovery code"
                    )
                    CopyableValue("Recovery code", value: nil, maskedValue: "•••• 4TRA")
                    CopyableValue("Invite code", value: "K7Q2PX", what: "invite code", layout: .row)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Copyable value") { CopyableValueGallery() }
    #Preview("Copyable value · dark, Amber") { CopyableValueGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Copyable value · AX3") { CopyableValueGallery().dynamicTypeSize(.accessibility3) }
#endif
