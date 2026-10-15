import Foundation
import KoboTokens
import SwiftUI

/// A circular progress gauge with rounded caps and an optional centre slot. Changes animate with `Motion.state`.
/// Size it with `.frame`; it stays square. VoiceOver reads it as one element: `accessibilityLabel` (or the centre's
/// text) and the progress as a percentage.
///
///     ProgressRing(progress: done / total, tone: .success, accessibilityLabel: "Tasks done") {
///         Text("\(done)/\(total)").font(theme.font(.headline))
///     }
///     .frame(width: Size.thumbnail, height: Size.thumbnail)
public struct ProgressRing<Center: View>: View {
    private let progress: Double
    private let lineWidth: CGFloat
    private let tint: RingTint
    private let trackColor: Color?
    private let label: Text?
    private let center: Center
    @Environment(\.koboTheme) private var theme

    /// - Parameters:
    ///   - progress: 0...1; values outside are clamped.
    ///   - trackColor: the unfilled ring; the sunken surface when `nil`.
    ///   - accessibilityLabel: what the ring measures ("Tasks done"); the centre's text when `nil`.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        trackColor: Color? = nil,
        accessibilityLabel: LocalizedStringKey? = nil,
        @ViewBuilder center: () -> Center
    ) {
        let label = accessibilityLabel.map { Text($0) }
        self.init(progress, lineWidth, .tone(tone), trackColor, label, center())
    }

    /// A ring whose accessibility label is shown as is (it names user data: "Garden plan progress").
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        trackColor: Color? = nil,
        verbatimAccessibilityLabel: String,
        @ViewBuilder center: () -> Center
    ) {
        let label = Text(verbatim: verbatimAccessibilityLabel)
        self.init(progress, lineWidth, .tone(tone), trackColor, label, center())
    }

    /// A ring in an explicit colour, for data colours outside the tone set.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        color: Color,
        trackColor: Color? = nil,
        accessibilityLabel: LocalizedStringKey? = nil,
        @ViewBuilder center: () -> Center
    ) {
        let label = accessibilityLabel.map { Text($0) }
        self.init(progress, lineWidth, .color(color), trackColor, label, center())
    }

    private init(
        _ progress: Double,
        _ lineWidth: CGFloat,
        _ tint: RingTint,
        _ track: Color?,
        _ label: Text?,
        _ center: Center
    ) {
        self.progress = progress
        self.lineWidth = lineWidth
        self.tint = tint
        self.trackColor = track
        self.label = label
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
        .koboAnimation(.state, value: clamped)
        .overlay {
            center
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(lineWidth + Space.xs)
        }
        .accessibilityElement(children: .combine)
        .modifier(OptionalAccessibilityLabel(label: label))
        .accessibilityValue(clamped.formatted(.percent.precision(.fractionLength(0))))
    }
}

extension ProgressRing where Center == EmptyView {
    /// A ring with nothing in the middle.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        trackColor: Color? = nil,
        accessibilityLabel: LocalizedStringKey? = nil
    ) {
        self.init(
            progress: progress,
            lineWidth: lineWidth,
            tone: tone,
            trackColor: trackColor,
            accessibilityLabel: accessibilityLabel
        ) {
            EmptyView()
        }
    }

    /// A ring with nothing in the middle and an accessibility label shown as is.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        tone: Tone = .accent,
        trackColor: Color? = nil,
        verbatimAccessibilityLabel: String
    ) {
        self.init(
            progress: progress,
            lineWidth: lineWidth,
            tone: tone,
            trackColor: trackColor,
            verbatimAccessibilityLabel: verbatimAccessibilityLabel
        ) { EmptyView() }
    }

    /// A ring in an explicit colour with nothing in the middle.
    public init(
        progress: Double,
        lineWidth: CGFloat = Space.sm,
        color: Color,
        trackColor: Color? = nil,
        accessibilityLabel: LocalizedStringKey? = nil
    ) {
        self.init(
            progress: progress,
            lineWidth: lineWidth,
            color: color,
            trackColor: trackColor,
            accessibilityLabel: accessibilityLabel
        ) {
            EmptyView()
        }
    }
}

/// Applies a label only when there is one, so a ring without a label keeps the label its centre's text combines into.
private struct OptionalAccessibilityLabel: ViewModifier {
    let label: Text?

    func body(content: Content) -> some View {
        if let label {
            content.accessibilityLabel(label)
        } else {
            content
        }
    }
}

private struct ProgressRingPreview: View {
    @State private var progress = 0.35
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.xl) {
            HStack(spacing: Space.xl) {
                ProgressRing(progress: progress, accessibilityLabel: "Week goal")
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

#if DEBUG
    #Preview("Progress ring") { ProgressRingPreview() }
    #Preview("Progress ring, dark") { ProgressRingPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Progress ring, AX3") { ProgressRingPreview().dynamicTypeSize(.accessibility3) }
#endif
