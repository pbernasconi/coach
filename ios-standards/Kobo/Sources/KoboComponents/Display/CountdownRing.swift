import Foundation
import KoboTokens
import SwiftUI

/// A ring that drains from full at `start` to empty at `end`, with the time left in the middle and an optional
/// "of 3:00" total under it. It only draws: the caller decides what happens at zero (it owns the clock and the dates).
///
///     CountdownRing(start: restStart, end: restStart.addingTimeInterval(180), accessibilityLabel: "Rest")
///         .frame(width: Size.thumbnail * 2, height: Size.thumbnail * 2)
///     CountdownRing(start: start, end: end, verbatimAccessibilityLabel: timer.name)
///
/// The arc follows the display's frame rate; with Reduce Motion on it steps once a second instead.
public struct CountdownRing: View {
    private let start: Date
    private let end: Date
    private let showsTotal: Bool
    private let lineWidth: CGFloat
    private let tint: RingTint
    private let label: Text?
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - showsTotal: draws "of 3:00" under the time left.
    ///   - accessibilityLabel: what VoiceOver calls the timer ("Rest"); "Timer" when `nil`.
    public init(
        start: Date,
        end: Date,
        showsTotal: Bool = true,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        accessibilityLabel: LocalizedStringKey? = nil
    ) {
        let label = accessibilityLabel.map { Text($0) }
        self.init(start, end, showsTotal: showsTotal, lineWidth: lineWidth, tone: tone, label: label)
    }

    /// A countdown whose VoiceOver name is shown as is (a timer the user named).
    public init(
        start: Date,
        end: Date,
        showsTotal: Bool = true,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        verbatimAccessibilityLabel: String
    ) {
        let label = Text(verbatim: verbatimAccessibilityLabel)
        self.init(start, end, showsTotal: showsTotal, lineWidth: lineWidth, tone: tone, label: label)
    }

    private init(_ start: Date, _ end: Date, showsTotal: Bool, lineWidth: CGFloat, tone: Tone, label: Text?) {
        self.start = start
        self.end = end
        self.showsTotal = showsTotal
        self.lineWidth = lineWidth
        self.tint = .tone(tone)
        self.label = label
    }

    public var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : nil, paused: false)) { context in
            RingStroke(
                progress: CountdownMath.fraction(now: context.date, start: start, end: end),
                lineWidth: lineWidth,
                color: tint.resolve(in: theme.palette),
                trackColor: theme.palette.surfaceSunken
            )
            .overlay { centre }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label ?? Text("Timer", bundle: .module))
            .accessibilityValue(CountdownMath.spokenRemaining(now: context.date, end: end))
            .accessibilityAddTraits(.updatesFrequently)
        }
    }

    private var centre: some View {
        VStack(spacing: Space.xxs) {
            // The system keeps this label current on its own, even between timeline updates.
            Text(timerInterval: CountdownMath.interval(start: start, end: end), countsDown: true)
                .font(theme.font(.title2))
                .monospacedDigit()
                .foregroundStyle(theme.palette.textPrimary)
                .multilineTextAlignment(.center)
            if showsTotal {
                Text("of \(totalText)", bundle: .module)
                    .font(theme.font(.caption).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .padding(lineWidth + Space.xs)
    }

    /// The whole countdown as a clock ("3:00"), for the "of 3:00" line.
    private var totalText: String {
        CountdownMath.clockText(seconds: CountdownMath.totalSeconds(start: start, end: end))
    }
}

#Preview("Countdown ring") {
    let now = Date.now
    HStack(spacing: Space.xl) {
        CountdownRing(start: now, end: now.addingTimeInterval(180), accessibilityLabel: "Rest")
            .frame(width: Size.thumbnail * 2, height: Size.thumbnail * 2)
        CountdownRing(
            start: now.addingTimeInterval(-50),
            end: now.addingTimeInterval(10),
            showsTotal: false,
            tone: .warning
        )
        .frame(width: Size.thumbnail, height: Size.thumbnail)
    }
    .padding()
}

#Preview("Countdown ring, dark") {
    let now = Date.now
    CountdownRing(start: now, end: now.addingTimeInterval(90))
        .frame(width: Size.thumbnail * 2, height: Size.thumbnail * 2)
        .koboTheme(.lift)
        .preferredColorScheme(.dark)
}

#Preview("Countdown ring, AX3") {
    let now = Date.now
    CountdownRing(start: now, end: now.addingTimeInterval(180))
        .frame(width: Size.thumbnail * 2, height: Size.thumbnail * 2)
        .dynamicTypeSize(.accessibility3)
}
