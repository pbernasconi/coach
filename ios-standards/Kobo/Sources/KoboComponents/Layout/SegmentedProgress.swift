import Foundation
import KoboTokens
import SwiftUI

/// A row of capsule segments showing progress toward a goal (for example "2 of 4 workouts this week").
/// VoiceOver reads the label and "x of y".
///
///     SegmentedProgress(done: 2, planned: 1, minimum: 3, goal: 4, accessibilityLabel: "Weekly goal")
public struct SegmentedProgress: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var height = Space.sm
    private let segments: [ProgressSegment]
    private let accessibilityLabel: LocalizedStringKey

    public init(segments: [ProgressSegment], accessibilityLabel: LocalizedStringKey) {
        self.segments = segments
        self.accessibilityLabel = accessibilityLabel
    }

    public init(done: Int, planned: Int = 0, minimum: Int = 0, goal: Int, accessibilityLabel: LocalizedStringKey) {
        self.init(
            segments: ProgressSegment.segments(done: done, planned: planned, minimum: minimum, goal: goal),
            accessibilityLabel: accessibilityLabel
        )
    }

    public var body: some View {
        HStack(spacing: Space.xs) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                segmentView(segment)
            }
        }
        .frame(height: height)
        .koboAnimation(.state, value: segments)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityLabel))
        .accessibilityValue(Text(verbatim: ProgressSegment.accessibilityValue(for: segments)))
    }

    @ViewBuilder
    private func segmentView(_ segment: ProgressSegment) -> some View {
        switch segment {
        case .done:
            Capsule().fill(theme.palette.accent)
        case .planned:
            Capsule().fill(theme.palette.accentSoft)
        case .required:
            Capsule().fill(theme.palette.surfaceSunken)
        case .optional:
            Capsule().strokeBorder(
                theme.palette.textTertiary,
                style: StrokeStyle(lineWidth: Space.xxs, dash: [Space.xs, Space.xxs])
            )
        }
    }
}

#if DEBUG
    private struct SegmentedProgressPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.xl) {
                ForEach(ProgressSegment.allCases) { segment in
                    Text(String(describing: segment))
                    SegmentedProgress(segments: [segment, segment, segment], accessibilityLabel: "Sample")
                }
                Text("2 done, 1 planned, required 3, goal 4")
                SegmentedProgress(done: 2, planned: 1, minimum: 3, goal: 4, accessibilityLabel: "Weekly goal")
                Text("Goal passed")
                SegmentedProgress(done: 5, goal: 3, accessibilityLabel: "Weekly goal")
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { SegmentedProgressPreview() }
    #Preview("Dark") { SegmentedProgressPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SegmentedProgressPreview().dynamicTypeSize(.accessibility3) }
#endif
