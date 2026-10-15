import Foundation

/// The submit of one flow step, as a small state machine: `idle` while the person fills the step in, `loading` while
/// the submit runs, `failed` with the reviewed reason when it did not go through, and `ready` once it did and the flow
/// may move on. Use it instead of `isSubmitting`, `error` and `didSubmit` side by side.
///
///     @State private var submit = LoadableStepState()
///     submit.send(.submit)            // false on a second tap while loading: nothing runs twice
///     submit.send(.fail(message: "Couldn't read the notes."))
///     submit.send(.edit)              // the banner clears when the input changes
///
/// `failureCount` rises on each failure, so a footer plays the error haptic once per failure, also when a retry fails
/// again with the same reason.
nonisolated public struct LoadableStepState: Equatable, Sendable {
    /// The phases, which exclude each other.
    public enum Phase: Equatable, Sendable {
        case idle
        case loading
        case failed(message: String)
        case ready
    }

    /// What happened to the step.
    public enum Event: Equatable, Sendable {
        /// The primary action was tapped (or the keyboard submitted).
        case submit
        /// The submit went through.
        case succeed
        /// The submit failed; `message` is reviewed copy, never a raw error.
        case fail(message: String)
        /// The submit was cancelled (the step went away). A cancellation is never shown as a failure.
        case cancel
        /// The person changed the step's input: a failure banner clears.
        case edit
        /// The step shows again (back from a later step): it starts over.
        case reset
    }

    public private(set) var phase: Phase
    /// How many submits have failed since the state was made.
    public private(set) var failureCount: Int

    public init(_ phase: Phase = .idle) {
        self.phase = phase
        self.failureCount = 0
    }

    /// Applies `event` and reports whether it changed anything. A submit while loading or ready, a result with no
    /// submit running, and an edit while loading are ignored.
    @discardableResult
    public mutating func send(_ event: Event) -> Bool {
        guard let next = Self.next(after: phase, on: event) else { return false }
        if case .fail = event { failureCount += 1 }
        phase = next
        return true
    }

    /// The phase `event` leads to from `phase`, or `nil` when the event does not apply.
    static func next(after phase: Phase, on event: Event) -> Phase? {
        switch (phase, event) {
        case (.idle, .submit), (.failed, .submit): .loading
        case (.loading, .succeed): .ready
        case (.loading, .fail(let message)): .failed(message: message)
        case (.loading, .cancel), (.failed, .edit): .idle
        case (.failed, .reset), (.ready, .reset), (.ready, .edit): .idle
        default: nil
        }
    }

    /// The submit is running: the primary action shows a spinner and ignores taps.
    public var isLoading: Bool { phase == .loading }

    /// The step can be submitted now (the caller still decides whether its input is complete).
    public var canSubmit: Bool { phase == .idle || failureMessage != nil }

    /// The step went through.
    public var isReady: Bool { phase == .ready }

    /// The reason of the last failure while it shows, else `nil`.
    public var failureMessage: String? {
        if case .failed(let message) = phase { return message }
        return nil
    }

    /// True when a change of `failureCount` from `old` to `new` should play the error haptic: only a rising count, so
    /// a screen that comes back stays quiet.
    public static func playsFailureFeedback(old: Int, new: Int) -> Bool {
        new > old
    }
}
