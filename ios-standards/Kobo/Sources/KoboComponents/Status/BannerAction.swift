import KoboTokens
import SwiftUI

/// The one text action of a banner or notice ("Update", "Open Settings"): a label and what a tap does.
public struct BannerAction {
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
