import KoboTokens
import SwiftUI

/// The level of a quiet section title (DL-H3): `.section` heads a group of rows or a part of a page, `.subsection`
/// heads a part inside one (the steps inside "How to", the facts on a card). Both are sentence case in the secondary
/// ink; the levels differ in size only, so a page has one title voice.
public enum SectionTitleLevel: Sendable, Equatable, CaseIterable {
    /// A section of a page: a `ListSection` header, a detail part's heading.
    case section
    /// A part inside a section or a card.
    case subsection
}

extension View {
    /// Styles a title as a quiet section title: sentence case, semibold, the secondary ink and a VoiceOver header.
    /// `ListSection` uses it for its header; use it for any other section heading so every screen has one look.
    ///
    ///     Text("How to").sectionTitleStyle()
    ///     Text("Setup").sectionTitleStyle(.subsection)
    public func sectionTitleStyle(_ level: SectionTitleLevel = .section) -> some View {
        modifier(SectionTitleModifier(level: level))
    }
}

private struct SectionTitleModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let level: SectionTitleLevel

    func body(content: Content) -> some View {
        content
            .font(theme.font(level == .section ? .subheadline : .footnote).weight(.semibold))
            .foregroundStyle(theme.palette.textSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}

#if DEBUG
    private struct SectionTitleStylePreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(verbatim: "Recent trips").sectionTitleStyle()
                Text(verbatim: "Packing").sectionTitleStyle(.subsection)
                Text(verbatim: "Passport, charger, a light jacket.")
            }
            .pageGutter()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { SectionTitleStylePreview() }
    #Preview("Dark") { SectionTitleStylePreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SectionTitleStylePreview().dynamicTypeSize(.accessibility3) }
#endif
