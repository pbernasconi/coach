import KoboComponents
import KoboTokens
import SwiftUI

extension View {
    /// The quiet bar title of a flow step: the flow's name in the footnote size and secondary ink, so the step heading
    /// in the body is the one title. Every step of a flow uses it, so the bar keeps one look while steps push. The
    /// navigation title stays set for VoiceOver and the back menu.
    ///
    ///     content.flowBarTitle("Import notes")
    public func flowBarTitle(_ title: LocalizedStringKey) -> some View {
        modifier(FlowBarTitle(title: Text(title)))
    }

    /// A quiet bar title shown as is (a record's name).
    public func flowBarTitle(verbatim title: String) -> some View {
        modifier(FlowBarTitle(title: Text(verbatim: title)))
    }
}

/// The quiet bar title; a `nil` title leaves the bar as the app set it.
struct FlowBarTitle: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let title: Text?

    func body(content: Content) -> some View {
        if let title {
            titled(content, title)
        } else {
            content
        }
    }

    private func titled(_ content: Content, _ title: Text) -> some View {
        content
            .navigationTitle(title)
            .toolbarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    title
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                        .lineLimit(1)
                        .accessibilityAddTraits(.isHeader)
                }
            }
    }
}
