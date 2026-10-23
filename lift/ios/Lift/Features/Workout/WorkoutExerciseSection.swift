import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// One exercise on the Workout screen: a compact header (thumbnail, name and working target, which open the exercise's
/// page), one-line warm-up, plates and progression hints, then the set grid with last time's
/// sets (Add set is in the exercise's "…"). The header and the grid's card edge sit on the page keyline; the grid is a
/// grouped card (a set of editable fields) with its column header inside it, so the column titles, the rows and Add set
/// share the card's inset.
struct WorkoutExerciseSection: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .footnote) private var hintIconWidth = Size.iconSm
    let exercise: WorkoutExercise
    /// The catalog still; nil when the exercise has no catalog entry.
    let thumbnail: MediaImage?
    /// The running rest and the set it comes before; that set's check fills as a ring.
    let rest: SetRowRest?
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            header
            ListSection {
                if !dynamicTypeSize.isAccessibilitySize {
                    SetGridHeader(unit: exercise.unit)
                }
                ForEach(exercise.sets) { item in
                    SetRow(
                        item: item,
                        unit: exercise.unit,
                        rest: rest?.setID == item.id ? rest?.timer : nil,
                        onLog: { send(.setLogTapped(item.id)) },
                        onEdit: { send(.setValuesTapped(item.id)) },
                        onSkip: { send(.setSkipTapped(item.id)) },
                        onRemove: { send(.setRemoveTapped(item.id)) }
                    )
                    .id(item.id)
                }
            } header: {
                EmptyView()
            }
            .listSectionStyle(.grouped)
        }
    }

    /// Thumbnail, name and target, then "…", in one row; a tap on the thumbnail or the name opens the exercise's page
    /// (how to do it, this workout's note, its history). At accessibility sizes the name wraps between the thumbnail and
    /// "…" (top-aligned) and the target takes the full width under them.
    private var header: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if dynamicTypeSize.isAccessibilitySize {
                HStack(alignment: .top, spacing: Space.md) {
                    opensDetail {
                        HStack(alignment: .top, spacing: Space.md) {
                            thumbnailView
                            name.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    WorkoutExerciseOptionsButton(exercise: exercise, send: send)
                }
                target
            } else {
                HStack(spacing: Space.md) {
                    opensDetail {
                        HStack(spacing: Space.md) {
                            thumbnailView
                            title.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    WorkoutExerciseOptionsButton(exercise: exercise, send: send)
                }
            }
            if exercise.warmUp != nil || exercise.progression != nil {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    hint(exercise.warmUp, symbol: "flame", color: theme.palette.textSecondary)
                    hint(exercise.progression, symbol: "arrow.up.right", color: theme.palette.accentText)
                }
            }
            // The note shows on the How to page; an exercise without one keeps it here. Add or edit it from "…".
            if exercise.libraryID == nil, let note = exercise.note {
                WorkoutExerciseNote(name: exercise.name, note: note) { send(.exerciseNoteTapped(exercise.id)) }
            }
        }
    }

    private var title: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            name
            target
        }
    }

    /// The name, with a small chevron when it opens the exercise's page.
    private var name: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
            Text(verbatim: exercise.name)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .multilineTextAlignment(.leading)
            if exercise.libraryID != nil {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityAddTraits(.isHeader)
    }

    /// `label` as one button to the exercise's page when it has one; as it is otherwise.
    @ViewBuilder private func opensDetail(@ViewBuilder _ label: () -> some View) -> some View {
        if let libraryID = exercise.libraryID {
            Button {
                send(.howToTapped(exerciseID: libraryID, note: exercise.note))
            } label: {
                label().contentShape(.rect)
            }
            .buttonStyle(.pressFeedback)
            .accessibilityHint(Text("Shows how to do it and its history"))
        } else {
            label()
        }
    }

    @ViewBuilder private var target: some View {
        if let target = exercise.target {
            Text(verbatim: target)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
        }
    }

    /// The still, inside the header's button.
    @ViewBuilder private var thumbnailView: some View {
        if let thumbnail, let catalogID = exercise.catalogID {
            ExerciseThumbnail(image: thumbnail, name: exercise.name, side: Size.minTouch)
                .onAppear { send(.thumbnailNeeded(catalogID: catalogID)) }
                .accessibilityHidden(true)
        }
    }

    /// One plain hint line with a leading symbol; one line at default sizes, wrapping at accessibility sizes. Every
    /// symbol takes the filled variant in one fixed-width frame, so the glyphs match in weight and the texts line up.
    @ViewBuilder
    private func hint(_ text: String?, symbol: String, color: Color) -> some View {
        if let text {
            HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                Image(systemName: symbol)
                    .symbolVariant(.fill)
                    .imageScale(.small)
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

/// The set grid's column header in sentence case (Set · Previous · kg or lb · Reps), the first line of the grid's card,
/// lined up with `SetRow` on the card's inset.
private struct SetGridHeader: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var badgeWidth = SetGridWidth.badge
    @ScaledMetric(relativeTo: .body) private var weightWidth = SetGridWidth.weight
    @ScaledMetric(relativeTo: .body) private var repsWidth = SetGridWidth.reps
    let unit: WeightUnit

    var body: some View {
        HStack(spacing: Space.sm) {
            Text("Set").frame(width: badgeWidth, alignment: .leading)
            Text("Previous").frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: unit.rawValue).frame(width: weightWidth)
            Text("Reps").frame(width: repsWidth)
            Color.clear.frame(width: Size.minTouch, height: 0)
        }
        .font(theme.font(.caption).weight(.semibold))
        .foregroundStyle(theme.palette.textSecondary)
        .lineLimit(1)
        .padding(.horizontal, SetGridWidth.inset)
        .padding(.top, Space.sm)
        .padding(.bottom, Space.xs)
        .accessibilityHidden(true)
    }
}

