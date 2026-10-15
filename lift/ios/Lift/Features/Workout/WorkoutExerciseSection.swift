import KoboComponents
import KoboTokens
import SwiftUI

/// One exercise on the Workout screen: its thumbnail, name, "How to" and plain hint lines, its set rows, and Add set.
struct WorkoutExerciseSection: View {
    @Environment(\.koboTheme) private var theme
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
                        onLog: { send(.setLogTapped(item.id)) },
                        onEdit: { send(.setValuesTapped(item.id)) },
                        onSkip: { send(.setSkipTapped(item.id)) },
                        onRemove: { send(.setRemoveTapped(item.id)) }
                    )
                }
            } header: {
                EmptyView()
            } footer: {
                Button("Add set", systemImage: "plus") { send(.addSetTapped(exerciseID: exercise.id)) }
                    .buttonStyle(.kobo(.plain, size: .compact))
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Space.md) {
            if let thumbnail, let catalogID = exercise.catalogID {
                ExerciseThumbnail(image: thumbnail, name: exercise.name, side: Size.minTouch)
                    .onAppear { send(.thumbnailNeeded(catalogID: catalogID)) }
            }
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: exercise.name)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                hint(exercise.target, color: theme.palette.textSecondary)
                hint(exercise.warmUp, color: theme.palette.textSecondary)
                hint(exercise.plates, color: theme.palette.textSecondary)
                hint(exercise.progression, color: theme.palette.accentText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let libraryID = exercise.libraryID {
                Button("How to") { send(.howToTapped(exerciseID: libraryID)) }
                    .buttonStyle(.kobo(.plain, size: .compact))
            }
        }
        .padding(.horizontal, Space.lg)
    }

    @ViewBuilder
    private func hint(_ text: String?, color: Color) -> some View {
        if let text {
            Text(verbatim: text)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(color)
        }
    }
}
