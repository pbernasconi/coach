import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// One exercise on the Workout screen: a compact header (thumbnail, name, working target, How to), one-line warm-up,
/// plates and progression hints, last time's note and this session's (or Add note), then the set grid with last time's
/// sets, and Add set as the grid's last row. The header and the grid's card edge sit on the page keyline; the grid is a
/// grouped card (a set of editable fields) with its column header inside it, so the column titles, the rows and Add set
/// share the card's inset.
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
                if !dynamicTypeSize.isAccessibilitySize {
                    SetGridHeader(unit: exercise.unit)
                }
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
                AddSetRow { send(.addSetTapped(exerciseID: exercise.id)) }
            } header: {
                EmptyView()
            }
            .listSectionStyle(.grouped)
        }
    }

    /// Thumbnail, name and target, How to and "…" in one row; at accessibility sizes the name wraps between the thumbnail
    /// and the buttons (all top-aligned) and the target takes the full width under them.
    private var header: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if dynamicTypeSize.isAccessibilitySize {
                HStack(alignment: .top, spacing: Space.md) {
                    thumbnailView
                    name.frame(maxWidth: .infinity, alignment: .leading)
                    howTo
                    WorkoutExerciseOptionsButton(exercise: exercise, send: send)
                }
                target
            } else {
                HStack(spacing: Space.md) {
                    thumbnailView
                    title.frame(maxWidth: .infinity, alignment: .leading)
                    howTo
                    WorkoutExerciseOptionsButton(exercise: exercise, send: send)
                }
            }
            if exercise.warmUp != nil || exercise.plates != nil || exercise.progression != nil {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    hint(exercise.warmUp, symbol: "flame", color: theme.palette.textSecondary)
                    hint(exercise.plates, symbol: "scalemass", color: theme.palette.textSecondary)
                    hint(exercise.progression, symbol: "arrow.up.right", color: theme.palette.accentText)
                }
            }
            WorkoutExerciseNotes(name: exercise.name, note: exercise.note, lastNote: exercise.lastNote) {
                send(.exerciseNoteTapped(exercise.id))
            }
        }
    }

    private var title: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            name
            target
        }
    }

    private var name: some View {
        Text(verbatim: exercise.name)
            .font(theme.font(.headline))
            .foregroundStyle(theme.palette.textPrimary)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder private var target: some View {
        if let target = exercise.target {
            Text(verbatim: target)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
        }
    }

    @ViewBuilder private var howTo: some View {
        if let libraryID = exercise.libraryID {
            IconButton(
                "info",
                verbatimAccessibilityLabel: String(localized: "How to \(exercise.name)"),
                style: .tinted
            ) { send(.howToTapped(exerciseID: libraryID)) }
        }
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
            Text("Set").frame(width: badgeWidth)
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

/// "Add set" as the grid's last row: inside the card, on its inset, behind the same hairline as the set rows.
private struct AddSetRow: View {
    let action: () -> Void

    var body: some View {
        Button("Add set", systemImage: "plus", action: action)
            .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
            .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
            .padding(.horizontal, SetGridWidth.inset)
            .padding(.vertical, Space.xxs)
            .overlay(alignment: .top) { Separator(leadingInset: SetGridWidth.inset) }
    }
}
