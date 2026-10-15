import KoboTokens
import SwiftUI

/// One dismissible feature suggestion on a home screen: an accent-tinted glyph disc, a title, the whole message (no
/// clamp: its last sentence is often the reason to act), a `TextLink` call to action and, when `onDismiss` is given, a
/// 44 pt close button. On a card surface; VoiceOver reads the copy, then the link and the close button.
///
///     SuggestionCard(
///         "Plan your week", message: "Pick three sessions and we'll remind you.", systemImage: "calendar",
///         actionTitle: "Plan now", onAction: plan, onDismiss: hide
///     )
public struct SuggestionCard: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var discSize = Size.minTouch
    private let title: Text
    private let message: Text
    private let systemImage: String
    private let actionTitle: Text
    private let onAction: () -> Void
    private let onDismiss: (() -> Void)?

    public init(
        _ title: LocalizedStringKey,
        message: LocalizedStringKey,
        systemImage: String,
        actionTitle: LocalizedStringKey,
        onAction: @escaping () -> Void,
        onDismiss: (() -> Void)? = nil
    ) {
        self.title = Text(title)
        self.message = Text(message)
        self.systemImage = systemImage
        self.actionTitle = Text(actionTitle)
        self.onAction = onAction
        self.onDismiss = onDismiss
    }

    /// A card whose copy is shown as is (server copy already reviewed).
    public init(
        verbatim title: String,
        message: String,
        systemImage: String,
        actionTitle: String,
        onAction: @escaping () -> Void,
        onDismiss: (() -> Void)? = nil
    ) {
        self.title = Text(verbatim: title)
        self.message = Text(verbatim: message)
        self.systemImage = systemImage
        self.actionTitle = Text(verbatim: actionTitle)
        self.onAction = onAction
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            Image(systemName: systemImage)
                .font(theme.font(.body).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
                .frame(width: discSize, height: discSize)
                .background(theme.palette.accentSoft, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    title
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textPrimary)
                    message
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
                Button(action: onAction) {
                    actionTitle
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                        .frame(minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.textLink)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let onDismiss {
                IconButton(
                    "xmark",
                    label: Text("Dismiss suggestion", bundle: .module),
                    style: .plain,
                    size: .small,
                    action: onDismiss
                )
            }
        }
        .koboCard(padding: Space.lg)
        .accessibilityElement(children: .contain)
    }
}

#if DEBUG
    private struct SuggestionCardPreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                SuggestionCard(
                    "Plan your week",
                    message: "Pick three sessions and we'll remind you the evening before each one.",
                    systemImage: "calendar",
                    actionTitle: "Plan now",
                    onAction: {},
                    onDismiss: {}
                )
                SuggestionCard(
                    "Turn on Health sync",
                    message: "Bring in your runs and walks.",
                    systemImage: "heart",
                    actionTitle: "Connect",
                    onAction: {}
                )
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Suggestion card") { SuggestionCardPreview() }
    #Preview("Suggestion card · dark, Amber") { SuggestionCardPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Suggestion card · AX3") { SuggestionCardPreview().dynamicTypeSize(.accessibility3) }
#endif
