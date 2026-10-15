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
                EmptyState(symbol: "dumbbell", title: "Exercise not found", message: "It is not in the catalog.")
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

/// The loaded entry, top to bottom.
private struct CatalogDetailBody: View {
    let item: CatalogDetailItem
    let state: CatalogDetailState
    let send: (CatalogDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AppHeader(verbatim: item.name, kicker: item.bodyPart)
            VStack(alignment: .leading, spacing: Space.xxl) {
                ExerciseMediaHero(animation: state.animation, name: item.name)
                    .koboCard()
                LibraryAction(status: state.library, send: send)
                CatalogFacts(item: item)
                CardSection("Steps") {
                    CatalogSteps(steps: item.steps)
                }
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
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

/// Target and secondary muscles as tags, and the equipment.
private struct CatalogFacts: View {
    @Environment(\.koboTheme) private var theme
    let item: CatalogDetailItem

    var body: some View {
        CardSection("Muscles") {
            tags("Target", [item.target], style: .tonal)
            if !item.secondary.isEmpty {
                tags("Secondary", item.secondary, style: .outline)
            }
        }
        CardSection("Equipment") {
            Text(verbatim: item.equipment)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
        }
    }

    private func tags(_ title: LocalizedStringKey, _ muscles: [String], style: KoboTag.Style) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            FlowLayout {
                // Fixed labels from the catalog; the offset is a stable identity for them.
                ForEach(Array(muscles.enumerated()), id: \.offset) { _, muscle in
                    KoboTag(verbatim: muscle, tone: .accent, style: style)
                }
            }
        }
    }
}
