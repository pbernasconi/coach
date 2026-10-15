import Foundation
import KoboTokens
import SwiftUI

/// Content that failed to load, or a neutral gate (`kind: .restricted`): a title, reviewed copy (never a raw error) and
/// an optional action. VoiceOver announces the title and message when it appears.
///
/// While `isRetrying` the action keeps its fill and width and spins in place, for at least
/// `Motion.Duration.spinnerHold` from the tap, so Try again always shows the attempt, even when the answer comes back
/// before a frame is drawn; if the state is still here when the spinner stops, VoiceOver reads it again. A
/// `.restricted` state (no access, a record that is gone) draws a neutral lock instead of the danger glyph, because
/// nothing failed; its action ("Go back") never spins. Don't offer a retry for a permission denial.
///
///     ErrorState(title: "Couldn't load history", message: "Check your connection.", isRetrying: isLoading) { reload() }
///     ErrorState(title: "This plan isn't shared with you", kind: .restricted, retryLabel: "Go back") { dismiss() }
///
/// The localized initialiser takes `LocalizedStringResource` rather than `LocalizedStringKey` because the copy is
/// also spoken as an announcement, which needs a resolved string. Literals localize from the app's bundle either way.
public struct ErrorState: View {
    /// What the state stands for.
    public enum Kind: Sendable, Equatable, CaseIterable {
        /// A read that failed: the danger glyph, and an action that retries.
        case failure
        /// An access rule, a read-only gate or a record that is gone: a neutral lock, because nothing failed.
        case restricted
    }

    private let title: Text
    private let message: Text?
    private let kind: Kind
    private let retryLabel: Text?
    private let isRetrying: Bool
    private let secondaryAction: NoticeBanner.Action?
    private let retry: (() -> Void)?
    /// The title and the message, as one sentence pair.
    let announcement: String
    @State private var showsSpinner = false
    @State private var taps = 0

    /// - Parameters:
    ///   - kind: `.failure` (the default) or `.restricted`.
    ///   - retryLabel: the button title; "Try again" when `nil`.
    ///   - isRetrying: the failed read runs again; the button spins in place.
    ///   - secondaryAction: a quiet second action under the first ("Contact support"); shown only with `retry`.
    ///   - retry: what the button does; no button when `nil` (for example, a permission denial).
    public init(
        title: LocalizedStringResource,
        message: LocalizedStringResource? = nil,
        kind: Kind = .failure,
        retryLabel: LocalizedStringKey? = nil,
        isRetrying: Bool = false,
        secondaryAction: NoticeBanner.Action? = nil,
        retry: (() -> Void)? = nil
    ) {
        self.title = Text(title)
        self.message = message.map { Text($0) }
        self.kind = kind
        self.retryLabel = retryLabel.map { Text($0) }
        self.isRetrying = isRetrying
        self.secondaryAction = secondaryAction
        self.retry = retry
        self.announcement = Self.sentences(String(localized: title), message.map { String(localized: $0) })
    }

    /// An error whose title and message are shown as is (already-resolved copy).
    public init(
        verbatim title: String,
        message: String? = nil,
        kind: Kind = .failure,
        retryLabel: LocalizedStringKey? = nil,
        isRetrying: Bool = false,
        secondaryAction: NoticeBanner.Action? = nil,
        retry: (() -> Void)? = nil
    ) {
        self.title = Text(verbatim: title)
        self.message = message.map { Text(verbatim: $0) }
        self.kind = kind
        self.retryLabel = retryLabel.map { Text($0) }
        self.isRetrying = isRetrying
        self.secondaryAction = secondaryAction
        self.retry = retry
        self.announcement = Self.sentences(title, message)
    }

    public var body: some View {
        FeedbackStateLayout(art: art, title: title, message: message, actions: actions)
            .accessibilityElement(children: .contain)
            .onAppear { announce() }
            .spinnerHold(isBusy: isRetrying, taps: taps, isShown: $showsSpinner)
            // The attempt ended and the state is still here: it failed again, so VoiceOver reads it again.
            .onChange(of: showsSpinner) { _, shows in
                if !shows { announce() }
            }
    }

    private var art: EmptyStateArt {
        switch kind {
        case .failure: EmptyStateArt(systemImage: "exclamationmark.triangle.fill", tone: .danger)
        case .restricted: EmptyStateArt(systemImage: "lock.fill", tone: .neutral)
        }
    }

    @ViewBuilder private var actions: some View {
        if let retry {
            VStack(spacing: Space.sm) {
                Button {
                    if kind == .failure { taps += 1 }
                    retry()
                } label: {
                    retryLabel ?? Text("Try again", bundle: .module)
                }
                .buttonStyle(.kobo(.primary, isLoading: showsSpinner))
                if let secondaryAction {
                    Button(action: secondaryAction.perform) { secondaryAction.label }
                        .buttonStyle(.kobo(.plain))
                }
            }
        }
    }

    private func announce() {
        AccessibilityNotification.Announcement(announcement).post()
    }

    private static func sentences(_ title: String, _ message: String?) -> String {
        [title, message].compactMap(\.self).joined(separator: ". ")
    }
}

#Preview("Error") {
    ErrorState(title: "Couldn't load history", message: "Check your connection and try again.") {}
}

#Preview("Error, retrying, dark") {
    ErrorState(
        title: "Couldn't load history",
        message: "Check your connection and try again.",
        isRetrying: true,
        secondaryAction: .init("Contact support") {}
    ) {}
    .preferredColorScheme(.dark)
}

#Preview("Restricted, solid") {
    ErrorState(
        title: "No access",
        message: "Ask the owner to share this plan.",
        kind: .restricted,
        retryLabel: "Go back"
    ) {}
    .koboTheme(Theme(palette: .lift, surfaceStyle: .solid))
}

#Preview("Error, AX3") {
    ErrorState(verbatim: "Couldn't load “Push day”", message: "Check your connection and try again.") {}
        .dynamicTypeSize(.accessibility3)
}
