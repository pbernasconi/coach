import Foundation

/// The wave of the typing indicator's three dots: each dot brightens in turn, one cycle every `period` seconds.
nonisolated enum ChatTypingDots {
    static let count = 3
    static let period: Double = 1.2
    static let dimmest: Double = 0.3

    /// The opacity of dot `index` at `time` seconds: a raised cosine, each dot a third of a cycle behind the last.
    static func opacity(dot index: Int, at time: Double) -> Double {
        let phase = (time / period - Double(index) / Double(count)).truncatingRemainder(dividingBy: 1)
        let unit = phase < 0 ? phase + 1 : phase
        let wave = (1 - cos(unit * 2 * .pi)) / 2
        return dimmest + (1 - dimmest) * wave
    }
}
