import Foundation

/// How urgent a banner in a `BannerStack` is. Higher priorities sit higher and win the visible slots.
nonisolated public enum BannerPriority: Int, Comparable, Sendable, CaseIterable {
    /// A suggestion the person can ignore ("A new version is available").
    case low
    /// Most notices.
    case normal
    /// The connection or the account needs attention (the offline banner by default).
    case high
    /// Something is broken for everyone right now (maintenance, an outage).
    case critical

    public static func < (lhs: BannerPriority, rhs: BannerPriority) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// A banner a `BannerStack` can queue: its identity and its priority. Apps usually make one enum of their banners.
///
///     enum AppBanner: StackableBanner {
///         case update, maintenance(String)
///         var id: String { … }
///         var priority: BannerPriority { self == .update ? .low : .critical }
///     }
public protocol StackableBanner: Identifiable {
    var priority: BannerPriority { get }
}

/// The pure ordering rule of a `BannerStack`.
nonisolated enum BannerOrdering {
    /// The ids to show, top to bottom: highest priority first, ties in the order given, at most `maxVisible`.
    /// The rest wait and move up when a shown banner leaves.
    static func arrange<ID: Hashable>(_ entries: [BannerEntry<ID>], maxVisible: Int) -> [ID] {
        let ordered = entries.enumerated().sorted { lhs, rhs in
            if lhs.element.priority != rhs.element.priority { return lhs.element.priority > rhs.element.priority }
            return lhs.offset < rhs.offset
        }
        return ordered.prefix(max(maxVisible, 0)).map(\.element.id)
    }

    /// How many banners wait behind the shown ones.
    static func waitingCount<ID: Hashable>(_ entries: [BannerEntry<ID>], maxVisible: Int) -> Int {
        max(entries.count - max(maxVisible, 0), 0)
    }
}

/// One banner in the queue: its id and priority.
nonisolated struct BannerEntry<ID: Hashable>: Equatable {
    let id: ID
    let priority: BannerPriority
}
