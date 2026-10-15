import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Sizes of the muscle volume rows.
enum MuscleVolumeMetrics {
    /// The muscle name's column, so every bar starts at the same x.
    static let nameWidth: CGFloat = 92
    /// The number's column after the bar.
    static let valueWidth: CGFloat = 32
    /// A bar's thickness.
    static let barHeight: CGFloat = 14
}

/// The chosen week's hard sets per muscle as horizontal bars over the shaded 10–20 band, with arrows to step through
/// the last 8 weeks. Each row opens the exercises behind it.
struct MuscleVolumeSection: View {
    @Environment(\.koboTheme) private var theme
    let progress: VolumeProgress
    let send: (HistoryAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .center, spacing: Space.xs) {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: progress.week.title).sectionTitleStyle()
                    Text(verbatim: "\(progress.week.total) · \(HistoryVolumeText.band)")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                WeekStepButtons(progress: progress, send: send)
            }
            VStack(spacing: 0) {
                ForEach(progress.week.muscles) { row in
                    MuscleVolumeRowView(row: row, scaleMax: progress.scaleMax) { send(.muscleTapped(row.id)) }
                }
            }
        }
    }
}

/// The week before and after, as two small icon buttons; an end of the 8 weeks disables its arrow.
private struct WeekStepButtons: View {
    let progress: VolumeProgress
    let send: (HistoryAction) -> Void

    var body: some View {
        HStack(spacing: 0) {
            IconButton("chevron.left", accessibilityLabel: "Previous week", style: .plain, size: .small) {
                if let week = progress.previousWeek { send(.volumeWeekSelected(week)) }
            }
            .disabled(progress.previousWeek == nil)
            IconButton("chevron.right", accessibilityLabel: "Next week", style: .plain, size: .small) {
                if let week = progress.nextWeek { send(.volumeWeekSelected(week)) }
            }
            .disabled(progress.nextWeek == nil)
        }
    }
}

/// One muscle: its name, its bar over the band and its hard sets. At accessibility sizes the bar moves under the
/// name and number, so neither is squeezed.
private struct MuscleVolumeRowView: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .subheadline) private var nameWidth = MuscleVolumeMetrics.nameWidth
    @ScaledMetric(relativeTo: .subheadline) private var valueWidth = MuscleVolumeMetrics.valueWidth
    @ScaledMetric(relativeTo: .subheadline) private var barHeight = MuscleVolumeMetrics.barHeight
    let row: VolumeMuscleRow
    let scaleMax: Double
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: Space.xs) {
                        HStack {
                            name
                            Spacer(minLength: Space.sm)
                            value
                        }
                        bar
                    }
                } else {
                    HStack(spacing: Space.md) {
                        name.frame(width: nameWidth, alignment: .leading)
                        bar
                        value.frame(minWidth: valueWidth, alignment: .trailing)
                    }
                }
            }
            .padding(.vertical, Space.sm)
            .frame(minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.highlight, in: RoundedRectangle(cornerRadius: Radius.xs, style: .continuous)))
        .accessibilityLabel(Text(verbatim: row.name))
        .accessibilityValue(Text(verbatim: row.accessibilityValue))
        .accessibilityHint(Text("Shows the exercises behind these sets."))
    }

    private var name: some View {
        Text(verbatim: row.name)
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textPrimary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
    }

    private var value: some View {
        Text(verbatim: row.value)
            .font(theme.font(.subheadline).weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(row.sets > 0 ? theme.palette.textPrimary : theme.palette.textTertiary)
    }

    private var bar: some View {
        VolumeBar(sets: row.sets, scaleMax: scaleMax).frame(height: barHeight)
    }
}
