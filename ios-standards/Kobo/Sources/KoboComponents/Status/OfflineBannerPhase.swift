import Foundation

/// What the offline slot of a `BannerStack` shows: nothing, "No internet connection", or, after a drop of at least
/// `longDropAfter`, "Back online" for `backOnlineHold` before the slot closes. A shorter drop closes silently, so a
/// flapping connection never flashes two banners. A pure value; `.offlineBannerPhase(isOffline:phase:clock:)` moves it.
///
///     @State private var offline = OfflineBannerPhase()
///     content.offlineBannerPhase(isOffline: network.isOffline, phase: $offline)
nonisolated public struct OfflineBannerPhase: Equatable, Sendable {
    /// What the slot draws.
    public enum Presence: Equatable, Sendable {
        case hidden, offline, backOnline
    }

    public private(set) var presence: Presence = .hidden
    /// The drop has lasted `longDropAfter`: the return says "Back online".
    public private(set) var isLongDrop = false

    public init() {}

    init(_ presence: Presence, isLongDrop: Bool = false) {
        self.presence = presence
        self.isLongDrop = isLongDrop
    }

    /// A drop this long says "Back online" when it ends.
    public static let longDropAfter: Duration = .seconds(2)
    /// How long "Back online" shows before the slot closes.
    public static let backOnlineHold: Duration = .milliseconds(1_500)

    /// The phase after the connection dropped (`isOffline`) or came back.
    public func connectivityChanged(isOffline: Bool) -> OfflineBannerPhase {
        if isOffline { return presence == .offline ? self : OfflineBannerPhase(.offline) }
        guard presence == .offline else { return self }
        return isLongDrop ? OfflineBannerPhase(.backOnline) : OfflineBannerPhase()
    }

    /// The phase after the drop reached `longDropAfter`. A late timer of another phase changes nothing.
    public func longDropReached() -> OfflineBannerPhase {
        presence == .offline ? OfflineBannerPhase(.offline, isLongDrop: true) : self
    }

    /// The phase after "Back online" held for `backOnlineHold`: the slot closes.
    public func holdEnded() -> OfflineBannerPhase {
        presence == .backOnline ? OfflineBannerPhase() : self
    }

    /// The timer the current presence waits on, or `nil` when nothing is pending.
    var pendingTimer: Duration? {
        switch presence {
        case .offline: isLongDrop ? nil : Self.longDropAfter
        case .backOnline: Self.backOnlineHold
        case .hidden: nil
        }
    }

    /// The phase after the pending timer fired.
    func timerFired() -> OfflineBannerPhase {
        switch presence {
        case .offline: longDropReached()
        case .backOnline: holdEnded()
        case .hidden: self
        }
    }
}
