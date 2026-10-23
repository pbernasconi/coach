import KoboComponents
import KoboTokens
import SwiftUI

/// A vital's range bar: a thin track from `min` to `max`, the normal range shaded, and a tick at the value, red when the
/// value is off. Decorative: the tile around it reads the value and its status.
struct TodayRangeBar: View {
    @Environment(\.koboTheme) private var theme
    let range: HealthRangeBar
    let isOff: Bool

    var body: some View {
        let scale = TodayRangeScale(range)
        GeometryReader { geometry in
            let width = geometry.size.width
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(theme.palette.surfaceSunken)
                    .frame(height: Space.xs)
                Capsule()
                    .fill(theme.palette.success.soft)
                    .frame(width: max(width * (scale.high - scale.low), Space.xs), height: Space.xs)
                    .offset(x: width * scale.low)
                Capsule()
                    .fill(isOff ? theme.palette.danger.ink : theme.palette.textPrimary)
                    .frame(width: Space.xxs, height: Space.md)
                    .offset(x: min(max(width * scale.value - Space.xxs / 2, 0), width - Space.xxs))
            }
            .frame(height: Space.md)
        }
        .frame(height: Space.md)
        .accessibilityHidden(true)
    }
}

/// Where the band's edges and the value sit on the track, as fractions 0…1 (clamped).
nonisolated struct TodayRangeScale: Equatable {
    let low: Double
    let high: Double
    let value: Double

    init(_ range: HealthRangeBar) {
        let span = range.max - range.min
        func fraction(_ x: Double) -> Double {
            guard span > 0, x.isFinite else { return 0.5 }
            return Swift.min(Swift.max((x - range.min) / span, 0), 1)
        }
        low = fraction(range.low)
        high = Swift.max(fraction(range.high), low)
        value = fraction(range.value)
    }
}
