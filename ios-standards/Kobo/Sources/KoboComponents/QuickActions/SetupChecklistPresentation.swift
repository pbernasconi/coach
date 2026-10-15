import Foundation

/// When a change of a `SetupChecklistCard` (its steps, the `Value`) shows. The first value shows at once, with no
/// motion. A later change shows only on a page that has settled (the pop back from the flow that finished a step has
/// ended), and then it animates; while the page moves or is covered, the card keeps `shown` and holds the change as
/// `pending`.
nonisolated struct SetupChecklistPresentation<Value: Equatable>: Equatable {
    private(set) var shown: Value?
    private(set) var pending: Value?
    private(set) var isSettled = false

    /// The outcome of an event: the next presentation, and whether the change shows now with motion.
    struct Change: Equatable {
        let next: SetupChecklistPresentation
        let animates: Bool
    }

    /// A new value from the app.
    func received(_ steps: Value) -> Change {
        var next = self
        next.pending = nil
        guard let shown else {
            next.shown = steps
            return Change(next: next, animates: false)
        }
        if steps == shown { return Change(next: next, animates: false) }
        guard isSettled else {
            next.pending = steps
            return Change(next: next, animates: false)
        }
        next.shown = steps
        return Change(next: next, animates: true)
    }

    /// The page settled. A held change shows now and animates.
    func pageSettled() -> Change {
        var next = self
        next.isSettled = true
        guard let pending else { return Change(next: next, animates: false) }
        next.shown = pending
        next.pending = nil
        return Change(next: next, animates: true)
    }

    /// The page started to move or was covered (a push): a change waits until it settles again.
    func pageLeft() -> SetupChecklistPresentation {
        var next = self
        next.isSettled = false
        return next
    }
}
