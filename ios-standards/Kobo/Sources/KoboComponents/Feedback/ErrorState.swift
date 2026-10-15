import Foundation
import KoboTokens
import SwiftUI

/// Content that failed to load: a title, reviewed copy (never a raw error) and an optional retry.
/// VoiceOver announces the title and message when it appears.
///
///     ErrorState(title: "Couldn't load history", message: "Check your connection.", retry: reload)
///
/// The localized initialiser takes `LocalizedStringResource` rather than `LocalizedStringKey` because the copy is
/// also spoken as an announcement, which needs a resolved string. Literals localize from the app's bundle either way.
public struct ErrorState: View {
    private let title: Text
    private let message: Text?
    private let retryLabel: Text?
    private let retry: (() -> Void)?
    /// The title and the message, as one sentence pair.
    let announcement: String
    @Environment(\.koboTheme) private var theme

    /// - Parameters:
    ///   - retryLabel: the button title; "Try again" when `nil`.
    ///   - retry: what the button does; no button when `nil` (for example, a permission denial).
    public init(
        title: LocalizedStringResource,
        message: LocalizedStringResource? = nil,
        retryLabel: LocalizedStringKey? = nil,
        retry: (() -> Void)? = nil
    ) {
        self.title = Text(title)
        self.message = message.map { Text($0) }
        self.retryLabel = retryLabel.map { Text($0) }
        self.retry = retry
        self.announcement = Self.sentences(String(localized: title), message.map { String(localized: $0) })
    }

    /// An error whose title and message are shown as is (already-resolved copy).
    public init(
        verbatim title: String,
        message: String? = nil,
        retryLabel: LocalizedStringKey? = nil,
        retry: (() -> Void)? = nil
    ) {
        self.title = Text(verbatim: title)
        self.message = message.map { Text(verbatim: $0) }
        self.retryLabel = retryLabel.map { Text($0) }
        self.retry = retry
        self.announcement = Self.sentences(title, message)
    }

    public var body: some View {
        FeedbackStateLayout(
            symbol: "exclamationmark.triangle.fill",
            symbolTone: .danger,
            title: title,
            message: message
        ) {
            if let retry {
                Button(action: retry) {
                    (retryLabel ?? Text("Try again", bundle: .module))
                        .font(theme.font(.headline))
                        .frame(minHeight: Size.minTouch)
                        .padding(.horizontal, Space.lg)
                }
                .buttonStyle(.glassProminent)
                .tint(theme.palette.accent)
            }
        }
        .accessibilityElement(children: .contain)
        .onAppear { AccessibilityNotification.Announcement(announcement).post() }
    }

    private static func sentences(_ title: String, _ message: String?) -> String {
        [title, message].compactMap(\.self).joined(separator: ". ")
    }
}

#Preview("Error") {
    ErrorState(title: "Couldn't load history", message: "Check your connection and try again.") {}
}

#Preview("Error, dark") {
    ErrorState(title: "No access", message: "Ask the owner to share this plan.")
        .preferredColorScheme(.dark)
}

#Preview("Error, AX3") {
    ErrorState(verbatim: "Couldn't load “Push day”", message: "Check your connection and try again.") {}
        .dynamicTypeSize(.accessibility3)
}
