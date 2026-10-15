import CraftTokens
import Foundation
import SwiftUI

/// A circular progress gauge with rounded caps and an optional centre slot. Changes animate with `Motion.state`.
/// Size it with `.frame`; it stays square. VoiceOver reads the progress as a percentage.
///
///     ProgressRing(progress: done / total, tone: .success) {
///         Text("\(done)/\(total)").font(.headline)
///     }
///     .frame(width: 64, height: 64)
public struct ProgressRing<Center: View>: View {
    private let progress: Double
    private let lineWidth: CGFloat
    private let tint: RingTint
    private let trackColor: Color?
    private let center: Center
    @Environment(\.craftTheme) private var theme

    /// - Parameters:
    ///   - progress: 0...1; values outside are clamped.
    ///   - trackColor: the unfilled ring; the sunken surface when `nil`.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        trackColor: Color? = nil,
        @ViewBuilder center: () -> Center
    ) {
        self.init(progress: progress, lineWidth: lineWidth, tint: .tone(tone), trackColor: trackColor, center: center())
    }

    /// A ring in an explicit colour, for data colours outside the tone set.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        color: Color,
        trackColor: Color? = nil,
        @ViewBuilder center: () -> Center
    ) {
        self.init(progress: progress, lineWidth: lineWidth, tint: .color(color), trackColor: trackColor, center: center())
    }

    private init(progress: Double, lineWidth: CGFloat, tint: RingTint, trackColor: Color?, center: Center) {
        self.progress = progress
        self.lineWidth = lineWidth
        self.tint = tint
        self.trackColor = trackColor
        self.center = center
    }

    public var body: some View {
        let clamped = RingMath.clamp(progress)
        RingStroke(
            progress: clamped,
            lineWidth: lineWidth,
            color: tint.resolve(in: theme.palette),
            trackColor: trackColor ?? theme.palette.surfaceSunken
        )
        .craftAnimation(.state, value: clamped)
        .overlay {
            center
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(lineWidth + Space.xs)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(clamped.formatted(.percent.precision(.fractionLength(0))))
    }
}

public extension ProgressRing where Center == EmptyView {
    /// A ring with nothing in the middle.
    init(progress: Double, lineWidth: CGFloat = Space.sm, tone: Tone = .accent, trackColor: Color? = nil) {
        self.init(progress: progress, lineWidth: lineWidth, tone: tone, trackColor: trackColor) { EmptyView() }
    }

    /// A ring in an explicit colour with nothing in the middle.
    init(progress: Double, lineWidth: CGFloat = Space.sm, color: Color, trackColor: Color? = nil) {
        self.init(progress: progress, lineWidth: lineWidth, color: color, trackColor: trackColor) { EmptyView() }
    }
}

private struct ProgressRingPreview: View {
    @State private var progress = 0.35
    @Environment(\.craftTheme) private var theme

    var body: some View {
        VStack(spacing: Space.xl) {
            HStack(spacing: Space.xl) {
                ProgressRing(progress: progress)
                    .frame(width: Size.minTouch, height: Size.minTouch)
                ProgressRing(progress: progress, tone: .success) {
                    Text(progress, format: .percent.precision(.fractionLength(0)))
                        .font(theme.font(.headline))
                }
                .frame(width: Size.thumbnail * 1.5, height: Size.thumbnail * 1.5)
                ProgressRing(progress: progress, lineWidth: Space.xs, color: theme.palette.info.ink)
                    .frame(width: Size.thumbnail, height: Size.thumbnail)
            }
            Button("Advance") { progress = progress >= 1 ? 0 : progress + 0.2 }
        }
        .padding()
    }
}

#Preview("Progress ring") { ProgressRingPreview() }
#Preview("Progress ring, dark") { ProgressRingPreview().craftTheme(.lift).preferredColorScheme(.dark) }
#Preview("Progress ring, AX3") { ProgressRingPreview().dynamicTypeSize(.accessibility3) }
