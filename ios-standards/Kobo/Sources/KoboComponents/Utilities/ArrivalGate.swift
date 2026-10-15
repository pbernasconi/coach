import Foundation

/// How often an `.onArrival` action runs.
nonisolated public enum ArrivalFrequency: Sendable, Equatable, CaseIterable {
    /// After every arrival: the first push or present, and again after a pop back to the page.
    case everyArrival
    /// Only after the first arrival of this view's identity.
    case once
}

/// When an arrival action runs (`onArrival`), apart from SwiftUI and UIKit so it can be tested. SwiftUI's appear arms
/// the gate; UIKit's appearance says the page is on screen with no transition left; a hold (`isArrivalHeld`) says the
/// presentation around it still moves. The action runs once the gate is armed, on screen and not held; then the gate
/// waits for the next appear (or, with `.once`, never runs again).
nonisolated struct ArrivalGate: Equatable {
    let frequency: ArrivalFrequency
    private(set) var isArmed = false
    private(set) var isOnScreen = false
    private(set) var isHeld = false
    private(set) var hasFired = false

    init(frequency: ArrivalFrequency = .everyArrival) {
        self.frequency = frequency
    }

    /// SwiftUI added the view, with the presentation's hold at that moment. True when the action runs now: the page
    /// already shows (content that arrived after a read).
    mutating func viewAppeared(held: Bool = false) -> Bool {
        isArmed = true
        isHeld = held
        return fire()
    }

    /// The presentation around the view started or ended its own motion. True when the action runs now.
    mutating func holdChanged(_ held: Bool) -> Bool {
        isHeld = held
        return fire()
    }

    /// SwiftUI removed the view: a later UIKit appearance (a cover that closes over the page) runs nothing.
    mutating func viewDisappeared() {
        isArmed = false
    }

    /// UIKit ended the transition that shows the page. True when the action runs now.
    mutating func pageAppeared() -> Bool {
        isOnScreen = true
        return fire()
    }

    /// UIKit starts a transition that hides the page (a push over it, a cover over it).
    mutating func pageWillDisappear() {
        isOnScreen = false
    }

    private mutating func fire() -> Bool {
        guard isArmed, isOnScreen, !isHeld else { return false }
        isArmed = false
        if frequency == .once && hasFired { return false }
        hasFired = true
        return true
    }
}
