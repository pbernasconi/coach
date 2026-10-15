import Foundation

/// When the press veil of a highlighted row or tile shows. A quick tap lifts the finger before the veil has faded in,
/// so the fade out waits for the fade in: every tap shows the whole veil once, and nothing flickers. Ported from
/// an earlier app's `PressFillSchedule`; pure, so it is tested without rendering.
nonisolated struct PressFillSchedule: Equatable, Sendable {
    /// The veil is up, or on its way up.
    private(set) var isShown = false
    /// The finger is down.
    private var isHeld = false
    /// The fade in of the current press still runs.
    private var isArriving = false
    /// Counts presses, so the end of an old fade in never ends a newer press.
    private(set) var press = 0

    /// The finger went down: the veil fades in.
    mutating func pressIn() {
        press += 1
        isShown = true
        isHeld = true
        isArriving = true
    }

    /// The finger lifted. The veil fades out now, or when its fade in ends.
    mutating func release() {
        isHeld = false
        if !isArriving { isShown = false }
    }

    /// The fade in of `finished` ended. A press that was already released fades out now.
    mutating func arrived(press finished: Int) {
        guard finished == press else { return }
        isArriving = false
        if !isHeld { isShown = false }
    }
}
