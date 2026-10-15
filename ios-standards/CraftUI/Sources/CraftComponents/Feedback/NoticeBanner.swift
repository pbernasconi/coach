import CraftTokens
import SwiftUI

/// An inline, toned notice inside a screen: a glyph, a title, an optional message, an optional action and an optional
/// dismiss button. The glyph carries the tone, so meaning never relies on colour alone.
///
///     NoticeBanner(tone: .warning, title: "You're offline", message: "Changes sync when you reconnect.")
public struct NoticeBanner: View {
    /// The one text action under the message ("Open Settings").
    public struct Action {
        public let label: Text
        public let perform: () -> Void

        /// An action with a localized label.
        public init(_ label: LocalizedStringKey, perform: @escaping () -> Void) {
            self.label = Text(label)
            self.perform = perform
        }

        /// An action whose label is shown as is.
        public init(verbatim label: String, perform: @escaping () -> Void) {
            self.label = Text(verbatim: label)
            self.perform = perform
        }
    }

    private let tone: Tone
    private let symbol: String?
    private let title: Text
    private let message: Text?
    private let action: Action?
    private let onDismiss: (() -> Void)?
    @Environment(\.craftTheme) private var theme

    /// - Parameters:
    ///   - symbol: an SF Symbol; `nil` uses the tone's glyph.
    ///   - onDismiss: shows a close button when given.
    public init(
        tone: Tone,
        symbol: String? = nil,
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        action: Action? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        let message = message.map { Text($0) }
        self.init(
            tone: tone,
            symbol: symbol,
            title: Text(title),
            message: message,
            action: action,
            onDismiss: onDismiss
        )
    }

    /// A banner whose title and message are shown as is (user data, server copy already reviewed).
    public init(
        tone: Tone,
        symbol: String? = nil,
        verbatim title: String,
        message: String? = nil,
        action: Action? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        let title = Text(verbatim: title)
        let message = message.map { Text(verbatim: $0) }
        self.init(tone: tone, symbol: symbol, title: title, message: message, action: action, onDismiss: onDismiss)
    }

    private init(tone: Tone, symbol: String?, title: Text, message: Text?, action: Action?, onDismiss: (() -> Void)?) {
        self.tone = tone
        self.symbol = symbol
        self.title = title
        self.message = message
        self.action = action
        self.onDismiss = onDismiss
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Image(systemName: symbol ?? tone.feedbackSymbol)
                .foregroundStyle(colors.ink)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                copy
                if let action {
                    Button(action: action.perform) {
                        action.label
                            .font(theme.font(.subheadline).weight(.semibold))
                            .underline()
                            .foregroundStyle(colors.ink)
                            .frame(minHeight: Size.minTouch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                        .frame(width: Size.minTouch, height: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Dismiss", bundle: .module))
            }
        }
        .padding(.leading, Space.md)
        .padding(.trailing, onDismiss == nil ? Space.md : Space.xxs)
        .padding(.vertical, action == nil ? Space.md : Space.sm)
        .background(colors.soft, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            title
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
            if let message {
                message
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }
}

private struct NoticeBannerPreviews: View {
    var body: some View {
        VStack(spacing: Space.md) {
            NoticeBanner(tone: .info, title: "New plan ready", message: "Week 3 starts Monday.")
            NoticeBanner(
                tone: .warning,
                title: "Notifications are off",
                message: "Turn them on to hear when rest is over.",
                action: .init("Open Settings") {},
                onDismiss: {}
            )
            NoticeBanner(tone: .danger, verbatim: "Couldn't sync “Push day”", onDismiss: {})
            NoticeBanner(tone: .success, symbol: "trophy.fill", title: "New personal record")
        }
        .padding()
    }
}

#Preview("Notice banner") { NoticeBannerPreviews() }
#Preview("Notice banner, dark") { NoticeBannerPreviews().preferredColorScheme(.dark) }
#Preview("Notice banner, AX3") { NoticeBannerPreviews().dynamicTypeSize(.accessibility3) }
