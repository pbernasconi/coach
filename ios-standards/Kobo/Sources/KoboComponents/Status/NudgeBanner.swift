import KoboTokens
import SwiftUI

/// A dismissible suggestion across the top of the app ("A new version is available", "Turn on backups"): a glyph, one
/// line of copy, an optional text action and a close button. It never blocks use; how often it may come back after a
/// dismissal is the app's rule. Queue it in a `BannerStack` with a low priority.
///
///     NudgeBanner("A new version is available.", action: .init("Update", perform: openStore), onDismiss: dismiss)
public struct NudgeBanner: View {
    @Environment(\.koboTheme) private var theme
    private let message: Text
    private let symbol: String
    private let tone: Tone
    private let action: BannerAction?
    private let onDismiss: () -> Void

    /// - Parameters:
    ///   - symbol: an SF Symbol before the message.
    ///   - action: a trailing text action; `nil` shows only the close button.
    public init(
        _ message: LocalizedStringKey,
        symbol: String = "sparkles",
        tone: Tone = .info,
        action: BannerAction? = nil,
        onDismiss: @escaping () -> Void
    ) {
        self.init(message: Text(message), symbol: symbol, tone: tone, action: action, onDismiss: onDismiss)
    }

    /// A banner whose message is shown as is (an app name, server copy already reviewed).
    public init(
        verbatim message: String,
        symbol: String = "sparkles",
        tone: Tone = .info,
        action: BannerAction? = nil,
        onDismiss: @escaping () -> Void
    ) {
        self.init(message: Text(verbatim: message), symbol: symbol, tone: tone, action: action, onDismiss: onDismiss)
    }

    private init(message: Text, symbol: String, tone: Tone, action: BannerAction?, onDismiss: @escaping () -> Void) {
        self.message = message
        self.symbol = symbol
        self.tone = tone
        self.action = action
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: Space.md) {
            Image(systemName: symbol)
                .font(theme.font(.body))
                .accessibilityHidden(true)
            message
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if let action {
                Button(action: action.perform) {
                    action.label
                        .font(theme.font(.subheadline).weight(.semibold))
                        .frame(minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            BannerDismissButton(label: Text("Dismiss", bundle: .module), action: onDismiss)
        }
        .padding(.trailing, -Space.md)
        .shellBanner(tone: tone, verticalPadding: Space.xxs)
        .accessibilityElement(children: .contain)
    }
}

#if DEBUG
    private struct NudgeBannerPreview: View {
        var body: some View {
            VStack(spacing: 0) {
                NudgeBanner("A new version is available.", action: .init("Update") {}, onDismiss: {})
                Separator()
                NudgeBanner("Turn on backups to keep your history safe.", symbol: "icloud", onDismiss: {})
                Spacer()
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Nudge banner") { NudgeBannerPreview() }
    #Preview("Nudge banner · dark, Amber") { NudgeBannerPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Nudge banner · AX3") { NudgeBannerPreview().dynamicTypeSize(.accessibility3) }
#endif
