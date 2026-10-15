import KoboTokens
import LiftCore
import SwiftUI

/// A muscle's weekly hard sets as a bar from zero over a track, with the 10–20 band shaded behind it and its edges
/// marked over both, all on one scale (0…`scaleMax`). Decorative for VoiceOver: the row reads the number and where it sits.
struct VolumeBar: View {
    @Environment(\.koboTheme) private var theme
    let sets: Double
    let scaleMax: Double

    var body: some View {
        SpanLayout {
            Capsule()
                .fill(theme.palette.surfaceSunken)
                .span(0...1)
            Rectangle()
                .fill(theme.palette.accentSoft)
                .span(fraction(band.lowerBound)...fraction(band.upperBound))
            Capsule()
                .fill(theme.palette.accent)
                .opacity(sets > 0 ? 1 : 0)
                .span(0...fraction(sets))
            edge.span(fraction(band.lowerBound)...fraction(band.lowerBound))
            edge.span(fraction(band.upperBound)...fraction(band.upperBound))
        }
        .accessibilityHidden(true)
    }

    private var band: ClosedRange<Double> { WeeklyVolume.targetSets }

    /// A band edge: a thin rule in the accent ink, drawn over the bar so it shows where the bar crosses it.
    private var edge: some View {
        Rectangle()
            .fill(theme.palette.accentText)
            .frame(width: Size.hairline * 2)
            .offset(x: -Size.hairline)
    }

    private func fraction(_ value: Double) -> Double {
        guard scaleMax > 0 else { return 0 }
        return min(max(value / scaleMax, 0), 1)
    }
}

/// Places each subview across the full height at its `span`, a fraction of the width (0 is the leading edge, 1 the
/// trailing one). Takes whatever width it is offered.
private struct SpanLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews _: Subviews, cache _: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        for subview in subviews {
            let span = subview[SpanKey.self]
            let width = bounds.width * (span.upperBound - span.lowerBound)
            subview.place(
                at: CGPoint(x: bounds.minX + bounds.width * span.lowerBound, y: bounds.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: width, height: bounds.height)
            )
        }
    }
}

private nonisolated struct SpanKey: LayoutValueKey {
    static let defaultValue: ClosedRange<Double> = 0...1
}

extension View {
    /// The part of a `SpanLayout`'s width this view covers.
    fileprivate func span(_ range: ClosedRange<Double>) -> some View {
        layoutValue(key: SpanKey.self, value: range)
    }
}
