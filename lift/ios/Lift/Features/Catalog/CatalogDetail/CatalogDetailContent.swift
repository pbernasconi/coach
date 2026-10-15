import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the animation, muscles, equipment, the dataset's steps and "Add to my exercises" (SCR-2).
struct CatalogDetailContent: View {
    let state: CatalogDetailState
    let send: (CatalogDetailAction) -> Void

    var body: some View {
        ScrollView {
            switch state.entry {
            case .loading:
                LoadingState()
                    .pageGutter()
            case .empty:
                EmptyState(
                    symbol: "dumbbell",
                    title: "Exercise not found",
                    message: "It is not in the catalog."
                )
                .pageGutter()
            case .failed:
                ErrorState(title: "The exercise catalog could not be loaded")
                    .pageGutter()
            case .loaded(let item):
                CatalogDetailBody(item: item, state: state, send: send)
            }
        }
        .screenCanvas()
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The loaded entry, top to bottom: name, the animation beside its muscles and equipment, the library action, then
/// the dataset's steps.
private struct CatalogDetailBody: View {
    let item: CatalogDetailItem
    let state: CatalogDetailState
    let send: (CatalogDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ExerciseTitle(name: item.name, kicker: item.bodyPart)
            ExerciseOverview {
                ExerciseMediaHero(animation: state.animation, name: item.name)
            } facts: {
                CatalogFacts(item: item)
            }
            LibraryAction(status: state.library, send: send)
            CardSection("Steps", padding: Space.md) {
                CatalogSteps(steps: item.steps)
            }
        }
        .pageGutter()
        .padding(.top, Space.xs)
        .padding(.bottom, Space.xxl)
    }
}

/// "Add to my exercises", or "In your library" once it is there.
private struct LibraryAction: View {
    let status: CatalogLibraryStatus
    let send: (CatalogDetailAction) -> Void

    var body: some View {
        switch status {
        case .checking:
            EmptyView()
        case .absent, .adding:
            Button("Add to my exercises", systemImage: "plus") { send(.addTapped) }
                .buttonStyle(.kobo(.primary, width: .full, isLoading: status == .adding))
        case .present:
            ListSection {
                ListRow("In your library", action: { send(.libraryExerciseTapped) }) {
                    Image(systemName: "checkmark.circle.fill").accessibilityHidden(true)
                }
            }
        }
    }
}

/// Target and secondary muscles as tags, and the equipment, beside the animation.
private struct CatalogFacts: View {
    let item: CatalogDetailItem

    var body: some View {
        ExerciseFact("Target") { MuscleTags(muscles: [item.target], style: .tonal) }
        if !item.secondary.isEmpty {
            ExerciseFact("Secondary") { MuscleTags(muscles: item.secondary, style: .outline) }
        }
        ExerciseFact("Equipment") {
            KoboTag(verbatim: item.equipment, tone: .neutral, systemImage: "dumbbell.fill")
        }
    }
}
