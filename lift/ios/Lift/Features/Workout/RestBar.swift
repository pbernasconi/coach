import KoboComponents
import KoboTokens
import SwiftUI

/// The rest countdown pinned under the Workout screen after a set is logged: the set it follows, time left, a bar,
/// +30s and Skip. It only draws; the ViewModel owns the clock. Tapping the set's name scrolls back to that set.
///
/// It floats on its own opaque panel, like a mini player above the tab bar, so the sets scrolling under it never show
/// through: the screen's footer is glass-style (no panel of its own), and the sets behind are busy.
struct RestBar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let rest: RestTimer
    /// "Back squat · Set 2"; nil when the set is not on the page.
    let setLabel: String?
    let onFocus: () -> Void
    let onExtend: () -> Void
    let onSkip: () -> Void

    /// The last seconds turn the clock amber, a glanceable cue that the next set is up.
    private static let finalSeconds = 10

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            layout {
                Button(action: onFocus) { clock }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityHint(Text("Scrolls to the set"))
                HStack(spacing: Space.sm) {
                    Button("+30s", action: onExtend)
                        .buttonStyle(.kobo(.secondary, size: .compact))
                        .accessibilityLabel(Text("Add 30 seconds"))
                    Button("Skip", action: onSkip)
                        .buttonStyle(.kobo(.tonal, size: .compact))
                        .accessibilityLabel(Text("Skip rest"))
                }
            }
            InlineProgress(value: Double(rest.elapsed), total: Double(rest.total), accessibilityLabel: "Rest")
        }
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.md)
        .background { RestBarPanel() }
    }

    /// The set the rest follows ("Back squat · Set 2") over "Rest 1:30 of 2:00": the time left large, the whole rest
    /// quieter beside it. The whole block is one tap target that scrolls back to the set.
    private var clock: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if let setLabel {
                Text(verbatim: setLabel)
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.accentText)
                    .lineLimit(1)
            }
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text("Rest")
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: rest.clockText)
                    .font(theme.font(.title).weight(.semibold).monospacedDigit())
                    .foregroundStyle(isFinalStretch ? theme.palette.accentText : theme.palette.textPrimary)
                    .contentTransition(.numericText(value: Double(rest.remaining)))
                    .koboAnimation(.state, value: rest.remaining)
                Text("of \(rest.totalText)")
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .lineLimit(1)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: spokenClock))
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// "Back squat, Set 2. 75 of 120 seconds of rest left."
    private var spokenClock: String {
        let left = String(localized: "\(rest.remaining) of \(rest.total) seconds of rest left")
        guard let setLabel else { return left }
        return "\(setLabel.replacingOccurrences(of: " · ", with: ", ")). \(left)"
    }

    private var isFinalStretch: Bool { rest.remaining <= Self.finalSeconds }

    /// Side by side, or stacked at accessibility sizes so nothing truncates.
    private var layout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
            : AnyLayout(HStackLayout(spacing: Space.md))
    }
}

/// The rest bar's opaque, raised panel. Light mode: a white card with a soft shadow over the grey canvas. Dark mode:
/// the raised grey, a tone above the set cards, since a shadow does not read on black. A hairline edges both.
private struct RestBarPanel: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
        shape
            .fill(colorScheme == .dark ? theme.palette.surfaceRaised : theme.palette.surface)
            .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
            .shadow(color: theme.palette.scrim, radius: Space.lg, y: Space.xs)
    }
}

#if DEBUG
    private struct RestBarPreview: View {
        let rest: RestTimer

        var body: some View {
            ScrollView {
                VStack(spacing: Space.md) {
                    ForEach(1..<16) { index in
                        Text(verbatim: "Set \(index)    245 lb × 5")
                            .koboCard()
                    }
                }
                .pageGutter()
            }
            .background(Theme.lift.palette.canvas)
            .pinnedFooter(style: .glass) {
                RestBar(rest: rest, setLabel: "Back squat · Set 2", onFocus: {}, onExtend: {}, onSkip: {})
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Light") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)) }
    #Preview("Dark") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)).preferredColorScheme(.dark) }
    #Preview("Final seconds") { RestBarPreview(rest: RestTimer(run: 1, seconds: 8)) }
    #Preview("AX3") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)).dynamicTypeSize(.accessibility3) }
#endif
