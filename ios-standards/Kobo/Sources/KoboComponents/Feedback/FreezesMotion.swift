import KoboTokens
import SwiftUI

extension EnvironmentValues {
    /// Holds every looping effect (`.skeletonBreath()`, `.shimmering()`, `.pulse(active:)`) on its still frame, as
    /// Reduce Motion does. The loops read the frame clock, so a snapshot of a moving one is never the same twice: a
    /// snapshot or screenshot harness sets this for deterministic captures. Ported from an earlier app's
    /// `freezesSkeletonBreath`.
    ///
    ///     SnapshotHost { LoadingScreen() }.environment(\.koboFreezesMotion, true)
    @Entry public var koboFreezesMotion: Bool = false
}
