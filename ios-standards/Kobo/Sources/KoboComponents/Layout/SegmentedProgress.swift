import Foundation
import KoboTokens
import SwiftUI

/// A row of capsule segments showing progress toward a goal (for example "2 of 4 tasks this week"): done segments in
/// the accent, planned ones in the soft accent, and the rest as a quiet filled track (a firmer grey where a minimum
/// still needs them). No outlines, so an empty bar reads as a calm track, not as noise. VoiceOver reads the label and
/// "x of y".
///
///     SegmentedProgress(done: 2, planned: 1, minimum: 3, goal: 4, accessibilityLabel: "Weekly goal")
///     SegmentedProgress(done: 1, goal: 3, verbatimAccessibilityLabel: "\(plan.name) this week")
public struct SegmentedProgress: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var height = Space.sm
    private let segments: [ProgressSegment]
    private let label: Text

    public init(segments: [ProgressSegment], accessibilityLabel: LocalizedStringKey) {
        self.init(segments, label: Text(accessibilityLabel))
    }

    /// Segments whose accessibility label is shown as is (it names user data).
    public init(segments: [ProgressSegment], verbatimAccessibilityLabel: String) {
        self.init(segments, label: Text(verbatim: verbatimAccessibilityLabel))
    }

    public init(done: Int, planned: Int = 0, minimum: Int = 0, goal: Int, accessibilityLabel: LocalizedStringKey) {
        let segments = ProgressSegment.segments(done: done, planned: planned, minimum: minimum, goal: goal)
        self.init(segments, label: Text(accessibilityLabel))
    }

    /// Progress toward a goal, with an accessibility label shown as is.
    public init(done: Int, planned: Int = 0, minimum: Int = 0, goal: Int, verbatimAccessibilityLabel: String) {
        let segments = ProgressSegment.segments(done: done, planned: planned, minimum: minimum, goal: goal)
        self.init(segments, label: Text(verbatim: verbatimAccessibilityLabel))
    }

    private init(_ segments: [ProgressSegment], label: Text) {
        self.segments = segments
        self.label = label
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
        .accessibilityLabel(label)
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
            Capsule().fill(theme.palette.textTertiary)
        case .optional:
            Capsule().fill(theme.palette.surfaceSunken)
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
                Text("2 done, 1 planned, minimum 3, goal 4")
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
