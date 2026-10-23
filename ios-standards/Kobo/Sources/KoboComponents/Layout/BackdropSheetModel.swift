import Observation
import SwiftUI

/// Where a `BackdropSheet` is now, for the controls over it. It changes every frame of a drag.
nonisolated public struct BackdropSheetState: Equatable, Sendable {
    /// The sheet's top edge, in screen points from the top.
    public var sheetTop: CGFloat
    /// 0 at medium or lower, 1 with the sheet fully up.
    public var expansion: Double
    /// 0 at medium or higher, 1 with the sheet fully down.
    public var collapse: Double
    /// The detent the sheet rests at; nil while it moves.
    public var resting: BackdropSheetDetent?
    /// The screen's size and its safe area at the top (the bar's bottom edge).
    public var size: CGSize
    public var topInset: CGFloat
}

/// What the backdrop needs from a `BackdropSheet`: where each detent puts the sheet's top, and where the sheet is
/// headed. It changes only when a drag is let go and when the sheet comes to rest, never every frame, so a map behind
/// the sheet can move its camera as the sheet starts to settle, in step with it.
nonisolated public struct BackdropSheetRest: Equatable, Sendable {
    public var size: CGSize
    public var topInset: CGFloat
    /// The detent the sheet rests at, or is settling to; nil while a finger holds it.
    public var detent: BackdropSheetDetent?
    var tops: [BackdropSheetDetent: CGFloat]

    /// The sheet's top at a detent.
    public func top(_ detent: BackdropSheetDetent) -> CGFloat { tops[detent] ?? size.height }
}

/// The screen a `BackdropSheet` lays out in.
nonisolated struct BackdropSheetFrame: Equatable, Sendable {
    var size: CGSize = .zero
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
}

/// A `BackdropSheet`'s live position. The scroll view writes `offset` every frame; only the views that read it (the
/// controls over the map, the map's clip) redraw, never the sheet's content or the map itself.
@MainActor @Observable
final class BackdropSheetModel {
    var frame = BackdropSheetFrame()
    var mediumFraction = 0.42
    var peek: CGFloat = 104
    /// The scroll offset: 0 is the collapsed sheet.
    var offset: CGFloat = 0
    /// Set once the scroll view has put the sheet at its first detent; nothing is drawn before.
    var isPlaced = false
    /// The detent the sheet rests at, or settles to after a release; nil while a finger holds it.
    var heading: BackdropSheetDetent?
    /// The detent it rests at; nil while it moves.
    var resting: BackdropSheetDetent?
    /// Moves the sheet one detent up (+1) or down (-1); VoiceOver's adjustable action on the grabber.
    @ObservationIgnored var step: (Int) -> Void = { _ in }

    var math: BackdropSheetMath {
        BackdropSheetMath(
            height: Double(frame.size.height),
            expandedTop: Double(frame.topInset),
            mediumFraction: mediumFraction,
            peek: Double(peek)
        )
    }

    var state: BackdropSheetState {
        let math = math
        let value = Double(offset)
        return BackdropSheetState(
            sheetTop: CGFloat(math.sheetTop(offset: value)),
            expansion: math.expansion(offset: value),
            collapse: math.collapse(offset: value),
            resting: resting,
            size: frame.size,
            topInset: frame.topInset
        )
    }

    var rest: BackdropSheetRest {
        let math = math
        return BackdropSheetRest(
            size: frame.size,
            topInset: frame.topInset,
            detent: heading,
            tops: Dictionary(uniqueKeysWithValues: BackdropSheetDetent.allCases.map { ($0, CGFloat(math.top($0))) })
        )
    }
}
