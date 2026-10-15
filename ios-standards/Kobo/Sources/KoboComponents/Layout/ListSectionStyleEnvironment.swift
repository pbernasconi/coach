import KoboTokens
import SwiftUI

extension EnvironmentValues {
    /// The style every `ListSection` below this point uses; `.flat` by default (top-level lists use flat rows).
    @Entry public var listSectionStyle: ListSectionStyle = .flat
}

extension View {
    /// Sets the style of every `ListSection` inside this view.
    ///
    ///     VStack { ListSection("Defaults") { … } }.listSectionStyle(.grouped)
    public func listSectionStyle(_ style: ListSectionStyle) -> some View {
        environment(\.listSectionStyle, style)
    }
}
