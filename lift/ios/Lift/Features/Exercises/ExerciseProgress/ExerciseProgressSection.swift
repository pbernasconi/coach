import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Sizes of the progress section.
enum ExerciseProgressMetrics {
    /// The range picker's width beside the heading; at accessibility sizes it takes the full width under it.
    static let pickerWidth: CGFloat = 200
    /// The plot's height at the default text size; it grows with Dynamic Type so axis labels keep their room.
    static let plotHeight: CGFloat = 168
}

/// "Progress" on an exercise page: the range picker, the best estimated one-rep max and its change (or the touched
/// session), and the chart of estimated 1RM and heaviest set per session. Hidden until there is a session to chart.
struct ExerciseProgressSection: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let progress: ExerciseProgressState
    let rangeChanged: (ProgressRange) -> Void
    let selectionChanged: (Date?) -> Void

    var body: some View {
        if case .loaded(let chart) = progress.chart {
            DetailSection("Progress") {
                VStack(alignment: .leading, spacing: Space.md) {
                    ProgressHeadlineView(headline: chart.headline)
                    if let message = chart.emptyMessage {
                        ProgressEmptyPlot(message: message)
                    } else {
                        ExerciseProgressPlot(chart: chart, selectionChanged: selectionChanged)
                        ProgressLegend()
                    }
                }
            } accessory: {
                SegmentedPicker(
                    "Range",
                    selection: .action(progress.range) { rangeChanged($0) },
                    options: ProgressRange.allCases.map { ChoiceOption($0, verbatim: ExerciseProgressText.title($0)) }
                )
                .frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? .infinity : ExerciseProgressMetrics.pickerWidth)
            }
        }
    }
}

/// The label over the big number, and the change or top set under it. Reads as one VoiceOver element.
private struct ProgressHeadlineView: View {
    @Environment(\.koboTheme) private var theme
    let headline: ProgressHeadline

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: headline.label)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            Text(verbatim: headline.value)
                .font(theme.font(.title2))
                .monospacedDigit()
                .foregroundStyle(theme.palette.textPrimary)
            Text(verbatim: headline.detail ?? " ")
                .font(theme.font(.subheadline))
                .monospacedDigit()
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityHidden(headline.detail == nil)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// The plot's place when the range has no session: the message, at the plot's height so the page does not jump.
private struct ProgressEmptyPlot: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var height = ExerciseProgressMetrics.plotHeight
    let message: String

    var body: some View {
        Text(verbatim: message)
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
    }
}

/// What the two lines are: a solid line with dots for the estimate, a dashed one for the heaviest set.
private struct ProgressLegend: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        HStack(spacing: Space.lg) {
            Label {
                Text("Est. 1RM")
            } icon: {
                Circle().fill(theme.palette.accentText).frame(width: Space.sm, height: Space.sm)
            }
            Label {
                Text("Heaviest set")
            } icon: {
                LegendDash()
                    .stroke(theme.palette.textSecondary, style: ExerciseProgressPlot.heaviestStroke)
                    .frame(width: Space.lg, height: Space.sm)
            }
        }
        .labelStyle(LegendLabelStyle())
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
        .accessibilityHidden(true)
    }
}

/// A legend key beside its text, centred on the text's first line.
private struct LegendLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: Space.xs) {
            configuration.icon
            configuration.title
        }
    }
}

/// A horizontal line through the middle of its frame, stroked dashed as the heaviest-set line is.
private struct LegendDash: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
    }
}
