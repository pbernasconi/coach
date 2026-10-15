import KoboComponents
import KoboTokens
import SwiftUI

/// The glyph over an outcome: a soft halo in the tone's fill, a disc in the tone's ink, and a glyph on the disc, so the
/// outcome reads at a glance; the title says it in words too. A success draws its check stroke by stroke; a pending
/// outcome spins in the disc. Decorative: VoiceOver reads the title.
struct OutcomeHero: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var scaledHalo = Size.thumbnail * 2
    let phase: OutcomePhase
    let symbol: String?
    /// False before the entrance: the halo and the disc start small and clear.
    let isShown: Bool
    /// False before the check draws itself.
    let isDrawn: Bool

    var body: some View {
        let colors = theme.palette.status(phase.tone)
        ZStack {
            Circle()
                .fill(colors.soft)
                .scaleEffect(scale(OutcomeEntrance.haloStartScale))
                .opacity(OutcomeEntrance.opacity(isShown: isShown))
                .animation(animation(delay: 0), value: isShown)
            glyph
                .foregroundStyle(theme.palette.surface)
                .frame(width: disc, height: disc)
                .background(colors.ink, in: Circle())
                .scaleEffect(scale(OutcomeEntrance.discStartScale))
                .opacity(OutcomeEntrance.opacity(isShown: isShown))
                .animation(animation(delay: OutcomeEntrance.discDelay), value: isShown)
        }
        .frame(width: halo, height: halo)
        .accessibilityHidden(true)
    }

    /// The halo grows with Dynamic Type, up to one and a half times its default size.
    private var halo: CGFloat { min(scaledHalo, Size.thumbnail * 3) }
    private var disc: CGFloat { OutcomeHeroMetrics.disc(halo: halo) }

    @ViewBuilder private var glyph: some View {
        if phase == .success && symbol == nil {
            let side = OutcomeHeroMetrics.check(halo: halo)
            OutcomeCheck()
                .trim(from: 0, to: OutcomeEntrance.drawn(isDrawn: isDrawn, reduceMotion: reduceMotion))
                .stroke(
                    style: StrokeStyle(
                        lineWidth: OutcomeHeroMetrics.checkLineWidth(checkSide: side),
                        lineCap: .round,
                        lineJoin: .round
                    )
                )
                .frame(width: side, height: side)
                .animation(animation(delay: OutcomeEntrance.drawDelay), value: isDrawn)
        } else if phase == .pending {
            ProgressView().tint(theme.palette.surface).controlSize(.large)
        } else {
            Image(systemName: symbol ?? phase.symbol)
                .font(.system(size: OutcomeHeroMetrics.glyph(halo: halo), weight: .bold))
                .accessibilityHidden(true)
        }
    }

    private func scale(_ start: Double) -> CGFloat {
        OutcomeEntrance.scale(from: start, isShown: isShown, reduceMotion: reduceMotion)
    }

    private func animation(delay: TimeInterval) -> Animation? {
        Motion.present.animation(reduceMotion: reduceMotion)?.delay(delay)
    }
}
