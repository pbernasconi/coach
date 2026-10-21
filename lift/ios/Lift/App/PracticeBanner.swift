import KoboComponents
import SwiftUI

/// The banner over every tab while practice mode is on, so sample workouts are never mistaken for the real log.
nonisolated enum PracticeBanner: StackableBanner {
    case on

    var id: Self { self }
    var priority: BannerPriority { .normal }
}

extension View {
    /// Shows `PracticeBanner` above the content while `isOn`, with a Turn off button.
    func practiceBanner(isOn: Bool, turnOff: @escaping () -> Void) -> some View {
        bannerStack(isOn ? [PracticeBanner.on] : []) { _ in
            SystemNotice(
                "Practice mode: sample workouts, nothing is saved to your log",
                symbol: "graduationcap",
                tone: .info,
                action: BannerAction("Turn off", perform: turnOff)
            )
        }
    }
}
