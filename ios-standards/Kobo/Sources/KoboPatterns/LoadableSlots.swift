import KoboComponents
import KoboTokens
import SwiftUI

/// The standard failure view: the danger art, "Couldn't load", the message and, when given, a retry button. VoiceOver
/// announces the title and message when it appears.
public struct LoadableFailedView: View {
    private let message: String
    private let retry: LoadableRetry?

    public init(message: String, retry: LoadableRetry?) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        let title = String(localized: "Couldn't load", bundle: .module)
        EmptyState(verbatim: title, message: message) {
            EmptyStateArt(systemImage: "exclamationmark.triangle.fill", tone: .danger)
        } actions: {
            if let retry {
                Button(action: retry.action) { retry.label }
                    .buttonStyle(.kobo(.primary))
            }
        }
        .onAppear { AccessibilityNotification.Announcement(title + ". " + message).post() }
    }
}

/// The standard empty view: an `EmptyState` with an icon, a title and an optional message.
public struct LoadableEmptyView: View {
    private enum Copy {
        case localized(LocalizedStringKey, message: LocalizedStringKey?)
        case verbatim(String, message: String?)
    }

    private let copy: Copy
    private let systemImage: String

    /// An empty view with localized copy.
    public init(_ title: LocalizedStringKey, systemImage: String = "tray", message: LocalizedStringKey? = nil) {
        self.copy = .localized(title, message: message)
        self.systemImage = systemImage
    }

    /// An empty view whose copy is shown as is (a search term, user data).
    public init(verbatim title: String, systemImage: String = "tray", message: String? = nil) {
        self.copy = .verbatim(title, message: message)
        self.systemImage = systemImage
    }

    public var body: some View {
        switch copy {
        case .localized(let title, let message):
            EmptyState(symbol: systemImage, title: title, message: message)
        case .verbatim(let title, let message):
            EmptyState(symbol: systemImage, verbatim: title, message: message)
        }
    }
}
