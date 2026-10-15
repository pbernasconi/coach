import Foundation
import Observation

/// The toast slot of a window: holds the one toast on screen and dismisses it after its duration.
///
/// A new toast replaces the current one (and restarts the timer): toasts do not queue, because a confirmation that
/// waits behind another one arrives after its moment has passed. A finger on the toast stops its timer (`hold(_:)`),
/// and the release resumes it with the time that was left (`release(_:)`). While VoiceOver runs, a toast with an
/// action stays until it is dismissed or replaced (`Toast.lifetime(screenReaderRunning:)`). Time comes from the
/// injected clock, so tests drive it with a manual clock. Own one per window and attach it with `.toastHost(_:)`:
///
///     @State private var toasts = ToastCenter()
///     var body: some View { content.toastHost(toasts) }
@Observable
@MainActor
public final class ToastCenter {
    /// The toast on screen, if any.
    public private(set) var current: Toast?
    /// Whether a screen reader runs. `.toastHost(_:)` keeps it current from the environment; tests set it.
    @ObservationIgnored public var isScreenReaderRunning = false

    private let clock: any Clock<Duration>
    @ObservationIgnored private var timer: Task<Void, Never>?
    /// The time left on the current toast; `nil` for a toast that stays until it is dismissed.
    @ObservationIgnored private var countdown: ToastTimer?
    /// Reads the time the timer has run since its last start or release.
    @ObservationIgnored private var ran: () -> Duration = { .zero }

    public init(clock: any Clock<Duration> = ContinuousClock()) {
        self.clock = clock
    }

    /// Shows `toast`, replacing whatever is on screen, and schedules its dismissal.
    public func show(_ toast: Toast) {
        stopTimer()
        current = toast
        countdown = toast.lifetime(screenReaderRunning: isScreenReaderRunning).map { ToastTimer(lifetime: $0) }
        startTimer(for: toast.id)
    }

    /// A finger is on the toast with `id`: its timer stops until `release(_:)`. A newer toast keeps its own timer.
    public func hold(_ id: Toast.ID) {
        guard current?.id == id, var held = countdown, !held.isHeld else { return }
        held.hold(afterRunning: ran())
        countdown = held
        stopTimer()
    }

    /// The finger left the toast with `id`: its timer runs again with the time that was left, at least one second.
    public func release(_ id: Toast.ID) {
        guard current?.id == id, var released = countdown, released.isHeld else { return }
        released.release()
        countdown = released
        startTimer(for: id)
    }

    /// Dismisses the toast with `id`, if it is still the one on screen.
    public func dismiss(_ id: Toast.ID) {
        guard current?.id == id else { return }
        stopTimer()
        countdown = nil
        current = nil
    }

    /// Dismisses whatever is on screen.
    public func dismissCurrent() {
        guard let current else { return }
        dismiss(current.id)
    }

    /// Runs the toast's action and dismisses it.
    public func performAction(of toast: Toast) {
        dismiss(toast.id)
        toast.action?.perform()
    }

    private func startTimer(for id: Toast.ID) {
        guard let remaining = countdown?.remaining else { return }
        ran = Self.stopwatch(clock)
        let clock = clock
        timer = Task { [weak self] in
            do {
                try await clock.sleep(for: remaining)
            } catch {
                return  // Cancelled: a newer toast, a hold or a dismiss took over.
            }
            self?.expire(id)
        }
    }

    private func stopTimer() {
        timer?.cancel()
        timer = nil
    }

    private func expire(_ id: Toast.ID) {
        guard current?.id == id else { return }
        timer = nil
        countdown = nil
        current = nil
    }

    /// Starts a stopwatch on `clock`: the closure reads the time since the start.
    private static func stopwatch<C: Clock<Duration>>(_ clock: C) -> () -> Duration {
        let start = clock.now
        return { start.duration(to: clock.now) }
    }
}
