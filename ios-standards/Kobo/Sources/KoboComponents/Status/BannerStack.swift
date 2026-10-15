import KoboTokens
import SwiftUI

/// The one slot for app-wide banners at the top of a screen. It queues the app's banners and the built-in offline
/// banner by `BannerPriority` (ties keep their order), shows at most `maxVisible`, and moves the next one up when a
/// banner leaves. Mount it with `.bannerStack(_:isOffline:banner:)`, which pays the top inset once however many
/// banners show. Stacked banners draw a hairline between them, so two banners of one tone never merge. Each banner
/// fades in and out; the offline slot opens and closes its height and says "Back online" after a long drop
/// (`OfflineBannerPhase`). Reduce Motion keeps only short fades.
///
///     content.bannerStack(banners, isOffline: network.isOffline) { banner in
///         switch banner {
///         case .update: NudgeBanner("A new version is available.", onDismiss: dismissUpdate)
///         case .maintenance(let text): SystemNotice(verbatim: text, symbol: "wrench.and.screwdriver")
///         }
///     }
public struct BannerStack<Item: StackableBanner, Banner: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offline: OfflineBannerPhase
    private let items: [Item]
    private let isOffline: Bool
    private let offlinePriority: BannerPriority
    private let maxVisible: Int
    private let clock: any Clock<Duration>
    private let banner: (Item) -> Banner

    /// - Parameters:
    ///   - items: the app's banners, in the order to show ties.
    ///   - isOffline: the connection is down; drives the built-in offline banner.
    ///   - offlinePriority: where the offline banner sits among the app's banners.
    ///   - maxVisible: how many banners show at once; the rest wait.
    ///   - clock: the time source of the offline timers (inject a test clock in tests).
    public init(
        _ items: [Item],
        isOffline: Bool = false,
        offlinePriority: BannerPriority = .high,
        maxVisible: Int = 2,
        clock: any Clock<Duration> = ContinuousClock(),
        @ViewBuilder banner: @escaping (Item) -> Banner
    ) {
        self.items = items
        self.isOffline = isOffline
        self.offlinePriority = offlinePriority
        self.maxVisible = maxVisible
        self.clock = clock
        self.banner = banner
        // A launch that starts offline shows the banner in its first frame, with no motion.
        _offline = State(initialValue: OfflineBannerPhase().connectivityChanged(isOffline: isOffline))
    }

    public var body: some View {
        let slots = visibleSlots
        VStack(spacing: 0) {
            ForEach(slots) { slot in
                slotView(slot)
                    .overlay(alignment: .top) {
                        if slot != slots.first { Separator() }
                    }
            }
        }
        .offlineBannerPhase(isOffline: isOffline, phase: $offline, clock: clock)
        .koboAnimation(.present, value: slots)
    }

    @ViewBuilder private func slotView(_ slot: BannerSlot<Item.ID>) -> some View {
        switch slot {
        case .offline:
            OfflineBanner(isBackOnline: offline.presence == .backOnline)
                .transition(OfflineBannerMotion.transition(reduceMotion: reduceMotion))
        case .item(let id):
            if let item = items.first(where: { $0.id == id }) {
                banner(item).transition(Motion.fade(reduceMotion: reduceMotion))
            }
        }
    }

    private var visibleSlots: [BannerSlot<Item.ID>] {
        var entries = items.map { BannerEntry(id: BannerSlot.item($0.id), priority: $0.priority) }
        if offline.presence != .hidden {
            entries.append(BannerEntry(id: .offline, priority: offlinePriority))
        }
        return BannerOrdering.arrange(entries, maxVisible: maxVisible)
    }
}

/// One slot of the stack: the built-in offline banner or one of the app's banners.
enum BannerSlot<ID: Hashable>: Hashable, Identifiable {
    case offline
    case item(ID)

    var id: Self { self }
}

/// The banner type of a stack that shows only the offline banner.
nonisolated public enum NoBanner: StackableBanner {
    public var id: Never { switch self {} }
    public var priority: BannerPriority { switch self {} }
}

extension BannerStack where Item == NoBanner, Banner == EmptyView {
    /// A stack that shows only the offline banner.
    public init(isOffline: Bool, clock: any Clock<Duration> = ContinuousClock()) {
        self.init([], isOffline: isOffline, clock: clock, banner: Self.noBannerView)
    }

    /// Generic so the compiler does not flag the body as unreachable for an uninhabited `NoBanner`.
    private static func noBannerView<Value>(_: Value) -> EmptyView { EmptyView() }
}

extension View {
    /// Pins a `BannerStack` above this view's content (in the top safe-area inset), so the page moves down as banners
    /// open and up as they close.
    public func bannerStack<Item: StackableBanner, Banner: View>(
        _ items: [Item],
        isOffline: Bool = false,
        offlinePriority: BannerPriority = .high,
        maxVisible: Int = 2,
        clock: any Clock<Duration> = ContinuousClock(),
        @ViewBuilder banner: @escaping (Item) -> Banner
    ) -> some View {
        safeAreaInset(edge: .top, spacing: 0) {
            BannerStack(
                items,
                isOffline: isOffline,
                offlinePriority: offlinePriority,
                maxVisible: maxVisible,
                clock: clock,
                banner: banner
            )
        }
    }

    /// Pins the offline banner alone above this view's content.
    public func offlineBanner(isOffline: Bool, clock: any Clock<Duration> = ContinuousClock()) -> some View {
        safeAreaInset(edge: .top, spacing: 0) { BannerStack(isOffline: isOffline, clock: clock) }
    }
}
