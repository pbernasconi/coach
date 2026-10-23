import KoboComponents
import SwiftUI

/// The banner over every tab while practice mode is on, so sample workouts are never mistaken for the real log.
nonisolated enum PracticeBanner: StackableBanner {
    case on

    var id: Self { self }
    var priority: BannerPriority { .normal }
}

extension View {
    /// Shows `PracticeBanner` above the content while `isOn`, with a Turn off button. It goes over the tab view in a
    /// stack, not as a safe-area inset: the tabs' navigation bars do not see an inset on the tab view, so their large
    /// titles drew over the banner. In the stack the tab view starts under the banner, and so do its bars.
    func practiceBanner(isOn: Bool, turnOff: @escaping () -> Void) -> some View {
        VStack(spacing: 0) {
            BannerStack(isOn ? [PracticeBanner.on] : []) { _ in
                SystemNotice(
                    "Practice mode: sample workouts, nothing is saved to your log",
                    symbol: "graduationcap",
                    tone: .info,
                    action: BannerAction("Turn off", perform: turnOff)
                )
            }
            self
        }
    }
}
