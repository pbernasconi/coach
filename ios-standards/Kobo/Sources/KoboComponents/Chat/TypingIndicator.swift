import KoboTokens
import SwiftUI

/// Three dots that rise in turn while a reply is on its way and no words have arrived yet. With Reduce Motion on (or
/// under `koboFreezesMotion`) the dots hold still. VoiceOver reads "Responding" once, not every frame.
///
///     if isWaitingForFirstWord { TypingIndicator() }
public struct TypingIndicator: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.koboFreezesMotion) private var freezesMotion
    @ScaledMetric(relativeTo: .body) private var dot = Space.sm

    public init() {}

    public var body: some View {
        Group {
            if reduceMotion || freezesMotion {
                dots { _ in (0, ChatMetrics.stillDotOpacity) }
            } else {
                TimelineView(.animation(minimumInterval: nil, paused: false)) { context in
                    let seconds = context.date.timeIntervalSinceReferenceDate
                    dots { TypingDotsMotion.frame(index: $0, at: seconds) }
                }
            }
        }
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement()
        .accessibilityLabel(Text("Responding", bundle: .module))
    }

    private func dots(_ frame: (Int) -> (rise: CGFloat, opacity: Double)) -> some View {
        HStack(spacing: Space.xs) {
            ForEach(0..<3) { index in
                let state = frame(index)
                Circle()
                    .fill(theme.palette.textSecondary)
                    .frame(width: dot, height: dot)
                    .opacity(state.opacity)
                    .offset(y: -state.rise)
            }
        }
    }
}

#if DEBUG
    private struct TypingIndicatorPreview: View {
        @Environment(\.koboTheme) private var theme
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                TypingIndicator()
                TypingIndicator().environment(\.koboFreezesMotion, true)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("TypingIndicator") { TypingIndicatorPreview() }
    #Preview("TypingIndicator · dark") { TypingIndicatorPreview().preferredColorScheme(.dark) }
    #Preview("TypingIndicator · AX3") { TypingIndicatorPreview().dynamicTypeSize(.accessibility3) }
#endif
