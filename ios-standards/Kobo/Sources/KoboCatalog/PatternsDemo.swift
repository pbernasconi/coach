import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Patterns section.
struct PatternsDemo: View {
    let component: CatalogComponent
    @State private var phase = DemoPhase.loaded
    @State private var confirming = false

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
                    LoadingState("Loading exercises")
                } empty: {
                    LoadableEmptyView("No exercises", systemImage: "dumbbell", message: "Add one from the library.")
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
            Button("Delete workout", role: .destructive) { confirming = true }
                .buttonStyle(.kobo(.destructive))
                .koboConfirm(
                    isPresented: $confirming,
                    .destructive(title: "Delete this workout?", confirmLabel: "Delete") {}
                )
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
        case .loaded: .loaded(["Back squat", "Bench press", "Barbell row"].map(DemoItem.init))
        case .failed: .failed("Couldn't load exercises.", retryLabel: "Try again")
        }
    }
}

nonisolated struct DemoItem: Identifiable, Equatable, Sendable {
    let name: String
    var id: String { name }
}
