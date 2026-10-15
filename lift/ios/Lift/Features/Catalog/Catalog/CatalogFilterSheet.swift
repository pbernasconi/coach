import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// A filter sheet's options: one facet, or "In my library" and every facet. Each option shows how many exercises it
/// would list, and options that would list none are disabled unless already chosen.
struct CatalogFilterSheet: View {
    let sheet: CatalogSheet
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        Group {
            switch sheet {
            case .facet(let facet):
                ListSection { options(facet) }
            case .all:
                if !state.library.isEmpty {
                    ListSection {
                        CheckRow(
                            "In my library",
                            value: state.counts.inLibrary.formatted(),
                            isOn: .action(state.filter.inLibrary) { _ in send(.libraryToggled) }
                        )
                    }
                }
                ForEach(CatalogFacet.allCases) { facet in
                    ListSection(verbatim: CatalogText.title(facet)) { options(facet) }
                }
            }
        }
        .listRowDensity(.compact)
    }

    private func options(_ facet: CatalogFacet) -> some View {
        ForEach(state.choices(facet)) { choice in
            CheckRow(
                verbatim: CatalogText.label(choice.value),
                value: choice.count.formatted(),
                isOn: .action(choice.isOn) { _ in send(.optionToggled(facet, choice.value)) }
            )
            .disabled(choice.count == 0 && !choice.isOn)
        }
    }
}

/// Reset (the sheet's facet, or every filter) and "Show N exercises", which closes the sheet.
struct CatalogSheetFooter: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let sheet: CatalogSheet
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        let layout =
            dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: Space.sm)) : AnyLayout(HStackLayout(spacing: Space.sm))
        layout {
            Button("Reset") { send(reset) }
                .buttonStyle(.kobo(.secondary, width: dynamicTypeSize.isAccessibilitySize ? .full : .hug))
                .disabled(!canReset)
            Button(String(localized: "Show \(state.resultCount) exercises")) { send(.sheetDismissed) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }

    private var reset: CatalogAction {
        switch sheet {
        case .all: .filtersCleared
        case .facet(let facet): .facetCleared(facet)
        }
    }

    private var canReset: Bool {
        switch sheet {
        case .all: !state.filter.isEmpty
        case .facet(let facet): !state.filter[facet].isEmpty
        }
    }
}
