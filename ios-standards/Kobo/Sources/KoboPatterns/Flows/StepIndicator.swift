import KoboComponents
import KoboTokens
import SwiftUI

/// "Step 2 of 4" over a row of segments, a row of dots or one bar. A segment fills from its leading edge on
/// `Motion.state` when the flow reaches it; Reduce Motion snaps. VoiceOver reads one element: "Step 2 of 4, Review".
///
///     StepIndicator(step: 2, of: 4, label: "Review")
///     StepIndicator(step: 1, of: 3, style: .dots)
///     StepIndicator(step: 3, of: nil, verbatim: section.name)   // length not known yet: "Step 3", no total
///
/// With an unknown total the caption drops "of Y" and the track is one empty bar, so the screen still reads as
/// progress without claiming a total that could change.
public struct StepIndicator: View {
    /// How the track looks.
    public enum Style: Sendable, Equatable, CaseIterable {
        /// One capsule per step, filled up to the current one.
        case segments
        /// A small dot per step; the current one is a wider pill.
        case dots
        /// One continuous bar filled to the current step's share.
        case bar
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var trackHeight = Space.xs
    @ScaledMetric(relativeTo: .caption) private var dotSide = Space.sm
    private let progress: StepProgress
    private let label: Text?
    private let style: Style

    /// An indicator with an optional localized step name.
    public init(step current: Int, of total: Int?, label: LocalizedStringKey? = nil, style: Style = .segments) {
        self.init(StepProgress(current, of: total), label: label.map { Text($0) }, style: style)
    }

    /// An indicator whose step name is shown as is (a section of user data).
    public init(step current: Int, of total: Int?, verbatim label: String, style: Style = .segments) {
        self.init(StepProgress(current, of: total), label: Text(verbatim: label), style: style)
    }

    /// An indicator for a `StepProgress` the flow already holds.
    public init(_ progress: StepProgress, label: LocalizedStringKey? = nil, style: Style = .segments) {
        self.init(progress, label: label.map { Text($0) }, style: style)
    }

    init(_ progress: StepProgress, label: Text?, style: Style) {
        self.progress = progress
        self.label = label
        self.style = style
    }

    public var body: some View {
        VStack(alignment: style == .dots ? .center : .leading, spacing: Space.sm) {
            caption
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
            track
        }
        .frame(maxWidth: .infinity, alignment: style == .dots ? .center : .leading)
        .koboAnimation(.state, value: progress)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(countText)
        .accessibilityValue(label ?? Text(verbatim: ""))
    }

    private var countText: Text {
        if let total = progress.total {
            Text("Step \(progress.current) of \(total)", bundle: .module)
        } else {
            Text("Step \(progress.current)", bundle: .module)
        }
    }

    private var caption: Text {
        guard let label else { return countText }
        return Text("\(countText) · \(label)", bundle: .module)
    }

    @ViewBuilder private var track: some View {
        switch style {
        case .segments:
            HStack(spacing: Space.xs) {
                ForEach(indices, id: \.offset) { index, _ in
                    segment(isFilled: progress.isFilled(index))
                }
            }
        case .dots:
            HStack(spacing: Space.sm) {
                ForEach(indices, id: \.offset) { index, _ in
                    dot(at: index)
                }
            }
        case .bar:
            Capsule()
                .fill(theme.palette.surfaceSunken)
                .overlay(alignment: .leading) {
                    Capsule().fill(theme.palette.accent).scaleEffect(x: progress.fraction, anchor: .leading)
                }
                .frame(height: trackHeight)
        }
    }

    /// One entry per segment or dot, keyed by position.
    private var indices: [(offset: Int, element: Int)] {
        Array((0..<progress.segmentCount).enumerated())
    }

    private func segment(isFilled: Bool) -> some View {
        Capsule()
            .fill(theme.palette.surfaceSunken)
            .overlay {
                Capsule().fill(theme.palette.accent).scaleEffect(x: isFilled ? 1 : 0, anchor: .leading)
            }
            .frame(maxWidth: .infinity)
            .frame(height: trackHeight)
    }

    private func dot(at index: Int) -> some View {
        let isCurrent = progress.total != nil && progress.isCurrent(index)
        return Capsule()
            .fill(progress.isFilled(index) ? theme.palette.accent : theme.palette.surfaceSunken)
            .frame(width: isCurrent ? dotSide * 3 : dotSide, height: dotSide)
    }
}

#if DEBUG
    private struct StepIndicatorPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var step = 2

        var body: some View {
            VStack(spacing: Space.xxl) {
                StepIndicator(step: step, of: 3, label: "Paste")
                StepIndicator(step: step, of: 3, style: .dots)
                StepIndicator(step: step, of: 3, label: "Import notes", style: .bar)
                StepIndicator(step: 3, of: nil, verbatim: "Details")
                Button("Next step") { step = step % 3 + 1 }.buttonStyle(.kobo(.secondary))
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Light") { StepIndicatorPreview() }
    #Preview("Dark, Lift") { StepIndicatorPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("AX3") { StepIndicatorPreview().dynamicTypeSize(.accessibility3) }
#endif
