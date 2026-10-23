import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Patterns section.
struct PatternsDemo: View {
    let component: CatalogComponent
    @State private var phase = DemoPhase.loaded
    @State private var confirming = false
    @State private var confirmingSheet = false

    var body: some View {
        switch component {
        case .loadableView:
            VStack(alignment: .leading, spacing: Space.md) {
                Picker("State", selection: $phase) {
                    ForEach(DemoPhase.allCases) { Text($0.rawValue.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
                LoadableView(phase.state, onRetry: { phase = .loaded }) { items in
                    VStack(alignment: .leading) { ForEach(items) { Text($0.name) } }
                } placeholder: {
                    VStack(alignment: .leading, spacing: Space.sm) {
                        ForEach(0..<3) { _ in Skeleton(.line).frame(maxWidth: Size.minTouch * 4) }
                    }
                    .skeletonPage()
                } empty: {
                    LoadableEmptyView("No recipes", systemImage: "fork.knife", message: "Add one from the library.")
                } failed: { message, retry in
                    LoadableFailedView(message: message, retry: retry)
                }
                .frame(minHeight: Size.minTouch * 3)
            }
        case .screenScaffold:
            NavigationStack {
                ScreenScaffold("Week", kicker: "Oct 12 – 18", headerStyle: .inline) {
                    Text("Screen content")
                }
            }
            .frame(height: Size.minTouch * 6)
        case .confirm:
            HStack(spacing: Space.sm) {
                Button("Delete recipe", role: .destructive) { confirming = true }
                    .buttonStyle(.kobo(.destructive))
                    .koboConfirm(
                        isPresented: $confirming,
                        .destructive(title: "Delete this recipe?", confirmLabel: "Delete") {}
                    )
                Button("Close order") { confirmingSheet = true }
                    .buttonStyle(.kobo(.secondary))
                    .koboConfirm(
                        isPresented: $confirmingSheet,
                        ConfirmationAction(
                            title: "Close this order?",
                            message: "2 items not packed yet.",
                            confirmLabel: "Close order",
                            cancelLabel: "Keep going"
                        ) {},
                        style: .sheet
                    )
            }
        case .skeletonHeader:
            SkeletonHeader(detailLines: 1).skeletonPage()
        case .skeletonStatGrid:
            VStack(spacing: Space.md) {
                SkeletonStatGrid(count: 4).koboCard()
                SkeletonStatGrid(count: 2, style: .tiles)
            }
            .skeletonPage()
        case .skeletonCard:
            VStack(spacing: Space.md) {
                SkeletonCard(lines: 0, blockHeight: Size.thumbnail * 2)
                SkeletonCard(title: .above, lines: 2)
            }
            .skeletonPage()
        default: EmptyView()
        }
    }
}

enum DemoPhase: String, CaseIterable, Identifiable {
    case loading, empty, loaded, failed

    var id: String { rawValue }

    var state: Loadable<[DemoItem]> {
        switch self {
        case .loading: .loading
        case .empty: .empty
        case .loaded: .loaded(["Lemon risotto", "Miso soup", "Shakshuka"].map(DemoItem.init))
        case .failed: .failed("Couldn't load recipes.", retryLabel: "Try again")
        }
    }
}

nonisolated struct DemoItem: Identifiable, Equatable, Sendable {
    let name: String
    var id: String { name }
}
