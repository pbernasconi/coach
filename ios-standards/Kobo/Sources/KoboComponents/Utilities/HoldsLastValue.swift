import SwiftUI

/// Draws `content` with the newest non-nil `value`, and keeps drawing the last one after `value` turns nil. For a sheet
/// or a detail pane that reads its item live from a list: when the item leaves the list during the dismiss, the content
/// stays while it slides away instead of going blank. Draws nothing until the first value.
///
///     .sheet(item: $selection) { _ in
///         HoldsLastValue(store.item(selection?.id)) { item in ItemDetail(item) }
///     }
public struct HoldsLastValue<Value: Equatable, Content: View>: View {
    @State private var last: Value?
    private let value: Value?
    private let content: (Value) -> Content

    public init(_ value: Value?, @ViewBuilder content: @escaping (Value) -> Content) {
        self.value = value
        self.content = content
    }

    public var body: some View {
        if let shown = value ?? last {
            content(shown)
                .onChange(of: value, initial: true) { _, new in
                    if let new { last = new }
                }
        }
    }
}
