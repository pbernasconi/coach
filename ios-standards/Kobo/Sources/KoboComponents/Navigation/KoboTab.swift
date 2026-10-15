import KoboTokens
import SwiftUI

/// One tab of a `TabShell`: its value, title, SF Symbol and badge count. The system bar draws the symbol and tints it;
/// a badge of 0 shows nothing and counts above 99 read "99+". Build the list from app state, and leave a tab out (rather
/// than disabling it) when the person may not use it.
///
///     KoboTab("Inbox", systemImage: "tray", value: .inbox, badge: unread)
public struct KoboTab<Value: Hashable>: Identifiable {
    public let value: Value
    public let title: Text
    public let systemImage: String
    public let badge: Int

    public var id: Value { value }

    /// A tab with a localized title.
    public init(_ title: LocalizedStringKey, systemImage: String, value: Value, badge: Int = 0) {
        self.init(title: Text(title), systemImage: systemImage, value: value, badge: badge)
    }

    /// A tab whose title is shown as is.
    public init(verbatim title: String, systemImage: String, value: Value, badge: Int = 0) {
        self.init(title: Text(verbatim: title), systemImage: systemImage, value: value, badge: badge)
    }

    init(title: Text, systemImage: String, value: Value, badge: Int) {
        self.value = value
        self.title = title
        self.systemImage = systemImage
        self.badge = badge
    }
}
