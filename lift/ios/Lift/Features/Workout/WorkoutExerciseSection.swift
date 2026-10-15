import KoboComponents
import KoboTokens
import SwiftUI

/// One exercise on the Workout screen: its name and plain hint lines, its set rows, and Add set.
struct WorkoutExerciseSection: View {
    @Environment(\.koboTheme) private var theme
    let exercise: WorkoutExercise
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
