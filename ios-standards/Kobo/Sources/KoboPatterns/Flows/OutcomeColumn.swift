import KoboComponents
import KoboTokens
import SwiftUI

/// The settled or pending outcome itself: the hero, the title (focused for VoiceOver), the detail, the facts and the
/// caller's extra content, centred in a scrolling column.
struct OutcomeColumn<Extra: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let phase: OutcomePhase
    let symbol: String?
    let title: Text
    let detail: Text?
    let facts: [OutcomeFact]
    let isRevealed: Bool
    let isDrawn: Bool
    let showsContent: Bool
    let titleFocus: AccessibilityFocusState<Bool>.Binding
    let extra: Extra

    var body: some View {
        VStack(spacing: Space.xxl) {
            VStack(spacing: Space.md) {
                OutcomeHero(phase: phase, symbol: symbol, isShown: isRevealed, isDrawn: isDrawn)
                    .padding(.bottom, Space.xs)
                VStack(spacing: Space.sm) {
                    title
                        .font(theme.font(.title))
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityFocused(titleFocus)
                    if let detail {
                        detail
                            .font(theme.font(.body))
                            .foregroundStyle(theme.palette.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .multilineTextAlignment(.center)
                .entrance(isShown: showsContent, reduceMotion: reduceMotion)
            }
            if !facts.isEmpty {
                OutcomeFactsCard(facts: facts).entrance(isShown: showsContent, reduceMotion: reduceMotion)
            }
            extra.entrance(isShown: showsContent, reduceMotion: reduceMotion)
        }
        .pageGutter()
        .padding(.vertical, Space.xxl)
        .frame(maxWidth: .infinity)
    }
}

extension View {
    /// The words and facts fade in from almost full size, after the check starts.
    fileprivate func entrance(isShown: Bool, reduceMotion: Bool) -> some View {
        scaleEffect(
            OutcomeEntrance.scale(from: OutcomeEntrance.contentStartScale, isShown: isShown, reduceMotion: reduceMotion)
        )
        .opacity(OutcomeEntrance.opacity(isShown: isShown))
        .animation(
            Motion.present.animation(reduceMotion: reduceMotion)?.delay(OutcomeEntrance.contentDelay),
            value: isShown
        )
    }
}
