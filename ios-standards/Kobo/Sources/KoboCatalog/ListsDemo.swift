import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Lists section: skeleton rows, paging footers and sections that load in place.
struct ListsDemo: View {
    let component: CatalogComponent
    @State private var phase = DemoPhase.loaded
    @State private var page = LoadMoreFooterModel(loadedCount: 20, totalCount: 54)

    var body: some View {
        switch component {
        case .listRowSkeleton:
            ListSection("Loading") { ListRowSkeleton(rows: 3) }
        case .loadMoreFooter:
            VStack(spacing: Space.md) {
                LoadMoreFooter(page) { page = page.loadStarted() }
                HStack {
                    Button("Finish page") {
                        page = page.pageLoaded(
                            loadedCount: min(page.loadedCount + 20, 54),
                            totalCount: 54,
                            hasMore: true
                        )
                    }
                    Button("Fail") { page = page.loadFailed() }
                }
                .buttonStyle(.kobo(.secondary))
            }
        case .loadableSection:
            VStack(alignment: .leading, spacing: Space.md) {
                phasePicker
                LoadableSection(placeState, skeletonRows: 2, emptyTitle: "No saved places", onRetry: retry) { places in
                    ListSection {
                        ForEach(places) { place in ListRow(verbatim: place.name, value: place.detail) }
                    }
                }
            }
        case .loadableCaptionSection:
            VStack(alignment: .leading, spacing: Space.md) {
                phasePicker
                LoadableCaptionSection(placeState, emptyCaption: "Nothing saved yet", onRetry: retry) { places in
                    Text(verbatim: "\(places.count) saved places")
                }
            }
        case .sectionEmptyCard:
            VStack(spacing: Space.md) {
                SectionEmptyCard("No notes yet", caption: "Notes you write show here.", systemImage: "note.text")
                SectionEmptyCard(verbatim: "Nothing shared with you")
            }
        default: EmptyView()
        }
    }

    private var phasePicker: some View {
        Picker("State", selection: $phase) {
            ForEach(DemoPhase.allCases) { Text($0.rawValue.capitalized).tag($0) }
        }
        .pickerStyle(.segmented)
    }

    private func retry() {
        phase = .loaded
    }

    private var placeState: Loadable<[CatalogPlace]> {
        switch phase {
        case .loading: .loading
        case .empty: .empty
        case .loaded: .loaded(CatalogSamples.places)
        case .failed: .failed(message: "Couldn't load saved places.", retryLabel: "Try again")
        }
    }
}
