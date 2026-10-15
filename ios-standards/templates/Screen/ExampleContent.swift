import Design
import KoboComponents
import SwiftUI

/// Dumb view: draws `state`, reports intents through `send`. Nothing else (SCR-2).
struct ExampleContent: View {
    let state: ExampleState
    let send: (ExampleAction) -> Void

    var body: some View {
        List {
            switch state.items {
            case .loading:
                LoadingRow()
            case .empty:
                EmptyStateRow(title: "Nothing yet", message: "Add your first one below.")
            case .failed(let kind):
                ErrorRow(kind: kind, retry: { send(.retryTapped) })
            case .loaded(let items):
                ForEach(items) { item in
                    Button {
                        send(.itemTapped(item.id))
                    } label: {
                        ExampleRow(item: item)
                    }
                }
            }
            Section {
                KoboTextField("Name", text: binding(state.draftName) { send(.nameChanged($0)) })
                Button("Save") { send(.saveTapped) }
                    .buttonStyle(.glassProminent)
                    .disabled(state.save == .saving)
            }
        }
    }
}
