import KoboTokens
import SwiftUI

/// The assistant is working on a reply: three dots that brighten in turn, with an optional status line beside them
/// ("Reading your calendar"). With Reduce Motion the dots stand still. VoiceOver reads "Responding" and the status.
///
///     ChatTypingIndicator()
///     ChatTypingIndicator(verbatim: "Checking the forecast")
public struct ChatTypingIndicator: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var dot = Space.sm
    private let status: String?

    /// Dots, and the status text when there is one.
    public init(verbatim status: String? = nil) {
        self.status = status
    }

    public var body: some View {
        HStack(spacing: Space.sm) {
            dots
            if let status {
                Text(verbatim: status)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .contentTransition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
        .koboAnimation(.defaultEffects, value: status)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Responding", bundle: .module))
        .accessibilityValue(status.map { Text(verbatim: $0) } ?? Text(verbatim: ""))
    }

    @ViewBuilder
    private var dots: some View {
        if reduceMotion {
            dotRow(Array(repeating: 0.6, count: ChatTypingDots.count))
        } else {
            TimelineView(.animation(minimumInterval: nil, paused: false)) { context in
                let time = context.date.timeIntervalSinceReferenceDate
                dotRow((0..<ChatTypingDots.count).map { ChatTypingDots.opacity(dot: $0, at: time) })
            }
        }
    }

    private func dotRow(_ opacities: [Double]) -> some View {
        HStack(spacing: Space.xs) {
            ForEach(Array(opacities.enumerated()), id: \.offset) { _, opacity in
                Circle()
                    .fill(theme.palette.textSecondary)
                    .frame(width: dot, height: dot)
                    .opacity(opacity)
            }
        }
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.sm + Space.xxs)
        .background(theme.palette.surfaceSunken, in: Capsule())
    }
}

#if DEBUG
    private struct ChatTypingIndicatorPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                ChatTypingIndicator()
                ChatTypingIndicator(verbatim: "Reading your calendar")
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Typing indicator") { ChatTypingIndicatorPreview() }
    #Preview("Typing indicator · dark") { ChatTypingIndicatorPreview().preferredColorScheme(.dark) }
    #Preview("Typing indicator · AX3") { ChatTypingIndicatorPreview().dynamicTypeSize(.accessibility3) }
#endif
