import KoboTokens
import SwiftUI

extension View {
    /// Places the view on a rounded surface card: surface fill, continuous corners and a subtle shadow
    /// in light mode only (dark mode separates by tone). The card's edge goes on the page keyline (inside
    /// `.pageGutter()`), and its content sits one `Space.cardInset` in; keep that default unless the content fills the
    /// card edge to edge (pass `0`). Cards are for forms and grouped fields; a page's top-level list is a flat
    /// `ListSection`.
    ///
    ///     VStack { … }.koboCard()
    public func koboCard(padding: CGFloat = Space.cardInset) -> some View {
        modifier(KoboCardModifier(padding: padding))
    }
}

private struct KoboCardModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let padding: CGFloat

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                // The shadow belongs to the card's shape only, so text and images inside never cast one of their own.
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .fill(theme.palette.surface)
                    .shadow(color: shadowColor, radius: Space.sm, y: Space.xxs)
            }
    }

    private var shadowColor: Color {
        colorScheme == .dark ? .clear : theme.palette.textPrimary.opacity(CardShadow.opacity)
    }
}

/// The light-mode card shadow strength (a maths constant, not a colour).
enum CardShadow {
    static let opacity: Double = 0.06
}

/// A titled card: an optional header above a `.koboCard()` that holds the content.
///
///     CardSection("This week") { Text("3 tasks done") }
public struct CardSection<Header: View, Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let padding: CGFloat
    private let header: Header
    private let content: Content

    /// A card with a custom header slot.
    public init(
        padding: CGFloat = Space.cardInset,
        @ViewBuilder content: () -> Content,
        @ViewBuilder header: () -> Header
    ) {
        self.padding = padding
        self.content = content()
        self.header = header()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            header
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Space.md) { content }
                .koboCard(padding: padding)
        }
    }
}

extension CardSection where Header == Text? {
    /// A card with an optional localized title.
    public init(
        _ title: LocalizedStringKey? = nil,
        padding: CGFloat = Space.cardInset,
        @ViewBuilder content: () -> Content
    ) {
        self.init(padding: padding, content: content) { title.map { Text($0) } }
    }

    /// A card whose title is shown as is (user data).
    public init(verbatim title: String, padding: CGFloat = Space.cardInset, @ViewBuilder content: () -> Content) {
        self.init(padding: padding, content: content) { Optional(Text(verbatim: title)) }
    }
}

#if DEBUG
    private struct CardPreview: View {
        var body: some View {
            ScrollView {
                VStack(spacing: Space.xl) {
                    Text("A plain card with some text that wraps onto a second line.")
                        .koboCard()
                    CardSection("This week") {
                        Text("3 tasks done")
                        Text("2 h 40 min")
                    }
                    CardSection(padding: Space.md) {
                        Text("Compact padding")
                    } header: {
                        Label("Custom header", systemImage: "star")
                    }
                }
                .padding(Space.gutter)
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { CardPreview() }
    #Preview("Dark") { CardPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { CardPreview().dynamicTypeSize(.accessibility3) }
#endif
