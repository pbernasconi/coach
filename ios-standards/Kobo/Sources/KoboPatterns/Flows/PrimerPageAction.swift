import SwiftUI

/// A footer action of a `PrimerPage`: "Allow notifications", "Not now". While `isLoading` the button spins in place
/// and keeps its fill (the system prompt is on its way).
///
///     PrimerPageAction("Allow notifications", isLoading: isAsking, action: ask)
///     PrimerPageAction.notNow(action: skip)
public struct PrimerPageAction {
    let title: Text
    let isLoading: Bool
    let isEnabled: Bool
    let action: () -> Void

    public init(
        _ title: LocalizedStringKey,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.init(title: Text(title), isLoading: isLoading, isEnabled: isEnabled, action: action)
    }

    /// An action whose title is shown as is.
    public init(verbatim title: String, isLoading: Bool = false, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.init(title: Text(verbatim: title), isLoading: isLoading, isEnabled: isEnabled, action: action)
    }

    init(title: Text, isLoading: Bool, isEnabled: Bool, action: @escaping () -> Void) {
        self.title = title
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    /// The library's "Not now": the way past a primer that never asks again on its own.
    public static func notNow(action: @escaping () -> Void) -> PrimerPageAction {
        PrimerPageAction(title: Text("Not now", bundle: .module), isLoading: false, isEnabled: true, action: action)
    }

    /// The library's "Continue", for an onboarding page with no permission behind it.
    public static func `continue`(action: @escaping () -> Void) -> PrimerPageAction {
        PrimerPageAction(title: Text("Continue", bundle: .module), isLoading: false, isEnabled: true, action: action)
    }
}

extension PrimerPageModel {
    /// A model with localized copy, resolved from the app's String Catalog.
    public init(
        _ title: LocalizedStringResource,
        message: LocalizedStringResource,
        symbol: String? = nil,
        reasons: [Reason] = []
    ) {
        self.init(verbatim: String(localized: title), message: String(localized: message), symbol: symbol, reasons: reasons)
    }
}

extension PrimerPageModel.Reason {
    /// A reason with localized copy, resolved from the app's String Catalog.
    public init(symbol: String, _ text: LocalizedStringResource) {
        self.init(symbol: symbol, verbatim: String(localized: text))
    }
}
