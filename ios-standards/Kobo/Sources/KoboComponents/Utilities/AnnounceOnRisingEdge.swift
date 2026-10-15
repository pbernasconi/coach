import SwiftUI

/// Speaks a message to VoiceOver when it appears or changes. iOS has no live region, so an alert that is not announced
/// is heard by nobody.
private struct AnnounceOnRisingEdge: ViewModifier {
    let message: String?
    /// The message spoken last. SwiftUI calls `onAppear` again after a tab switch or a pop; this state survives that,
    /// so a message that already shows stays quiet when the screen comes back.
    @State private var announced: String?

    func body(content: Content) -> some View {
        content
            .onAppear { update(to: message) }
            .onChange(of: message) { _, new in update(to: new) }
    }

    private func update(to new: String?) {
        let step = AnnouncementEdge.step(announced: announced, message: new)
        if let text = step.speak { AccessibilityNotification.Announcement(text).post() }
        announced = step.announced
    }
}

extension View {
    /// Speaks `message` to VoiceOver when it appears or changes to a new non-empty value. A repeat stays quiet; after
    /// `nil` the same message speaks again. Resolve literal copy with `String(localized:)`.
    ///
    ///     ErrorLine(text).announceOnRisingEdge(text)
    public func announceOnRisingEdge(_ message: String?) -> some View {
        modifier(AnnounceOnRisingEdge(message: message))
    }

    /// Speaks `message` to VoiceOver each time `condition` becomes true.
    ///
    ///     form.announce(String(localized: "Saved"), when: didSave)
    public func announce(_ message: String, when condition: Bool) -> some View {
        modifier(AnnounceOnRisingEdge(message: condition ? message : nil))
    }
}
