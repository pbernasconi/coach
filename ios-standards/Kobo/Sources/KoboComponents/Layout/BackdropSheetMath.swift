import Foundation

/// The three heights of a `BackdropSheet`.
nonisolated public enum BackdropSheetDetent: String, CaseIterable, Sendable {
    /// Only the top of the sheet shows; the backdrop fills the screen.
    case collapsed
    /// The sheet's top at about two fifths of the screen.
    case medium
    /// The sheet fills the screen under the bar, and its content scrolls.
    case expanded
}

/// Where a `BackdropSheet`'s top sits for each detent, and where a drag comes to rest. The sheet is one scroll view: a
/// clear space as tall as `collapsedTop`, then the sheet. Scroll offset 0 is the collapsed sheet, and the sheet's top
/// is `collapsedTop - offset`. Past the expanded offset the sheet's own content scrolls. All values are points, with
/// the scroll view's top at 0.
nonisolated public struct BackdropSheetMath: Equatable, Sendable {
    /// A flick at least this far past the resting place moves on to the next detent that way.
    public static let flick: Double = 24
    /// A fling this fast (points per second) may skip a detent, as with Apple's sheets; slower ones move one step.
    public static let skipSpeed: Double = 2000

    public let collapsedTop: Double
    public let mediumTop: Double
    public let expandedTop: Double

    /// - Parameters:
    ///   - height: the scroll view's height.
    ///   - expandedTop: the sheet's top when expanded (0: the scroll view's top).
    ///   - mediumFraction: the medium sheet's top, as a fraction of `fullHeight`, measured from `fullTop`.
    ///   - peek: how much of the collapsed sheet shows above the bottom edge.
    ///   - fullTop: where the screen's top is in scroll view points (negative when the scroll view starts under a bar).
    public init(
        height: Double,
        expandedTop: Double = 0,
        mediumFraction: Double = 0.42,
        peek: Double = 104,
        fullTop: Double = 0
    ) {
        let fullHeight = height - fullTop
        collapsedTop = max(expandedTop, height - peek)
        mediumTop = min(max(fullTop + fullHeight * mediumFraction, expandedTop), collapsedTop)
        self.expandedTop = expandedTop
    }

    /// The sheet's top at a detent.
    public func top(_ detent: BackdropSheetDetent) -> Double {
        switch detent {
        case .collapsed: collapsedTop
        case .medium: mediumTop
        case .expanded: expandedTop
        }
    }

    /// The scroll offset that puts the sheet at a detent.
    public func offset(_ detent: BackdropSheetDetent) -> Double {
        collapsedTop - top(detent)
    }

    /// The sheet's top at a scroll offset.
    public func sheetTop(offset: Double) -> Double {
        collapsedTop - offset
    }

    /// Where a drag that ends at `offset`, and would coast to `projected`, comes to rest. Inside the sheet's range it
    /// snaps to a detent: a slow release to the nearest one; a flick to the next one that way, or further when it is
    /// faster than `skipSpeed`. Once the sheet is up, the content coasts freely but stops at its top: a flick down
    /// never pulls the sheet down.
    public func target(from offset: Double, projected: Double, speed: Double = 0) -> Double {
        let expanded = self.offset(.expanded)
        if offset >= expanded - 0.5 {
            return max(projected, expanded)
        }
        let stops = BackdropSheetDetent.allCases.map { self.offset($0) }
        let travel = projected - offset
        let ahead = stops.filter { stop in
            if travel > Self.flick { return stop > offset + 0.5 }
            if travel < -Self.flick { return stop < offset - 0.5 }
            return true
        }
        guard !ahead.isEmpty else { return stops.min { abs($0 - projected) < abs($1 - projected) } ?? expanded }
        let isFlick = abs(travel) > Self.flick
        let aim = isFlick && abs(speed) < Self.skipSpeed ? offset : projected
        return ahead.min { abs($0 - aim) < abs($1 - aim) } ?? expanded
    }

    /// The detent at a resting offset: the nearest one, `expanded` once the content has scrolled.
    public func detent(at offset: Double) -> BackdropSheetDetent {
        if offset >= self.offset(.expanded) - 0.5 { return .expanded }
        return BackdropSheetDetent.allCases.min { abs(self.offset($0) - offset) < abs(self.offset($1) - offset) }
            ?? .medium
    }

    /// 0 with the sheet at medium or lower, 1 with it fully up.
    public func expansion(offset: Double) -> Double {
        Self.unit(offset, from: self.offset(.medium), to: self.offset(.expanded))
    }

    /// 0 with the sheet at medium or higher, 1 with it fully down.
    public func collapse(offset: Double) -> Double {
        Self.unit(offset, from: self.offset(.medium), to: self.offset(.collapsed))
    }

    /// How far `value` has gone from `from` to `to`, clamped to 0...1.
    public static func unit(_ value: Double, from: Double, to: Double) -> Double {
        guard from != to else { return value == to ? 1 : 0 }
        return min(max((value - from) / (to - from), 0), 1)
    }
}
