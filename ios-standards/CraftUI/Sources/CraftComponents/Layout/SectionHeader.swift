import CraftTokens
import SwiftUI

/// A section title with an optional subtitle and an optional trailing text button ("See all").
/// The title is a VoiceOver header; the button is a separate element.
///
///     SectionHeader("Recent", subtitle: "Last 7 days", actionTitle: "See all") { showAll() }
public struct SectionHeader: View {
    @Environment(\.craftTheme) private var theme
    private let title: String
    private let subtitle: String?
    private let actionTitle: String?
    private let action: (() -> Void)?

    /// A title with an optional subtitle.
    public init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = nil
        self.action = nil
    }

    /// A title with a trailing action button.
    public init(_ title: String, subtitle: String? = nil, actionTitle: String, action: @escaping () -> Void) {
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(title)
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle)
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
