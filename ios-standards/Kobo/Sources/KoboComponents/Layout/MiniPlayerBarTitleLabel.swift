import SwiftUI

// The labelled `title:` initialisers of `MiniPlayerBar`, kept so code written before 0.1 still compiles. Every other
// Kobo component takes its localized title unlabelled (`MiniPlayerBar("Rest", …)`), as SwiftUI does.
extension MiniPlayerBar {
    /// A bar with a localized title and subtitle.
    @available(*, deprecated, renamed: "init(_:subtitle:chrome:action:leading:trailing:)")
    public init(
        title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(title, subtitle: subtitle, chrome: chrome, action: action, leading: leading, trailing: trailing)
    }
}

extension MiniPlayerBar where Trailing == EmptyView {
    /// A bar with a localized title, a leading slot and no trailing button.
    @available(*, deprecated, renamed: "init(_:subtitle:chrome:action:leading:)")
    public init(
        title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(title, subtitle: subtitle, chrome: chrome, action: action, leading: leading)
    }
}
