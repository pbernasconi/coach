import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// One exercise on the Workout screen: a compact header (thumbnail, name, working target, How to), one-line warm-up,
/// plates and progression hints, then the set grid with last time's sets, and Add set.
struct WorkoutExerciseSection: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .footnote) private var hintIconWidth = Size.iconSm
    let exercise: WorkoutExercise
    /// The catalog still; nil when the exercise has no catalog entry.
    let thumbnail: MediaImage?
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            header
            ListSection {
                ForEach(exercise.sets) { item in
                    SetRow(
                        item: item,
                        unit: exercise.unit,
                        onLog: { send(.setLogTapped(item.id)) },
                        onEdit: { send(.setValuesTapped(item.id)) },
                        onSkip: { send(.setSkipTapped(item.id)) },
                        onRemove: { send(.setRemoveTapped(item.id)) }
                    )
                }
            } header: {
                if !dynamicTypeSize.isAccessibilitySize {
                    SetGridHeader(unit: exercise.unit)
                }
            } footer: {
                Button("Add set", systemImage: "plus") { send(.addSetTapped(exerciseID: exercise.id)) }
                    .buttonStyle(.kobo(.plain, size: .compact))
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(spacing: Space.md) {
                thumbnailView
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: exercise.name)
                        .font(theme.font(.headline))
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    if let target = exercise.target {
                        Text(verbatim: target)
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let libraryID = exercise.libraryID {
                    IconButton(
                        "info.circle",
                        verbatimAccessibilityLabel: String(localized: "How to \(exercise.name)"),
                        style: .plain
                    ) { send(.howToTapped(exerciseID: libraryID)) }
                }
            }
            if exercise.warmUp != nil || exercise.plates != nil || exercise.progression != nil {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    hint(exercise.warmUp, symbol: "flame", color: theme.palette.textSecondary)
                    hint(exercise.plates, symbol: "scalemass", color: theme.palette.textSecondary)
                    hint(exercise.progression, symbol: "arrow.up.right", color: theme.palette.accentText)
                }
            }
        }
        .padding(.horizontal, Space.lg)
    }

    /// The still; tapping it opens How to too. VoiceOver skips it, since the How to button does the same.
    @ViewBuilder private var thumbnailView: some View {
        if let thumbnail, let catalogID = exercise.catalogID {
            let still = ExerciseThumbnail(image: thumbnail, name: exercise.name, side: Size.minTouch)
                .onAppear { send(.thumbnailNeeded(catalogID: catalogID)) }
            if let libraryID = exercise.libraryID {
                Button {
                    send(.howToTapped(exerciseID: libraryID))
                } label: {
                    still
                }
                .buttonStyle(.pressFeedback)
                .accessibilityHidden(true)
            } else {
                still
            }
        }
    }

    /// One plain hint line with a leading symbol; one line at default sizes, wrapping at accessibility sizes.
    @ViewBuilder
    private func hint(_ text: String?, symbol: String, color: Color) -> some View {
        if let text {
            HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                Image(systemName: symbol)
                    .frame(width: hintIconWidth)
                    .accessibilityHidden(true)
                Text(verbatim: text)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 1)
                    .minimumScaleFactor(0.85)
            }
            .font(theme.font(.footnote).monospacedDigit())
            .foregroundStyle(color)
        }
    }
}

/// The set grid's column header: SET · PREVIOUS · KG (or LB) · REPS, lined up with `SetRow`.
private struct SetGridHeader: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var badgeWidth = SetGridWidth.badge
    @ScaledMetric(relativeTo: .body) private var weightWidth = SetGridWidth.weight
    @ScaledMetric(relativeTo: .body) private var repsWidth = SetGridWidth.reps
    let unit: WeightUnit

    var body: some View {
        HStack(spacing: Space.sm) {
            Text("Set").frame(width: badgeWidth)
            Text("Previous").frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: unit.rawValue).frame(width: weightWidth)
            Text("Reps").frame(width: repsWidth)
            Color.clear.frame(width: Size.minTouch, height: 0)
        }
        .font(theme.font(.caption).weight(.semibold))
        .lineLimit(1)
        .accessibilityHidden(true)
    }
}
