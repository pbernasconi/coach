import SwiftUI

/// A footer action of an outcome: "Done" leaves the flow, "Start another" begins it again, "Try again" retries.
///
///     OutcomeAction("Done", action: close)
public struct OutcomeAction {
    let title: Text
    let action: () -> Void

    public init(_ title: LocalizedStringKey, action: @escaping () -> Void) {
        self.title = Text(title)
        self.action = action
    }

    /// An action whose title is shown as is.
    public init(verbatim title: String, action: @escaping () -> Void) {
        self.title = Text(verbatim: title)
        self.action = action
    }
}

extension OutcomeFact {
    /// A fact with a localized label, resolved from the app's String Catalog.
    public init(_ label: LocalizedStringResource, value: String, id: String? = nil) {
        self.init(verbatim: String(localized: label), value: value, id: id)
    }
}
