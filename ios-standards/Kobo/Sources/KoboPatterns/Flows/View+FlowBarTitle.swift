import KoboComponents
import KoboTokens
import SwiftUI

extension View {
    /// The bar title of a flow step: the flow's name as the standard inline navigation title, the same title every
    /// pushed screen of the app shows, so a modal flow and a pushed page share one header look. Every step of a flow
    /// uses it, so the bar keeps one look while steps push.
    ///
    ///     content.flowBarTitle("Import notes")
    public func flowBarTitle(_ title: LocalizedStringKey) -> some View {
        modifier(FlowBarTitle(title: Text(title)))
    }

    /// A bar title shown as is (a record's name).
    public func flowBarTitle(verbatim title: String) -> some View {
        modifier(FlowBarTitle(title: Text(verbatim: title)))
    }
}

/// The inline bar title; a `nil` title leaves the bar as the app set it.
struct FlowBarTitle: ViewModifier {
    let title: Text?

    func body(content: Content) -> some View {
        if let title {
            content
                .navigationTitle(title)
                .toolbarTitleDisplayMode(.inline)
        } else {
            content
        }
    }
}
