import KoboComponents
import KoboTokens
import SwiftUI

/// Detail on a review that most people skip: the raw lines behind a summary, every line of a long import. A
/// `Collapsible` header in a card that shows or hides the content; VoiceOver reads "Expanded" or "Collapsed". It keeps
/// its own open state unless the caller passes `isExpanded`.
///
///     ReviewDisclosure("Show the pasted text", subtitle: "12 lines") { Text(verbatim: pasted).font(.callout) }
public struct ReviewDisclosure<Content: View>: View {
    private enum Title {
        case localized(LocalizedStringKey, subtitle: LocalizedStringKey?)
        case verbatim(String, subtitle: String?)
    }

    @State private var ownIsExpanded = false
    private let title: Title
    private let isExpanded: Binding<Bool>?
    private let content: Content

    /// - Parameter isExpanded: the open state when the caller owns it; `nil` keeps it inside, starting closed.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        isExpanded: Binding<Bool>? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = .localized(title, subtitle: subtitle)
        self.isExpanded = isExpanded
        self.content = content()
    }

    /// A disclosure whose title and subtitle are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        isExpanded: Binding<Bool>? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = .verbatim(title, subtitle: subtitle)
        self.isExpanded = isExpanded
        self.content = content()
    }

    public var body: some View {
        collapsible.koboCard()
    }

    @ViewBuilder private var collapsible: some View {
        let binding = isExpanded ?? $ownIsExpanded
        switch title {
        case .localized(let title, let subtitle):
            Collapsible(title, subtitle: subtitle, isExpanded: binding) { content }
        case .verbatim(let title, let subtitle):
            Collapsible(verbatim: title, subtitle: subtitle, isExpanded: binding) { content }
        }
    }
}
