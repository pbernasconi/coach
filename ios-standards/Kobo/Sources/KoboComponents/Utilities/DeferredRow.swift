import SwiftUI

/// A `ForEach` row that SwiftUI may build off the main thread. This module defaults to the main actor, so a plain
/// `ForEach(rows) { row in … }` closure is main-actor isolated, and Swift 6 checks that isolation each time it runs.
/// During some animations SwiftUI builds rows on its async render thread and that check traps. `content(_:)` hands
/// `ForEach` a nonisolated function that only stores the element; the row closure runs in `body`, on the main thread.
///
///     ForEach(items, content: DeferredRow.content { item in ListRow(verbatim: item.name) })
///
/// A `ForEach` of `Tab` builds `TabContent`, not views, so it keeps its own closure.
nonisolated public struct DeferredRow<Element, Content: View>: View {
    let element: Element
    let row: (Element) -> Content

    public var body: some View { row(element) }

    /// The `content` of a `ForEach`: nonisolated, so SwiftUI may call it off the main thread.
    public static func content(@ViewBuilder _ row: @escaping (Element) -> Content) -> (Element) -> DeferredRow {
        { element in DeferredRow(element: element, row: row) }
    }
}
