import Foundation

/// The one-time entrance of a settled outcome: the halo fades in, the disc settles from a little smaller, the check
/// draws itself, and the words and facts fade in from almost full size, nearly together. No overshoot on content and
/// no confetti. With Reduce Motion nothing scales or draws: everything is simply there (a short fade at most). With
/// VoiceOver on, the words never wait for a fade, so focus lands on the title at once.
nonisolated enum OutcomeEntrance {
    /// The scale the halo starts from.
    static let haloStartScale: Double = 0.96
    /// The scale the disc starts from.
    static let discStartScale: Double = 0.9
    /// The scale the words and the facts start from.
    static let contentStartScale: Double = 0.98
    /// The disc starts a little after the halo.
    static let discDelay: TimeInterval = 0.04
    /// The check starts to draw while the disc settles.
    static let drawDelay: TimeInterval = 0.13
    /// The words and the facts start after the check.
    static let contentDelay: TimeInterval = 0.17

    /// The scale of a part. Reduce Motion never scales.
    static func scale(from start: Double, isShown: Bool, reduceMotion: Bool) -> Double {
        isShown || reduceMotion ? 1 : start
    }

    /// The opacity of a part.
    static func opacity(isShown: Bool) -> Double {
        isShown ? 1 : 0
    }

    /// How much of the check stroke shows. Reduce Motion never draws: the check is whole.
    static func drawn(isDrawn: Bool, reduceMotion: Bool) -> Double {
        isDrawn || reduceMotion ? 1 : 0
    }

    /// The words show at once for VoiceOver, so focus never lands on an invisible title.
    static func showsContent(isRevealed: Bool, voiceOver: Bool) -> Bool {
        isRevealed || voiceOver
    }
}

/// The geometry of the hero: a soft halo, a filled disc inside it, and a glyph or drawn check inside the disc. The
/// sizes derive from one diameter, so `@ScaledMetric` can grow the whole hero with Dynamic Type.
nonisolated enum OutcomeHeroMetrics {
    /// The disc's share of the halo diameter.
    static let discShare: Double = 0.64
    /// The glyph's share of the disc diameter.
    static let glyphShare: Double = 0.5
    /// The drawn check's share of the disc diameter.
    static let checkShare: Double = 0.56
    /// The check stroke on its 24-unit grid.
    static let checkGridLineWidth: Double = 2.8
    /// The side of the check's grid.
    static let checkGrid: Double = 24
    /// The short leg, the corner and the long leg, on the 24-unit grid: drawn in the order a hand draws a check.
    static let checkPoints: [(x: Double, y: Double)] = [(5, 12.8), (9.8, 17.4), (19.2, 7)]

    static func disc(halo: Double) -> Double { halo * discShare }
    static func glyph(halo: Double) -> Double { disc(halo: halo) * glyphShare }
    static func check(halo: Double) -> Double { disc(halo: halo) * checkShare }
    static func checkLineWidth(checkSide: Double) -> Double { checkGridLineWidth * checkSide / checkGrid }
}
