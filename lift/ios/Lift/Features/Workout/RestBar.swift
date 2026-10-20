import KoboComponents
import KoboTokens
import SwiftUI

/// The rest countdown pinned under the Workout screen after a set is logged: time left, a bar, +30s and Skip.
/// It only draws; the ViewModel owns the clock.
///
/// It floats on its own opaque panel, like a mini player above the tab bar, so the sets scrolling under it never show
/// through: the screen's footer is glass-style (no panel of its own), and the sets behind are busy.
struct RestBar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let rest: RestTimer
    let onExtend: () -> Void
    let onSkip: () -> Void

    /// The last seconds turn the clock amber, a glanceable cue that the next set is up.
    private static let finalSeconds = 10

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            layout {
                clock
                    .frame(maxWidth: .infinity, alignment: .leading)
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

    /// "Rest 1:30 of 2:00": the time left large, its label and the whole rest quieter beside it.
    private var clock: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Text("Rest")
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            Text(verbatim: rest.clockText)
                .font(theme.font(.title).weight(.semibold).monospacedDigit())
                .foregroundStyle(isFinalStretch ? theme.palette.accentText : theme.palette.textPrimary)
                .contentTransition(.numericText(countsDown: true))
                .koboAnimation(.state, value: rest.remaining)
                .accessibilityLabel(Text("\(rest.remaining) seconds left"))
            Text("of \(rest.totalText)")
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityHidden(true)
        }
        .lineLimit(1)
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
            .pinnedFooter(style: .glass) { RestBar(rest: rest, onExtend: {}, onSkip: {}) }
            .koboTheme(.lift)
        }
    }

    #Preview("Light") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)) }
    #Preview("Dark") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)).preferredColorScheme(.dark) }
    #Preview("Final seconds") { RestBarPreview(rest: RestTimer(run: 1, seconds: 8)) }
    #Preview("AX3") { RestBarPreview(rest: RestTimer(run: 1, seconds: 90)).dynamicTypeSize(.accessibility3) }
#endif
