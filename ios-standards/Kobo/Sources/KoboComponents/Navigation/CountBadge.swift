import KoboTokens
import SwiftUI

/// A small numeric badge: a capsule with the count, "99+" above the cap, and nothing at zero. Pin it to an icon with
/// `.countBadge(_:)`. VoiceOver reads the count as part of the element it decorates ("3 new").
///
///     Image(systemName: "bell").countBadge(unread)
///     CountBadge(count: 120)  // "99+"
public struct CountBadge: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var minSide = Space.lg + Space.xs
    private let count: Int
    private let cap: Int
    private let tone: Tone

    /// - Parameters:
    ///   - cap: counts above it read "`cap`+".
    ///   - tone: `.danger` for things that need attention, `.accent` for plain counts.
    public init(count: Int, cap: Int = CountBadgeText.defaultCap, tone: Tone = .danger) {
        self.count = count
        self.cap = cap
        self.tone = tone
    }

    public var body: some View {
        if let text = CountBadgeText.label(for: count, cap: cap) {
            Text(verbatim: text)
                .font(theme.font(.caption).weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .foregroundStyle(ink)
                .padding(.horizontal, Space.xs)
                .frame(minWidth: minSide, minHeight: minSide)
                .background(fill, in: Capsule())
                .contentTransition(.numericText(value: Double(min(count, cap + 1))))
                .koboAnimation(.defaultEffects, value: text)
                .accessibilityLabel(Text("\(text) new", bundle: .module))
        }
    }

    private var fill: Color { tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink }
    private var ink: Color { tone == .accent ? theme.palette.onAccent : theme.palette.surface }
}

extension View {
    /// Pins a `CountBadge` to the top trailing corner of this view, and adds the count to its VoiceOver label.
    public func countBadge(_ count: Int, cap: Int = CountBadgeText.defaultCap, tone: Tone = .danger) -> some View {
        overlay(alignment: .topTrailing) {
            CountBadge(count: count, cap: cap, tone: tone)
                .alignmentGuide(.top) { $0[VerticalAlignment.center] }
                .alignmentGuide(.trailing) { $0[HorizontalAlignment.center] }
                .accessibilityHidden(true)
        }
        .accessibilityValue(badgeValue(count, cap: cap))
    }

    private func badgeValue(_ count: Int, cap: Int) -> Text {
        guard let text = CountBadgeText.label(for: count, cap: cap) else { return Text(verbatim: "") }
        return Text("\(text) new", bundle: .module)
    }
}

#if DEBUG
    private struct CountBadgePreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            HStack(spacing: Space.xxl) {
                CountBadge(count: 3)
                CountBadge(count: 42, tone: .accent)
                CountBadge(count: 120)
                Image(systemName: "bell")
                    .accessibilityLabel(Text(verbatim: "Notifications"))
                    .font(theme.font(.title2))
                    .frame(width: Size.minTouch, height: Size.minTouch)
                    .countBadge(7)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Count badge") { CountBadgePreview() }
    #Preview("Count badge · dark, Amber") { CountBadgePreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Count badge · AX3") { CountBadgePreview().dynamicTypeSize(.accessibility3) }
#endif
