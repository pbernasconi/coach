import CraftTokens
import SwiftUI

/// A section title with an optional subtitle and an optional trailing text button ("See all").
/// The title is a VoiceOver header; the button is a separate element.
///
///     SectionHeader("Recent", subtitle: "Last 7 days", actionTitle: "See all") { showAll() }
public struct SectionHeader: View {
    @Environment(\.craftTheme) private var theme
    private let title: Text
    private let subtitle: Text?
    private let actionTitle: LocalizedStringKey?
    private let action: (() -> Void)?

    /// A localized title with an optional subtitle.
    public init(_ title: LocalizedStringKey, subtitle: LocalizedStringKey? = nil) {
        self.init(title: Text(title), subtitle: subtitle.map { Text($0) }, actionTitle: nil, action: nil)
    }

    /// A localized title with a trailing action button.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        actionTitle: LocalizedStringKey,
        action: @escaping () -> Void
    ) {
        self.init(title: Text(title), subtitle: subtitle.map { Text($0) }, actionTitle: actionTitle, action: action)
    }

    /// A title and subtitle shown as is (user data).
    public init(verbatim title: String, subtitle: String? = nil) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), subtitle: subtitle, actionTitle: nil, action: nil)
    }

    /// A title and subtitle shown as is, with a trailing action button whose title stays localized.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        actionTitle: LocalizedStringKey,
        action: @escaping () -> Void
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), subtitle: subtitle, actionTitle: actionTitle, action: action)
    }

    private init(title: Text, subtitle: Text?, actionTitle: LocalizedStringKey?, action: (() -> Void)?) {
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                title
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    subtitle
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.accentText)
                    .frame(minHeight: Size.minTouch)
                    .contentShape(Rectangle())
            }
        }
    }
}

#if DEBUG
    private struct SectionHeaderPreview: View {
        var body: some View {
            VStack(spacing: Space.xxl) {
                SectionHeader("Recent")
                SectionHeader("This week", subtitle: "3 of 4 workouts")
                SectionHeader("Exercises", subtitle: "Sorted by last used", actionTitle: "See all") {}
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { SectionHeaderPreview() }
    #Preview("Dark") { SectionHeaderPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SectionHeaderPreview().dynamicTypeSize(.accessibility3) }
#endif
