import KoboComponents
import SwiftUI

extension View {
    /// Pull to refresh with Kobo's haptic: `.refreshable`, plus one light `feedback` the moment the system control starts
    /// the refresh (a tinted refresh control plays none of its own). The system spinner stays: it owns the pull physics.
    /// Tint it once at launch with `RefreshControlTint.apply(_:)`. Attach it only over loaded content
    /// (`Loadable.Phase.acceptsRefresh`), and not inside a sheet, where the pull should close the sheet.
    ///
    ///     List { … }.koboRefreshable { await model.refresh() }
    public func koboRefreshable(
        feedback: HapticFeedback? = .tap,
        _ action: @escaping @Sendable () async -> Void
    ) -> some View {
        modifier(KoboRefreshableModifier(feedback: feedback, action: action))
    }
}

private struct KoboRefreshableModifier: ViewModifier {
    @State private var starts = 0
    let feedback: HapticFeedback?
    let action: @Sendable () async -> Void

    func body(content: Content) -> some View {
        content
            .refreshable { @MainActor in
                starts += 1
                await action()
            }
            .koboFeedback(feedback, trigger: starts)
    }
}
