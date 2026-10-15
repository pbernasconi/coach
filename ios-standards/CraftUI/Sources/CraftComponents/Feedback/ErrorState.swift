import CraftTokens
import SwiftUI

/// Content that failed to load: a title, reviewed copy (never a raw error) and an optional retry.
/// VoiceOver announces the title and message when it appears.
///
///     ErrorState(title: "Couldn't load history", message: "Check your connection.", retry: reload)
public struct ErrorState: View {
    private let title: String
    private let message: String?
    private let retryLabel: String?
    private let retry: (() -> Void)?
    @Environment(\.craftTheme) private var theme

    /// - Parameters:
    ///   - retryLabel: the button title; "Try again" when `nil`.
    ///   - retry: what the button does; no button when `nil` (for example, a permission denial).
    public init(
        title: String,
        message: String? = nil,
        retryLabel: String? = nil,
        retry: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.retryLabel = retryLabel
        self.retry = retry
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
                    buttonTitle
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

    private var buttonTitle: Text {
        if let retryLabel { Text(retryLabel) } else { Text("Try again") }
    }

    /// The title and the message, as one sentence pair.
    var announcement: String {
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
    ErrorState(title: "Couldn't load history", message: "Check your connection and try again.") {}
        .dynamicTypeSize(.accessibility3)
}
