import KoboComponents
import KoboTokens
import SwiftUI

/// The search field, body-part chips and the equipment menu.
struct CatalogFilters: View {
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SearchField(
                text: .action(state.query) { send(.queryChanged($0)) },
                prompt: "Search by name, muscle or equipment"
            )
            ScrollView(.horizontal) {
                HStack(spacing: Space.sm) {
                    ForEach(bodyParts) { choice in
                        Chip(verbatim: title(choice), isSelected: state.bodyPart == choice) {
                            send(.bodyPartChanged(choice))
                        }
                    }
                }
                .pageGutter()
            }
            .scrollIndicators(.hidden)
            .bleedsPageGutter()
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Text("Body part"))
            MenuSelectField(
                "Equipment",
                selection: Binding<CatalogChoice>.action(state.equipment) { send(.equipmentChanged($0)) },
                options: equipment
            )
        }
    }

    private var bodyParts: [CatalogChoice] {
        [.any] + state.bodyParts.map(CatalogChoice.only)
    }

    private var equipment: [ChoiceOption<CatalogChoice>] {
        [ChoiceOption(.any, title: "Any equipment")]
            + state.equipmentKinds.map { ChoiceOption(.only($0), verbatim: CatalogText.label($0)) }
    }

    private func title(_ choice: CatalogChoice) -> String {
        choice.value.map(CatalogText.label) ?? String(localized: "All")
    }
}
