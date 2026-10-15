import KoboTokens
import SwiftUI

/// A horizontal row of action chips under a header ("Rename", "Duplicate", "Share", "Delete"). When every chip fits,
/// the row sits centred and does not scroll; otherwise it scrolls sideways at the full width, padded by `margin` at both
/// ends so the first chip lines up with the content. Inside a page gutter (`.pageGutter()`) the scrolling row bleeds to
/// the screen edges. Each chip is a real button; a loading chip spins and ignores taps.
///
///     ActionChipRow([
///         ActionChip(symbol: "pencil", label: String(localized: "Rename"), action: rename),
///         ActionChip(symbol: "trash", label: String(localized: "Delete"), look: .destructive, action: delete),
///     ])
public struct ActionChipRow: View {
    private let chips: [ActionChip]
    private let margin: CGFloat

    /// - Parameter margin: the inset at both ends of a scrolling row; the page gutter by default.
    public init(_ chips: [ActionChip], margin: CGFloat = Space.gutter) {
        self.chips = chips
        self.margin = margin
    }

    public var body: some View {
        ViewThatFits(in: .horizontal) {
            row.frame(maxWidth: .infinity)
            ScrollView(.horizontal) {
                row.padding(.horizontal, margin)
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
            .bleedsPageGutter(margin)
        }
    }

    private var row: some View {
        HStack(spacing: Space.sm) {
            ForEach(chips) { chip in
                ActionChipButton(chip: chip)
            }
        }
    }
}

/// One chip: a capsule with a glyph (or a spinner) and a label, in a 44 pt target.
private struct ActionChipButton: View {
    @Environment(\.koboTheme) private var theme
    let chip: ActionChip

    var body: some View {
        Button {
            chip.action()
        } label: {
            HStack(spacing: Space.xs) {
                ZStack {
                    Image(systemName: chip.symbol).opacity(chip.isLoading ? 0 : 1)
                    if chip.isLoading { ProgressView().controlSize(.small).tint(ink) }
                }
                .accessibilityHidden(true)
                Text(verbatim: chip.label).lineLimit(1)
            }
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(ink)
            .padding(.horizontal, Space.md)
            .frame(minHeight: Size.buttonHeightCompact)
            .background(fill, in: Capsule())
            .frame(minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .allowsHitTesting(!chip.isLoading)
        .accessibilityValue(chip.isLoading ? Text("In progress", bundle: .module) : Text(verbatim: ""))
    }

    private var fill: Color {
        switch chip.look {
        case .tonal: theme.palette.accentSoft
        case .filled: theme.palette.accent
        case .destructive: theme.palette.danger.soft
        }
    }

    private var ink: Color {
        switch chip.look {
        case .tonal: theme.palette.accentText
        case .filled: theme.palette.onAccent
        case .destructive: theme.palette.danger.ink
        }
    }
}

#if DEBUG
    private struct ActionChipRowPreview: View {
        var body: some View {
            VStack(spacing: Space.xl) {
                ActionChipRow([
                    ActionChip(symbol: "pencil", label: "Rename") {},
                    ActionChip(symbol: "plus.square.on.square", label: "Duplicate") {},
                    ActionChip(symbol: "square.and.arrow.up", label: "Share") {},
                    ActionChip(symbol: "calendar", label: "Reschedule", isLoading: true) {},
                    ActionChip(symbol: "trash", label: "Delete", look: .destructive) {},
                ])
                ActionChipRow([
                    ActionChip(symbol: "play.fill", label: "Resume", look: .filled) {},
                    ActionChip(symbol: "xmark", label: "End", look: .destructive) {},
                ])
            }
            .padding(.vertical, Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Action chip row") { ActionChipRowPreview() }
    #Preview("Action chip row · dark, Lift") { ActionChipRowPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Action chip row · AX3") { ActionChipRowPreview().dynamicTypeSize(.accessibility3) }
#endif
